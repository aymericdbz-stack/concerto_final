import { NextResponse } from "next/server";
import Replicate from "replicate";
import {
  DEFAULT_PROMPT,
  DEFAULT_SUPABASE_OUTPUT_BUCKET,
  DEFAULT_REPLICATE_MODEL,
} from "@/lib/constants";
import { createSupabaseRouteClient, createSupabaseServiceRoleClient } from "@/lib/supabase-server";
import { ensureBucketExists } from "@/lib/supabase-storage";
import type { Database } from "@/types/supabase";

export const runtime = "nodejs";

const REQUIRED_ENV_VARS = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "REPLICATE_API_TOKEN",
] as const;

type EnvKey = (typeof REQUIRED_ENV_VARS)[number];
type ReplicateModelName = `${string}/${string}` | `${string}/${string}:${string}`;

type ReplicateResponse = unknown;
type ProjectRow = Database["public"]["Tables"]["projects"]["Row"];

const MIME_EXTENSION_MAP: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heic",
};

const URL_PREFIXES = ["http://", "https://", "data:"] as const;

function assertEnvVars(env: NodeJS.ProcessEnv): asserts env is NodeJS.ProcessEnv & Record<EnvKey, string> {
  const missing = REQUIRED_ENV_VARS.filter((key) => !env[key]?.length);

  if (missing.length > 0) {
    throw new Error(`Variables d'environnement manquantes: ${missing.join(", ")}`);
  }
}

function assertReplicateModel(model: unknown): asserts model is ReplicateModelName {
  if (typeof model !== "string" || !/^[^/]+\/[^/:]+(?::[^/:]+)?$/.test(model)) {
    throw new Error(
      `REPLICATE_MODEL invalide: "${model ?? "undefined"}". Utilisez le format owner/model ou owner/model:version.`
    );
  }
}

function resolveExtension(fileName: string, mimeType?: string): string {
  if (mimeType && MIME_EXTENSION_MAP[mimeType]) {
    return MIME_EXTENSION_MAP[mimeType];
  }

  const [, extension] = /\.([a-zA-Z0-9]+)$/.exec(fileName ?? "") ?? [];
  return extension?.toLowerCase() ?? "png";
}

function isUrlLikeString(candidate: string | null | undefined): candidate is string {
  if (!candidate) {
    return false;
  }

  return URL_PREFIXES.some((prefix) => candidate.startsWith(prefix));
}

function toUrlString(value: unknown, visited: WeakSet<object>): string | null {
  if (!value) {
    return null;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    return isUrlLikeString(trimmed) ? trimmed : null;
  }

  if (value instanceof URL) {
    return value.toString();
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const result = toUrlString(item, visited);
      if (result) {
        return result;
      }
    }
    return null;
  }

  if (typeof value === "object") {
    if (visited.has(value)) {
      return null;
    }
    visited.add(value);

    if ("output" in value) {
      const maybeNested = toUrlString((value as { output?: unknown }).output, visited);
      if (maybeNested) {
        return maybeNested;
      }
    }

    if ("url" in value && typeof (value as { url?: () => unknown }).url === "function") {
      try {
        const urlResult = (value as { url: () => unknown }).url();
        const resolved = toUrlString(urlResult, visited);
        if (resolved) {
          return resolved;
        }
      } catch (error) {
        console.warn("Impossible de lire la méthode url() sur la sortie Replicate", error);
      }
    }

    if (typeof (value as { toString?: () => string }).toString === "function") {
      try {
        const stringified = (value as { toString: () => string }).toString();
        if (isUrlLikeString(stringified)) {
          return stringified;
        }
      } catch (error) {
        console.warn("Conversion en chaîne échouée pour la sortie Replicate", error);
      }
    }
  }

  return null;
}

function normaliseReplicateOutput(output: ReplicateResponse): string | null {
  return toUrlString(output, new WeakSet());
}

export async function POST(request: Request) {
  let projectId: string | null = null;
  let adminSupabase: ReturnType<typeof createSupabaseServiceRoleClient> | null = null;
  let markedProcessing = false;

  try {
    const supabaseAuth = createSupabaseRouteClient();
    const {
      data: { session },
      error: sessionError,
    } = await supabaseAuth.auth.getSession();

    if (sessionError) {
      throw sessionError;
    }

    if (!session) {
      return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
    }

    assertEnvVars(process.env);

    let payload: unknown;
    try {
      payload = await request.json();
    } catch {
      return NextResponse.json({ error: "Corps de requête invalide." }, { status: 400 });
    }

    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      return NextResponse.json({ error: "Corps de requête invalide." }, { status: 400 });
    }

    const { projectId: projectIdCandidate } = payload as { projectId?: unknown };

    if (!projectIdCandidate || typeof projectIdCandidate !== "string") {
      return NextResponse.json({ error: "projectId manquant." }, { status: 400 });
    }

    projectId = projectIdCandidate;

    adminSupabase = createSupabaseServiceRoleClient();

    const { data: project, error: fetchError } = await adminSupabase
      .from("projects")
      .select("*")
      .eq("id", projectId)
      .single<ProjectRow>();

    if (fetchError || !project) {
      return NextResponse.json({ error: "Projet introuvable." }, { status: 404 });
    }

    if (project.user_id !== session.user.id) {
      return NextResponse.json({ error: "Accès interdit à ce projet." }, { status: 403 });
    }

    if (project.payment_status !== "paid") {
      return NextResponse.json(
        { error: "Paiement requis avant la génération." },
        { status: 402 }
      );
    }

    if (project.status === "processing") {
      return NextResponse.json(
        { error: "Une génération est déjà en cours pour ce projet." },
        { status: 409 }
      );
    }

    if (project.status === "completed" && project.output_image_url) {
      return NextResponse.json({ imageUrl: project.output_image_url, project });
    }

    if (!project.input_image_url) {
      throw new Error("Aucune image source associée à ce projet.");
    }

    const replicateToken = process.env.REPLICATE_API_TOKEN;
    const replicateModelCandidate = process.env.REPLICATE_MODEL ?? DEFAULT_REPLICATE_MODEL;
    if (!process.env.REPLICATE_MODEL) {
      console.warn(
        `[generate] REPLICATE_MODEL manquant, utilisation du modèle par défaut "${replicateModelCandidate}".`
      );
    }
    assertReplicateModel(replicateModelCandidate);
    const replicateModel: ReplicateModelName = replicateModelCandidate;

    const { error: statusUpdateError } = await adminSupabase
      .from("projects")
      .update({ status: "processing" })
      .eq("id", project.id);

    if (statusUpdateError) {
      throw new Error(
        `Impossible de mettre à jour le statut du projet avant la génération: ${statusUpdateError.message}`
      );
    }

    markedProcessing = true;

    const replicate = new Replicate({
      auth: replicateToken,
      userAgent: "concerto-image-editor/1.1",
      useFileOutput: false,
    });

    const prompt = project.prompt?.trim().length ? project.prompt : DEFAULT_PROMPT;

    const replicateResponse = (await replicate.run(replicateModel, {
      input: {
        prompt,
        image_input: [project.input_image_url],
        output_format: "png",
      },
    })) as ReplicateResponse;

    const outputUrl = normaliseReplicateOutput(replicateResponse);

    if (!outputUrl) {
      throw new Error("La réponse de Replicate ne contient pas d'URL valide.");
    }

    const generatedResponse = await fetch(outputUrl);
    if (!generatedResponse.ok) {
      throw new Error("Impossible de télécharger l'image générée par Replicate.");
    }

    const outputBucket = process.env.SUPABASE_OUTPUT_BUCKET ?? DEFAULT_SUPABASE_OUTPUT_BUCKET;
    if (!process.env.SUPABASE_OUTPUT_BUCKET) {
      console.warn(
        `[generate] SUPABASE_OUTPUT_BUCKET manquant, utilisation du bucket par défaut "${outputBucket}".`
      );
    }
    await ensureBucketExists(adminSupabase, outputBucket);
    const outputArrayBuffer = await generatedResponse.arrayBuffer();
    const outputContentType = generatedResponse.headers.get("content-type") ?? "image/png";
    const outputExtension = resolveExtension(
      `output.${outputContentType.split("/")[1] ?? "png"}`,
      outputContentType
    );
    const outputPath = `outputs/${crypto.randomUUID()}.${outputExtension}`;

    const { error: uploadOutputError } = await adminSupabase.storage
      .from(outputBucket)
      .upload(outputPath, Buffer.from(outputArrayBuffer), {
        cacheControl: "3600",
        contentType: outputContentType,
        upsert: false,
      });

    if (uploadOutputError) {
      throw new Error(
        `Échec de l'upload de l'image générée dans le bucket ${outputBucket}: ${uploadOutputError.message}`
      );
    }

    const {
      data: { publicUrl: outputPublicUrl },
    } = adminSupabase.storage.from(outputBucket).getPublicUrl(outputPath);

    if (!outputPublicUrl) {
      throw new Error("Impossible de générer l'URL publique de l'image générée.");
    }

    const { data: updatedProject, error: updateError } = await adminSupabase
      .from("projects")
      .update({
        status: "completed",
        output_image_url: outputPublicUrl,
      })
      .eq("id", project.id)
      .select()
      .single<ProjectRow>();

    if (updateError) {
      throw new Error(`Échec de la mise à jour du projet: ${updateError.message}`);
    }

    return NextResponse.json({ imageUrl: outputPublicUrl, project: updatedProject });
  } catch (error) {
    console.error("[generate] Erreur lors de la génération:", error);

    if (projectId && adminSupabase && markedProcessing) {
      const { error: rollbackError } = await adminSupabase
        .from("projects")
        .update({ status: "pending" })
        .eq("id", projectId);

      if (rollbackError) {
        console.error("[generate] Échec du rollback du statut du projet:", rollbackError.message);
      }
    }

    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ error: "Erreur interne inattendue." }, { status: 500 });
  }
}

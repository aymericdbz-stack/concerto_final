import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import Replicate from "replicate";

export const runtime = "nodejs";

const REQUIRED_ENV_VARS = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_INPUT_BUCKET",
  "SUPABASE_OUTPUT_BUCKET",
  "REPLICATE_API_TOKEN",
  "REPLICATE_MODEL",
] as const;

type EnvKey = (typeof REQUIRED_ENV_VARS)[number];

type ReplicateResponse = unknown;

const MIME_EXTENSION_MAP: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heic",
};

const URL_PREFIXES = ["http://", "https://", "data:"] as const;

const DEFAULT_PROMPT =
  "Transform the uploaded portrait so the person performs centre stage at a grand classical music concert. They play a classical instrument such as a grand piano, violin or cello, surrounded by a full symphony orchestra and conductor in an opulent concert hall. Keep facial likeness, formal black-tie attire, warm golden spotlights and polished wood stage. Avoid rock, pop, electric guitars, microphones or modern festival lighting.";

function assertEnvVars(env: NodeJS.ProcessEnv): asserts env is NodeJS.ProcessEnv & Record<EnvKey, string> {
  const missing = REQUIRED_ENV_VARS.filter((key) => !env[key]?.length);

  if (missing.length > 0) {
    throw new Error(`Variables d'environnement manquantes: ${missing.join(", ")}`);
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
  try {
    assertEnvVars(process.env);

    const formData = await request.formData();
    const prompt = DEFAULT_PROMPT;
    const file = formData.get("image");

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: "Aucun fichier image reçu." },
        { status: 400 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const inputBucket = process.env.SUPABASE_INPUT_BUCKET;
    const outputBucket = process.env.SUPABASE_OUTPUT_BUCKET;
    const replicateToken = process.env.REPLICATE_API_TOKEN;
    const replicateModel = process.env.REPLICATE_MODEL;

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const replicate = new Replicate({
      auth: replicateToken,
      userAgent: "concerto-image-editor/1.0",
      useFileOutput: false,
    });

    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const inputExtension = resolveExtension(file.name, file.type);
    const inputPath = `inputs/${crypto.randomUUID()}.${inputExtension}`;

    const { error: uploadInputError } = await supabase.storage
      .from(inputBucket)
      .upload(inputPath, fileBuffer, {
        cacheControl: "3600",
        contentType: file.type || "application/octet-stream",
        upsert: false,
      });

    if (uploadInputError) {
      throw new Error(`Échec de l'upload dans le bucket ${inputBucket}: ${uploadInputError.message}`);
    }

    const {
      data: { publicUrl: inputPublicUrl },
    } = supabase.storage.from(inputBucket).getPublicUrl(inputPath);

    if (!inputPublicUrl) {
      throw new Error("Impossible de générer l'URL publique de l'image source.");
    }

    const replicateResponse = (await replicate.run(replicateModel, {
      input: {
        prompt,
        image_input: [inputPublicUrl],
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

    const outputArrayBuffer = await generatedResponse.arrayBuffer();
    const outputContentType = generatedResponse.headers.get("content-type") ?? "image/png";
    const outputExtension = resolveExtension(`output.${outputContentType.split("/")[1] ?? "png"}`, outputContentType);
    const outputPath = `outputs/${crypto.randomUUID()}.${outputExtension}`;

    const { error: uploadOutputError } = await supabase.storage
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
    } = supabase.storage.from(outputBucket).getPublicUrl(outputPath);

    if (!outputPublicUrl) {
      throw new Error("Impossible de générer l'URL publique de l'image générée.");
    }

    const { error: insertError } = await supabase.from("projects").insert({
      input_image_url: inputPublicUrl,
      output_image_url: outputPublicUrl,
      prompt,
      status: "completed",
    });

    if (insertError) {
      throw new Error(`Échec de l'enregistrement du projet: ${insertError.message}`);
    }

    return NextResponse.json({ imageUrl: outputPublicUrl });
  } catch (error) {
    console.error(error);
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ error: "Erreur interne inattendue." }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import Stripe from "stripe";
import { DEFAULT_PROMPT, DEFAULT_SUPABASE_INPUT_BUCKET } from "@/lib/constants";
import { createSupabaseRouteClient, createSupabaseServiceRoleClient } from "@/lib/supabase-server";
import { ensureBucketExists } from "@/lib/supabase-storage";
import type { Database } from "@/types/supabase";

export const runtime = "nodejs";

const REQUIRED_ENV_VARS = ["STRIPE_SECRET_KEY", "NEXT_PUBLIC_URL"] as const;

const PRICE_UNIT_AMOUNT = 200; // 2.00 EUR in cents
const PRICE_AMOUNT = 2.0;

type EnvKey = (typeof REQUIRED_ENV_VARS)[number];
type ProjectInsert = Database["public"]["Tables"]["projects"]["Insert"];
type ProjectRow = Database["public"]["Tables"]["projects"]["Row"];

const MIME_EXTENSION_MAP: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heic",
};

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

export async function POST(request: Request) {
  let adminSupabase: ReturnType<typeof createSupabaseServiceRoleClient> | null = null;
  let uploadedInputPath: string | null = null;
  let inputBucketName: string | null = null;
  let createdProjectId: string | null = null;

  try {
    assertEnvVars(process.env);

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

    const formData = await request.formData();
    const projectIdCandidate = formData.get("projectId");
    const file = formData.get("image");
    const promptCandidate = formData.get("prompt");

    if (!projectIdCandidate || typeof projectIdCandidate !== "string") {
      return NextResponse.json({ error: "Identifiant de projet manquant." }, { status: 400 });
    }

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "Aucun fichier image reçu." }, { status: 400 });
    }

    const prompt =
      typeof promptCandidate === "string" && promptCandidate.trim().length > 0
        ? promptCandidate.trim()
        : DEFAULT_PROMPT;

    const inputBucket = process.env.SUPABASE_INPUT_BUCKET ?? DEFAULT_SUPABASE_INPUT_BUCKET;
    if (!process.env.SUPABASE_INPUT_BUCKET) {
      console.warn(
        `[create-checkout-session] SUPABASE_INPUT_BUCKET manquant, utilisation du bucket par défaut "${inputBucket}".`
      );
    }
    inputBucketName = inputBucket;
    const originUrl = process.env.NEXT_PUBLIC_URL;

    adminSupabase = createSupabaseServiceRoleClient();
    await ensureBucketExists(adminSupabase, inputBucket);

    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const inputExtension = resolveExtension(file.name, file.type);
    const inputPath = `inputs/${projectIdCandidate}-${Date.now()}.${inputExtension}`;
    uploadedInputPath = inputPath;

    const { error: uploadInputError } = await adminSupabase.storage
      .from(inputBucket)
      .upload(inputPath, fileBuffer, {
        cacheControl: "3600",
        contentType: file.type || "application/octet-stream",
        upsert: false,
      });

    if (uploadInputError) {
      throw new Error(
        `Échec de l'upload de l'image source dans le bucket ${inputBucket}: ${uploadInputError.message}`
      );
    }

    const {
      data: { publicUrl: inputPublicUrl },
    } = adminSupabase.storage.from(inputBucket).getPublicUrl(inputPath);

    if (!inputPublicUrl) {
      throw new Error("Impossible de générer l'URL publique de l'image source.");
    }

    const projectPayload: ProjectInsert = {
      id: projectIdCandidate,
      user_id: session.user.id,
      input_image_url: inputPublicUrl,
      prompt,
      status: "pending",
      payment_status: "pending",
      payment_amount: PRICE_AMOUNT,
    };

    const { data: project, error: insertError } = await adminSupabase
      .from("projects")
      .insert([projectPayload])
      .select()
      .single<ProjectRow>();

    if (insertError) {
      throw new Error(`Échec de la création du projet: ${insertError.message}`);
    }

    createdProjectId = project.id;

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

    const checkoutSession = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_intent_data: {
        metadata: {
          project_id: project.id,
        },
      },
      line_items: [
        {
          price_data: {
            currency: "eur",
            product_data: {
              name: "Génération d'image IA",
            },
            unit_amount: PRICE_UNIT_AMOUNT,
          },
          quantity: 1,
        },
      ],
      metadata: {
        project_id: project.id,
      },
      customer_email: session.user.email ?? undefined,
      success_url: `${originUrl}/dashboard`,
      cancel_url: `${originUrl}/dashboard`,
    });

    if (!checkoutSession.url) {
      throw new Error("Stripe a renvoyé une session sans URL de redirection.");
    }

    const { error: updateError } = await adminSupabase
      .from("projects")
      .update({
        stripe_checkout_session_id: checkoutSession.id,
      })
      .eq("id", project.id);

    if (updateError) {
      throw new Error(`Échec de la mise à jour du projet avec la session Stripe: ${updateError.message}`);
    }

    return NextResponse.json({
      sessionId: checkoutSession.id,
      sessionUrl: checkoutSession.url,
      project,
    });
  } catch (error) {
    console.error("[create-checkout-session] Erreur:", error);

    if (adminSupabase && uploadedInputPath && inputBucketName) {
      const { error: removeError } = await adminSupabase.storage
        .from(inputBucketName)
        .remove([uploadedInputPath]);

      if (removeError) {
        console.error("[create-checkout-session] Échec de la suppression de l'image source:", removeError.message);
      }
    }

    if (adminSupabase && createdProjectId) {
      const { error: deleteError } = await adminSupabase
        .from("projects")
        .delete()
        .eq("id", createdProjectId);

      if (deleteError) {
        console.error("[create-checkout-session] Échec de la suppression du projet:", deleteError.message);
      }
    }

    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ error: "Erreur interne inattendue." }, { status: 500 });
  }
}

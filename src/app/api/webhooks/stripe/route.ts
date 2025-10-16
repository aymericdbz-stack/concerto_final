import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createSupabaseServiceRoleClient } from "@/lib/supabase-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const REQUIRED_ENV_VARS = ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"] as const;

type EnvKey = (typeof REQUIRED_ENV_VARS)[number];

function assertEnvVars(env: NodeJS.ProcessEnv): asserts env is NodeJS.ProcessEnv & Record<EnvKey, string> {
  const missing = REQUIRED_ENV_VARS.filter((key) => !env[key]?.length);

  if (missing.length > 0) {
    throw new Error(`Variables d'environnement Stripe Webhook manquantes: ${missing.join(", ")}`);
  }
}

function toPaymentIntentId(paymentIntent: Stripe.Checkout.Session["payment_intent"]): string | null {
  if (!paymentIntent) {
    return null;
  }

  if (typeof paymentIntent === "string") {
    return paymentIntent;
  }

  return paymentIntent.id ?? null;
}

export async function POST(request: Request) {
  try {
    assertEnvVars(process.env);

    const signature = request.headers.get("stripe-signature");

    if (!signature) {
      return NextResponse.json({ error: "Signature Stripe manquante." }, { status: 400 });
    }

    const rawBody = await request.text();
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(rawBody, signature, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (error) {
      console.error("[stripe-webhook] Signature invalide:", error);
      return NextResponse.json({ error: "Signature Stripe invalide." }, { status: 400 });
    }

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const projectId = session.metadata?.project_id;

      if (!projectId) {
        console.warn("[stripe-webhook] checkout.session.completed sans project_id dans les metadata.");
      } else {
        const adminSupabase = createSupabaseServiceRoleClient();

        const { error: updateError } = await adminSupabase
          .from("projects")
          .update({
            payment_status: "paid",
            stripe_checkout_session_id: session.id,
            stripe_payment_intent_id: toPaymentIntentId(session.payment_intent),
          })
          .eq("id", projectId);

        if (updateError) {
          console.error(
            `[stripe-webhook] Échec de la mise à jour du projet ${projectId}:`,
            updateError.message
          );
        }
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("[stripe-webhook] Erreur inattendue:", error);
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ error: "Erreur interne inattendue." }, { status: 500 });
  }
}

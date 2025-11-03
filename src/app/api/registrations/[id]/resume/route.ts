import { NextResponse } from "next/server";
import Stripe from "stripe";
import { DEFAULT_CURRENCY, MAIN_EVENT } from "@/lib/constants";
import { createSupabaseRouteClient, createSupabaseServiceRoleClient } from "@/lib/supabase-server";
import type { Database } from "@/types/supabase";

export const runtime = "nodejs";

const REQUIRED_ENV_VARS = ["STRIPE_SECRET_KEY", "NEXT_PUBLIC_URL"] as const;

type EnvKey = (typeof REQUIRED_ENV_VARS)[number];
type RegistrationRow = Database["public"]["Tables"]["registrations"]["Row"];

interface RouteContext {
  params: {
    id?: string;
  };
}

function assertEnvVars(env: NodeJS.ProcessEnv): asserts env is NodeJS.ProcessEnv & Record<EnvKey, string> {
  const missing = REQUIRED_ENV_VARS.filter((key) => !env[key]?.length);

  if (missing.length > 0) {
    throw new Error(`Variables d'environnement manquantes: ${missing.join(", ")}`);
  }
}

export async function POST(_request: Request, { params }: RouteContext) {
  try {
    assertEnvVars(process.env);

    const registrationId = params.id?.trim();
    if (!registrationId) {
      return NextResponse.json({ error: "Identifiant d'inscription manquant." }, { status: 400 });
    }

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

    const adminSupabase = createSupabaseServiceRoleClient();

    const { data: registration, error: fetchError } = await adminSupabase
      .from("registrations")
      .select("*")
      .eq("id", registrationId)
      .single<RegistrationRow>();

    if (fetchError) {
      throw new Error(fetchError.message);
    }

    if (!registration || registration.user_id !== session.user.id) {
      return NextResponse.json({ error: "Inscription introuvable." }, { status: 404 });
    }

    if (registration.status === "paid") {
      return NextResponse.json(
        { error: "Cette réservation est déjà confirmée." },
        { status: 400 }
      );
    }

    if (registration.status === "cancelled") {
      return NextResponse.json(
        { error: "Cette réservation a été annulée. Merci de créer une nouvelle participation." },
        { status: 400 }
      );
    }

    const amountNumber = Number(registration.amount ?? 0);

    if (!Number.isFinite(amountNumber) || amountNumber <= 0) {
      return NextResponse.json(
        { error: "Montant invalide pour cette réservation. Merci de contacter le support." },
        { status: 400 }
      );
    }

    const amountInCents = Math.round(amountNumber * 100);
    if (amountInCents < 100) {
      return NextResponse.json(
        { error: "Le montant minimum est de 1 €." },
        { status: 400 }
      );
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const originUrl = process.env.NEXT_PUBLIC_URL;
    const eventDetails = MAIN_EVENT;
    const eventId = registration.event_id ?? eventDetails.id;

    const checkoutSession = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_intent_data: {
        metadata: {
          registration_id: registration.id,
          event_id: eventId,
        },
      },
      line_items: [
        {
          price_data: {
            currency: DEFAULT_CURRENCY.toLowerCase(),
            product_data: {
              name: `Participation — ${eventDetails.title}`,
              description: `${eventDetails.venue} · ${eventDetails.date}`,
            },
            unit_amount: amountInCents,
          },
          quantity: 1,
        },
      ],
      metadata: {
        registration_id: registration.id,
        event_id: eventId,
        participant_email: registration.email,
      },
      customer_email: registration.email ?? undefined,
      success_url: `${originUrl}/dashboard?statut=confirmation&inscription=${registration.id}`,
      cancel_url: `${originUrl}/dashboard?statut=annule&inscription=${registration.id}`,
    });

    if (!checkoutSession.url) {
      throw new Error("Stripe a renvoyé une session sans URL de redirection.");
    }

    const { error: updateError } = await adminSupabase
      .from("registrations")
      .update({
        stripe_checkout_session_id: checkoutSession.id,
        stripe_payment_intent_id: null,
        status: "pending",
      })
      .eq("id", registration.id);

    if (updateError) {
      throw new Error(
        `Échec de la mise à jour du dossier participant avec la session Stripe: ${updateError.message}`
      );
    }

    return NextResponse.json({
      sessionId: checkoutSession.id,
      sessionUrl: checkoutSession.url,
    });
  } catch (error) {
    console.error("[resume-checkout] Erreur:", error);
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ error: "Une erreur inattendue est survenue." }, { status: 500 });
  }
}


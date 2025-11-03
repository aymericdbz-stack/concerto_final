import { NextResponse } from "next/server";
import Stripe from "stripe";
import { DEFAULT_CURRENCY, MAIN_EVENT, MAIN_EVENT_ID } from "@/lib/constants";
import { createSupabaseRouteClient, createSupabaseServiceRoleClient } from "@/lib/supabase-server";
import type { Database } from "@/types/supabase";

export const runtime = "nodejs";

const REQUIRED_ENV_VARS = ["STRIPE_SECRET_KEY", "NEXT_PUBLIC_URL"] as const;

type EnvKey = (typeof REQUIRED_ENV_VARS)[number];
type RegistrationInsert = Database["public"]["Tables"]["registrations"]["Insert"];
type RegistrationRow = Database["public"]["Tables"]["registrations"]["Row"];

function assertEnvVars(env: NodeJS.ProcessEnv): asserts env is NodeJS.ProcessEnv & Record<EnvKey, string> {
  const missing = REQUIRED_ENV_VARS.filter((key) => !env[key]?.length);

  if (missing.length > 0) {
    throw new Error(`Variables d'environnement manquantes: ${missing.join(", ")}`);
  }
}

interface CheckoutPayload {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  amount?: number | string;
  eventId?: string;
}

function isTruthyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export async function POST(request: Request) {
  let adminSupabase: ReturnType<typeof createSupabaseServiceRoleClient> | null = null;
  let createdRegistrationId: string | null = null;

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

    let payload: CheckoutPayload;
    try {
      payload = (await request.json()) as CheckoutPayload;
    } catch {
      return NextResponse.json({ error: "Corps de requête invalide." }, { status: 400 });
    }

    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      return NextResponse.json({ error: "Corps de requête invalide." }, { status: 400 });
    }

    const firstName = payload.firstName?.toString().trim();
    const lastName = payload.lastName?.toString().trim();
    const email = payload.email?.toString().trim().toLowerCase();
    const phone = payload.phone?.toString().trim();
    const eventId = isTruthyString(payload.eventId) ? payload.eventId : MAIN_EVENT_ID;

    if (!firstName) {
      return NextResponse.json({ error: "Le prénom est requis." }, { status: 400 });
    }
    if (!lastName) {
      return NextResponse.json({ error: "Le nom est requis." }, { status: 400 });
    }
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return NextResponse.json({ error: "Adresse email invalide." }, { status: 400 });
    }
    if (!phone) {
      return NextResponse.json({ error: "Le numéro de téléphone est requis." }, { status: 400 });
    }

    const amountNumber = Number.parseFloat(payload.amount as string);

    if (!Number.isFinite(amountNumber) || amountNumber <= 0) {
      return NextResponse.json(
        { error: "Merci d'indiquer un montant de participation supérieur à 0 €." },
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

    const originUrl = process.env.NEXT_PUBLIC_URL;
    adminSupabase = createSupabaseServiceRoleClient();

    const registrationPayload: RegistrationInsert = {
      user_id: session.user.id,
      event_id: eventId,
      first_name: firstName,
      last_name: lastName,
      email,
      phone,
      amount: amountNumber,
      currency: DEFAULT_CURRENCY,
      status: "pending",
    };

    const { data: registration, error: insertError } = await adminSupabase
      .from("registrations")
      .insert([registrationPayload])
      .select()
      .single<RegistrationRow>();

    if (insertError || !registration) {
      throw new Error(insertError?.message ?? "Impossible d'enregistrer la participation.");
    }

    createdRegistrationId = registration.id;

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const eventDetails = MAIN_EVENT;

    const checkoutSession = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_intent_data: {
        metadata: {
          registration_id: registration.id,
          event_id: registration.event_id,
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
        event_id: registration.event_id,
        participant_email: registration.email,
      },
      customer_email: registration.email,
      success_url: `${originUrl}/dashboard?statut=confirmation&inscription=${encodeURIComponent(registration.id)}`,
      cancel_url: `${originUrl}/dashboard?statut=annule&inscription=${encodeURIComponent(registration.id)}`,
    });

    if (!checkoutSession.url) {
      throw new Error("Stripe a renvoyé une session sans URL de redirection.");
    }

    const { error: updateError } = await adminSupabase
      .from("registrations")
      .update({ stripe_checkout_session_id: checkoutSession.id })
      .eq("id", registration.id);

    if (updateError) {
      throw new Error(
        `Échec de la mise à jour du dossier participant avec la session Stripe: ${updateError.message}`
      );
    }

    return NextResponse.json({
      sessionId: checkoutSession.id,
      sessionUrl: checkoutSession.url,
      registration,
    });
  } catch (error) {
    console.error("[create-checkout-session] Erreur:", error);

    if (adminSupabase && createdRegistrationId) {
      const { error: deleteError } = await adminSupabase
        .from("registrations")
        .delete()
        .eq("id", createdRegistrationId);

      if (deleteError) {
        console.error("[create-checkout-session] Échec du nettoyage du dossier participant:", deleteError.message);
      }
    }

    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ error: "Erreur interne inattendue." }, { status: 500 });
  }
}

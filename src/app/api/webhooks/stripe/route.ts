import { NextResponse } from "next/server";
import Stripe from "stripe";
import QRCode from "qrcode";
import { createSupabaseServiceRoleClient } from "@/lib/supabase-server";
import { generateTicketPdf, sendTicketEmail } from "@/lib/ticketing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const REQUIRED_ENV_VARS = [
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "RESEND_API_KEY",
  "RESEND_FROM_EMAIL",
  "NEXT_PUBLIC_URL",
] as const;

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
      const registrationId = session.metadata?.registration_id;

      if (!registrationId) {
        console.warn("[stripe-webhook] checkout.session.completed sans registration_id dans les metadata.");
      } else {
        const adminSupabase = createSupabaseServiceRoleClient();

        const { data: registration, error: fetchError } = await adminSupabase
          .from("registrations")
          .select("*")
          .eq("id", registrationId)
          .single();

        if (fetchError || !registration) {
          console.error(
            `[stripe-webhook] Impossible de récupérer l'inscription ${registrationId}:`,
            fetchError?.message
          );
        } else {
          const checkinUrl = `${process.env.NEXT_PUBLIC_URL}/dashboard?inscription=${registrationId}`;
          let qrDataUrl: string | null = null;

          try {
            qrDataUrl = await QRCode.toDataURL(checkinUrl, {
              margin: 1,
              scale: 8,
              color: {
                dark: "#3d1f15",
                light: "#ffffff",
              },
            });
          } catch (error) {
            console.error("[stripe-webhook] Génération du QR code impossible:", error);
          }

          const { data: updatedRegistration, error: updateError } = await adminSupabase
            .from("registrations")
            .update({
              status: "paid",
              stripe_checkout_session_id: session.id,
              stripe_payment_intent_id: toPaymentIntentId(session.payment_intent),
              qr_code_data_url: qrDataUrl,
            })
            .eq("id", registrationId)
            .select()
            .single();

          if (updateError || !updatedRegistration) {
            console.error(
              `[stripe-webhook] Échec de la mise à jour de l'inscription ${registrationId}:`,
              updateError?.message
            );
          } else if (qrDataUrl) {
            if (!updatedRegistration.email) {
              console.warn(
                `[stripe-webhook] Aucun email pour l'inscription ${registrationId}, impossible d'envoyer la confirmation.`
              );
            } else {
              try {
                const ticketPdf = await generateTicketPdf({
                  firstName: updatedRegistration.first_name ?? "",
                  lastName: updatedRegistration.last_name ?? "",
                  email: updatedRegistration.email ?? "",
                  amount: Number(updatedRegistration.amount ?? 0),
                  qrDataUrl,
                  registrationId,
                });

                await sendTicketEmail({
                  to: updatedRegistration.email,
                  firstName: updatedRegistration.first_name ?? "",
                  lastName: updatedRegistration.last_name ?? "",
                  email: updatedRegistration.email ?? "",
                  amount: Number(updatedRegistration.amount ?? 0),
                  qrDataUrl,
                  ticketPdf,
                  registrationId,
                });
              } catch (error) {
                console.error("[stripe-webhook] Échec de l'envoi de l'email de confirmation:", error);
              }
            }
          }
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

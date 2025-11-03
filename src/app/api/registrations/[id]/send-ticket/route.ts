import { NextResponse } from "next/server";
import Stripe from "stripe";
import QRCode from "qrcode";
import { createSupabaseRouteClient, createSupabaseServiceRoleClient } from "@/lib/supabase-server";
import { generateTicketPdf, sendTicketEmail } from "@/lib/ticketing";
import type { Database } from "@/types/supabase";

export const runtime = "nodejs";

const REQUIRED_ENV_VARS = [
  "RESEND_API_KEY",
  "RESEND_FROM_EMAIL",
  "NEXT_PUBLIC_URL",
  "STRIPE_SECRET_KEY",
] as const;
type EnvKey = (typeof REQUIRED_ENV_VARS)[number];

interface RouteContext {
  params: {
    id?: string;
  };
}

function assertEnvVars(env: NodeJS.ProcessEnv): asserts env is NodeJS.ProcessEnv & Record<EnvKey, string> {
  const missing = REQUIRED_ENV_VARS.filter((key) => !env[key]?.length);

  if (missing.length > 0) {
    throw new Error(`Variables d'environnement manquantes pour l'envoi du billet: ${missing.join(", ")}`);
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
      .single<Database["public"]["Tables"]["registrations"]["Row"]>();

    if (fetchError || !registration) {
      console.error("[send-ticket] Enregistrement introuvable:", fetchError?.message);
      return NextResponse.json({ error: "Réservation introuvable." }, { status: 404 });
    }

    if (registration.user_id !== session.user.id) {
      return NextResponse.json({ error: "Accès non autorisé." }, { status: 403 });
    }

    if (!registration.email) {
      return NextResponse.json({ error: "Aucune adresse email disponible." }, { status: 400 });
    }

    let qrDataUrl = registration.qr_code_data_url;

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

    if (registration.status !== "paid") {
      if (!registration.stripe_checkout_session_id) {
        return NextResponse.json(
          { error: "Aucune session Stripe associée à cette inscription." },
          { status: 400 }
        );
      }

      let stripeSession: Stripe.Checkout.Session | null = null;
      try {
        stripeSession = await stripe.checkout.sessions.retrieve(registration.stripe_checkout_session_id);
      } catch (error) {
        console.error("[send-ticket] Impossible de récupérer la session Stripe:", error);
        return NextResponse.json(
          { error: "Impossible de vérifier l'état du paiement auprès de Stripe." },
          { status: 500 }
        );
      }

      if (stripeSession.payment_status !== "paid") {
        return NextResponse.json(
          { error: "Le paiement n'est pas encore confirmé par Stripe." },
          { status: 400 }
        );
      }

      const { error: updateStatusError } = await adminSupabase
        .from("registrations")
        .update({
          status: "paid",
          stripe_payment_intent_id: typeof stripeSession.payment_intent === "string"
            ? stripeSession.payment_intent
            : stripeSession.payment_intent?.id ?? registration.stripe_payment_intent_id,
        })
        .eq("id", registrationId);

      if (updateStatusError) {
        console.error("[send-ticket] Mise à jour du statut vers 'paid' impossible:", updateStatusError.message);
      }
    }

    if (!qrDataUrl) {
      const checkinUrl = `${process.env.NEXT_PUBLIC_URL}/dashboard?inscription=${registrationId}`;
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
        console.error("[send-ticket] Génération du QR code impossible:", error);
        return NextResponse.json({ error: "Impossible de générer le QR code." }, { status: 500 });
      }

      const { error: updateQrError } = await adminSupabase
        .from("registrations")
        .update({ qr_code_data_url: qrDataUrl })
        .eq("id", registrationId);

      if (updateQrError) {
        console.error("[send-ticket] Sauvegarde du QR code impossible:", updateQrError.message);
      }
    }

    const ticketPdf = await generateTicketPdf({
      firstName: registration.first_name ?? "",
      lastName: registration.last_name ?? "",
      email: registration.email ?? "",
      amount: Number(registration.amount ?? 0),
      qrDataUrl: qrDataUrl ?? "",
      registrationId,
    });

    let emailSent = false;
    try {
      await sendTicketEmail({
        to: registration.email,
        firstName: registration.first_name ?? "",
        lastName: registration.last_name ?? "",
        email: registration.email ?? "",
        amount: Number(registration.amount ?? 0),
        qrDataUrl: qrDataUrl ?? "",
        ticketPdf,
        registrationId,
      });
      emailSent = true;
    } catch (error) {
      console.error("[send-ticket] L'envoi de l'email a échoué mais le billet est prêt:", error);
    }

    return NextResponse.json({
      sent: emailSent,
      qrReady: Boolean(qrDataUrl),
    });
  } catch (error) {
    console.error("[send-ticket] Erreur:", error);
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ error: "Erreur inattendue lors de l'envoi du billet." }, { status: 500 });
  }
}

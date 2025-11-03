import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { createSupabaseRouteClient, createSupabaseServiceRoleClient } from "@/lib/supabase-server";
import { generateTicketPdf } from "@/lib/ticketing";
import type { Database } from "@/types/supabase";

export const runtime = "nodejs";

interface RouteContext {
  params: {
    id?: string;
  };
}

export async function GET(_request: Request, { params }: RouteContext) {
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
    console.error("[ticket-download] Session error:", sessionError);
    return NextResponse.json({ error: "Erreur d'authentification." }, { status: 500 });
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
    console.error("[ticket-download] Registration fetch error:", fetchError?.message);
    return NextResponse.json({ error: "Réservation introuvable." }, { status: 404 });
  }

  if (registration.user_id !== session.user.id) {
    return NextResponse.json({ error: "Accès non autorisé." }, { status: 403 });
  }

  if (registration.status !== "paid") {
    return NextResponse.json({ error: "Cette réservation n'est pas confirmée." }, { status: 400 });
  }

  let qrDataUrl = registration.qr_code_data_url;

  if (!qrDataUrl) {
    try {
      const checkinUrl = `${process.env.NEXT_PUBLIC_URL}/dashboard?inscription=${registrationId}`;
      qrDataUrl = await QRCode.toDataURL(checkinUrl, {
        margin: 1,
        scale: 8,
        color: {
          dark: "#3d1f15",
          light: "#ffffff",
        },
      });

      await adminSupabase
        .from("registrations")
        .update({ qr_code_data_url: qrDataUrl })
        .eq("id", registrationId);
    } catch (error) {
      console.error("[ticket-download] QR code generation failed:", error);
      return NextResponse.json({ error: "Impossible de générer le billet." }, { status: 500 });
    }
  }

  try {
    const pdfBuffer = await generateTicketPdf({
      firstName: registration.first_name ?? "",
      lastName: registration.last_name ?? "",
      email: registration.email ?? "",
      amount: Number(registration.amount ?? 0),
      qrDataUrl: qrDataUrl ?? "",
      registrationId,
    });

    return new Response(pdfBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="concerto-billet-${registrationId}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[ticket-download] PDF generation failed:", error);
    return NextResponse.json({ error: "Impossible de générer le billet PDF." }, { status: 500 });
  }
}

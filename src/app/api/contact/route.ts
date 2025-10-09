import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

function assertPresence(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);

    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Corps de requête invalide." }, { status: 400 });
    }

    const nomPrenom = (body as { nomPrenom?: string }).nomPrenom;
    const email = (body as { email?: string }).email;
    const message = (body as { message?: string }).message;

    if (!assertPresence(nomPrenom) || !assertPresence(email)) {
      return NextResponse.json(
        { error: "Merci de renseigner votre nom et votre email." },
        { status: 400 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!assertPresence(supabaseUrl) || !assertPresence(serviceRoleKey)) {
      return NextResponse.json(
        { error: "Configuration Supabase manquante." },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    const { error } = await supabase.from("client").insert({
      nom_prenom: nomPrenom.trim(),
      email: email.trim().toLowerCase(),
      message: message?.trim() ?? null,
    });

    if (error) {
      const conflict = error.code === "23505";
      return NextResponse.json(
        {
          error: conflict
            ? "Ce nom est déjà enregistré."
            : "Impossible d'enregistrer votre demande pour le moment.",
        },
        { status: conflict ? 409 : 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Erreur lors de l'enregistrement du client", error);
    return NextResponse.json({ error: "Erreur interne inattendue." }, { status: 500 });
  }
}

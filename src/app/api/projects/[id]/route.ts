import { NextRequest, NextResponse } from "next/server";
import { createSupabaseRouteClient, createSupabaseServiceRoleClient } from "@/lib/supabase-server";
import type { Database } from "@/types/supabase";

function extractStoragePath(publicUrl: string, bucket: string): string | null {
  try {
    const url = new URL(publicUrl);
    const prefix = `/storage/v1/object/public/${bucket}/`;
    const index = url.pathname.indexOf(prefix);
    if (index === -1) {
      return null;
    }
    return decodeURIComponent(url.pathname.slice(index + prefix.length));
  } catch {
    return null;
  }
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  type ProjectRow = Database["public"]["Tables"]["projects"]["Row"];

  try {
    const { id } = await context.params;
    const supabaseAuth = createSupabaseRouteClient();
    const {
      data: { session },
    } = await supabaseAuth.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
    }

    const inputBucket = process.env.SUPABASE_INPUT_BUCKET;
    const outputBucket = process.env.SUPABASE_OUTPUT_BUCKET;

    if (!inputBucket || !outputBucket) {
      return NextResponse.json({ error: "Configuration Supabase incomplète." }, { status: 500 });
    }

    const { data: project, error: fetchError } = await supabaseAuth
      .from("projects")
      .select("*")
      .eq("id", id)
      .single<ProjectRow>();

    if (fetchError || !project) {
      const status = fetchError?.code === "PGRST116" ? 404 : 403;
      return NextResponse.json(
        { error: fetchError ? "Projet introuvable ou accès refusé." : "Projet introuvable." },
        { status }
      );
    }

    if (project.user_id !== session.user.id) {
      return NextResponse.json({ error: "Accès refusé." }, { status: 403 });
    }

    const adminSupabase = createSupabaseServiceRoleClient();

    const inputPath = extractStoragePath(project.input_image_url, inputBucket);
    const outputPath = project.output_image_url
      ? extractStoragePath(project.output_image_url, outputBucket)
      : null;

    const removalErrors = [];

    if (inputPath) {
      const { error } = await adminSupabase.storage.from(inputBucket).remove([inputPath]);
      if (error) {
        console.error("Suppression de l'image d'entrée échouée:", error);
        removalErrors.push(error.message);
      }
    }

    if (outputPath) {
      const { error } = await adminSupabase.storage.from(outputBucket).remove([outputPath]);
      if (error) {
        console.error("Suppression de l'image générée échouée:", error);
        removalErrors.push(error.message);
      }
    }

    const { error: deleteError } = await supabaseAuth.from("projects").delete().eq("id", id);

    if (deleteError) {
      throw deleteError;
    }

    return NextResponse.json({
      success: true,
      warnings: removalErrors.length > 0 ? removalErrors : undefined,
    });
  } catch (error) {
    console.error("Erreur lors de la suppression du projet", error);
    return NextResponse.json(
      { error: "Suppression impossible pour le moment." },
      { status: 500 }
    );
  }
}

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createSupabaseServerClient, createSupabaseServiceRoleClient } from "@/lib/supabase-server";
import type { Database } from "@/types/supabase";
import { DashboardClient } from "./_components/DashboardClient";

export const metadata: Metadata = {
  title: "Tableau de bord — Concerto Final",
};

export default async function DashboardPage() {
  const supabase = createSupabaseServerClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    redirect("/login");
  }

  const adminSupabase = createSupabaseServiceRoleClient();

  const { data: projects, error } = await adminSupabase
    .from("projects")
    .select("*")
    .eq("user_id", session.user.id)
    .order("created_at", { ascending: false })
    .returns<Database["public"]["Tables"]["projects"]["Row"][]>();

  if (error) {
    console.error("Impossible de charger les projets:", error.message);
  }

  return <DashboardClient initialProjects={projects ?? []} />;
}

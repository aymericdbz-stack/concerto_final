import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createSupabaseServerClient, createSupabaseServiceRoleClient } from "@/lib/supabase-server";
import type { Database } from "@/types/supabase";
import { DashboardClient } from "./_components/DashboardClient";

export const metadata: Metadata = {
  title: "Espace abonné — Concerto",
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

  const { data: registrations, error } = await adminSupabase
    .from("registrations")
    .select("*")
    .eq("user_id", session.user.id)
    .order("created_at", { ascending: false })
    .returns<Database["public"]["Tables"]["registrations"]["Row"][]>();

  if (error) {
    console.error("Impossible de charger les inscriptions:", error.message);
  }

  return <DashboardClient initialRegistrations={registrations ?? []} />;
}

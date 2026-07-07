import { redirect } from "next/navigation";
import { DashboardLayoutShell } from "@/components/layout/dashboard-layout-shell";
import { apiFetch, type MeResponse } from "@/lib/api";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) redirect("/login");

  let workspaces: MeResponse["workspaces"] = [];
  try {
    const me = await apiFetch<MeResponse>("/api/v1/me", session.access_token);
    workspaces = me.workspaces;
  } catch {
    workspaces = [];
  }

  return (
    <DashboardLayoutShell workspaces={workspaces}>{children}</DashboardLayoutShell>
  );
}

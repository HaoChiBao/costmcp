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
  let user: { name: string; email?: string } | undefined;

  try {
    const me = await apiFetch<MeResponse>("/api/v1/me", session.access_token);
    workspaces = me.workspaces;
    user = {
      name: me.profile?.display_name ?? me.user.email?.split("@")[0] ?? "Account",
      email: me.user.email,
    };
  } catch {
    workspaces = [];
    user = session.user.email
      ? { name: session.user.email.split("@")[0], email: session.user.email }
      : undefined;
  }

  return (
    <DashboardLayoutShell workspaces={workspaces} user={user}>
      {children}
    </DashboardLayoutShell>
  );
}

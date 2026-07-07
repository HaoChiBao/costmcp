import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { SpendDashboard } from "@/components/metrics/spend-dashboard";
import { apiFetch, type MeResponse, type OrgTree } from "@/lib/api";
import { createClient } from "@/lib/supabase/server";

export default async function WorkspaceDashboard({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) redirect("/login");

  const [me, org] = await Promise.all([
    apiFetch<MeResponse>("/api/v1/me", session.access_token),
    apiFetch<OrgTree>(`/api/v1/workspaces/${slug}/org`, session.access_token).catch(() => null),
  ]);

  if (!org) {
    return (
      <DashboardShell
        userLabel={me.profile?.display_name ?? me.user.email ?? "Account"}
        workspaces={me.workspaces}
        currentSlug={slug}
      >
        <p className="text-muted">Workspace not found.</p>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell
      userLabel={me.profile?.display_name ?? me.user.email ?? "Account"}
      workspaces={me.workspaces}
      currentSlug={slug}
    >
      <SpendDashboard
        workspaceSlug={slug}
        workspaceName={org.workspace.name}
        org={org}
      />
    </DashboardShell>
  );
}

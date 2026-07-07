import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { Button } from "@/components/ui/button";
import { DashboardPanel } from "@/components/ui/panel";
import { apiFetch, type MeResponse } from "@/lib/api";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) redirect("/login");

  let me: MeResponse;
  try {
    me = await apiFetch<MeResponse>("/api/v1/me", session.access_token);
  } catch {
    return (
      <main className="auth-page">
        <p className="text-muted">Could not load your account. Is the API running on port 3000?</p>
      </main>
    );
  }

  const defaultSlug =
    me.workspaces.find((w) => w.id === me.profile?.default_workspace_id)?.slug ??
    me.workspaces[0]?.slug;

  if (defaultSlug) {
    redirect(`/dashboard/${defaultSlug}`);
  }

  return (
    <DashboardShell
      userLabel={me.profile?.display_name ?? me.user.email ?? "Account"}
      workspaces={me.workspaces}
    >
      <header className="dashboard-page-header">
        <div>
          <p className="meta-label">Welcome</p>
          <h1 className="heading-sm">
            {me.profile?.display_name ? `Hi, ${me.profile.display_name}` : "Your dashboard"}
          </h1>
        </div>
      </header>
      <DashboardPanel
        title="Get started"
        description="No workspaces yet. Create your first cost account to start organizing projects."
      >
            <Button href="/dashboard/new" variant="ink">
          Create cost account
        </Button>
      </DashboardPanel>
    </DashboardShell>
  );
}

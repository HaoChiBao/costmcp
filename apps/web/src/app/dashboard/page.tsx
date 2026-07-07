import { redirect } from "next/navigation";
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
      <DashboardPanel title="Account unavailable">
        <p className="text-muted">Could not load your account. Is the API running on port 3000?</p>
      </DashboardPanel>
    );
  }

  const defaultSlug =
    me.workspaces.find((w) => w.id === me.profile?.default_workspace_id)?.slug ??
    me.workspaces[0]?.slug;

  if (defaultSlug) {
    redirect(`/dashboard/${defaultSlug}`);
  }

  return (
    <DashboardPanel
      title="Get started"
      description="No workspaces yet. Create your first cost account to start organizing projects."
    >
      <Button href="/dashboard/new" variant="ink">
        Create cost account
      </Button>
    </DashboardPanel>
  );
}

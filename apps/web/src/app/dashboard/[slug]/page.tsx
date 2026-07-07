import { redirect } from "next/navigation";
import { SpendDashboard } from "@/components/metrics/spend-dashboard";
import { apiFetch, type OrgTree } from "@/lib/api";
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

  const org = await apiFetch<OrgTree>(
    `/api/v1/workspaces/${slug}/org`,
    session.access_token,
  ).catch(() => null);

  if (!org) {
    return <p className="text-muted">Workspace not found.</p>;
  }

  return (
    <SpendDashboard
      workspaceSlug={slug}
      workspaceName={org.workspace.name}
      org={org}
    />
  );
}

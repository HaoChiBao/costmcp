import Link from "next/link";
import { redirect } from "next/navigation";
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
      <main style={{ padding: "2rem" }}>
        <p>Could not load your account. Is the API running on port 3000?</p>
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
    <main style={{ padding: "2rem", maxWidth: 720, margin: "0 auto" }}>
      <h1>Welcome{me.profile?.display_name ? `, ${me.profile.display_name}` : ""}</h1>
      <p style={{ color: "#7b8da8" }}>No workspaces yet.</p>
      <Link href="/dashboard/new" style={{ color: "#60a5fa" }}>
        Create your first cost account
      </Link>
    </main>
  );
}

import { redirect } from "next/navigation";
import { ConnectionsManager } from "@/components/dashboard/connections-manager";
import { createClient } from "@/lib/supabase/server";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";

export default async function ConnectionsPage({
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

  return (
    <ConnectionsManager
      workspaceSlug={slug}
      apiUrl={API_URL}
      mcpUrl={`${API_URL}/api/mcp`}
    />
  );
}

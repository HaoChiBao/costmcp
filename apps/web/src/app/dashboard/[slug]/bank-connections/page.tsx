import { redirect } from "next/navigation";
import { BankConnectionsManager } from "@/components/dashboard/bank-connections-manager";
import { createClient } from "@/lib/supabase/server";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";

export default async function BankConnectionsPage({
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

  return <BankConnectionsManager workspaceSlug={slug} apiUrl={API_URL} />;
}

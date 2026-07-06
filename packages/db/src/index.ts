import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types.js";

export type { Database };

export function createServiceClient(): SupabaseClient<Database> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
  }
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export type InsertCostMessageInput =
  Database["public"]["Tables"]["cost_messages"]["Insert"];

export async function insertCostMessage(
  client: SupabaseClient<Database>,
  input: InsertCostMessageInput,
) {
  const { data, error } = await client
    .from("cost_messages")
    .insert(input)
    .select("id, amount_usd, project_id, created_at")
    .single();

  if (error) throw error;
  return data;
}

export async function findProjectBySlug(
  client: SupabaseClient<Database>,
  workspaceId: string,
  slug: string,
) {
  const { data, error } = await client
    .from("projects")
    .select("id, slug, name, budget")
    .eq("workspace_id", workspaceId)
    .eq("slug", slug)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function upsertProjectBySlug(
  client: SupabaseClient<Database>,
  workspaceId: string,
  slug: string,
  name?: string,
) {
  const existing = await findProjectBySlug(client, workspaceId, slug);
  if (existing) return existing;

  const { data, error } = await client
    .from("projects")
    .insert({
      workspace_id: workspaceId,
      slug,
      name: name ?? slug,
    })
    .select("id, slug, name, budget")
    .single();

  if (error) throw error;
  return data;
}

export async function findMessageByIdempotencyKey(
  client: SupabaseClient<Database>,
  workspaceId: string,
  idempotencyKey: string,
) {
  const { data, error } = await client
    .from("cost_messages")
    .select("id, amount_usd, project_id, created_at")
    .eq("workspace_id", workspaceId)
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function getMonthlySpend(client: SupabaseClient<Database>, workspaceId: string) {
  const start = new Date();
  start.setUTCDate(1);
  start.setUTCHours(0, 0, 0, 0);

  const { data, error } = await client
    .from("cost_messages")
    .select("amount_usd, message_type, project_id, projects(name, slug)")
    .eq("workspace_id", workspaceId)
    .gte("created_at", start.toISOString());

  if (error) throw error;
  return (data ?? []) as Array<{
    amount_usd: number;
    message_type: string;
    project_id: string | null;
    projects: { slug: string; name: string } | { slug: string; name: string }[] | null;
  }>;
}

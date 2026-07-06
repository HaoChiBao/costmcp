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

export function createUserClient(accessToken: string): SupabaseClient<Database> {
  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error("SUPABASE_URL and SUPABASE_ANON_KEY are required");
  }
  return createClient<Database>(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export type OrgTree = {
  workspace: Database["public"]["Tables"]["workspaces"]["Row"];
  role: string;
  collections: Array<
    Database["public"]["Tables"]["collections"]["Row"] & {
      projects: Database["public"]["Tables"]["projects"]["Row"][];
    }
  >;
  ungrouped_projects: Database["public"]["Tables"]["projects"]["Row"][];
  categories: Array<
    Database["public"]["Tables"]["cost_categories"]["Row"] & {
      children: Database["public"]["Tables"]["cost_categories"]["Row"][];
    }
  >;
  vendors: Database["public"]["Tables"]["vendors"]["Row"][];
  budgets: Database["public"]["Tables"]["budgets"]["Row"][];
};

export async function getUserProfile(client: SupabaseClient<Database>, userId: string) {
  const { data, error } = await client
    .from("profiles")
    .select("id, email, display_name, avatar_url, default_workspace_id")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getUserWorkspaces(client: SupabaseClient<Database>, userId: string) {
  const { data: memberships, error } = await client
    .from("workspace_members")
    .select("role, workspace_id")
    .eq("user_id", userId)
    .order("joined_at", { ascending: true });
  if (error) throw error;
  if (!memberships?.length) return [];

  const workspaceIds = memberships.map((m) => m.workspace_id);
  const { data: workspaces, error: wsError } = await client
    .from("workspaces")
    .select("id, name, slug, type, description, base_currency, sort_order")
    .in("id", workspaceIds);
  if (wsError) throw wsError;

  const byId = new Map((workspaces ?? []).map((w) => [w.id, w]));
  return memberships
    .map((m) => {
      const workspace = byId.get(m.workspace_id);
      if (!workspace) return null;
      return { role: m.role as string, workspace };
    })
    .filter((row): row is { role: string; workspace: Database["public"]["Tables"]["workspaces"]["Row"] } => row !== null);
}

export async function getWorkspaceOrgTree(
  client: SupabaseClient<Database>,
  workspaceSlug: string,
  userId: string,
): Promise<OrgTree | null> {
  const { data: workspace, error: wsError } = await client
    .from("workspaces")
    .select("*")
    .eq("slug", workspaceSlug)
    .maybeSingle();
  if (wsError) throw wsError;
  if (!workspace) return null;

  const { data: membership, error: memberError } = await client
    .from("workspace_members")
    .select("role")
    .eq("user_id", userId)
    .eq("workspace_id", workspace.id)
    .maybeSingle();
  if (memberError) throw memberError;
  if (!membership) return null;

  const wsId = workspace.id;

  const [collectionsRes, projectsRes, categoriesRes, vendorsRes, budgetsRes] = await Promise.all([
    client
      .from("collections")
      .select("*")
      .eq("workspace_id", wsId)
      .eq("archived", false)
      .order("sort_order"),
    client
      .from("projects")
      .select("*")
      .eq("workspace_id", wsId)
      .eq("archived", false)
      .order("sort_order"),
    client.from("cost_categories").select("*").eq("workspace_id", wsId).order("sort_order"),
    client.from("vendors").select("*").eq("workspace_id", wsId).order("name"),
    client.from("budgets").select("*").eq("workspace_id", wsId).order("created_at"),
  ]);

  for (const res of [collectionsRes, projectsRes, categoriesRes, vendorsRes, budgetsRes]) {
    if (res.error) throw res.error;
  }

  const projects = (projectsRes.data ?? []) as Database["public"]["Tables"]["projects"]["Row"][];
  const collections = (collectionsRes.data ?? []) as Database["public"]["Tables"]["collections"]["Row"][];
  const categories = (categoriesRes.data ?? []) as Database["public"]["Tables"]["cost_categories"]["Row"][];

  const rootCategories = categories.filter((c) => !c.parent_id);
  const categoryTree = rootCategories.map((parent) => ({
    ...parent,
    children: categories.filter((c) => c.parent_id === parent.id),
  }));

  const collectionsWithProjects = collections.map((collection) => ({
    ...collection,
    projects: projects.filter((p) => p.collection_id === collection.id),
  }));

  return {
    workspace,
    role: membership.role as string,
    collections: collectionsWithProjects,
    ungrouped_projects: projects.filter((p) => !p.collection_id),
    categories: categoryTree,
    vendors: (vendorsRes.data ?? []) as Database["public"]["Tables"]["vendors"]["Row"][],
    budgets: (budgetsRes.data ?? []) as Database["public"]["Tables"]["budgets"]["Row"][],
  };
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
    .select("amount_usd, message_type, project_id")
    .eq("workspace_id", workspaceId)
    .gte("created_at", start.toISOString());

  if (error) throw error;

  const projectIds = [...new Set((data ?? []).map((r) => r.project_id).filter(Boolean))] as string[];
  let projectMap = new Map<string, { slug: string; name: string }>();
  if (projectIds.length) {
    const { data: projects, error: projectError } = await client
      .from("projects")
      .select("id, slug, name")
      .in("id", projectIds);
    if (projectError) throw projectError;
    projectMap = new Map((projects ?? []).map((p) => [p.id, { slug: p.slug, name: p.name }]));
  }

  return (data ?? []).map((row) => ({
    amount_usd: row.amount_usd as number,
    message_type: row.message_type as string,
    project_id: row.project_id as string | null,
    projects: row.project_id ? projectMap.get(row.project_id) ?? null : null,
  }));
}

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

export type SpendFilters = {
  since?: Date | null;
  projectSlug?: string | null;
  messageType?: string | null;
  environment?: string | null;
};

export type SpendMessageRow = {
  id: string;
  amount_usd: number;
  message_type: string;
  created_at: string;
  project_id: string | null;
  environment: string | null;
  feature: string | null;
  source: string;
  metadata: Record<string, unknown>;
  project_slug: string | null;
  project_name: string | null;
};

export async function getWorkspaceSpendMessages(
  client: SupabaseClient<Database>,
  workspaceId: string,
  filters: SpendFilters = {},
) {
  let projectId: string | null = null;
  if (filters.projectSlug) {
    const project = await findProjectBySlug(client, workspaceId, filters.projectSlug);
    if (!project) return [];
    projectId = project.id;
  }

  let query = client
    .from("cost_messages")
    .select("id, amount_usd, message_type, created_at, project_id, environment, feature, source, metadata")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });

  if (filters.since) {
    query = query.gte("created_at", filters.since.toISOString());
  }
  if (projectId) {
    query = query.eq("project_id", projectId);
  }
  if (filters.messageType) {
    query = query.eq("message_type", filters.messageType);
  }
  if (filters.environment) {
    query = query.eq("environment", filters.environment);
  }

  const { data, error } = await query;
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

  return (data ?? []).map((row) => {
    const project = row.project_id ? projectMap.get(row.project_id as string) : null;
    return {
      id: row.id as string,
      amount_usd: Number(row.amount_usd ?? 0),
      message_type: row.message_type as string,
      created_at: row.created_at as string,
      project_id: row.project_id as string | null,
      environment: row.environment as string | null,
      feature: row.feature as string | null,
      source: row.source as string,
      metadata: (row.metadata as Record<string, unknown>) ?? {},
      project_slug: project?.slug ?? null,
      project_name: project?.name ?? null,
    } satisfies SpendMessageRow;
  });
}

export type WorkspaceMetrics = {
  period: string;
  period_label: string;
  total_usd: number;
  usage_usd: number;
  expense_usd: number;
  subscription_usd: number;
  message_count: number;
  daily: Array<{ date: string; amount_usd: number }>;
  by_project: Array<{ slug: string; name: string; amount_usd: number; percent: number }>;
  by_type: Record<string, number>;
  budget: {
    name: string;
    limit: number;
    spent: number;
    remaining: number;
    percent_used: number;
    status: "ok" | "warning" | "danger";
  } | null;
  top_project: { slug: string; name: string; amount_usd: number } | null;
};

function aggregateDaily(rows: SpendMessageRow[]) {
  const byDay = new Map<string, number>();
  for (const row of rows) {
    const day = row.created_at.slice(0, 10);
    byDay.set(day, (byDay.get(day) ?? 0) + row.amount_usd);
  }
  return [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, amount_usd]) => ({ date, amount_usd }));
}

export async function getWorkspaceMetrics(
  client: SupabaseClient<Database>,
  workspaceId: string,
  period: string,
  since: Date | null,
  filters: Omit<SpendFilters, "since"> = {},
): Promise<WorkspaceMetrics> {
  const rows = await getWorkspaceSpendMessages(client, workspaceId, { ...filters, since });

  const total = rows.reduce((s, r) => s + r.amount_usd, 0);
  const usage = rows.filter((r) => r.message_type === "usage").reduce((s, r) => s + r.amount_usd, 0);
  const subscription = rows.filter((r) => r.message_type === "subscription").reduce((s, r) => s + r.amount_usd, 0);
  const expense = rows
    .filter((r) => r.message_type !== "usage" && r.message_type !== "subscription")
    .reduce((s, r) => s + r.amount_usd, 0);

  const byProjectMap = new Map<string, { slug: string; name: string; amount_usd: number }>();
  for (const row of rows) {
    const slug = row.project_slug ?? "unassigned";
    const name = row.project_name ?? "Unassigned";
    const existing = byProjectMap.get(slug) ?? { slug, name, amount_usd: 0 };
    existing.amount_usd += row.amount_usd;
    byProjectMap.set(slug, existing);
  }

  const by_project = [...byProjectMap.values()]
    .sort((a, b) => b.amount_usd - a.amount_usd)
    .map((p) => ({
      ...p,
      percent: total > 0 ? p.amount_usd / total : 0,
    }));

  const by_type: Record<string, number> = {};
  for (const row of rows) {
    by_type[row.message_type] = (by_type[row.message_type] ?? 0) + row.amount_usd;
  }

  const { data: globalBudget } = await client
    .from("budgets")
    .select("name, amount")
    .eq("workspace_id", workspaceId)
    .eq("scope_type", "global")
    .maybeSingle();

  let budget: WorkspaceMetrics["budget"] = null;
  if (globalBudget) {
    const limit = Number(globalBudget.amount ?? 0);
    const spent = total;
    const remaining = Math.max(0, limit - spent);
    const percent_used = limit > 0 ? spent / limit : 0;
    const status = percent_used >= 1 ? "danger" : percent_used >= 0.8 ? "warning" : "ok";
    budget = {
      name: globalBudget.name as string,
      limit,
      spent,
      remaining,
      percent_used,
      status,
    };
  }

  const top = by_project[0] ?? null;

  const periodLabels: Record<string, string> = {
    day: "Today",
    week: "Past 7 days",
    month: "This month",
    quarter: "This quarter",
    year: "This year",
    all: "All time",
  };

  return {
    period,
    period_label: periodLabels[period] ?? "This month",
    total_usd: total,
    usage_usd: usage,
    expense_usd: expense,
    subscription_usd: subscription,
    message_count: rows.length,
    daily: aggregateDaily(rows),
    by_project,
    by_type,
    budget,
    top_project: top ? { slug: top.slug, name: top.name, amount_usd: top.amount_usd } : null,
  };
}

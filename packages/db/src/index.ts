import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "./database.types.js";

export type { Database, Json };
export { sumSpendForApiKey, utcMonthStartIso } from "./api-keys.js";

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
    .select("id, amount_usd, project_id, created_at, occurred_at")
    .single();

  if (error) throw error;
  return data;
}

export async function updateCostMessage(
  client: SupabaseClient<Database>,
  id: string,
  workspaceId: string,
  patch: Database["public"]["Tables"]["cost_messages"]["Update"],
) {
  const { data, error } = await client
    .from("cost_messages")
    .update(patch)
    .eq("id", id)
    .eq("workspace_id", workspaceId)
    .is("voided_at", null)
    .select("id, amount_usd, project_id, created_at, occurred_at, message_type, source")
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function voidCostMessage(
  client: SupabaseClient<Database>,
  id: string,
  workspaceId: string,
) {
  return updateCostMessage(client, id, workspaceId, {
    voided_at: new Date().toISOString(),
  });
}

export async function getFxRates(client: SupabaseClient<Database>) {
  const { data, error } = await client.from("fx_rates").select("currency, rate_to_usd");
  if (error) throw error;
  const rates: Record<string, number> = {};
  for (const row of data ?? []) {
    rates[String(row.currency).toUpperCase()] = Number(row.rate_to_usd);
  }
  return rates;
}

export async function findCategoryBySlugOrName(
  client: SupabaseClient<Database>,
  workspaceId: string,
  value: string,
) {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const slug = trimmed
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  const { data: bySlug, error: slugError } = await client
    .from("cost_categories")
    .select("id, name, slug")
    .eq("workspace_id", workspaceId)
    .eq("slug", slug)
    .maybeSingle();
  if (slugError) throw slugError;
  if (bySlug) return bySlug;

  const { data: byName, error: nameError } = await client
    .from("cost_categories")
    .select("id, name, slug")
    .eq("workspace_id", workspaceId)
    .ilike("name", trimmed)
    .maybeSingle();
  if (nameError) throw nameError;
  return byName;
}

export async function getCostMessageById(
  client: SupabaseClient<Database>,
  workspaceId: string,
  id: string,
) {
  const { data, error } = await client
    .from("cost_messages")
    .select(
      "id, workspace_id, project_id, vendor_id, message_type, amount_usd, currency, amount_original, source, metadata, cost_category_id, created_at, occurred_at, voided_at, feature, environment",
    )
    .eq("workspace_id", workspaceId)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export type SubscriptionLedgerRow = {
  id: string;
  project_id: string | null;
  amount_usd: number;
  amount_original: number | null;
  currency: string;
  occurred_at: string;
  metadata: Record<string, unknown> | null;
  projects: { slug: string; name: string } | null;
};

export async function listSubscriptions(
  client: SupabaseClient<Database>,
  workspaceId: string,
  opts?: { projectId?: string },
): Promise<SubscriptionLedgerRow[]> {
  let query = client
    .from("cost_messages")
    .select("id, project_id, amount_usd, amount_original, currency, occurred_at, metadata")
    .eq("workspace_id", workspaceId)
    .eq("message_type", "subscription")
    .is("voided_at", null)
    .order("occurred_at", { ascending: false })
    .limit(200);

  if (opts?.projectId) {
    query = query.eq("project_id", opts.projectId);
  }

  const { data, error } = await query;
  if (error) throw error;
  const rows = data ?? [];

  const projectIds = [
    ...new Set(rows.map((row) => row.project_id).filter((id): id is string => Boolean(id))),
  ];
  const projectById = new Map<string, { slug: string; name: string }>();
  if (projectIds.length) {
    const { data: projects, error: projectError } = await client
      .from("projects")
      .select("id, slug, name")
      .in("id", projectIds);
    if (projectError) throw projectError;
    for (const project of projects ?? []) {
      projectById.set(project.id, { slug: project.slug, name: project.name });
    }
  }

  return rows.map((row) => ({
    id: row.id as string,
    project_id: row.project_id as string | null,
    amount_usd: Number(row.amount_usd),
    amount_original: row.amount_original as number | null,
    currency: row.currency as string,
    occurred_at: row.occurred_at as string,
    metadata: (row.metadata as Record<string, unknown> | null) ?? null,
    projects: row.project_id ? projectById.get(row.project_id as string) ?? null : null,
  }));
}

export async function findLatestSubscriptionByVendor(
  client: SupabaseClient<Database>,
  workspaceId: string,
  projectId: string,
  vendor: string,
) {
  const { data, error } = await client
    .from("cost_messages")
    .select(
      "id, workspace_id, project_id, vendor_id, message_type, amount_usd, currency, amount_original, source, metadata, cost_category_id, created_at, occurred_at, voided_at, feature, environment",
    )
    .eq("workspace_id", workspaceId)
    .eq("project_id", projectId)
    .eq("message_type", "subscription")
    .is("voided_at", null)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) throw error;

  const needle = vendor.toLowerCase().trim();
  return (
    (data ?? []).find((row) => {
      const meta = row.metadata as Record<string, unknown> | null;
      const name = meta?.vendor;
      return typeof name === "string" && name.toLowerCase().trim() === needle;
    }) ?? null
  );
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

export type CreateProjectInput = {
  slug: string;
  name: string;
  description?: string;
  budget?: number;
  currency?: string;
  environment?: "development" | "staging" | "production" | "other";
};

export class ProjectConflictError extends Error {
  constructor(slug: string) {
    super(`Project "${slug}" already exists`);
    this.name = "ProjectConflictError";
  }
}

export async function createProject(
  client: SupabaseClient<Database>,
  workspaceId: string,
  input: CreateProjectInput,
) {
  const existing = await findProjectBySlug(client, workspaceId, input.slug);
  if (existing) throw new ProjectConflictError(input.slug);

  const { data, error } = await client
    .from("projects")
    .insert({
      workspace_id: workspaceId,
      slug: input.slug,
      name: input.name,
      description: input.description ?? null,
      budget: input.budget ?? null,
      currency: input.currency ?? "USD",
      environment: input.environment ?? "production",
    })
    .select("id, slug, name, description, budget, currency, environment, created_at")
    .single();

  if (error) throw error;
  return data;
}

export type ProjectSummary = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  budget: number | null;
  currency: string;
  environment: string;
  status: string;
  archived: boolean;
  collection_id: string | null;
  created_at: string;
};

export async function listProjects(
  client: SupabaseClient<Database>,
  workspaceId: string,
  opts?: { includeArchived?: boolean },
): Promise<ProjectSummary[]> {
  let query = client
    .from("projects")
    .select(
      "id, slug, name, description, budget, currency, environment, status, archived, collection_id, created_at",
    )
    .eq("workspace_id", workspaceId)
    .order("sort_order")
    .order("name");

  if (!opts?.includeArchived) {
    query = query.eq("archived", false);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as ProjectSummary[];
}

export type UpdateProjectInput = {
  name?: string;
  description?: string | null;
  budget?: number | null;
  currency?: string;
  environment?: "development" | "staging" | "production" | "other";
  status?: string;
  archived?: boolean;
};

export async function updateProject(
  client: SupabaseClient<Database>,
  workspaceId: string,
  slug: string,
  patch: UpdateProjectInput,
) {
  const existing = await findProjectBySlug(client, workspaceId, slug);
  if (!existing) return null;

  const update: Database["public"]["Tables"]["projects"]["Update"] = {
    updated_at: new Date().toISOString(),
  };
  if (patch.name !== undefined) update.name = patch.name;
  if (patch.description !== undefined) update.description = patch.description;
  if (patch.budget !== undefined) update.budget = patch.budget;
  if (patch.currency !== undefined) update.currency = patch.currency;
  if (patch.environment !== undefined) update.environment = patch.environment;
  if (patch.status !== undefined) update.status = patch.status;
  if (patch.archived !== undefined) update.archived = patch.archived;

  const { data, error } = await client
    .from("projects")
    .update(update)
    .eq("workspace_id", workspaceId)
    .eq("slug", slug)
    .select(
      "id, slug, name, description, budget, currency, environment, status, archived, collection_id, created_at, updated_at",
    )
    .single();

  if (error) throw error;
  return data;
}

export type DbPricingRule = {
  id: string;
  workspace_id: string | null;
  provider: string;
  model: string | null;
  unit_type: string;
  rate_usd: number;
  notes: string | null;
};

export async function getPricingRules(
  client: SupabaseClient<Database>,
  workspaceId: string,
): Promise<DbPricingRule[]> {
  const { data, error } = await client
    .from("pricing_rules")
    .select("id, workspace_id, provider, model, unit_type, rate_usd, notes")
    .eq("active", true)
    .or(`workspace_id.is.null,workspace_id.eq.${workspaceId}`);

  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: row.id as string,
    workspace_id: row.workspace_id as string | null,
    provider: row.provider as string,
    model: (row.model as string | null) ?? null,
    unit_type: row.unit_type as string,
    rate_usd: Number(row.rate_usd),
    notes: (row.notes as string | null) ?? null,
  }));
}

function slugifyName(input: string): string {
  const slug = input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "vendor";
}

export async function upsertVendorByName(
  client: SupabaseClient<Database>,
  workspaceId: string,
  name: string,
  category?: string,
) {
  const slug = slugifyName(name);

  const { data: existing, error: lookupError } = await client
    .from("vendors")
    .select("id, slug, name")
    .eq("workspace_id", workspaceId)
    .eq("slug", slug)
    .maybeSingle();

  if (lookupError) throw lookupError;
  if (existing) return existing;

  const { data, error } = await client
    .from("vendors")
    .insert({
      workspace_id: workspaceId,
      slug,
      name,
      category: category ?? null,
    })
    .select("id, slug, name")
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
    .is("voided_at", null)
    .gte("occurred_at", start.toISOString());

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
  until?: Date | null;
  projectSlug?: string | null;
  messageType?: string | null;
  environment?: string | null;
  vendorSlug?: string | null;
};

export type SpendMessageRow = {
  id: string;
  amount_usd: number;
  amount_original: number | null;
  currency: string;
  message_type: string;
  created_at: string;
  occurred_at: string;
  project_id: string | null;
  vendor_id: string | null;
  cost_category_id: string | null;
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
    .select(
      "id, amount_usd, amount_original, currency, message_type, created_at, occurred_at, project_id, vendor_id, cost_category_id, environment, feature, source, metadata",
    )
    .eq("workspace_id", workspaceId)
    .is("voided_at", null)
    .order("occurred_at", { ascending: false });

  if (filters.since) {
    query = query.gte("occurred_at", filters.since.toISOString());
  }
  if (filters.until) {
    query = query.lte("occurred_at", filters.until.toISOString());
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

  let rows = data ?? [];

  if (filters.vendorSlug) {
    const vendorSlug = filters.vendorSlug.toLowerCase();
    const { data: vendor } = await client
      .from("vendors")
      .select("id, slug, name")
      .eq("workspace_id", workspaceId)
      .eq("slug", vendorSlug)
      .maybeSingle();

    rows = rows.filter((row) => {
      if (vendor?.id && row.vendor_id === vendor.id) return true;
      const metadata = (row.metadata as Record<string, unknown>) ?? {};
      const metaVendor =
        typeof metadata.vendor === "string" ? slugifyName(metadata.vendor) : null;
      const provider =
        typeof metadata.provider === "string" ? slugifyName(metadata.provider) : null;
      return metaVendor === vendorSlug || provider === vendorSlug;
    });
  }

  const projectIds = [...new Set(rows.map((r) => r.project_id).filter(Boolean))] as string[];
  let projectMap = new Map<string, { slug: string; name: string }>();
  if (projectIds.length) {
    const { data: projects, error: projectError } = await client
      .from("projects")
      .select("id, slug, name")
      .in("id", projectIds);
    if (projectError) throw projectError;
    projectMap = new Map((projects ?? []).map((p) => [p.id, { slug: p.slug, name: p.name }]));
  }

  return rows.map((row) => {
    const project = row.project_id ? projectMap.get(row.project_id as string) : null;
    return {
      id: row.id as string,
      amount_usd: Number(row.amount_usd ?? 0),
      amount_original:
        row.amount_original == null ? null : Number(row.amount_original),
      currency: (row.currency as string) ?? "USD",
      message_type: row.message_type as string,
      created_at: row.created_at as string,
      occurred_at: (row.occurred_at as string) ?? (row.created_at as string),
      project_id: row.project_id as string | null,
      vendor_id: row.vendor_id as string | null,
      cost_category_id: row.cost_category_id as string | null,
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
  daily_by_type: Array<{
    date: string;
    usage_usd: number;
    subscription_usd: number;
    expense_usd: number;
    total_usd: number;
  }>;
  daily_by_project: {
    series: Array<{ slug: string; name: string }>;
    daily: Array<{ date: string } & Record<string, number | string>>;
  };
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
    const day = row.occurred_at.slice(0, 10);
    byDay.set(day, (byDay.get(day) ?? 0) + row.amount_usd);
  }
  return [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, amount_usd]) => ({ date, amount_usd }));
}

function expenseBucket(messageType: string) {
  if (messageType === "usage") return "usage_usd" as const;
  if (messageType === "subscription") return "subscription_usd" as const;
  return "expense_usd" as const;
}

function fillDateRange<T extends { date: string }>(
  points: T[],
  createEmpty: (date: string) => T,
): T[] {
  if (!points.length) return [];
  const sorted = [...points].sort((a, b) => a.date.localeCompare(b.date));
  const map = new Map(sorted.map((point) => [point.date, point]));
  const first = sorted[0]!;
  const last = sorted[sorted.length - 1]!;
  const start = new Date(`${first.date}T00:00:00Z`);
  const end = new Date(`${last.date}T00:00:00Z`);
  const filled: T[] = [];

  for (let cursor = new Date(start); cursor <= end; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    const date = cursor.toISOString().slice(0, 10);
    filled.push(map.get(date) ?? createEmpty(date));
  }

  return filled;
}

function aggregateDailyByType(rows: SpendMessageRow[]) {
  const byDay = new Map<string, { usage_usd: number; subscription_usd: number; expense_usd: number }>();

  for (const row of rows) {
    const day = row.occurred_at.slice(0, 10);
    const current = byDay.get(day) ?? { usage_usd: 0, subscription_usd: 0, expense_usd: 0 };
    const bucket = expenseBucket(row.message_type);
    current[bucket] += row.amount_usd;
    byDay.set(day, current);
  }

  const points = [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, values]) => ({
      date,
      usage_usd: values.usage_usd,
      subscription_usd: values.subscription_usd,
      expense_usd: values.expense_usd,
      total_usd: values.usage_usd + values.subscription_usd + values.expense_usd,
    }));

  return fillDateRange(points, (date) => ({
    date,
    usage_usd: 0,
    subscription_usd: 0,
    expense_usd: 0,
    total_usd: 0,
  }));
}

function aggregateDailyByProject(
  rows: SpendMessageRow[],
  topProjects: Array<{ slug: string; name: string }>,
) {
  const trackedSlugs = new Set(topProjects.map((project) => project.slug));
  const series =
    topProjects.length > 0
      ? [...topProjects, { slug: "other", name: "Other" }]
      : [{ slug: "unassigned", name: "Unassigned" }];

  const byDay = new Map<string, Record<string, number>>();

  for (const row of rows) {
    const day = row.occurred_at.slice(0, 10);
    const slug = row.project_slug ?? "unassigned";
    const key = trackedSlugs.has(slug) ? slug : topProjects.length > 0 ? "other" : slug;
    const current = byDay.get(day) ?? {};
    current[key] = (current[key] ?? 0) + row.amount_usd;
    byDay.set(day, current);
  }

  const points = [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, values]) => {
      const point: { date: string } & Record<string, number | string> = { date };
      for (const item of series) {
        point[item.slug] = values[item.slug] ?? 0;
      }
      return point;
    });

  const emptyPoint = (date: string) => {
    const point: { date: string } & Record<string, number | string> = { date };
    for (const item of series) {
      point[item.slug] = 0;
    }
    return point;
  };

  return {
    series,
    daily: fillDateRange(points, emptyPoint),
  };
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
  const topProjects = by_project.slice(0, 5).map((project) => ({
    slug: project.slug,
    name: project.name,
  }));

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
    daily_by_type: aggregateDailyByType(rows),
    daily_by_project: aggregateDailyByProject(rows, topProjects),
    by_project,
    by_type,
    budget,
    top_project: top ? { slug: top.slug, name: top.name, amount_usd: top.amount_usd } : null,
  };
}

export type ObligationRow = Database["public"]["Tables"]["obligations"]["Row"];
export type ObligationInsert = Database["public"]["Tables"]["obligations"]["Insert"];
export type ObligationUpdate = Database["public"]["Tables"]["obligations"]["Update"];

const OBLIGATION_SELECT =
  "id, workspace_id, project_id, vendor_id, payee, amount_original, currency, amount_usd, due_date, remind_at, status, notes, paid_at, settled_message_id, source, created_at, updated_at";

export async function insertObligation(
  client: SupabaseClient<Database>,
  input: ObligationInsert,
) {
  const { data, error } = await client
    .from("obligations")
    .insert(input)
    .select(OBLIGATION_SELECT)
    .single();
  if (error) throw error;
  return data as ObligationRow;
}

export async function getObligationById(
  client: SupabaseClient<Database>,
  workspaceId: string,
  id: string,
) {
  const { data, error } = await client
    .from("obligations")
    .select(OBLIGATION_SELECT)
    .eq("workspace_id", workspaceId)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data as ObligationRow | null;
}

export async function listObligations(
  client: SupabaseClient<Database>,
  workspaceId: string,
  opts?: {
    status?: string;
    dueBefore?: string;
    dueAfter?: string;
    limit?: number;
  },
) {
  let query = client
    .from("obligations")
    .select(OBLIGATION_SELECT)
    .eq("workspace_id", workspaceId)
    .order("due_date", { ascending: true })
    .limit(opts?.limit ?? 200);

  if (opts?.status) query = query.eq("status", opts.status);
  if (opts?.dueBefore) query = query.lte("due_date", opts.dueBefore);
  if (opts?.dueAfter) query = query.gte("due_date", opts.dueAfter);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as ObligationRow[];
}

export async function updateObligation(
  client: SupabaseClient<Database>,
  workspaceId: string,
  id: string,
  patch: ObligationUpdate,
) {
  const { data, error } = await client
    .from("obligations")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("workspace_id", workspaceId)
    .eq("id", id)
    .select(OBLIGATION_SELECT)
    .maybeSingle();
  if (error) throw error;
  return data as ObligationRow | null;
}

export async function deleteObligation(
  client: SupabaseClient<Database>,
  workspaceId: string,
  id: string,
) {
  const { data, error } = await client
    .from("obligations")
    .delete()
    .eq("workspace_id", workspaceId)
    .eq("id", id)
    .select(OBLIGATION_SELECT)
    .maybeSingle();
  if (error) throw error;
  return data as ObligationRow | null;
}

export type UpcomingSubscriptionRenewal = {
  kind: "subscription";
  id: string;
  label: string;
  amount_usd: number;
  currency: string;
  amount_original: number | null;
  due_date: string;
  project_id: string | null;
  project_slug: string | null;
  project_name: string | null;
  interval: string | null;
  status: string | null;
};

export type UpcomingObligationItem = {
  kind: "obligation";
  id: string;
  label: string;
  amount_usd: number;
  currency: string;
  amount_original: number;
  due_date: string;
  remind_at: string | null;
  project_id: string | null;
  project_slug: string | null;
  project_name: string | null;
  status: string;
  overdue: boolean;
};

export type UpcomingPayment =
  | UpcomingSubscriptionRenewal
  | UpcomingObligationItem;

export async function listUpcomingPayments(
  client: SupabaseClient<Database>,
  workspaceId: string,
  opts?: { days?: number; includeOverdue?: boolean },
): Promise<UpcomingPayment[]> {
  const days = opts?.days ?? 30;
  const includeOverdue = opts?.includeOverdue ?? true;
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const todayStr = today.toISOString().slice(0, 10);
  const until = new Date(today);
  until.setUTCDate(until.getUTCDate() + days);
  const untilStr = until.toISOString().slice(0, 10);

  const obligations = await listObligations(client, workspaceId, {
    status: "open",
    dueBefore: untilStr,
    dueAfter: includeOverdue ? undefined : todayStr,
    limit: 200,
  });

  const projectIds = [
    ...new Set(
      obligations
        .map((o) => o.project_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ];

  const projectMap = new Map<string, { slug: string; name: string }>();
  if (projectIds.length) {
    const { data: projects, error } = await client
      .from("projects")
      .select("id, slug, name")
      .eq("workspace_id", workspaceId)
      .in("id", projectIds);
    if (error) throw error;
    for (const p of projects ?? []) {
      projectMap.set(String(p.id), { slug: String(p.slug), name: String(p.name) });
    }
  }

  const items: UpcomingPayment[] = obligations
    .filter((o) => includeOverdue || o.due_date >= todayStr)
    .map((o) => {
      const project = o.project_id ? projectMap.get(o.project_id) : undefined;
      return {
        kind: "obligation" as const,
        id: o.id,
        label: o.payee,
        amount_usd: Number(o.amount_usd),
        currency: o.currency,
        amount_original: Number(o.amount_original),
        due_date: o.due_date,
        remind_at: o.remind_at,
        project_id: o.project_id,
        project_slug: project?.slug ?? null,
        project_name: project?.name ?? null,
        status: o.status,
        overdue: o.due_date < todayStr,
      };
    });

  const { data: subs, error: subError } = await client
    .from("cost_messages")
    .select("id, amount_usd, currency, amount_original, project_id, metadata")
    .eq("workspace_id", workspaceId)
    .eq("message_type", "subscription")
    .is("voided_at", null)
    .limit(200);
  if (subError) throw subError;

  const subProjectIds = [
    ...new Set(
      (subs ?? [])
        .map((r) => r.project_id as string | null)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const missing = subProjectIds.filter((id) => !projectMap.has(id));
  if (missing.length) {
    const { data: projects, error } = await client
      .from("projects")
      .select("id, slug, name")
      .eq("workspace_id", workspaceId)
      .in("id", missing);
    if (error) throw error;
    for (const p of projects ?? []) {
      projectMap.set(String(p.id), { slug: String(p.slug), name: String(p.name) });
    }
  }

  for (const row of subs ?? []) {
    const meta = (row.metadata ?? {}) as Record<string, unknown>;
    const status = typeof meta.status === "string" ? meta.status : "active";
    if (status === "cancelled" || status === "paused") continue;
    const renewalRaw = meta.renewal_date;
    if (typeof renewalRaw !== "string" || !renewalRaw) continue;
    const due = renewalRaw.slice(0, 10);
    if (due > untilStr) continue;
    if (!includeOverdue && due < todayStr) continue;

    const project = row.project_id
      ? projectMap.get(String(row.project_id))
      : undefined;

    items.push({
      kind: "subscription",
      id: String(row.id),
      label: typeof meta.vendor === "string" ? meta.vendor : "Subscription",
      amount_usd: Number(row.amount_usd ?? 0),
      currency: String(row.currency ?? "USD"),
      amount_original:
        row.amount_original != null ? Number(row.amount_original) : null,
      due_date: due,
      project_id: (row.project_id as string | null) ?? null,
      project_slug: project?.slug ?? null,
      project_name: project?.name ?? null,
      interval: typeof meta.interval === "string" ? meta.interval : null,
      status,
    });
  }

  items.sort((a, b) => a.due_date.localeCompare(b.due_date));
  return items;
}

import { createServiceClient, findProjectBySlug, getMonthlySpend, createProject, ProjectConflictError, listProjects, updateProject, getPricingRules } from "@costmcp/db";
import { parseCostMessage, validateProjectSlug, computeUsageEstimate } from "@costmcp/core";
import {
  assertCanCreateProject,
  assertProjectAccess,
  filterProjectsByPolicy,
  filterSummaryByPolicy,
  persistCostMessage,
  requirePermission,
} from "@/lib/auth";
import type { McpAuthContext } from "@/lib/mcp/auth";

export interface McpTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  permission: string | null;
  handler: (ctx: McpAuthContext, args: Record<string, unknown>) => Promise<unknown>;
}

const str = (v: unknown): string | undefined => (typeof v === "string" ? v : undefined);
const num = (v: unknown): number | undefined => (typeof v === "number" ? v : undefined);
const bool = (v: unknown): boolean | undefined => (typeof v === "boolean" ? v : undefined);

function throwIfDenied(res: Response | null): void {
  if (!res) return;
  throw new McpToolError(
    res.status === 403 ? "Forbidden by API key conditions" : `Request failed (${res.status})`,
  );
}

export const MCP_TOOLS: McpTool[] = [
  {
    name: "log_usage",
    description:
      "Record AI usage cost (tokens, images, video, voice) for a project in CostMCP.",
    permission: "log_usage",
    inputSchema: {
      type: "object",
      properties: {
        project: { type: "string", description: "Project slug, e.g. slideshow-studio" },
        provider: { type: "string", description: "Provider name, e.g. openai" },
        model: { type: "string" },
        unit_type: {
          type: "string",
          description: "input_tokens, output_tokens, image, video_second, voice_character, etc.",
        },
        quantity: { type: "number" },
        estimated_cost: { type: "number" },
        feature: { type: "string" },
        batch_id: { type: "string" },
      },
      required: ["project", "provider", "unit_type", "quantity"],
    },
    handler: async (ctx, args) => {
      const envelope = parseCostMessage({
        project: str(args.project),
        source: "mcp",
        message: {
          type: "usage",
          provider: str(args.provider),
          model: str(args.model),
          unit_type: str(args.unit_type),
          quantity: num(args.quantity),
          estimated_cost: num(args.estimated_cost),
          feature: str(args.feature),
          batch_id: str(args.batch_id),
        },
      });
      try {
        return await persistCostMessage(ctx, envelope);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to log usage";
        throw new McpToolError(message);
      }
    },
  },
  {
    name: "add_expense",
    description: "Log a one-off expense or purchase for a project in CostMCP.",
    permission: "add_expenses",
    inputSchema: {
      type: "object",
      properties: {
        project: { type: "string" },
        vendor: { type: "string" },
        amount: { type: "number" },
        currency: { type: "string", default: "USD" },
        category: { type: "string" },
        notes: { type: "string" },
        timestamp: {
          type: "string",
          description: "When the expense occurred (ISO 8601). Defaults to now.",
        },
      },
      required: ["project", "vendor", "amount"],
    },
    handler: async (ctx, args) => {
      const envelope = parseCostMessage({
        project: str(args.project),
        source: "mcp",
        timestamp: str(args.timestamp),
        message: {
          type: "expense",
          vendor: str(args.vendor),
          amount: num(args.amount),
          currency: str(args.currency) ?? "USD",
          category: str(args.category),
          notes: str(args.notes),
        },
      });
      try {
        return await persistCostMessage(ctx, envelope);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to add expense";
        throw new McpToolError(message);
      }
    },
  },
  {
    name: "add_subscription",
    description: "Log a recurring subscription cost for a project in CostMCP.",
    permission: "manage_subscriptions",
    inputSchema: {
      type: "object",
      properties: {
        project: { type: "string" },
        vendor: { type: "string" },
        amount: { type: "number" },
        currency: { type: "string", default: "USD" },
        interval: {
          type: "string",
          description: "monthly, yearly, weekly, or quarterly",
        },
        category: { type: "string" },
        notes: { type: "string" },
        status: { type: "string" },
        timestamp: {
          type: "string",
          description: "When the subscription charge occurred (ISO 8601).",
        },
      },
      required: ["project", "vendor", "amount", "interval"],
    },
    handler: async (ctx, args) => {
      const envelope = parseCostMessage({
        project: str(args.project),
        source: "mcp",
        timestamp: str(args.timestamp),
        message: {
          type: "subscription",
          vendor: str(args.vendor),
          amount: num(args.amount),
          currency: str(args.currency) ?? "USD",
          interval: str(args.interval),
          category: str(args.category),
          notes: str(args.notes),
          status: str(args.status),
        },
      });
      try {
        return await persistCostMessage(ctx, envelope);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to add subscription";
        throw new McpToolError(message);
      }
    },
  },
  {
    name: "get_project_spend",
    description: "Get the spend breakdown and recent ledger for a project.",
    permission: "read_summaries",
    inputSchema: {
      type: "object",
      properties: {
        project: { type: "string", description: "Project slug" },
        from: { type: "string", description: "ISO date start" },
        to: { type: "string", description: "ISO date end" },
      },
      required: ["project"],
    },
    handler: async (ctx, args) => {
      const client = createServiceClient();
      const slug = str(args.project) ?? "";
      const project = await findProjectBySlug(client, ctx.workspaceId, slug);
      if (!project) throw new McpToolError("Project not found");

      throwIfDenied(assertProjectAccess(ctx, project));

      let query = client
        .from("cost_messages")
        .select(
          "id, message_type, amount_usd, unit_type, quantity, feature, batch_id, created_at, occurred_at",
        )
        .eq("workspace_id", ctx.workspaceId)
        .eq("project_id", project.id)
        .is("voided_at", null)
        .order("occurred_at", { ascending: false })
        .limit(200);

      const from = str(args.from);
      const to = str(args.to);
      if (from) query = query.gte("occurred_at", from);
      if (to) query = query.lte("occurred_at", to);

      const { data, error } = await query;
      if (error) throw error;
      const total = (data ?? []).reduce((s, r) => s + Number(r.amount_usd ?? 0), 0);
      return {
        project: { slug: project.slug, name: project.name, budget: project.budget },
        total_usd: total,
        message_count: data?.length ?? 0,
        messages: data ?? [],
      };
    },
  },
  {
    name: "get_budget_status",
    description: "Get remaining budget and alert status for the workspace.",
    permission: "read_summaries",
    inputSchema: { type: "object", properties: {} },
    handler: async (ctx) => {
      const client = createServiceClient();
      const start = new Date();
      start.setUTCDate(1);
      start.setUTCHours(0, 0, 0, 0);

      const { data: budgets, error: budgetError } = await client
        .from("budgets")
        .select("*")
        .eq("workspace_id", ctx.workspaceId);
      if (budgetError) throw budgetError;

      let spendQuery = client
        .from("cost_messages")
        .select("amount_usd, project_id")
        .eq("workspace_id", ctx.workspaceId)
        .is("voided_at", null)
        .gte("occurred_at", start.toISOString());

      if (ctx.projectId) {
        spendQuery = spendQuery.eq("project_id", ctx.projectId);
      }

      const { data: spendRows, error: spendError } = await spendQuery;
      if (spendError) throw spendError;

      const spentByScope = new Map<string, number>();
      for (const row of spendRows ?? []) {
        const key = row.project_id as string | null;
        if (!key) continue;
        spentByScope.set(key, (spentByScope.get(key) ?? 0) + Number(row.amount_usd ?? 0));
      }

      const totalSpent = (spendRows ?? []).reduce((s, r) => s + Number(r.amount_usd ?? 0), 0);
      const scopedBudgets = (budgets ?? []).filter((budget) => {
        if (!ctx.projectId) return true;
        return budget.scope_type === "workspace" || budget.scope_id === ctx.projectId;
      });

      return {
        budgets: scopedBudgets.map((budget) => {
          const spent = budget.scope_id
            ? (spentByScope.get(budget.scope_id as string) ?? 0)
            : totalSpent;
          const limit = Number(budget.amount ?? 0);
          const pct = limit > 0 ? spent / limit : 0;
          return {
            name: budget.name,
            scope_type: budget.scope_type,
            amount: limit,
            spent,
            remaining: Math.max(0, limit - spent),
            percent_used: pct,
            alert: pct >= 0.8,
          };
        }),
      };
    },
  },
  {
    name: "get_monthly_summary",
    description: "Get this month's total spend across all projects, split by type.",
    permission: "read_summaries",
    inputSchema: { type: "object", properties: {} },
    handler: async (ctx) => {
      const client = createServiceClient();
      const allRows = await getMonthlySpend(client, ctx.workspaceId);
      const rows = filterSummaryByPolicy(ctx, allRows);
      const sum = (pred: (t: string) => boolean) =>
        rows.filter((r) => pred(r.message_type)).reduce((s, r) => s + Number(r.amount_usd ?? 0), 0);

      const byProject = new Map<string, number>();
      for (const row of rows) {
        const slug = row.projects?.slug ?? "unknown";
        byProject.set(slug, (byProject.get(slug) ?? 0) + Number(row.amount_usd ?? 0));
      }
      const top = [...byProject.entries()].sort((a, b) => b[1] - a[1])[0];

      return {
        period: "month",
        total_usd: rows.reduce((s, r) => s + Number(r.amount_usd ?? 0), 0),
        usage_usd: sum((t) => t === "usage"),
        subscription_usd: sum((t) => t === "subscription"),
        expense_usd: sum((t) => t !== "usage" && t !== "subscription"),
        by_project: Object.fromEntries(byProject),
        top_project: top ? { slug: top[0], amount_usd: top[1] } : null,
        message_count: rows.length,
      };
    },
  },
  {
    name: "create_project",
    description:
      "Create a new project in the workspace before logging costs. Sets name, budget, and metadata upfront.",
    permission: "manage_projects",
    inputSchema: {
      type: "object",
      properties: {
        slug: {
          type: "string",
          description: "URL-safe project slug, e.g. slideshow-studio",
        },
        name: { type: "string", description: "Display name" },
        description: { type: "string" },
        budget: { type: "number", description: "Monthly budget in the project's currency" },
        currency: { type: "string", default: "USD" },
        environment: {
          type: "string",
          enum: ["development", "staging", "production", "other"],
          default: "production",
        },
      },
      required: ["slug", "name"],
    },
    handler: async (ctx, args) => {
      const slug = str(args.slug)?.trim() ?? "";
      const name = str(args.name)?.trim() ?? "";
      const description = str(args.description);
      const budget = num(args.budget);
      const currency = str(args.currency) ?? "USD";
      const environment = str(args.environment) as
        | "development"
        | "staging"
        | "production"
        | "other"
        | undefined;

      const slugError = validateProjectSlug(slug);
      if (slugError) throw new McpToolError(slugError);
      if (!name) throw new McpToolError("name is required");

      throwIfDenied(assertCanCreateProject(ctx, slug));

      try {
        const client = createServiceClient();
        const project = await createProject(client, ctx.workspaceId, {
          slug,
          name,
          description,
          budget,
          currency,
          environment,
        });
        return { project, created: true };
      } catch (err) {
        if (err instanceof ProjectConflictError) {
          throw new McpToolError(err.message);
        }
        const message = err instanceof Error ? err.message : "Failed to create project";
        throw new McpToolError(message);
      }
    },
  },
  {
    name: "list_projects",
    description: "List all projects in the workspace with metadata (slug, name, budget, environment).",
    permission: "read_summaries",
    inputSchema: {
      type: "object",
      properties: {
        include_archived: {
          type: "boolean",
          description: "Include archived projects (default false)",
        },
      },
    },
    handler: async (ctx, args) => {
      const client = createServiceClient();
      const includeArchived = bool(args.include_archived) ?? false;
      const allProjects = await listProjects(client, ctx.workspaceId, { includeArchived });
      const projects = filterProjectsByPolicy(ctx, allProjects);
      return { projects, count: projects.length };
    },
  },
  {
    name: "update_project",
    description: "Update an existing project's name, budget, description, environment, or archive status.",
    permission: "manage_projects",
    inputSchema: {
      type: "object",
      properties: {
        slug: { type: "string", description: "Project slug to update" },
        name: { type: "string" },
        description: { type: "string" },
        budget: { type: "number", description: "Monthly budget, or null to clear" },
        currency: { type: "string" },
        environment: {
          type: "string",
          enum: ["development", "staging", "production", "other"],
        },
        status: { type: "string" },
        archived: { type: "boolean" },
      },
      required: ["slug"],
    },
    handler: async (ctx, args) => {
      const slug = str(args.slug)?.trim() ?? "";
      if (!slug) throw new McpToolError("slug is required");

      const patch = {
        name: str(args.name)?.trim(),
        description: args.description === null ? null : str(args.description),
        budget: args.budget === null ? null : num(args.budget),
        currency: str(args.currency),
        environment: str(args.environment) as
          | "development"
          | "staging"
          | "production"
          | "other"
          | undefined,
        status: str(args.status),
        archived: bool(args.archived),
      };

      const hasUpdate = Object.values(patch).some((v) => v !== undefined);
      if (!hasUpdate) throw new McpToolError("At least one field to update is required");

      if (patch.name !== undefined && !patch.name) {
        throw new McpToolError("name cannot be empty");
      }

      if (patch.budget !== undefined && patch.budget !== null && patch.budget < 0) {
        throw new McpToolError("budget must be a non-negative number or null");
      }

      const client = createServiceClient();
      const existing = await findProjectBySlug(client, ctx.workspaceId, slug);
      if (!existing) throw new McpToolError("Project not found");

      throwIfDenied(assertProjectAccess(ctx, existing));

      try {
        const project = await updateProject(client, ctx.workspaceId, slug, patch);
        if (!project) throw new McpToolError("Project not found");
        return { project, updated: true };
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to update project";
        throw new McpToolError(message);
      }
    },
  },
  {
    name: "estimate_cost",
    description:
      "Estimate USD cost for AI usage before logging. Looks up pricing rules by provider, model, and unit type.",
    permission: "estimate_costs",
    inputSchema: {
      type: "object",
      properties: {
        provider: { type: "string", description: "Provider name, e.g. openai" },
        model: { type: "string", description: "Model name, e.g. gpt-4o-mini" },
        unit_type: {
          type: "string",
          description: "input_tokens, output_tokens, image, video_second, voice_character, etc.",
        },
        quantity: { type: "number", description: "Number of units to estimate" },
      },
      required: ["provider", "unit_type", "quantity"],
    },
    handler: async (ctx, args) => {
      const provider = str(args.provider)?.trim() ?? "";
      const unit_type = str(args.unit_type)?.trim() ?? "";
      const quantity = num(args.quantity);
      const model = str(args.model);

      if (!provider) throw new McpToolError("provider is required");
      if (!unit_type) throw new McpToolError("unit_type is required");
      if (quantity === undefined || quantity <= 0) {
        throw new McpToolError("quantity must be a positive number");
      }

      const client = createServiceClient();
      const rules = await getPricingRules(client, ctx.workspaceId);
      const estimate = computeUsageEstimate({ provider, model, unit_type, quantity }, rules);
      return {
        ...estimate,
        pricing_rule_found: estimate.matched_rule !== null,
      };
    },
  },
];

export function findTool(name: string): McpTool | undefined {
  return MCP_TOOLS.find((t) => t.name === name);
}

export function ensurePermission(ctx: McpAuthContext, tool: McpTool): void {
  if (!tool.permission) return;
  const denied = requirePermission(ctx, tool.permission);
  if (denied) {
    throw new McpToolError(`Missing permission: ${tool.permission}`);
  }
}

export class McpToolError extends Error {}

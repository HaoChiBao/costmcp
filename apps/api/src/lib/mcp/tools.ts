import { createServiceClient, findProjectBySlug, getMonthlySpend } from "@costmcp/db";
import { parseCostMessage } from "@costmcp/core";
import { persistCostMessage, requirePermission } from "@/lib/auth";
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
      return persistCostMessage(ctx, envelope);
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
      },
      required: ["project", "vendor", "amount"],
    },
    handler: async (ctx, args) => {
      const envelope = parseCostMessage({
        project: str(args.project),
        source: "mcp",
        message: {
          type: "expense",
          vendor: str(args.vendor),
          amount: num(args.amount),
          currency: str(args.currency) ?? "USD",
          category: str(args.category),
          notes: str(args.notes),
        },
      });
      return persistCostMessage(ctx, envelope);
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
      if (!project) throw new Error("Project not found");

      let query = client
        .from("cost_messages")
        .select("id, message_type, amount_usd, unit_type, quantity, feature, batch_id, created_at")
        .eq("workspace_id", ctx.workspaceId)
        .eq("project_id", project.id)
        .order("created_at", { ascending: false })
        .limit(200);

      const from = str(args.from);
      const to = str(args.to);
      if (from) query = query.gte("created_at", from);
      if (to) query = query.lte("created_at", to);

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

      const { data: spendRows, error: spendError } = await client
        .from("cost_messages")
        .select("amount_usd, project_id")
        .eq("workspace_id", ctx.workspaceId)
        .gte("created_at", start.toISOString());
      if (spendError) throw spendError;

      const spentByScope = new Map<string, number>();
      for (const row of spendRows ?? []) {
        const key = row.project_id as string | null;
        if (!key) continue;
        spentByScope.set(key, (spentByScope.get(key) ?? 0) + Number(row.amount_usd ?? 0));
      }

      const totalSpent = (spendRows ?? []).reduce((s, r) => s + Number(r.amount_usd ?? 0), 0);
      return {
        budgets: (budgets ?? []).map((budget) => {
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
      const rows = await getMonthlySpend(client, ctx.workspaceId);
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

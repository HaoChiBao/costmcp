#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const API_BASE = process.env.COSTMCP_API_URL ?? "http://localhost:3000";
const API_KEY = process.env.COSTMCP_API_KEY;

async function apiFetch(path: string, init?: RequestInit) {
  if (!API_KEY) throw new Error("COSTMCP_API_KEY is required");
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${API_KEY}`,
      ...(init?.headers ?? {}),
    },
  });
  const body = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) {
    throw new Error(typeof body.error === "string" ? body.error : res.statusText);
  }
  return body;
}

const server = new McpServer({
  name: "costmcp",
  version: "0.0.1",
});

server.tool(
  "log_usage",
  "Record AI usage cost (tokens, images, video, voice) for a project",
  {
    project: z.string().describe("Project slug, e.g. slideshow-studio"),
    provider: z.string().describe("Provider name, e.g. openai"),
    model: z.string().optional(),
    unit_type: z
      .string()
      .describe("Unit type: input_tokens, output_tokens, image, video_second, voice_character, etc."),
    quantity: z.number().positive(),
    estimated_cost: z.number().nonnegative().optional(),
    feature: z.string().optional(),
    batch_id: z.string().optional(),
  },
  async (args) => {
    const result = await apiFetch("/api/v1/messages", {
      method: "POST",
      body: JSON.stringify({
        project: args.project,
        source: "mcp",
        message: {
          type: "usage",
          provider: args.provider,
          model: args.model,
          unit_type: args.unit_type,
          quantity: args.quantity,
          estimated_cost: args.estimated_cost,
          feature: args.feature,
          batch_id: args.batch_id,
        },
      }),
    });
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  },
);

server.tool(
  "add_expense",
  "Log a one-off expense or purchase for a project",
  {
    project: z.string(),
    vendor: z.string(),
    amount: z.number().refine((n) => n !== 0, "Amount must be non-zero"),
    currency: z.string().default("USD"),
    category: z.string().optional(),
    notes: z.string().optional(),
    timestamp: z
      .string()
      .datetime()
      .optional()
      .describe("When the expense occurred (ISO 8601). Defaults to now."),
  },
  async (args) => {
    const result = await apiFetch("/api/v1/messages", {
      method: "POST",
      body: JSON.stringify({
        project: args.project,
        source: "mcp",
        timestamp: args.timestamp,
        message: {
          type: "expense",
          vendor: args.vendor,
          amount: args.amount,
          currency: args.currency,
          category: args.category,
          notes: args.notes,
        },
      }),
    });
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  },
);

server.tool(
  "add_subscription",
  "Log a recurring subscription cost for a project",
  {
    project: z.string(),
    vendor: z.string(),
    amount: z.number().refine((n) => n !== 0, "Amount must be non-zero"),
    currency: z.string().default("USD"),
    interval: z.enum(["monthly", "yearly", "weekly", "quarterly"]),
    category: z.string().optional(),
    notes: z.string().optional(),
    status: z.enum(["active", "trial", "paused", "cancelled"]).optional(),
    renewal_date: z
      .string()
      .optional()
      .describe("Next renewal date (YYYY-MM-DD or ISO 8601)"),
    started_at: z
      .string()
      .optional()
      .describe("Billing start date (YYYY-MM-DD or ISO 8601)"),
    timestamp: z.string().optional().describe("Alias for started_at"),
  },
  async (args) => {
    const result = await apiFetch("/api/v1/messages", {
      method: "POST",
      body: JSON.stringify({
        project: args.project,
        source: "mcp",
        timestamp: args.started_at ?? args.timestamp,
        message: {
          type: "subscription",
          vendor: args.vendor,
          amount: args.amount,
          currency: args.currency,
          interval: args.interval,
          category: args.category,
          notes: args.notes,
          status: args.status,
          renewal_date: args.renewal_date,
        },
      }),
    });
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  },
);

server.tool(
  "list_subscriptions",
  "List subscription records with renewal and billing dates",
  {
    project: z.string().optional().describe("Filter by project slug"),
  },
  async (args) => {
    const params = new URLSearchParams();
    if (args.project) params.set("project", args.project);
    const qs = params.toString();
    const result = await apiFetch(`/api/v1/subscriptions${qs ? `?${qs}` : ""}`);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  },
);

server.tool(
  "update_subscription",
  "Update an existing subscription (by id or project+vendor)",
  {
    id: z.string().optional(),
    project: z.string().optional(),
    vendor: z.string().optional(),
    amount: z.number().optional(),
    currency: z.string().optional(),
    interval: z.enum(["monthly", "yearly", "weekly", "quarterly"]).optional(),
    category: z.string().optional(),
    notes: z.string().optional(),
    status: z.enum(["active", "trial", "paused", "cancelled"]).optional(),
    renewal_date: z.string().optional(),
    started_at: z.string().optional(),
  },
  async (args) => {
    const { id, project, vendor, ...patch } = args;
    let path = "/api/v1/subscriptions";
    if (id) path += `/${encodeURIComponent(id)}`;
    else if (!project || !vendor) {
      throw new Error("id or (project and vendor) is required");
    } else {
      const listed = (await apiFetch(
        `/api/v1/subscriptions?project=${encodeURIComponent(project)}`,
      )) as { subscriptions?: Array<{ id: string; vendor: string | null }> };
      const match = listed.subscriptions?.find(
        (s) => s.vendor?.toLowerCase() === vendor.toLowerCase(),
      );
      if (!match?.id) throw new Error(`Subscription not found for vendor "${vendor}"`);
      path += `/${encodeURIComponent(match.id)}`;
    }
    const result = await apiFetch(path, {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  },
);

server.tool(
  "add_obligation",
  "Track money you owe: payee, amount, and due date (not spend until settled)",
  {
    payee: z.string(),
    amount: z.number().positive(),
    currency: z.string().default("USD"),
    due_date: z.string().describe("YYYY-MM-DD or ISO datetime"),
    remind_at: z.string().optional(),
    project: z.string().optional(),
    vendor: z.string().optional(),
    notes: z.string().optional(),
  },
  async (args) => {
    const result = await apiFetch("/api/v1/obligations", {
      method: "POST",
      body: JSON.stringify({
        payee: args.payee,
        amount: args.amount,
        currency: args.currency,
        due_date: args.due_date,
        remind_at: args.remind_at,
        project: args.project,
        vendor: args.vendor,
        notes: args.notes,
        source: "mcp",
      }),
    });
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  },
);

server.tool(
  "list_obligations",
  "List payment obligations (who you owe)",
  {
    status: z.enum(["open", "paid", "cancelled"]).optional(),
    due_before: z.string().optional(),
    due_after: z.string().optional(),
  },
  async (args) => {
    const params = new URLSearchParams();
    if (args.status) params.set("status", args.status);
    if (args.due_before) params.set("due_before", args.due_before);
    if (args.due_after) params.set("due_after", args.due_after);
    const qs = params.toString();
    const result = await apiFetch(`/api/v1/obligations${qs ? `?${qs}` : ""}`);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  },
);

server.tool(
  "update_obligation",
  "Update an obligation's amount, due date, notes, or status",
  {
    id: z.string().describe("Obligation UUID"),
    payee: z.string().optional(),
    amount: z.number().positive().optional(),
    currency: z.string().optional(),
    due_date: z.string().optional(),
    remind_at: z.string().optional(),
    project: z.string().optional(),
    vendor: z.string().optional(),
    notes: z.string().optional(),
    status: z.enum(["open", "paid", "cancelled"]).optional(),
  },
  async (args) => {
    const { id, ...patch } = args;
    const result = await apiFetch(`/api/v1/obligations/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  },
);

server.tool(
  "settle_obligation",
  "Mark an obligation paid and post a matching expense",
  {
    id: z.string().describe("Obligation UUID"),
    project: z.string().optional().describe("Required if obligation has no project"),
    category: z.string().optional(),
    notes: z.string().optional(),
    occurred_at: z.string().datetime().optional(),
  },
  async (args) => {
    const { id, ...body } = args;
    const result = await apiFetch(
      `/api/v1/obligations/${encodeURIComponent(id)}/settle`,
      {
        method: "POST",
        body: JSON.stringify(body),
      },
    );
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  },
);

server.tool(
  "list_upcoming_payments",
  "List upcoming obligations and subscription renewals",
  {
    days: z.number().positive().optional().describe("Lookahead days (default 30)"),
    include_overdue: z.boolean().optional(),
  },
  async (args) => {
    const params = new URLSearchParams();
    if (args.days) params.set("days", String(args.days));
    if (args.include_overdue === false) params.set("include_overdue", "0");
    const qs = params.toString();
    const result = await apiFetch(`/api/v1/upcoming${qs ? `?${qs}` : ""}`);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  },
);

server.tool(
  "create_project",
  "Create a new project in the workspace before logging costs",
  {
    slug: z.string().describe("URL-safe project slug, e.g. slideshow-studio"),
    name: z.string().describe("Display name"),
    description: z.string().optional(),
    budget: z.number().nonnegative().optional().describe("Monthly budget"),
    currency: z.string().default("USD"),
    environment: z
      .enum(["development", "staging", "production", "other"])
      .default("production"),
  },
  async (args) => {
    const result = await apiFetch("/api/v1/projects", {
      method: "POST",
      body: JSON.stringify({
        slug: args.slug,
        name: args.name,
        description: args.description,
        budget: args.budget,
        currency: args.currency,
        environment: args.environment,
      }),
    });
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  },
);

server.tool(
  "list_projects",
  "List all projects in the workspace",
  {
    include_archived: z.boolean().optional().describe("Include archived projects"),
  },
  async (args) => {
    const params = new URLSearchParams();
    if (args.include_archived) params.set("include_archived", "true");
    const qs = params.toString();
    const result = await apiFetch(`/api/v1/projects${qs ? `?${qs}` : ""}`);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  },
);

server.tool(
  "update_project",
  "Update an existing project's name, budget, description, or archive status",
  {
    slug: z.string().describe("Project slug to update"),
    name: z.string().optional(),
    description: z.string().optional(),
    budget: z.number().nonnegative().nullable().optional(),
    currency: z.string().optional(),
    environment: z.enum(["development", "staging", "production", "other"]).optional(),
    status: z.string().optional(),
    archived: z.boolean().optional(),
  },
  async (args) => {
    const { slug, ...patch } = args;
    const result = await apiFetch(`/api/v1/projects/${encodeURIComponent(slug)}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  },
);

server.tool(
  "estimate_cost",
  "Estimate USD cost for AI usage before logging",
  {
    provider: z.string().describe("Provider name, e.g. openai"),
    model: z.string().optional().describe("Model name, e.g. gpt-4o-mini"),
    unit_type: z
      .string()
      .describe("Unit type: input_tokens, output_tokens, image, video_second, etc."),
    quantity: z.number().positive(),
  },
  async (args) => {
    const result = await apiFetch("/api/v1/estimate", {
      method: "POST",
      body: JSON.stringify(args),
    });
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  },
);

server.tool(
  "get_project_spend",
  "Get spend breakdown for a project",
  {
    project: z.string().describe("Project slug"),
    from: z.string().optional().describe("ISO date start"),
    to: z.string().optional().describe("ISO date end"),
  },
  async (args) => {
    const params = new URLSearchParams();
    if (args.from) params.set("from", args.from);
    if (args.to) params.set("to", args.to);
    const qs = params.toString();
    const result = await apiFetch(
      `/api/v1/projects/${encodeURIComponent(args.project)}/spend${qs ? `?${qs}` : ""}`,
    );
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  },
);

server.tool(
  "get_budget_status",
  "Get remaining budget and alert status",
  {},
  async () => {
    const result = await apiFetch("/api/v1/budgets/status");
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  },
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

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
    timestamp: z.string().datetime().optional(),
  },
  async (args) => {
    const result = await apiFetch("/api/v1/messages", {
      method: "POST",
      body: JSON.stringify({
        project: args.project,
        source: "mcp",
        timestamp: args.timestamp,
        message: {
          type: "subscription",
          vendor: args.vendor,
          amount: args.amount,
          currency: args.currency,
          interval: args.interval,
          category: args.category,
          notes: args.notes,
          status: args.status,
        },
      }),
    });
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

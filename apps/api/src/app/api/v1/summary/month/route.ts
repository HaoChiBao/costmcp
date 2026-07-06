import { createServiceClient, getMonthlySpend } from "@costmcp/db";
import type { NextRequest } from "next/server";
import { authenticateRequest, requirePermission } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if (auth instanceof Response) return auth;

  const denied = requirePermission(auth, "read_summaries");
  if (denied) return denied;

  try {
    const client = createServiceClient();
    const rows = await getMonthlySpend(client, auth.workspaceId);

    const total = rows.reduce((sum, row) => sum + Number(row.amount_usd ?? 0), 0);
    const usage = rows
      .filter((row) => row.message_type === "usage")
      .reduce((sum, row) => sum + Number(row.amount_usd ?? 0), 0);
    const expenses = rows
      .filter((row) => row.message_type !== "usage" && row.message_type !== "subscription")
      .reduce((sum, row) => sum + Number(row.amount_usd ?? 0), 0);
    const subscriptions = rows
      .filter((row) => row.message_type === "subscription")
      .reduce((sum, row) => sum + Number(row.amount_usd ?? 0), 0);

    const byProject = new Map<string, number>();
    for (const row of rows) {
      const slug = row.projects?.slug ?? "unknown";
      byProject.set(slug, (byProject.get(slug) ?? 0) + Number(row.amount_usd ?? 0));
    }

    const topProject = [...byProject.entries()].sort((a, b) => b[1] - a[1])[0];

    return Response.json({
      period: "month",
      total_usd: total,
      usage_usd: usage,
      expense_usd: expenses,
      subscription_usd: subscriptions,
      by_project: Object.fromEntries(byProject),
      top_project: topProject ? { slug: topProject[0], amount_usd: topProject[1] } : null,
      message_count: rows.length,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load summary";
    return Response.json({ error: message }, { status: 500 });
  }
}

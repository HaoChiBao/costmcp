import { createServiceClient } from "@costmcp/db";
import type { NextRequest } from "next/server";
import { authenticateRequest, requirePermission } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if (auth instanceof Response) return auth;

  const denied = requirePermission(auth, "read_summaries");
  if (denied) return denied;

  try {
    const client = createServiceClient();
    const start = new Date();
    start.setUTCDate(1);
    start.setUTCHours(0, 0, 0, 0);

    const { data: budgets, error: budgetError } = await client
      .from("budgets")
      .select("*")
      .eq("workspace_id", auth.workspaceId);

    if (budgetError) throw budgetError;

    let spendQuery = client
      .from("cost_messages")
      .select("amount_usd, project_id")
      .eq("workspace_id", auth.workspaceId)
      .gte("created_at", start.toISOString());

    if (auth.projectId) {
      spendQuery = spendQuery.eq("project_id", auth.projectId);
    }

    const { data: spendRows, error: spendError } = await spendQuery;

    if (spendError) throw spendError;

    const spentByScope = new Map<string, number>();
    for (const row of spendRows ?? []) {
      const key = row.project_id as string | null;
      if (!key) continue;
      spentByScope.set(key, (spentByScope.get(key) ?? 0) + Number(row.amount_usd ?? 0));
    }

    const scopedBudgets = (budgets ?? []).filter((budget) => {
      if (!auth.projectId) return true;
      return budget.scope_type === "workspace" || budget.scope_id === auth.projectId;
    });

    const statuses = scopedBudgets.map((budget) => {
      const spent = budget.scope_id
        ? (spentByScope.get(budget.scope_id as string) ?? 0)
        : (spendRows ?? []).reduce((s, r) => s + Number(r.amount_usd ?? 0), 0);
      const limit = Number(budget.amount ?? 0);
      const remaining = Math.max(0, limit - spent);
      const pct = limit > 0 ? spent / limit : 0;
      return {
        id: budget.id,
        name: budget.name,
        scope_type: budget.scope_type,
        amount: limit,
        spent,
        remaining,
        percent_used: pct,
        alert: pct >= 0.8,
      };
    });

    return Response.json({ budgets: statuses });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load budgets";
    return Response.json({ error: message }, { status: 500 });
  }
}

import { createServiceClient, findProjectBySlug } from "@costmcp/db";
import type { NextRequest } from "next/server";
import { authenticateRequest, requirePermission } from "@/lib/auth";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ slug: string }> },
) {
  const auth = await authenticateRequest(request);
  if (auth instanceof Response) return auth;

  const denied = requirePermission(auth, "read_summaries");
  if (denied) return denied;

  const { slug } = await context.params;
  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  try {
    const client = createServiceClient();
    const project = await findProjectBySlug(client, auth.workspaceId, slug);
    if (!project) {
      return Response.json({ error: "Project not found" }, { status: 404 });
    }

    let query = client
      .from("cost_messages")
      .select("id, message_type, amount_usd, unit_type, quantity, feature, batch_id, created_at")
      .eq("workspace_id", auth.workspaceId)
      .eq("project_id", project.id)
      .order("created_at", { ascending: false })
      .limit(500);

    if (from) query = query.gte("created_at", from);
    if (to) query = query.lte("created_at", to);

    const { data, error } = await query;
    if (error) throw error;

    const total = (data ?? []).reduce((sum, row) => sum + Number(row.amount_usd ?? 0), 0);

    return Response.json({
      project: { slug: project.slug, name: project.name, budget: project.budget },
      total_usd: total,
      message_count: data?.length ?? 0,
      messages: data ?? [],
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load project spend";
    return Response.json({ error: message }, { status: 500 });
  }
}

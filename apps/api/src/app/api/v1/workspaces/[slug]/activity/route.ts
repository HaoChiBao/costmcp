import { getWorkspaceSpendMessages } from "@costmcp/db";
import {
  authenticateWorkspaceAccess,
  parsePeriod,
  periodStart,
} from "@/lib/workspace-auth";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const auth = await authenticateWorkspaceAccess(request, slug);
  if (auth instanceof Response) return auth;

  const url = new URL(request.url);
  const period = parsePeriod(url.searchParams.get("period"));
  const since = periodStart(period);
  const project = url.searchParams.get("project");
  const messageType = url.searchParams.get("type");
  const environment = url.searchParams.get("environment");
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 25), 100);

  try {
    const rows = await getWorkspaceSpendMessages(auth.userClient, auth.workspaceId, {
      since,
      projectSlug: project,
      messageType,
      environment,
    });
    return Response.json({
      period,
      count: rows.length,
      activity: rows.slice(0, limit).map((row) => ({
        id: row.id,
        amount_usd: row.amount_usd,
        amount_original: row.amount_original,
        currency: row.currency,
        message_type: row.message_type,
        created_at: row.created_at,
        occurred_at: row.occurred_at,
        project_slug: row.project_slug,
        project_name: row.project_name,
        environment: row.environment,
        feature: row.feature,
        source: row.source,
        cost_category_id: row.cost_category_id,
        metadata: row.metadata,
        label: formatActivityLabel(row),
        vendor:
          typeof row.metadata.vendor === "string" ? row.metadata.vendor : null,
        category:
          typeof row.metadata.category === "string" ? row.metadata.category : null,
        notes: typeof row.metadata.notes === "string" ? row.metadata.notes : null,
        expense_type:
          typeof row.metadata.expense_type === "string"
            ? row.metadata.expense_type
            : null,
        interval:
          typeof row.metadata.interval === "string" ? row.metadata.interval : null,
        status:
          typeof row.metadata.status === "string" ? row.metadata.status : null,
      })),
    });
  } catch {
    return Response.json({ error: "Failed to load activity" }, { status: 500 });
  }
}

function formatActivityLabel(row: {
  message_type: string;
  project_name: string | null;
  feature: string | null;
  metadata: Record<string, unknown>;
}) {
  const project = row.project_name ?? "Unassigned";
  const vendor =
    typeof row.metadata.vendor === "string" ? row.metadata.vendor : null;
  const category =
    typeof row.metadata.category === "string" ? row.metadata.category : null;
  const notes = typeof row.metadata.notes === "string" ? row.metadata.notes : null;

  if (row.message_type === "expense" || row.message_type === "subscription") {
    const parts = [vendor ?? row.message_type];
    if (category) parts.push(category);
    else if (notes) parts.push(notes);
    else parts.push(project);
    return parts.join(" · ");
  }

  const feature = row.feature ? ` · ${row.feature}` : "";
  const provider =
    typeof row.metadata.provider === "string" ? ` · ${row.metadata.provider}` : "";
  return `${row.message_type} · ${project}${feature}${provider}`;
}

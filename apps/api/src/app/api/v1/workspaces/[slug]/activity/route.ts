import { getWorkspaceSpendMessages } from "@costmcp/db";
import {
  authenticateWorkspaceAccess,
  parsePeriod,
  periodStart,
} from "@/lib/workspace-auth";
import { parseSpendQueryFilters, toDbSpendFilters } from "@/lib/spend-query";

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
  const queryFilters = parseSpendQueryFilters(url);
  const format = url.searchParams.get("format");
  const limit = Math.min(Number(url.searchParams.get("limit") ?? (format === "csv" ? 5000 : 25)), 5000);

  try {
    const rows = await getWorkspaceSpendMessages(auth.userClient, auth.workspaceId, {
      since,
      ...toDbSpendFilters(queryFilters),
    });

    const activity = rows.slice(0, limit).map((row) => ({
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
    }));

    if (format === "csv") {
      const csv = buildCsv(activity);
      const filename = `costmcp-${slug}-${period}.csv`;
      return new Response(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${filename}"`,
        },
      });
    }

    return Response.json({
      period,
      count: rows.length,
      activity,
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

function csvEscape(value: string | number | null | undefined) {
  const text = value == null ? "" : String(value);
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function buildCsv(
  rows: Array<{
    occurred_at: string;
    created_at: string;
    label: string;
    message_type: string;
    project_name: string | null;
    project_slug: string | null;
    environment: string | null;
    vendor: string | null;
    amount_usd: number;
    currency?: string;
    amount_original?: number | null;
    source?: string;
    feature?: string | null;
  }>,
) {
  const header = [
    "date",
    "type",
    "label",
    "project",
    "environment",
    "vendor",
    "amount_usd",
    "currency",
    "amount_original",
    "source",
    "feature",
  ];
  const lines = rows.map((row) =>
    [
      row.occurred_at ?? row.created_at,
      row.message_type,
      row.label,
      row.project_name ?? row.project_slug ?? "",
      row.environment ?? "",
      row.vendor ?? "",
      row.amount_usd,
      row.currency ?? "USD",
      row.amount_original ?? "",
      row.source ?? "",
      row.feature ?? "",
    ]
      .map(csvEscape)
      .join(","),
  );
  return [header.join(","), ...lines].join("\n");
}

import {
  parseCostMessage,
  parseCostMessageBatch,
  type CostMessageEnvelope,
} from "@costmcp/core";
import type { NextRequest } from "next/server";
import {
  authenticateRequest,
  persistCostMessage,
  requirePermission,
} from "@/lib/auth";

function permissionForEnvelope(envelope: CostMessageEnvelope): string {
  switch (envelope.message.type) {
    case "expense":
      return "add_expenses";
    case "subscription":
      return "manage_subscriptions";
    case "usage":
    case "batch":
    case "allocation":
    default:
      return "log_usage";
  }
}

export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if (auth instanceof Response) return auth;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const envelopes: CostMessageEnvelope[] = Array.isArray(body)
    ? parseCostMessageBatch(body)
    : [parseCostMessage(body)];

  for (const envelope of envelopes) {
    const denied = requirePermission(auth, permissionForEnvelope(envelope));
    if (denied) return denied;
  }

  try {
    const results: Awaited<ReturnType<typeof persistCostMessage>>[] = [];
    for (const envelope of envelopes) {
      results.push(await persistCostMessage(auth, envelope));
    }
    return Response.json(Array.isArray(body) ? { messages: results } : results[0], {
      status: 201,
    });
  } catch (err) {
    const status =
      err && typeof err === "object" && "status" in err && typeof (err as { status: unknown }).status === "number"
        ? (err as { status: number }).status
        : 500;
    const code =
      err && typeof err === "object" && "code" in err
        ? String((err as { code: unknown }).code)
        : undefined;
    const bodyPayload =
      err && typeof err === "object" && "body" in err
        ? (err as { body: unknown }).body
        : undefined;
    if (bodyPayload && typeof bodyPayload === "object") {
      return Response.json(bodyPayload, { status });
    }
    const message = err instanceof Error ? err.message : "Failed to persist message";
    return Response.json(
      code ? { error: code, error_description: message } : { error: message },
      { status },
    );
  }
}

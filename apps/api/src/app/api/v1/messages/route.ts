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

export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if (auth instanceof Response) return auth;

  const denied = requirePermission(auth, "log_usage");
  if (denied) return denied;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const envelopes: CostMessageEnvelope[] = Array.isArray(body)
    ? parseCostMessageBatch(body)
    : [parseCostMessage(body)];

  try {
    const results: Awaited<ReturnType<typeof persistCostMessage>>[] = [];
    for (const envelope of envelopes) {
      results.push(await persistCostMessage(auth, envelope));
    }
    return Response.json(Array.isArray(body) ? { messages: results } : results[0], {
      status: 201,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to persist message";
    return Response.json({ error: message }, { status: 500 });
  }
}

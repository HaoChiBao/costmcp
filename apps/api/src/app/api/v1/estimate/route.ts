import { computeUsageEstimate } from "@costmcp/core";
import { createServiceClient, getPricingRules } from "@costmcp/db";
import type { NextRequest } from "next/server";
import { authenticateRequest, requirePermission } from "@/lib/auth";

type EstimateBody = {
  provider?: string;
  model?: string;
  unit_type?: string;
  quantity?: number;
};

export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if (auth instanceof Response) return auth;

  const denied = requirePermission(auth, "estimate_costs");
  if (denied) return denied;

  let body: EstimateBody;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const provider = body.provider?.trim() ?? "";
  const unit_type = body.unit_type?.trim() ?? "";
  const quantity = body.quantity;
  const model = body.model?.trim();

  if (!provider) {
    return Response.json({ error: "provider is required" }, { status: 400 });
  }
  if (!unit_type) {
    return Response.json({ error: "unit_type is required" }, { status: 400 });
  }
  if (typeof quantity !== "number" || quantity <= 0 || !Number.isFinite(quantity)) {
    return Response.json({ error: "quantity must be a positive number" }, { status: 400 });
  }

  try {
    const client = createServiceClient();
    const rules = await getPricingRules(client, auth.workspaceId);
    const estimate = computeUsageEstimate(
      { provider, model, unit_type, quantity },
      rules,
    );

    return Response.json({
      ...estimate,
      pricing_rule_found: estimate.matched_rule !== null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to estimate cost";
    return Response.json({ error: message }, { status: 500 });
  }
}

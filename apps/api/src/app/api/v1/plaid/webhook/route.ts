import {
  handlePlaidWebhook,
  messageFromPlaidError,
  statusFromPlaidError,
} from "@/lib/plaid/service";

/**
 * Plaid webhook receiver. Configure PLAID_WEBHOOK_URL to this endpoint.
 * Verification via Plaid webhook verification JWT can be added once production keys are set.
 */
export async function POST(request: Request) {
  let body: {
    webhook_type?: string;
    webhook_code?: string;
    item_id?: string;
    error?: { error_code?: string; error_message?: string } | null;
  };

  try {
    body = (await request.json()) as typeof body;
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    const result = await handlePlaidWebhook(body);
    return Response.json(result);
  } catch (err) {
    return Response.json(
      { error: messageFromPlaidError(err) },
      { status: statusFromPlaidError(err) },
    );
  }
}

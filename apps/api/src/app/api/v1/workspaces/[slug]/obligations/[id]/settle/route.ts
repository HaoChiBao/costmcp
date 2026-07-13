import { settleObligationRecord, statusFromError } from "@/lib/obligations";
import { authenticateWorkspaceAccess } from "@/lib/workspace-auth";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string; id: string }> },
) {
  const { slug, id } = await params;
  const auth = await authenticateWorkspaceAccess(request, slug);
  if (auth instanceof Response) return auth;

  let body: unknown = {};
  try {
    const text = await request.text();
    if (text.trim()) body = JSON.parse(text);
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    const result = await settleObligationRecord(auth.workspaceId, id, body);
    return Response.json(result);
  } catch (err) {
    const status = statusFromError(err);
    const message =
      err instanceof Error ? err.message : "Failed to settle obligation";
    return Response.json({ error: message }, { status });
  }
}

import {
  createObligationRecord,
  listObligationRecords,
  statusFromError,
} from "@/lib/obligations";
import { authenticateWorkspaceAccess } from "@/lib/workspace-auth";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const auth = await authenticateWorkspaceAccess(request, slug);
  if (auth instanceof Response) return auth;

  const url = new URL(request.url);
  const status = url.searchParams.get("status") ?? undefined;
  const dueBefore = url.searchParams.get("due_before") ?? undefined;
  const dueAfter = url.searchParams.get("due_after") ?? undefined;

  try {
    const obligations = await listObligationRecords(auth.workspaceId, {
      status,
      dueBefore,
      dueAfter,
    });
    return Response.json({ obligations });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to list obligations";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const auth = await authenticateWorkspaceAccess(request, slug);
  if (auth instanceof Response) return auth;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    const obligation = await createObligationRecord(auth.workspaceId, {
      ...(typeof body === "object" && body ? body : {}),
      source: "manual",
    });
    return Response.json({ obligation }, { status: 201 });
  } catch (err) {
    const status = statusFromError(err);
    const message =
      err instanceof Error ? err.message : "Failed to create obligation";
    return Response.json(
      { error: message },
      { status: status === 500 && message.includes("must") ? 400 : status },
    );
  }
}

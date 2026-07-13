import {
  createServiceClient,
  findProjectBySlug,
  listSubscriptions,
} from "@costmcp/db";
import type { NextRequest } from "next/server";
import {
  assertProjectAccess,
  authenticateRequest,
  requirePermission,
} from "@/lib/auth";
import { subscriptionFromRow } from "@/lib/subscription-ledger";

export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if (auth instanceof Response) return auth;

  const denied = requirePermission(auth, "read_summaries");
  if (denied) return denied;

  const projectSlug = new URL(request.url).searchParams.get("project")?.trim() ?? "";

  try {
    const client = createServiceClient();
    let projectId: string | undefined;
    if (projectSlug) {
      const project = await findProjectBySlug(client, auth.workspaceId, projectSlug);
      if (!project) {
        return Response.json({ error: "Project not found" }, { status: 404 });
      }
      const projectDenied = assertProjectAccess(auth, project);
      if (projectDenied) return projectDenied;
      projectId = project.id;
    }

    const rows = await listSubscriptions(client, auth.workspaceId, { projectId });
    const subscriptions = rows
      .filter((row) => {
        if (!row.projects) return true;
        return !assertProjectAccess(auth, {
          id: row.project_id as string,
          slug: row.projects.slug,
        });
      })
      .map((row) => subscriptionFromRow({ ...row, metadata: row.metadata ?? {} }));

    return Response.json({ subscriptions, count: subscriptions.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to list subscriptions";
    return Response.json({ error: message }, { status: 500 });
  }
}

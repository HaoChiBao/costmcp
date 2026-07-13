import { createServiceClient, findProjectBySlug, updateProject } from "@costmcp/db";
import type { NextRequest } from "next/server";
import {
  assertProjectAccess,
  authenticateRequest,
  requirePermission,
} from "@/lib/auth";

type UpdateProjectBody = {
  name?: string;
  description?: string | null;
  budget?: number | null;
  currency?: string;
  environment?: "development" | "staging" | "production" | "other";
  status?: string;
  archived?: boolean;
};

const VALID_ENVIRONMENTS = ["development", "staging", "production", "other"] as const;

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ slug: string }> },
) {
  const auth = await authenticateRequest(request);
  if (auth instanceof Response) return auth;

  const denied = requirePermission(auth, "manage_projects");
  if (denied) return denied;

  const { slug } = await context.params;

  let body: UpdateProjectBody;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const hasUpdate = Object.keys(body).some((key) => body[key as keyof UpdateProjectBody] !== undefined);
  if (!hasUpdate) {
    return Response.json({ error: "At least one field to update is required" }, { status: 400 });
  }

  if (body.name !== undefined && !body.name.trim()) {
    return Response.json({ error: "name cannot be empty" }, { status: 400 });
  }

  if (body.budget !== undefined && body.budget !== null) {
    if (typeof body.budget !== "number" || body.budget < 0) {
      return Response.json({ error: "budget must be a non-negative number or null" }, { status: 400 });
    }
  }

  if (body.environment !== undefined && !VALID_ENVIRONMENTS.includes(body.environment)) {
    return Response.json({ error: "Invalid environment" }, { status: 400 });
  }

  try {
    const client = createServiceClient();
    const existing = await findProjectBySlug(client, auth.workspaceId, slug);
    if (!existing) {
      return Response.json({ error: "Project not found" }, { status: 404 });
    }

    const projectDenied = assertProjectAccess(auth, existing);
    if (projectDenied) return projectDenied;

    const project = await updateProject(client, auth.workspaceId, slug, {
      name: body.name?.trim(),
      description: body.description,
      budget: body.budget,
      currency: body.currency,
      environment: body.environment,
      status: body.status,
      archived: body.archived,
    });

    if (!project) {
      return Response.json({ error: "Project not found" }, { status: 404 });
    }

    return Response.json({ project, updated: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update project";
    return Response.json({ error: message }, { status: 500 });
  }
}

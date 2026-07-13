import { createProject, ProjectConflictError, createServiceClient, listProjects } from "@costmcp/db";
import { validateProjectSlug } from "@costmcp/core";
import type { NextRequest } from "next/server";
import {
  assertCanCreateProject,
  authenticateRequest,
  filterProjectsByPolicy,
  requirePermission,
} from "@/lib/auth";

type CreateProjectBody = {
  slug?: string;
  name?: string;
  description?: string;
  budget?: number;
  currency?: string;
  environment?: "development" | "staging" | "production" | "other";
};

export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if (auth instanceof Response) return auth;

  const denied = requirePermission(auth, "read_summaries");
  if (denied) return denied;

  const { searchParams } = new URL(request.url);
  const includeArchived = searchParams.get("include_archived") === "true";

  try {
    const client = createServiceClient();
    const allProjects = await listProjects(client, auth.workspaceId, { includeArchived });
    const projects = filterProjectsByPolicy(auth, allProjects);
    return Response.json({ projects, count: projects.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to list projects";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if (auth instanceof Response) return auth;

  const denied = requirePermission(auth, "manage_projects");
  if (denied) return denied;

  let body: CreateProjectBody;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const slug = body.slug?.trim() ?? "";
  const name = body.name?.trim() ?? "";

  const slugError = validateProjectSlug(slug);
  if (slugError) {
    return Response.json({ error: slugError }, { status: 400 });
  }
  if (!name) {
    return Response.json({ error: "name is required" }, { status: 400 });
  }

  const createDenied = assertCanCreateProject(auth, slug);
  if (createDenied) return createDenied;

  if (body.budget !== undefined && (typeof body.budget !== "number" || body.budget < 0)) {
    return Response.json({ error: "budget must be a non-negative number" }, { status: 400 });
  }

  const validEnvironments = ["development", "staging", "production", "other"] as const;
  if (body.environment !== undefined && !validEnvironments.includes(body.environment)) {
    return Response.json({ error: "Invalid environment" }, { status: 400 });
  }

  try {
    const client = createServiceClient();
    const project = await createProject(client, auth.workspaceId, {
      slug,
      name,
      description: body.description,
      budget: body.budget,
      currency: body.currency ?? "USD",
      environment: body.environment,
    });
    return Response.json({ project, created: true }, { status: 201 });
  } catch (err) {
    if (err instanceof ProjectConflictError) {
      return Response.json({ error: err.message }, { status: 409 });
    }
    const message = err instanceof Error ? err.message : "Failed to create project";
    return Response.json({ error: message }, { status: 500 });
  }
}

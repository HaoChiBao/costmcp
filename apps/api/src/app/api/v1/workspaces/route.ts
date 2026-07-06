import { authenticateUser } from "@/lib/user-auth";

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export async function POST(request: Request) {
  const auth = await authenticateUser(request);
  if (auth instanceof Response) return auth;

  let body: { name?: string; type?: string; description?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const name = body.name?.trim();
  if (!name) {
    return Response.json({ error: "name is required" }, { status: 400 });
  }

  const type = body.type ?? "team";
  if (!["personal", "team", "organization"].includes(type)) {
    return Response.json({ error: "Invalid workspace type" }, { status: 400 });
  }

  const baseSlug = slugify(name);
  let slug = baseSlug;
  let attempt = 0;

  try {
    while (attempt < 5) {
      const { data: existing } = await auth.client
        .from("workspaces")
        .select("id")
        .eq("slug", slug)
        .maybeSingle();
      if (!existing) break;
      slug = `${baseSlug}-${Math.random().toString(36).slice(2, 6)}`;
      attempt++;
    }

    const { data: workspace, error: wsError } = await auth.client
      .from("workspaces")
      .insert({
        name,
        slug,
        type,
        description: body.description ?? null,
        owner_id: auth.user.id,
      })
      .select("*")
      .single();
    if (wsError) throw wsError;

    const { error: memberError } = await auth.client.from("workspace_members").insert({
      workspace_id: workspace.id,
      user_id: auth.user.id,
      role: "owner",
    });
    if (memberError) throw memberError;

    await auth.client.rpc("seed_workspace_defaults", { ws_id: workspace.id });

    return Response.json({ workspace }, { status: 201 });
  } catch {
    return Response.json({ error: "Failed to create workspace" }, { status: 500 });
  }
}

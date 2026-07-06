import Link from "next/link";
import { redirect } from "next/navigation";
import { apiFetch, type MeResponse, type OrgTree } from "@/lib/api";
import { createClient } from "@/lib/supabase/server";
import { SignOutButton } from "../sign-out-button";
import { WorkspaceSwitcher } from "../workspace-switcher";

export default async function WorkspaceDashboard({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) redirect("/login");

  const [me, org] = await Promise.all([
    apiFetch<MeResponse>("/api/v1/me", session.access_token),
    apiFetch<OrgTree>(`/api/v1/workspaces/${slug}/org`, session.access_token).catch(() => null),
  ]);

  if (!org) {
    return (
      <main style={{ padding: "2rem" }}>
        <p>Workspace not found.</p>
        <Link href="/dashboard">Back</Link>
      </main>
    );
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", minHeight: "100vh" }}>
      <aside style={{ borderRight: "1px solid #243044", padding: "1.5rem", background: "#0f141c" }}>
        <p style={{ color: "#7b8da8", fontSize: 12, textTransform: "uppercase", letterSpacing: "0.06em" }}>
          CostMCP
        </p>
        <h2 style={{ fontSize: "1.1rem", margin: "0.5rem 0 1.5rem" }}>{me.profile?.display_name ?? me.user.email}</h2>
        <WorkspaceSwitcher workspaces={me.workspaces} currentSlug={slug} />
        <div style={{ marginTop: "2rem" }}>
          <SignOutButton />
        </div>
      </aside>

      <main style={{ padding: "2rem" }}>
        <header style={{ marginBottom: "2rem" }}>
          <p style={{ color: "#7b8da8", margin: 0, fontSize: 13 }}>
            {org.workspace.type} · {org.role}
          </p>
          <h1 style={{ margin: "0.25rem 0" }}>{org.workspace.name}</h1>
          <p style={{ color: "#a8b4c8", margin: 0 }}>Your organized cost account structure</p>
        </header>

        <section style={{ marginBottom: "2rem" }}>
          <h3 style={{ fontSize: 14, color: "#7b8da8", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Collections → Projects
          </h3>
          <div style={{ display: "grid", gap: "1rem", marginTop: "1rem" }}>
            {org.collections.map((collection) => (
              <div key={collection.id} style={panelStyle}>
                <strong>{collection.name}</strong>
                <p style={{ color: "#7b8da8", fontSize: 13, margin: "0.25rem 0 0.75rem" }}>
                  {collection.description}
                </p>
                {collection.projects.length === 0 ? (
                  <p style={{ color: "#5c6b82", fontSize: 13, margin: 0 }}>No projects yet</p>
                ) : (
                  <ul style={{ margin: 0, paddingLeft: "1.25rem" }}>
                    {collection.projects.map((project) => (
                      <li key={project.id} style={{ marginBottom: 4 }}>
                        {project.name}{" "}
                        <span style={{ color: "#7b8da8", fontSize: 12 }}>
                          ({project.environment}
                          {project.budget != null ? ` · $${project.budget} budget` : ""})
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
            {org.ungrouped_projects.length > 0 && (
              <div style={panelStyle}>
                <strong>Ungrouped projects</strong>
                <ul style={{ margin: "0.75rem 0 0", paddingLeft: "1.25rem" }}>
                  {org.ungrouped_projects.map((project) => (
                    <li key={project.id}>{project.name}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </section>

        <section style={{ marginBottom: "2rem" }}>
          <h3 style={{ fontSize: 14, color: "#7b8da8", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Chart of accounts
          </h3>
          <div style={{ display: "grid", gap: "0.75rem", marginTop: "1rem" }}>
            {org.categories.map((category) => (
              <div key={category.id} style={panelStyle}>
                <strong>{category.name}</strong>
                {category.children.length > 0 && (
                  <div style={{ marginTop: 8, paddingLeft: 12, borderLeft: "2px solid #243044" }}>
                    {category.children.map((child) => (
                      <div key={child.id} style={{ color: "#a8b4c8", fontSize: 14, marginBottom: 4 }}>
                        {child.name}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        <section style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
          <div style={panelStyle}>
            <h3 style={{ marginTop: 0, fontSize: 14, color: "#7b8da8" }}>Budgets</h3>
            {org.budgets.map((b) => (
              <div key={b.id} style={{ marginBottom: 8 }}>
                {b.name}: ${b.amount} / {b.period}
              </div>
            ))}
          </div>
          <div style={panelStyle}>
            <h3 style={{ marginTop: 0, fontSize: 14, color: "#7b8da8" }}>Vendors</h3>
            {org.vendors.length === 0 ? (
              <p style={{ color: "#5c6b82", fontSize: 13 }}>Add vendors as you connect providers</p>
            ) : (
              org.vendors.map((v) => <div key={v.id}>{v.name}</div>)
            )}
          </div>
        </section>

        <p style={{ marginTop: "2rem", color: "#5c6b82", fontSize: 13 }}>
          <Link href="/dashboard/new" style={{ color: "#60a5fa" }}>
            + New cost account
          </Link>
        </p>
      </main>
    </div>
  );
}

const panelStyle: React.CSSProperties = {
  background: "#121820",
  border: "1px solid #243044",
  borderRadius: 10,
  padding: "1rem",
};

import type { OrgTree } from "@/lib/api";
import { Panel, SectionHeading } from "@/components/ui/panel";

function ProjectList({
  projects,
}: {
  projects: Array<{
    id: string;
    name: string;
    slug: string;
    environment: string;
    budget: number | null;
  }>;
}) {
  if (!projects.length) return null;
  return (
    <ul className="rule-list">
      {projects.map((project) => (
        <li key={project.id} className="rule-list__item">
          <span>{project.name}</span>
          <span className="text-muted" style={{ fontSize: "var(--text-caption)" }}>
            {project.environment}
            {project.budget != null ? ` · $${project.budget}` : ""}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function WorkspaceOverview({ org }: { org: OrgTree }) {
  return (
    <>
      <section className="dashboard-section">
        <SectionHeading>Organization</SectionHeading>
        <p className="text-muted body-lg" style={{ marginBottom: "var(--spacing-29)", maxWidth: "36rem" }}>
          {org.workspace.name} · {org.workspace.type} · {org.role}
        </p>
        <SectionHeading>Collections → Projects</SectionHeading>
        <div className="stack">
          {org.collections.map((collection) => (
            <Panel
              key={collection.id}
              title={collection.name}
              description={collection.description}
              empty={collection.projects.length === 0 ? "No projects yet" : undefined}
            >
              <ProjectList projects={collection.projects} />
            </Panel>
          ))}
          {org.ungrouped_projects.length > 0 && (
            <Panel title="Ungrouped projects">
              <ProjectList projects={org.ungrouped_projects} />
            </Panel>
          )}
        </div>
      </section>

      <section className="dashboard-section">
        <SectionHeading>Chart of accounts</SectionHeading>
        <div className="stack">
          {org.categories.map((category) => (
            <Panel key={category.id} title={category.name}>
              {category.children.length > 0 && (
                <div className="nested-rule">
                  {category.children.map((child) => (
                    <div key={child.id} className="text-muted" style={{ fontSize: "var(--text-body-sm)", marginBottom: "var(--spacing-7)" }}>
                      {child.name}
                    </div>
                  ))}
                </div>
              )}
            </Panel>
          ))}
        </div>
      </section>

      <section className="dashboard-two-col">
        <Panel title="Budgets">
          <ul className="rule-list">
            {org.budgets.map((b) => (
              <li key={b.id} className="rule-list__item">
                <span>{b.name}</span>
                <span className="text-accent">${b.amount} / {b.period}</span>
              </li>
            ))}
          </ul>
        </Panel>
        <Panel
          title="Vendors"
          empty={org.vendors.length === 0 ? "Add vendors as you connect providers" : undefined}
        >
          {org.vendors.length > 0 && (
            <ul className="rule-list">
              {org.vendors.map((v) => (
                <li key={v.id} className="rule-list__item">
                  <span>{v.name}</span>
                  <span className="text-muted" style={{ fontSize: "var(--text-caption)" }}>{v.slug}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </section>
    </>
  );
}

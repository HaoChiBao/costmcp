import type { OrgTree } from "@/lib/api";
import { DashboardPanel } from "@/components/ui/panel";

function formatBudget(budget: number | null) {
  if (budget == null) return null;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(budget);
}

export function WorkspaceStructure({ org }: { org: OrgTree }) {
  const projectCount =
    org.collections.reduce((n, c) => n + c.projects.length, 0) +
    org.ungrouped_projects.length;

  return (
    <section className="dashboard-section">
      <div className="structure-grid">
        <DashboardPanel
          title="Organization"
          description={`${org.workspace.type} · ${org.role} · ${projectCount} project${projectCount === 1 ? "" : "s"}`}
        >
          <div className="data-table-wrap">
            <table className="data-table data-table--compact">
              <thead>
                <tr>
                  <th scope="col">Collection</th>
                  <th scope="col">Project</th>
                  <th scope="col">Environment</th>
                  <th scope="col" className="data-table__amount-col">
                    Budget
                  </th>
                </tr>
              </thead>
              <tbody>
                {org.collections.flatMap((collection) =>
                  collection.projects.length === 0
                    ? [
                        <tr key={collection.id}>
                          <td className="data-table__primary">{collection.name}</td>
                          <td colSpan={3} className="data-table__meta">
                            No projects
                          </td>
                        </tr>,
                      ]
                    : collection.projects.map((project, i) => (
                        <tr key={project.id}>
                          {i === 0 ? (
                            <td
                              className="data-table__primary"
                              rowSpan={collection.projects.length}
                            >
                              {collection.name}
                            </td>
                          ) : null}
                          <td>{project.name}</td>
                          <td>
                            <span className="env-tag">{project.environment}</span>
                          </td>
                          <td className="data-table__amount tabular-nums">
                            {formatBudget(project.budget) ?? "—"}
                          </td>
                        </tr>
                      )),
                )}
                {org.ungrouped_projects.map((project) => (
                  <tr key={project.id}>
                    <td className="data-table__meta">Ungrouped</td>
                    <td className="data-table__primary">{project.name}</td>
                    <td>
                      <span className="env-tag">{project.environment}</span>
                    </td>
                    <td className="data-table__amount tabular-nums">
                      {formatBudget(project.budget) ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DashboardPanel>

        <DashboardPanel title="Chart of accounts">
          {org.categories.length === 0 ? (
            <p className="dashboard-panel__empty">No categories configured.</p>
          ) : (
            <ul className="account-tree">
              {org.categories.map((category) => (
                <li key={category.id} className="account-tree__group">
                  <span className="account-tree__parent">{category.name}</span>
                  {category.children.length > 0 && (
                    <ul className="account-tree__children">
                      {category.children.map((child) => (
                        <li key={child.id}>{child.name}</li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          )}
        </DashboardPanel>
      </div>
    </section>
  );
}

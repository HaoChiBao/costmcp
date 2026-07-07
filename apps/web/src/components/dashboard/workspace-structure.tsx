import type { OrgTree } from "@/lib/api";
import { DashboardPanel } from "@/components/ui/panel";
import { OrgPill, ProjectLabel } from "@/components/ui/org-pill";
import { collectionTone, environmentTone, projectColorBySlug } from "@/lib/org-colors";

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
    <DashboardPanel
      title="Organization"
      description={`${projectCount} project${projectCount === 1 ? "" : "s"} across ${org.collections.length} collection${org.collections.length === 1 ? "" : "s"}`}
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
            {org.collections.flatMap((collection) => {
              const collectionStyle = collectionTone(collection.slug);
              return collection.projects.length === 0
                ? [
                    <tr key={collection.id}>
                      <td className="data-table__primary">
                        <OrgPill tone={collectionStyle}>{collection.name}</OrgPill>
                      </td>
                      <td colSpan={3} className="data-table__meta">
                        No projects
                      </td>
                    </tr>,
                  ]
                : collection.projects.map((project, i) => (
                    <tr
                      key={project.id}
                      style={{
                        boxShadow: `inset 3px 0 0 ${projectColorBySlug(project.slug)}`,
                      }}
                    >
                      {i === 0 ? (
                        <td
                          className="data-table__primary"
                          rowSpan={collection.projects.length}
                        >
                          <OrgPill tone={collectionStyle}>{collection.name}</OrgPill>
                        </td>
                      ) : null}
                      <td>
                        <ProjectLabel name={project.name} slug={project.slug} />
                      </td>
                      <td>
                        <OrgPill tone={environmentTone(project.environment)}>
                          {environmentTone(project.environment).label}
                        </OrgPill>
                      </td>
                      <td className="data-table__amount tabular-nums">
                        {formatBudget(project.budget) ?? "—"}
                      </td>
                    </tr>
                  ));
            })}
            {org.ungrouped_projects.map((project) => (
              <tr
                key={project.id}
                style={{
                  boxShadow: `inset 3px 0 0 ${projectColorBySlug(project.slug)}`,
                }}
              >
                <td className="data-table__meta">
                  <OrgPill tone={collectionTone("ungrouped")}>Ungrouped</OrgPill>
                </td>
                <td>
                  <ProjectLabel name={project.name} slug={project.slug} />
                </td>
                <td>
                  <OrgPill tone={environmentTone(project.environment)}>
                    {environmentTone(project.environment).label}
                  </OrgPill>
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
  );
}

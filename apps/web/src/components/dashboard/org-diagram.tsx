import type { OrgTree } from "@/lib/api";

const COLLECTION_COLORS = [
  "var(--color-voltage-blue)",
  "var(--color-success)",
  "var(--color-warning)",
  "#8b5cf6",
];

export function OrgDiagram({ org }: { org: OrgTree }) {
  return (
    <section className="org-diagram">
      <p className="money-board__section-label">Organization</p>
      <p className="org-diagram__workspace">{org.workspace.name}</p>

      <div className="org-diagram__tree">
        {org.collections.map((collection, i) => (
          <div key={collection.id} className="org-diagram__branch">
            <div className="org-diagram__node org-diagram__node--collection">
              <span
                className="org-diagram__dot"
                style={{ background: COLLECTION_COLORS[i % COLLECTION_COLORS.length] }}
              />
              <span className="org-diagram__label">{collection.name}</span>
              <span className="org-diagram__count">{collection.projects.length}</span>
            </div>
            {collection.projects.length > 0 && (
              <div className="org-diagram__children">
                {collection.projects.map((project) => (
                  <div key={project.id} className="org-diagram__node org-diagram__node--project">
                    <span className="org-diagram__connector" />
                    <span className="org-diagram__label">{project.name}</span>
                    <span className={`org-diagram__env org-diagram__env--${project.environment}`}>
                      {project.environment}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}

        {org.ungrouped_projects.length > 0 && (
          <div className="org-diagram__branch">
            <div className="org-diagram__node org-diagram__node--collection">
              <span className="org-diagram__dot" style={{ background: "var(--color-muted)" }} />
              <span className="org-diagram__label">Ungrouped</span>
            </div>
            <div className="org-diagram__children">
              {org.ungrouped_projects.map((project) => (
                <div key={project.id} className="org-diagram__node org-diagram__node--project">
                  <span className="org-diagram__connector" />
                  <span className="org-diagram__label">{project.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {org.categories.length > 0 && (
        <div className="org-diagram__categories">
          <p className="org-diagram__categories-label">Categories</p>
          <div className="org-diagram__category-pills">
            {org.categories.map((cat) => (
              <span key={cat.id} className="org-diagram__category-pill">
                {cat.name}
              </span>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

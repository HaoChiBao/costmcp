type SceneType = "workspaces" | "collections" | "accounts" | "api";

export function FeaturePlaceholderScene({ type }: { type: SceneType }) {
  switch (type) {
    case "workspaces":
      return (
        <div className="scene scene--workspaces">
          <div className="scene__chrome">
            <span />
            <span />
            <span />
          </div>
          <div className="scene__tabs">
            <span className="scene__tab scene__tab--active">Personal</span>
            <span className="scene__tab">Team</span>
            <span className="scene__tab">Client</span>
          </div>
          <div className="scene__panel">
            <div className="scene__line scene__line--wide" />
            <div className="scene__line" />
            <div className="scene__line scene__line--short" />
            <p className="scene__amount">$1,284.50</p>
          </div>
        </div>
      );
    case "collections":
      return (
        <div className="scene scene--collections">
          <div className="scene__stack">
            <div className="scene__card scene__card--back">
              <span>Experiments</span>
            </div>
            <div className="scene__card scene__card--mid">
              <span>Production</span>
            </div>
            <div className="scene__card scene__card--front">
              <span>Client work</span>
              <div className="scene__line scene__line--short" />
            </div>
          </div>
        </div>
      );
    case "accounts":
      return (
        <div className="scene scene--accounts">
          <ul className="scene__tree">
            <li className="scene__tree-item scene__tree-item--root">
              Operating
              <ul>
                <li className="scene__tree-item">LLM tokens</li>
                <li className="scene__tree-item">Image gen</li>
                <li className="scene__tree-item">Subscriptions</li>
              </ul>
            </li>
          </ul>
        </div>
      );
    case "api":
      return (
        <div className="scene scene--api">
          <div className="scene__terminal">
            <p>
              <span className="scene__prompt">→</span> mcp.log_cost
            </p>
            <p className="scene__terminal-line scene__terminal-line--dim">workspace: demo-builder</p>
            <p className="scene__terminal-line scene__terminal-line--success">✓ $0.0042 logged</p>
            <p className="scene__terminal-line scene__terminal-line--cursor" />
          </div>
        </div>
      );
  }
}

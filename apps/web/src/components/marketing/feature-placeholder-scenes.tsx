import type { CSSProperties } from "react";
import { OrgPill } from "@/components/ui/org-pill";
import {
  accountCategoryTone,
  collectionTone,
  messageTypeTone,
  projectColorBySlug,
} from "@/lib/org-colors";

type SceneType = "workspaces" | "collections" | "accounts" | "api";

type SceneProps = {
  type: SceneType;
  playing?: boolean;
};

const WORKSPACES = [
  { name: "Personal", amount: "$428.12" },
  { name: "Studio", amount: "$1,284.50" },
  { name: "Client", amount: "$2,041.00" },
] as const;

const COLLECTIONS = [
  {
    slug: "production",
    name: "Production",
    projects: [
      { slug: "slideshow-studio", name: "Slideshow Studio", spend: 72 },
      { slug: "youtube-pipeline", name: "YouTube Pipeline", spend: 48 },
    ],
  },
  {
    slug: "experiments",
    name: "Experiments",
    projects: [
      { slug: "ai-experiments", name: "AI Experiments", spend: 56 },
      { slug: "content-hub", name: "Content Hub", spend: 34 },
    ],
  },
  {
    slug: "ungrouped",
    name: "Client work",
    projects: [{ slug: "internal-tools", name: "Internal Tools", spend: 40 }],
  },
] as const;

const ACCOUNT_TREE = [
  {
    slug: "ai-usage",
    name: "AI usage",
    children: [
      { slug: "llm-tokens", name: "LLM tokens" },
      { slug: "image-generation", name: "Image gen" },
    ],
  },
  {
    slug: "subscriptions",
    name: "Subscriptions",
    children: [{ slug: "subscriptions", name: "SaaS seats" }],
  },
  {
    slug: "infrastructure",
    name: "Infrastructure",
    children: [{ slug: "infrastructure", name: "GPU / hosts" }],
  },
] as const;

const ACTIVITY = [
  { id: "1", tag: "usage", title: "Claude 4 Sonnet", meta: "Slideshow Studio", amount: "$0.42", initial: "C" },
  { id: "2", tag: "subscription", title: "Cursor Pro", meta: "Studio", amount: "$20.00", initial: "C" },
  { id: "3", tag: "expense", title: "ElevenLabs", meta: "Voice", amount: "$12.00", initial: "E" },
] as const;

export function FeaturePlaceholderScene({ type, playing = false }: SceneProps) {
  const playClass = playing ? " scene--playing" : "";

  switch (type) {
    case "workspaces":
      return <WorkspacesScene playClass={playClass} />;
    case "collections":
      return <CollectionsScene playClass={playClass} />;
    case "accounts":
      return <AccountsScene playClass={playClass} />;
    case "api":
      return <ApiScene playClass={playClass} />;
  }
}

function WorkspacesScene({ playClass }: { playClass: string }) {
  return (
    <div className={`scene scene--dash scene--workspaces${playClass}`}>
      <aside className="scene-dash__nav">
        <p className="scene-dash__nav-label">Accounts</p>
        <ul className="scene-dash__accounts">
          {WORKSPACES.map((ws, index) => (
            <li
              key={ws.name}
              className={`scene-dash__account scene-dash__account--${index + 1}`}
            >
              {ws.name}
            </li>
          ))}
        </ul>
      </aside>

      <div className="scene-dash__main">
        <div className="scene-dash__header">
          <div className="scene-dash__amounts">
            {WORKSPACES.map((ws, index) => (
              <p
                key={ws.name}
                className={`scene-dash__amount scene-dash__amount--${index + 1} tabular-nums`}
              >
                {ws.amount}
              </p>
            ))}
          </div>
          <div className="scene-dash__periods">
            <span className="scene-dash__period">7D</span>
            <span className="scene-dash__period scene-dash__period--active">Month</span>
            <span className="scene-dash__period">YTD</span>
          </div>
        </div>

        <div className="scene-dash__chart">
          <svg viewBox="0 0 240 88" className="scene-dash__chart-svg" aria-hidden="true">
            <defs>
              <linearGradient id="scene-usage-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--org-type-usage)" stopOpacity="0.34" />
                <stop offset="100%" stopColor="var(--org-type-usage)" stopOpacity="0.04" />
              </linearGradient>
              <linearGradient id="scene-sub-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--org-type-subscription)" stopOpacity="0.34" />
                <stop offset="100%" stopColor="var(--org-type-subscription)" stopOpacity="0.04" />
              </linearGradient>
              <linearGradient id="scene-exp-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--org-type-expense)" stopOpacity="0.34" />
                <stop offset="100%" stopColor="var(--org-type-expense)" stopOpacity="0.04" />
              </linearGradient>
            </defs>
            {[18, 36, 54, 72].map((y) => (
              <line
                key={y}
                x1="0"
                y1={y}
                x2="240"
                y2={y}
                className="scene-dash__grid"
              />
            ))}
            <path
              className="scene-dash__area scene-dash__area--expense"
              d="M0 78 C28 74, 48 70, 72 66 S120 58, 144 54 S192 46, 240 42 L240 88 L0 88 Z"
              fill="url(#scene-exp-fill)"
            />
            <path
              className="scene-dash__area scene-dash__area--subscription"
              d="M0 62 C28 58, 48 54, 72 50 S120 40, 144 36 S192 30, 240 26 L240 88 L0 88 Z"
              fill="url(#scene-sub-fill)"
            />
            <path
              className="scene-dash__area scene-dash__area--usage"
              d="M0 48 C28 42, 48 38, 72 34 S120 24, 144 20 S192 14, 240 10 L240 88 L0 88 Z"
              fill="url(#scene-usage-fill)"
            />
            <path
              className="scene-dash__stroke"
              d="M0 48 C28 42, 48 38, 72 34 S120 24, 144 20 S192 14, 240 10"
              fill="none"
              stroke="var(--org-type-usage)"
              strokeWidth="2"
            />
          </svg>
        </div>

        <ul className="scene-dash__legend">
          <li>
            <span style={{ background: "var(--org-type-usage)" }} />
            Usage
          </li>
          <li>
            <span style={{ background: "var(--org-type-subscription)" }} />
            Sub
          </li>
          <li>
            <span style={{ background: "var(--org-type-expense)" }} />
            Expense
          </li>
        </ul>
      </div>
    </div>
  );
}

function CollectionsScene({ playClass }: { playClass: string }) {
  return (
    <div className={`scene scene--dash scene--collections${playClass}`}>
      <div className="scene-collections">
        {COLLECTIONS.map((collection, index) => {
          const tone = collectionTone(collection.slug);
          return (
            <div
              key={collection.slug}
              className={`scene-collections__group scene-collections__group--${index + 1}`}
            >
              <div className="scene-collections__head">
                <OrgPill tone={tone}>{collection.name}</OrgPill>
                <span className="scene-collections__count">{collection.projects.length}</span>
              </div>
              <ul className="scene-collections__projects">
                {collection.projects.map((project) => (
                  <li key={project.slug} className="scene-collections__project">
                    <span
                      className="scene-collections__dot"
                      style={{ background: projectColorBySlug(project.slug) }}
                    />
                    <span className="scene-collections__name">{project.name}</span>
                    <span
                      className="scene-collections__bar"
                      style={
                        {
                          "--bar": `${project.spend}%`,
                          "--bar-color": projectColorBySlug(project.slug),
                        } as CSSProperties
                      }
                    />
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AccountsScene({ playClass }: { playClass: string }) {
  return (
    <div className={`scene scene--dash scene--accounts${playClass}`}>
      <div className="scene-accounts">
        <p className="scene-accounts__label">Chart of accounts</p>
        <ul className="scene-accounts__tree">
          {ACCOUNT_TREE.map((category, index) => {
            const tone = accountCategoryTone(category.slug);
            return (
              <li
                key={category.slug}
                className={`scene-accounts__group scene-accounts__group--${index + 1}`}
              >
                <div className="scene-accounts__parent">
                  <span
                    className="scene-accounts__dot"
                    style={{ background: tone.color }}
                  />
                  <span>{category.name}</span>
                  <OrgPill tone={tone} dot={false} className="scene-accounts__pill">
                    {category.children.length}
                  </OrgPill>
                </div>
                <ul className="scene-accounts__children">
                  {category.children.map((child) => {
                    const childTone = accountCategoryTone(child.slug);
                    return (
                      <li key={`${category.slug}-${child.name}`} className="scene-accounts__child">
                        <span
                          className="scene-accounts__dot scene-accounts__dot--child"
                          style={{ background: childTone.color }}
                        />
                        {child.name}
                      </li>
                    );
                  })}
                </ul>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

function ApiScene({ playClass }: { playClass: string }) {
  return (
    <div className={`scene scene--dash scene--api${playClass}`}>
      <div className="scene-api">
        <div className="scene-api__code">
          <div className="scene-api__code-bar">
            <span>mcp</span>
            <span className="scene-api__code-file">log_usage</span>
          </div>
          <pre className="scene-api__pre">
            <code>
              <span className="scene-api__line scene-api__line--1">
                <span className="scene-api__muted">{"→ "}</span>
                <span className="scene-api__fn">log_usage</span>
                <span>{"({"}</span>
              </span>
              <span className="scene-api__line scene-api__line--2">
                {"  model: "}
                <span className="scene-api__str">&quot;claude-sonnet&quot;</span>
                {","}
              </span>
              <span className="scene-api__line scene-api__line--3">
                {"  cost_usd: "}
                <span className="scene-api__num">0.0042</span>
                {","}
              </span>
              <span className="scene-api__line scene-api__line--4">
                {"  project: "}
                <span className="scene-api__str">&quot;slideshow&quot;</span>
              </span>
              <span className="scene-api__line scene-api__line--5">{"})"}</span>
              <span className="scene-api__line scene-api__line--ok">
                <span className="scene-api__ok">✓</span> logged to ledger
              </span>
            </code>
          </pre>
        </div>

        <div className="scene-api__feed">
          <p className="scene-api__feed-label">Activity</p>
          <ul className="scene-api__rows">
            {ACTIVITY.map((row, index) => {
              const tone = messageTypeTone(row.tag);
              return (
                <li
                  key={row.id}
                  className={`scene-api__row scene-api__row--${index + 1}`}
                >
                  <span
                    className="scene-api__icon"
                    style={{ background: tone.bg, color: tone.color }}
                  >
                    {row.initial}
                  </span>
                  <span className="scene-api__copy">
                    <span className="scene-api__title">{row.title}</span>
                    <span className="scene-api__meta">{row.meta}</span>
                  </span>
                  <span className="scene-api__amount tabular-nums">{row.amount}</span>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}

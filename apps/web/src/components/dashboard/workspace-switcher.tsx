import Link from "next/link";

type Workspace = {
  slug: string | null;
  name: string;
};

export function WorkspaceSwitcher({
  workspaces,
  currentSlug,
}: {
  workspaces: Workspace[];
  currentSlug?: string;
}) {
  if (!workspaces.length) return null;

  return (
    <nav className="workspace-nav" aria-label="Cost accounts">
      <p className="workspace-nav__label">Accounts</p>
      <ul className="workspace-nav__list">
        {workspaces.map((ws) =>
          ws.slug ? (
            <li key={ws.slug}>
              <Link
                href={`/dashboard/${ws.slug}`}
                prefetch
                className={`workspace-link ${ws.slug === currentSlug ? "workspace-link--active" : ""}`}
              >
                {ws.name}
              </Link>
            </li>
          ) : null,
        )}
        <li>
          <Link href="/dashboard/new" className="workspace-link workspace-link--new">
            New account
          </Link>
        </li>
      </ul>
    </nav>
  );
}

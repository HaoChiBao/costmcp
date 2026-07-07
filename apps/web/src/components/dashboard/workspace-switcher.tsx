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
      <div className="workspace-nav__scroll">
        {workspaces.map((ws) =>
          ws.slug ? (
            <Link
              key={ws.slug}
              href={`/dashboard/${ws.slug}`}
              prefetch
              className={`workspace-link ${ws.slug === currentSlug ? "workspace-link--active" : ""}`}
            >
              {ws.name}
            </Link>
          ) : null,
        )}
        <Link href="/dashboard/new" className="workspace-link workspace-link--new">
          + New
        </Link>
      </div>
    </nav>
  );
}

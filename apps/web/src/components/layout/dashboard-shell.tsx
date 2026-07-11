import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { UserProfile } from "@/components/dashboard/user-profile";
import { WorkspaceSwitcher } from "@/components/dashboard/workspace-switcher";

type Workspace = {
  slug: string | null;
  name: string;
};

type NavItem = {
  href: string;
  label: string;
  active?: boolean;
};

function NavIcon({ name }: { name: "activity" | "connections" }) {
  if (name === "connections") {
    return (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
        <path
          d="M6.5 9.5h5M9.5 6.5v5M3 9a6.5 6.5 0 1 1 13 0 6.5 6.5 0 0 1-13 0Z"
          stroke="currentColor"
          strokeWidth="1.25"
          strokeLinecap="round"
        />
      </svg>
    );
  }

  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path
        d="M3 4.5h12M3 9h8M3 13.5h10"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function DashboardShell({
  workspaces,
  currentSlug,
  user,
  navItems,
  children,
}: {
  workspaces: Workspace[];
  currentSlug?: string;
  user?: { name: string; email?: string; avatarUrl?: string | null };
  navItems?: NavItem[];
  children: ReactNode;
}) {
  return (
    <div className="dashboard">
      <aside className="dashboard-nav">
        <div className="dashboard-nav__top">
          <Link href="/dashboard" className="dashboard-nav__brand">
            <Image
              src="/logo.png"
              alt=""
              width={22}
              height={22}
              className="dashboard-nav__logo"
              priority
            />
            <span>CostMCP</span>
          </Link>

          {navItems && navItems.length > 0 ? (
            <nav className="dashboard-nav__menu" aria-label="Workspace">
              <ul className="dashboard-nav__menu-list">
                {navItems.map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={`dashboard-nav__link${item.active ? " dashboard-nav__link--active" : ""}`}
                      aria-current={item.active ? "page" : undefined}
                    >
                      <NavIcon name={item.label === "Connections" ? "connections" : "activity"} />
                      <span>{item.label}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ) : null}

          <WorkspaceSwitcher workspaces={workspaces} currentSlug={currentSlug} />
        </div>

        {user ? <UserProfile name={user.name} email={user.email} avatarUrl={user.avatarUrl} /> : null}
      </aside>

      <div className="dashboard-body">{children}</div>
    </div>
  );
}

import type { ReactNode } from "react";
import { SignOutButton } from "@/components/dashboard/sign-out-button";
import { WorkspaceSwitcher } from "@/components/dashboard/workspace-switcher";
import Link from "next/link";

type Workspace = {
  slug: string | null;
  name: string;
};

export function DashboardShell({
  userLabel,
  workspaces,
  currentSlug,
  children,
}: {
  userLabel: string;
  workspaces: Workspace[];
  currentSlug?: string;
  children: ReactNode;
}) {
  return (
    <div className="dashboard">
      <header className="dashboard-topbar">
        <div className="dashboard-topbar__row">
          <Link href="/dashboard" className="dashboard-topbar__brand">
            CostMCP
          </Link>
          <div className="dashboard-topbar__account">
            <span className="dashboard-topbar__meta">{userLabel}</span>
            <SignOutButton />
          </div>
        </div>
        <WorkspaceSwitcher workspaces={workspaces} currentSlug={currentSlug} />
      </header>
      <main className="dashboard-main">{children}</main>
    </div>
  );
}

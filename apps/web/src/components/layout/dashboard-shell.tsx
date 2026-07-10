import type { ReactNode } from "react";
import { SignOutButton } from "@/components/dashboard/sign-out-button";
import { WorkspaceSwitcher } from "@/components/dashboard/workspace-switcher";
import Image from "next/image";
import Link from "next/link";

type Workspace = {
  slug: string | null;
  name: string;
};

export function DashboardShell({
  workspaces,
  currentSlug,
  children,
}: {
  userLabel?: string;
  workspaces: Workspace[];
  currentSlug?: string;
  children: ReactNode;
}) {
  return (
    <div className="dashboard">
      <header className="dashboard-topbar">
        <Link href="/dashboard" className="dashboard-topbar__brand">
          <Image
            src="/logo.png"
            alt=""
            width={24}
            height={24}
            className="dashboard-topbar__logo"
            priority
          />
          <span>CostMCP</span>
        </Link>
        <WorkspaceSwitcher workspaces={workspaces} currentSlug={currentSlug} />
        <div className="dashboard-topbar__actions">
          {currentSlug ? (
            <Link
              href={`/dashboard/${currentSlug}/connections`}
              className="btn btn--ghost dashboard-topbar__link"
            >
              Connections &amp; API keys
            </Link>
          ) : null}
          <SignOutButton />
        </div>
      </header>
      <main className="dashboard-main">{children}</main>
    </div>
  );
}

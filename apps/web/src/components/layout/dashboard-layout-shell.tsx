"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { DashboardShell } from "@/components/layout/dashboard-shell";

type Workspace = {
  slug: string | null;
  name: string;
};

export function DashboardLayoutShell({
  workspaces,
  user,
  children,
}: {
  workspaces: Workspace[];
  user?: { name: string; email?: string };
  children: ReactNode;
}) {
  const pathname = usePathname();
  const slugMatch = pathname.match(/^\/dashboard\/([^/]+)/);
  const segment = slugMatch?.[1];
  const currentSlug = segment && segment !== "new" ? segment : undefined;

  const navItems = currentSlug
    ? [
        {
          href: `/dashboard/${currentSlug}`,
          label: "Activity",
          active: pathname === `/dashboard/${currentSlug}`,
        },
        {
          href: `/dashboard/${currentSlug}/connections`,
          label: "Connections",
          active: pathname.startsWith(`/dashboard/${currentSlug}/connections`),
        },
      ]
    : undefined;

  return (
    <DashboardShell
      workspaces={workspaces}
      currentSlug={currentSlug}
      user={user}
      navItems={navItems}
    >
      {children}
    </DashboardShell>
  );
}

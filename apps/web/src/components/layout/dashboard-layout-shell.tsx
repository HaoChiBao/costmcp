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
  user?: { name: string; email?: string; avatarUrl?: string | null; provider?: string | null };
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
        {
          href: `/dashboard/${currentSlug}/bank-connections`,
          label: "Banks",
          active: pathname.startsWith(`/dashboard/${currentSlug}/bank-connections`),
        },
        {
          href: `/dashboard/${currentSlug}/api-keys`,
          label: "API keys",
          active: pathname.startsWith(`/dashboard/${currentSlug}/api-keys`),
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

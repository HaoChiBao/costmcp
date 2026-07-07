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
  children,
}: {
  workspaces: Workspace[];
  children: ReactNode;
}) {
  const pathname = usePathname();
  const slugMatch = pathname.match(/^\/dashboard\/([^/]+)/);
  const segment = slugMatch?.[1];
  const currentSlug = segment && segment !== "new" ? segment : undefined;

  return (
    <DashboardShell workspaces={workspaces} currentSlug={currentSlug}>
      {children}
    </DashboardShell>
  );
}

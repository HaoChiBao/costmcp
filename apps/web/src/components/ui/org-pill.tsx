import type { ReactNode } from "react";
import type { OrgTone } from "@/lib/org-colors";
import { projectColorBySlug } from "@/lib/org-colors";

export function OrgPill({
  tone,
  children,
  dot = true,
  className,
}: {
  tone: OrgTone;
  children: ReactNode;
  dot?: boolean;
  className?: string;
}) {
  return (
    <span
      className={`org-pill${className ? ` ${className}` : ""}`}
      style={{
        color: tone.color,
        backgroundColor: tone.bg,
        borderColor: tone.border,
      }}
    >
      {dot ? (
        <span className="org-pill__dot" style={{ backgroundColor: tone.color }} aria-hidden="true" />
      ) : null}
      {children}
    </span>
  );
}

export function ProjectLabel({
  name,
  slug,
}: {
  name: string;
  slug?: string | null;
}) {
  const color = projectColorBySlug(slug ?? "unassigned");

  return (
    <span className="project-label">
      <span className="project-label__dot" style={{ backgroundColor: color }} aria-hidden="true" />
      <span className="project-label__name">{name}</span>
    </span>
  );
}

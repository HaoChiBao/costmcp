import type { ReactNode } from "react";

export function Hairline() {
  return <hr className="hairline" />;
}

export function PageFooter() {
  return (
    <footer className="page-footer">
      <p className="page-footer__line">
        CostMCP — organized AI spend
      </p>
    </footer>
  );
}

export function HeadlineBlock({
  headline,
  subheadline,
  align = "left",
}: {
  headline: string;
  subheadline?: string;
  align?: "left" | "right" | "center";
}) {
  return (
    <header className={`headline-block headline-block--${align}`}>
      <h1 className="display">{headline}</h1>
      {subheadline ? <p className="headline-block__sub">{subheadline}</p> : null}
    </header>
  );
}

export function SectionHeading({ children }: { children: ReactNode }) {
  return <h2 className="section-heading">{children}</h2>;
}

export function StampedHeader({ children }: { children: ReactNode }) {
  return (
    <header className="stamped-header">
      <h2 className="stamped-header__text">{children}</h2>
      <span className="stamped-header__rule" aria-hidden="true" />
    </header>
  );
}

export function InvertedLetter({
  eyebrow,
  children,
  actions,
}: {
  eyebrow?: string;
  children: ReactNode;
  actions?: ReactNode;
  footer?: string;
}) {
  return (
    <section className="inverted-letter">
      {eyebrow ? <p className="inverted-letter__eyebrow">{eyebrow}</p> : null}
      <div className="inverted-letter__body">{children}</div>
      {actions ? <div className="inverted-letter__actions">{actions}</div> : null}
    </section>
  );
}

export function FeatureItem({
  index,
  title,
  children,
}: {
  index?: number;
  title: string;
  children: ReactNode;
}) {
  return (
    <article className="feature-item">
      {index != null ? <span className="feature-item__index">{String(index).padStart(2, "0")}</span> : null}
      <div>
        <h3 className="feature-item__title">{title}</h3>
        <p className="feature-item__body">{children}</p>
      </div>
    </article>
  );
}

export function FeatureCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <article className="feature-card">
      <h3 className="feature-card__title">{title}</h3>
      <p className="feature-card__body">{children}</p>
    </article>
  );
}

export function CtaBand({ children, actions }: { children: ReactNode; actions: ReactNode }) {
  return (
    <section className="cta-band surface-ink">
      <div className="cta-band__inner">
        <p className="cta-band__text">{children}</p>
        <div className="cta-band__actions">{actions}</div>
      </div>
    </section>
  );
}

export function DashboardPanel({
  title,
  description,
  children,
  empty,
  variant = "default",
  className,
}: {
  title?: string;
  description?: string | null;
  children?: ReactNode;
  empty?: string;
  variant?: "default" | "hero" | "subtle";
  className?: string;
}) {
  const classes = [
    "dashboard-panel",
    variant !== "default" ? `dashboard-panel--${variant}` : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <section className={classes}>
      {(title || description) && (
        <header className="dashboard-panel__header">
          {title ? <h2 className="dashboard-panel__title">{title}</h2> : null}
          {description ? <p className="dashboard-panel__desc">{description}</p> : null}
        </header>
      )}
      {children}
      {!children && empty ? <p className="dashboard-panel__empty">{empty}</p> : null}
    </section>
  );
}

export function StatusBadge({
  children,
  warn,
  strong,
}: {
  children: ReactNode;
  warn?: boolean;
  strong?: boolean;
  accent?: boolean;
  danger?: boolean;
  live?: boolean;
}) {
  return (
    <span
      className={`status-badge${warn ? " status-badge--warn" : ""}${strong ? " status-badge--strong" : ""}`}
    >
      {children}
    </span>
  );
}

export const ContentCard = DashboardPanel;
export const GridCell = DashboardPanel;
export const PaperCard = DashboardPanel;
export const Section = DashboardPanel;
export const Panel = DashboardPanel;
export const DisplayBlock = HeadlineBlock;
export const NumberedItem = FeatureItem;

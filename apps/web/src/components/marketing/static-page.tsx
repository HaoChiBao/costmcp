import Link from "next/link";
import type { ReactNode } from "react";
import { FeatureItem, Hairline } from "@/components/ui/panel";

type StaticPageHeaderProps = {
  eyebrow: string;
  title: string;
  meta?: string;
  intro?: string;
};

export function StaticPage({ children }: { children: ReactNode }) {
  return <article className="static-page">{children}</article>;
}

export function StaticPageHeader({ eyebrow, title, meta, intro }: StaticPageHeaderProps) {
  return (
    <header className="static-page__header">
      <p className="eyebrow">{eyebrow}</p>
      <h1 className="section-heading static-page__title">{title}</h1>
      {meta ? <p className="static-page__meta">{meta}</p> : null}
      {intro ? <p className="static-page__intro">{intro}</p> : null}
      <Hairline />
    </header>
  );
}

export function StaticPageSection({
  label,
  title,
  children,
}: {
  label?: string;
  title?: string;
  children: ReactNode;
}) {
  return (
    <section className="static-page__section">
      {label ? <p className="meta-label">{label}</p> : null}
      {title ? <h2 className="heading-sm static-page__section-title">{title}</h2> : null}
      <div className="static-page__section-body">{children}</div>
    </section>
  );
}

export function StaticPagePanel({ children }: { children: ReactNode }) {
  return <div className="static-page__panel">{children}</div>;
}

export function StaticPageFaq({
  items,
}: {
  items: Array<{ question: string; answer: string }>;
}) {
  return (
    <div className="static-page__faq">
      {items.map((item, index) => (
        <FeatureItem key={item.question} index={index + 1} title={item.question}>
          {item.answer}
        </FeatureItem>
      ))}
    </div>
  );
}

export function StaticPageActions({ children }: { children: ReactNode }) {
  return <nav className="static-page__actions" aria-label="Related links">{children}</nav>;
}

export function StaticPageLink({
  href,
  external,
  children,
}: {
  href: string;
  external?: boolean;
  children: ReactNode;
}) {
  if (external) {
    return (
      <a href={href} className="text-link" target="_blank" rel="noreferrer">
        {children}
      </a>
    );
  }

  return (
    <Link href={href} className="text-link">
      {children}
    </Link>
  );
}

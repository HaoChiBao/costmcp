"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { FeaturePlaceholderScene } from "@/components/marketing/feature-placeholder-scenes";

const features = [
  {
    id: "workspaces",
    title: "Workspaces",
    description:
      "Separate personal, team, and client accounts. Switch between them in one click and keep spend isolated.",
    scene: "workspaces" as const,
  },
  {
    id: "collections",
    title: "Collections",
    description:
      "Group projects the way you build — production, experiments, client work — without losing the thread.",
    scene: "collections" as const,
  },
  {
    id: "accounts",
    title: "Chart of accounts",
    description:
      "Categorize tokens, images, and subscriptions with a hierarchy that scales as your stack grows.",
    scene: "accounts" as const,
  },
  {
    id: "api",
    title: "API & MCP",
    description:
      "Log costs from code, Cursor, or any agent. One ledger catches every source automatically.",
    scene: "api" as const,
  },
];

export function FeaturesSection() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [revealed, setRevealed] = useState<Record<number, boolean>>({});
  const cardRefs = useRef<(HTMLElement | null)[]>([]);

  useEffect(() => {
    const cards = cardRefs.current.filter(Boolean) as HTMLElement[];
    if (cards.length === 0) return;

    const activeObserver = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);

        if (visible.length > 0) {
          const index = Number(visible[0].target.getAttribute("data-index"));
          if (!Number.isNaN(index)) setActiveIndex(index);
        }
      },
      { rootMargin: "-30% 0px -30% 0px", threshold: [0, 0.35, 0.65, 1] },
    );

    const revealObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const index = Number(entry.target.getAttribute("data-index"));
          if (Number.isNaN(index)) return;
          setRevealed((prev) => (prev[index] ? prev : { ...prev, [index]: true }));
          revealObserver.unobserve(entry.target);
        });
      },
      { rootMargin: "0px 0px -12% 0px", threshold: 0.18 },
    );

    cards.forEach((card) => {
      activeObserver.observe(card);
      revealObserver.observe(card);
    });
    return () => {
      activeObserver.disconnect();
      revealObserver.disconnect();
    };
  }, []);

  return (
    <section id="features" className="features-section">
      <div className="landing-spine__grid features-split">
        <header className="landing-spine__pane landing-spine__pane--left features-section__intro scroll-reveal is-in">
          <p className="eyebrow">Product</p>
          <h2 className="features-section__title">How it works</h2>
        </header>

        <div className="landing-spine__pane landing-spine__pane--center" aria-hidden="true" />

        <div className="landing-spine__pane landing-spine__pane--right features-section__intro features-section__intro--right scroll-reveal is-in">
          <p className="features-section__lead">
            Workspaces, collections, chart of accounts, and MCP — one ledger for every source.
          </p>
        </div>

        {features.map((feature, index) => {
          const isLeft = index % 2 === 0;
          const revealClass = revealed[index] ? " is-in" : "";
          const activeClass = activeIndex === index ? " is-active" : "";

          return (
            <Fragment key={feature.id}>
              {isLeft ? (
                <>
                  <article
                    ref={(el) => {
                      cardRefs.current[index] = el;
                    }}
                    data-index={index}
                    className={`landing-spine__pane landing-spine__pane--left features-split__card scroll-reveal scroll-reveal--left${revealClass}${activeClass}`}
                  >
                    <FeatureCard feature={feature} index={index} align="left" />
                  </article>
                  <div className="landing-spine__pane landing-spine__pane--center" aria-hidden="true" />
                  <div className="landing-spine__pane landing-spine__pane--right landing-spine__pane--spacer" />
                </>
              ) : (
                <>
                  <div className="landing-spine__pane landing-spine__pane--left landing-spine__pane--spacer" />
                  <div className="landing-spine__pane landing-spine__pane--center" aria-hidden="true" />
                  <article
                    ref={(el) => {
                      cardRefs.current[index] = el;
                    }}
                    data-index={index}
                    className={`landing-spine__pane landing-spine__pane--right features-split__card scroll-reveal scroll-reveal--right${revealClass}${activeClass}`}
                  >
                    <FeatureCard feature={feature} index={index} align="right" />
                  </article>
                </>
              )}
            </Fragment>
          );
        })}
      </div>
    </section>
  );
}

type FeatureCardProps = {
  feature: (typeof features)[number];
  index: number;
  align: "left" | "right";
};

function FeatureCard({ feature, index, align }: FeatureCardProps) {
  return (
    <div className={`features-split__card-inner features-split__card-inner--${align}`}>
      <span className="features-split__index meta-label">
        {String(index + 1).padStart(2, "0")}
      </span>
      <h3 className="features-split__title">{feature.title}</h3>
      <p className="features-split__desc">{feature.description}</p>
      <div className="features-split__preview" aria-hidden="true">
        <FeaturePlaceholderScene type={feature.scene} />
      </div>
    </div>
  );
}

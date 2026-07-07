"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
  const stepRefs = useRef<(HTMLElement | null)[]>([]);
  const stageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const steps = stepRefs.current.filter(Boolean) as HTMLElement[];
    if (steps.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);

        if (visible.length > 0) {
          const index = Number(visible[0].target.getAttribute("data-index"));
          if (!Number.isNaN(index)) setActiveIndex(index);
        }
      },
      { rootMargin: "-35% 0px -35% 0px", threshold: [0, 0.25, 0.5, 0.75, 1] },
    );

    steps.forEach((step) => observer.observe(step));
    return () => observer.disconnect();
  }, []);

  const scrollToStep = useCallback((index: number) => {
    stepRefs.current[index]?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, []);

  const progress = ((activeIndex + 1) / features.length) * 100;

  return (
    <section id="features" className="features-section">
      <header className="features-section__intro">
        <p className="eyebrow">Product</p>
        <h2 className="features-section__title">How it works</h2>
        <p className="features-section__lead">
          Scroll through each piece — video walkthroughs coming soon.
        </p>
      </header>

      <div className="feature-showcase" ref={stageRef}>
        <nav className="feature-showcase__rail" aria-label="Feature sections">
          <div className="feature-showcase__rail-track" aria-hidden="true">
            <div
              className="feature-showcase__rail-fill"
              style={{ height: `${progress}%` }}
            />
          </div>
          {features.map((feature, index) => (
            <button
              key={feature.id}
              type="button"
              className={`feature-showcase__rail-item${activeIndex === index ? " is-active" : ""}${activeIndex > index ? " is-complete" : ""}`}
              onClick={() => scrollToStep(index)}
              aria-current={activeIndex === index ? "step" : undefined}
            >
              <span className="feature-showcase__rail-dot" aria-hidden="true" />
              <span className="feature-showcase__rail-index">
                {String(index + 1).padStart(2, "0")}
              </span>
              <span className="feature-showcase__rail-label">{feature.title}</span>
            </button>
          ))}
        </nav>

        <div className="feature-showcase__sticky">
          <div className="feature-showcase__frame">
            {features.map((feature, index) => (
              <div
                key={feature.id}
                className={`feature-showcase__video${activeIndex === index ? " is-active" : ""}`}
                aria-hidden={activeIndex !== index}
              >
                <div className="feature-showcase__video-inner">
                  <FeaturePlaceholderScene type={feature.scene} />
                  <div className="feature-showcase__video-overlay">
                    <span className="feature-showcase__play" aria-hidden="true">
                      ▶
                    </span>
                    <span className="feature-showcase__video-tag">Preview · {feature.title}</span>
                  </div>
                </div>
              </div>
            ))}
            <div className="feature-showcase__frame-footer">
              <span className="meta-label">
                {String(activeIndex + 1).padStart(2, "0")} / {String(features.length).padStart(2, "0")}
              </span>
              <span className="feature-showcase__frame-title">{features[activeIndex].title}</span>
            </div>
          </div>
        </div>

        <div className="feature-showcase__steps">
          {features.map((feature, index) => (
            <article
              key={feature.id}
              ref={(el) => {
                stepRefs.current[index] = el;
              }}
              data-index={index}
              className={`feature-showcase__step${activeIndex === index ? " is-active" : ""}`}
            >
              <div className="feature-showcase__step-marker" aria-hidden="true">
                <span>{String(index + 1).padStart(2, "0")}</span>
              </div>
              <div className="feature-showcase__step-body">
                <h3 className="feature-showcase__step-title">{feature.title}</h3>
                <p className="feature-showcase__step-desc">{feature.description}</p>
                <p className="feature-showcase__step-note meta-label">Video walkthrough · coming soon</p>
              </div>
              <div className="feature-showcase__step-mobile-video" aria-hidden="true">
                <FeaturePlaceholderScene type={feature.scene} />
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

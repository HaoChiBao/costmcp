"use client";

import { Button } from "@/components/ui/button";
import { HeroHeadline } from "@/components/marketing/hero-headline";

export function LandingHero() {
  return (
    <section className="hero hero--statement">
      <div className="landing-spine__grid hero__grid">
        <div className="landing-spine__pane landing-spine__pane--full hero__mast">
          <HeroHeadline />
        </div>

        <div className="landing-spine__pane landing-spine__pane--left hero__rail hero__rail--left">
          <p className="hero__lead">
            MCP-native ledger for tokens, tools, and subscriptions. See burn before the bill
            lands.
          </p>
        </div>

        <div className="landing-spine__pane landing-spine__pane--center" aria-hidden="true" />

        <div className="landing-spine__pane landing-spine__pane--right hero__rail hero__rail--right">
          <Button href="/signup" variant="ink">
            Get started
          </Button>
        </div>
      </div>
    </section>
  );
}

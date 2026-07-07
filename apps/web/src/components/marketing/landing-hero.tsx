"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { HeroHeadline } from "@/components/marketing/hero-headline";

export function LandingHero() {
  const [bobbing, setBobbing] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduceMotion(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  const startBobbing = useCallback(() => {
    if (reduceMotion) return;
    setBobbing(true);
  }, [reduceMotion]);

  return (
    <section className="hero hero--statement">
      <div className="hero__frame">
        <div className="hero__visual" aria-hidden="true">
          <div className="hero__dip" onPointerEnter={startBobbing}>
            <div className={`hero__sway${bobbing ? " hero__sway--bobbing" : ""}`}>
              <Image
                src="/images/hero-fishing-line.png"
                alt=""
                width={720}
                height={1400}
                className="hero__hook-image"
                priority
              />
            </div>
          </div>
        </div>

        <div className="hero__mast">
          <HeroHeadline />
        </div>

        <div className="hero__rail hero__rail--left">
          <p className="hero__lead">
            MCP-native ledger for tokens, tools, and subscriptions. See burn before the bill
            lands.
          </p>
        </div>

        <div className="hero__rail hero__rail--right">
          <Button href="/signup" variant="ink">
            Get started
          </Button>
        </div>
      </div>
    </section>
  );
}

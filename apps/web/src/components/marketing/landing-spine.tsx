"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

type LandingSpineProps = {
  children: ReactNode;
};

export function LandingSpine({ children }: LandingSpineProps) {
  const spineRef = useRef<HTMLDivElement>(null);
  const [hookSway, setHookSway] = useState(0);
  const [bobbing, setBobbing] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduceMotion(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (reduceMotion) return;

    const onScroll = () => {
      const spine = spineRef.current;
      if (!spine) return;

      const rect = spine.getBoundingClientRect();
      const progress = Math.min(
        1,
        Math.max(0, (window.scrollY - spine.offsetTop) / Math.max(spine.offsetHeight - window.innerHeight, 1)),
      );

      setHookSway(Math.sin(progress * Math.PI * 6) * 2.25);
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [reduceMotion]);

  const startBobbing = useCallback(() => {
    if (reduceMotion) return;
    setBobbing(true);
  }, [reduceMotion]);

  return (
    <div className="landing-spine" ref={spineRef}>
      <div className="landing-spine__track" aria-hidden="true">
        <div className="landing-spine__hook-sticky">
          <div
            className="landing-spine__hook-sway"
            style={reduceMotion ? undefined : { rotate: `${hookSway}deg` }}
          >
            <div
              className={`landing-spine__hook${bobbing ? " landing-spine__hook--bobbing" : ""}`}
              onPointerEnter={startBobbing}
            >
              <Image
                src="/images/hero-fishing-line.png"
                alt=""
                width={720}
                height={1400}
                className="landing-spine__hook-image"
                priority
              />
            </div>
          </div>
        </div>
      </div>

      <div className="landing-spine__content">{children}</div>
    </div>
  );
}

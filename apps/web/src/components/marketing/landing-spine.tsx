"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import {
  HOOK_SCALE_END,
  HOOK_SCALE_START,
  HOOK_TOP_OFFSET,
  SIDE_HOOKS,
  scaledBillSize,
} from "@/components/marketing/hook-gallery-config";

type LandingSpineProps = {
  children: ReactNode;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function HookImage({ className }: { className: string }) {
  return (
    <Image
      src="/images/hero-fishing-line.png"
      alt=""
      width={720}
      height={1400}
      className={className}
      priority
    />
  );
}

export function LandingSpine({ children }: LandingSpineProps) {
  const spineRef = useRef<HTMLDivElement>(null);
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
    const spine = spineRef.current;
    if (!spine) return;

    const hero = spine.querySelector<HTMLElement>(".hero--statement");

    const update = () => {
      const heroHeight = hero?.offsetHeight ?? window.innerHeight;
      const growDistance = Math.max(heroHeight * 0.42, 280);
      const scrollInHero = window.scrollY - (hero?.offsetTop ?? 0);

      const growProgress = reduceMotion
        ? scrollInHero > growDistance * 0.5
          ? 1
          : 0
        : clamp(scrollInHero / growDistance, 0, 1);

      const centerScale =
        HOOK_SCALE_START + growProgress * (HOOK_SCALE_END - HOOK_SCALE_START);
      const sideOpacity = clamp(1 - growProgress * 0.92, 0.06, 1);

      const spineProgress = clamp(
        scrollInHero / Math.max((spine.offsetHeight - window.innerHeight) * 0.85, 1),
        0,
        1,
      );
      const hookSway = reduceMotion ? 0 : Math.sin(spineProgress * Math.PI * 6) * 2.25;

      spine.style.setProperty("--center-hook-scale", String(centerScale));
      spine.style.setProperty("--side-hooks-opacity", String(sideOpacity));
      spine.style.setProperty("--hook-sway-deg", `${hookSway}deg`);
    };

    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);

    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [reduceMotion]);

  const startBobbing = useCallback(() => {
    if (reduceMotion) return;
    setBobbing(true);
  }, [reduceMotion]);

  return (
    <div
      className="landing-spine"
      ref={spineRef}
      style={
        {
          "--center-hook-scale": HOOK_SCALE_START,
          "--side-hooks-opacity": 1,
          "--hook-sway-deg": "0deg",
          "--hook-top-offset": `${HOOK_TOP_OFFSET}px`,
        } as CSSProperties
      }
    >
      <div className="landing-spine__track" aria-hidden="true">
        <div
          className="landing-spine__hook-row"
          style={{ opacity: "var(--side-hooks-opacity)" }}
        >
          {SIDE_HOOKS.map((hook) => (
            <div
              key={hook.id}
              className="landing-spine__hook-mini"
              style={{
                left: hook.left,
                top: hook.topExtra,
                zIndex: hook.zIndex,
              }}
            >
              <div
                className={`landing-spine__hook-mini-sway${reduceMotion ? " landing-spine__hook-mini-sway--still" : ""}`}
                style={
                  {
                    "--hook-scale": scaledBillSize(hook.scale),
                    "--hook-drop": `${hook.drop}px`,
                    "--hook-sway-delay": `${hook.swayDelay}s`,
                    "--hook-sway-duration": `${hook.swayDuration}s`,
                    "--hook-sway-angle": `${hook.swayAngle}deg`,
                  } as CSSProperties
                }
              >
                <HookImage className="landing-spine__hook-image landing-spine__hook-image--mini" />
              </div>
            </div>
          ))}
        </div>

        <div className="landing-spine__hook-sticky">
          <div
            className="landing-spine__hook-sway-scroll"
            style={{ rotate: "var(--hook-sway-deg)" }}
          >
            <div
              className={`landing-spine__hook-sway${reduceMotion ? " landing-spine__hook-sway--still" : ""}`}
              style={
                {
                  "--hook-sway-duration": "5.4s",
                  "--hook-sway-angle": "1.8deg",
                } as CSSProperties
              }
            >
              <div className="landing-spine__hook-grow" onPointerEnter={startBobbing}>
                <div
                  className={`landing-spine__hook${bobbing ? " landing-spine__hook--bobbing" : ""}`}
                >
                  <HookImage className="landing-spine__hook-image landing-spine__hook-image--hero" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="landing-spine__content">{children}</div>
    </div>
  );
}

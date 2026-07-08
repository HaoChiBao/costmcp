"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import {
  CENTER_BILL_SIZE,
  CENTER_FOCAL_TARGET_VH,
  CENTER_SCROLL_SCALE_END,
  CENTER_SCROLL_SCALE_START,
  CENTER_STICKY_EXTEND_FRACTION,
  HOOK_TOP_OFFSET,
  SIDE_HOOKS,
  SIDE_SCROLL_GROW_MAX,
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

      const sideOpacity = clamp(1 - growProgress * 0.92, 0.06, 1);

      const centerScrollScale =
        CENTER_SCROLL_SCALE_START +
        growProgress * (CENTER_SCROLL_SCALE_END - CENTER_SCROLL_SCALE_START);

      const grow = spine.querySelector<HTMLElement>(".landing-spine__hook-grow");
      const sticky = spine.querySelector<HTMLElement>(".landing-spine__hook-sticky");

      // Keep the bill's vertical center pinned to the focal line as it scales.
      // The bill scales from its top edge, so while it's small its center sits
      // above the focal line (fine). Once growth would push the center past the
      // line, translate the bill up by the excess so the center stays put while
      // it keeps growing around that point.
      let centerLift = 0;
      if (grow && sticky) {
        const vh = window.innerHeight;
        const baseHeight = grow.offsetHeight;
        if (baseHeight > 0) {
          // sticky isn't affected by the grow transform, so its top + the sticky
          // padding gives the bill's untranslated top edge.
          const billTop = sticky.getBoundingClientRect().top + HOOK_TOP_OFFSET;
          const renderedHeight = baseHeight * CENTER_BILL_SIZE * centerScrollScale;
          const naturalCenter = billTop + renderedHeight / 2;
          const targetCenter = vh * CENTER_FOCAL_TARGET_VH;
          centerLift = Math.max(0, naturalCenter - targetCenter);
        }
      }

      // End the sticky region past the footer's top edge so the bill extends
      // further down into the footer (by a fraction of its rendered height)
      // before releasing and scrolling away with the page.
      const footer = spine.querySelector<HTMLElement>(".site-footer");
      const track = spine.querySelector<HTMLElement>(".landing-spine__track");
      if (footer && track) {
        const spineTop = spine.getBoundingClientRect().top;
        const footerTop = footer.getBoundingClientRect().top;
        const renderedBillHeight = grow
          ? grow.offsetHeight * CENTER_BILL_SIZE * CENTER_SCROLL_SCALE_END
          : 0;
        const stopOffset = renderedBillHeight * CENTER_STICKY_EXTEND_FRACTION;
        track.style.height = `${footerTop - spineTop + stopOffset}px`;
      }

      const miniSways = spine.querySelectorAll<HTMLElement>("[data-hook-id]");
      miniSways.forEach((el) => {
        const hook = SIDE_HOOKS.find((item) => item.id === el.dataset.hookId);
        if (!hook) return;

        const hookGrowProgress = reduceMotion
          ? growProgress > 0.5
            ? 1
            : 0
          : clamp(growProgress * hook.scrollGrowSpeed, 0, 1);

        const baseScale = scaledBillSize(hook.scale);
        const scrollScale = baseScale * (1 + hookGrowProgress * SIDE_SCROLL_GROW_MAX);
        el.style.setProperty("--hook-scale", String(scrollScale));
      });

      const spineProgress = clamp(
        scrollInHero / Math.max((spine.offsetHeight - window.innerHeight) * 0.85, 1),
        0,
        1,
      );
      const hookSway = reduceMotion ? 0 : Math.sin(spineProgress * Math.PI * 6) * 2.25;

      spine.style.setProperty("--center-scroll-scale", String(centerScrollScale));
      spine.style.setProperty("--center-lift", `${centerLift}px`);
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
          "--center-scroll-scale": CENTER_SCROLL_SCALE_START,
          "--center-lift": "0px",
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
                data-hook-id={hook.id}
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
              <div
                className="landing-spine__hook-grow"
                style={{ "--hook-scale": CENTER_BILL_SIZE } as CSSProperties}
                onPointerEnter={startBobbing}
              >
                <div
                  className={`landing-spine__hook${bobbing ? " landing-spine__hook--bobbing" : ""}`}
                >
                  <HookImage className="landing-spine__hook-image landing-spine__hook-image--mini" />
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

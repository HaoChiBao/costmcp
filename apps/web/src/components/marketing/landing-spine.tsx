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

type SwayPhysics = {
  angle: number;
  velocity: number;
};

const CURSOR_SWAY_VELOCITY_SCALE = 0.0035;
const CURSOR_SWAY_VERTICAL_SCALE = 0.0012;
const CURSOR_SWAY_DAMPING = 0.9;
const CURSOR_SWAY_SPRING = 0.07;
const CURSOR_SWAY_MAX_DEG = 11;

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
  const swayPhysicsRef = useRef<Map<string, SwayPhysics>>(new Map());
  const pointerRef = useRef({
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    lastX: 0,
    lastY: 0,
    lastTime: 0,
    active: false,
  });

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
    let frame = 0;
    let smoothedGrow = 0;
    let hasSmoothed = false;

    const update = () => {
      const heroHeight = hero?.offsetHeight ?? window.innerHeight;
      const growDistance = Math.max(heroHeight * 0.42, 280);
      const scrollInHero = window.scrollY - (hero?.offsetTop ?? 0);

      const rawGrow = reduceMotion
        ? scrollInHero > growDistance * 0.5
          ? 1
          : 0
        : clamp(scrollInHero / growDistance, 0, 1);

      // Ease scroll-driven values so wheel/trackpad motion feels continuous.
      if (!hasSmoothed || reduceMotion) {
        smoothedGrow = rawGrow;
        hasSmoothed = true;
      } else {
        smoothedGrow += (rawGrow - smoothedGrow) * 0.18;
        if (Math.abs(rawGrow - smoothedGrow) < 0.0008) smoothedGrow = rawGrow;
      }

      const growProgress = smoothedGrow;
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

      if (!reduceMotion && Math.abs(rawGrow - smoothedGrow) > 0.0008) {
        frame = requestAnimationFrame(update);
      }
    };

    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [reduceMotion]);

  useEffect(() => {
    if (reduceMotion) return;

    const spine = spineRef.current;
    if (!spine) return;

    const getSwayState = (id: string): SwayPhysics => {
      let state = swayPhysicsRef.current.get(id);
      if (!state) {
        state = { angle: 0, velocity: 0 };
        swayPhysicsRef.current.set(id, state);
      }
      return state;
    };

    const isPointerOverBill = (rect: DOMRect, x: number, y: number) => {
      const padX = rect.width * 0.22;
      return (
        x >= rect.left - padX &&
        x <= rect.right + padX &&
        y >= rect.top &&
        y <= rect.bottom
      );
    };

    const applyCursorImpulse = () => {
      const pointer = pointerRef.current;
      if (!pointer.active) return;

      const swayTargets = spine.querySelectorAll<HTMLElement>("[data-hook-id]");
      swayTargets.forEach((el) => {
        const id = el.dataset.hookId;
        if (!id) return;

        const rect = el.getBoundingClientRect();
        if (!isPointerOverBill(rect, pointer.x, pointer.y)) return;

        const state = getSwayState(id);
        state.velocity +=
          pointer.vx * CURSOR_SWAY_VELOCITY_SCALE +
          pointer.vy * CURSOR_SWAY_VERTICAL_SCALE;
      });
    };

    let physicsFrame = 0;

    const tickPhysics = () => {
      const swayTargets = spine.querySelectorAll<HTMLElement>("[data-hook-id]");
      let moving = false;

      swayTargets.forEach((el) => {
        const id = el.dataset.hookId;
        if (!id) return;

        const state = getSwayState(id);
        state.velocity += -state.angle * CURSOR_SWAY_SPRING;
        state.velocity *= CURSOR_SWAY_DAMPING;
        state.angle += state.velocity;
        state.angle = clamp(state.angle, -CURSOR_SWAY_MAX_DEG, CURSOR_SWAY_MAX_DEG);

        if (Math.abs(state.angle) > 0.02 || Math.abs(state.velocity) > 0.02) {
          moving = true;
        } else {
          state.angle = 0;
          state.velocity = 0;
        }

        el.style.setProperty("--hook-cursor-sway-deg", `${state.angle}deg`);
      });

      if (moving || pointerRef.current.active) {
        physicsFrame = requestAnimationFrame(tickPhysics);
      } else {
        physicsFrame = 0;
      }
    };

    const ensurePhysicsLoop = () => {
      if (!physicsFrame) physicsFrame = requestAnimationFrame(tickPhysics);
    };

    const onPointerMove = (event: PointerEvent) => {
      const pointer = pointerRef.current;
      const now = performance.now();
      const dt = pointer.lastTime > 0 ? Math.min(now - pointer.lastTime, 48) : 16;

      if (pointer.lastTime > 0 && dt > 0) {
        const rawVx = ((event.clientX - pointer.lastX) / dt) * 16;
        const rawVy = ((event.clientY - pointer.lastY) / dt) * 16;
        pointer.vx = pointer.vx * 0.55 + rawVx * 0.45;
        pointer.vy = pointer.vy * 0.55 + rawVy * 0.45;
      }

      pointer.x = event.clientX;
      pointer.y = event.clientY;
      pointer.lastX = event.clientX;
      pointer.lastY = event.clientY;
      pointer.lastTime = now;
      pointer.active = true;

      applyCursorImpulse();
      ensurePhysicsLoop();
    };

    const onPointerLeave = () => {
      pointerRef.current.active = false;
    };

    window.addEventListener("pointermove", onPointerMove, { passive: true });
    document.documentElement.addEventListener("pointerleave", onPointerLeave);

    return () => {
      cancelAnimationFrame(physicsFrame);
      window.removeEventListener("pointermove", onPointerMove);
      document.documentElement.removeEventListener("pointerleave", onPointerLeave);
      swayPhysicsRef.current.clear();
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
              data-hook-id="center"
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

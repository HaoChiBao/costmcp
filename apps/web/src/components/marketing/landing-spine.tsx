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

type BillSwayState = {
  offsetAngle: number;
  offsetVelocity: number;
  amplitude: number;
  period: number;
  phase: number;
};

const OFFSET_SPRING = 7.5;
const OFFSET_DAMPING = 5;
const CURSOR_MAX_SPEED = 1.6;
const CURSOR_VELOCITY_IMPULSE = 9;
const CURSOR_VERTICAL_RATIO = 0.22;
const CURSOR_MIN_SPEED = 0.04;

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
  const swayPhysicsRef = useRef<Map<string, BillSwayState>>(new Map());
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
      spine.style.setProperty("--hook-scroll-sway-deg", `${hookSway}deg`);

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

    const startTime = performance.now();
    let lastTick = startTime;
    let physicsFrame = 0;

    const readBillConfig = (el: HTMLElement): Pick<BillSwayState, "amplitude" | "period" | "phase"> => ({
      amplitude: Number(el.dataset.swayAmplitude) || 1.4,
      period: Number(el.dataset.swayPeriod) || 4.5,
      phase: Number(el.dataset.swayPhase) || 0,
    });

    const getSwayState = (id: string, el: HTMLElement): BillSwayState => {
      let state = swayPhysicsRef.current.get(id);
      if (!state) {
        const config = readBillConfig(el);
        state = { offsetAngle: 0, offsetVelocity: 0, ...config };
        swayPhysicsRef.current.set(id, state);
      }
      return state;
    };

    const idleAngle = (t: number, state: BillSwayState) => {
      const omega = (Math.PI * 2) / state.period;
      return state.amplitude * Math.sin(omega * t + state.phase);
    };

    const billImage = (el: HTMLElement) => el.querySelector("img");

    const isPointerOverBill = (rect: DOMRect, x: number, y: number) => {
      const padX = rect.width * 0.18;
      const padY = rect.height * 0.04;
      return (
        x >= rect.left - padX &&
        x <= rect.right + padX &&
        y >= rect.top - padY &&
        y <= rect.bottom + padY
      );
    };

    const applyCursorImpulse = () => {
      const pointer = pointerRef.current;
      if (!pointer.active) return;

      const speed = Math.hypot(pointer.vx, pointer.vy);
      if (speed < CURSOR_MIN_SPEED) return;

      const normalized = Math.min(speed / CURSOR_MAX_SPEED, 1);
      const nx = pointer.vx / speed;
      const ny = pointer.vy / speed;
      const impulse =
        normalized * (nx * CURSOR_VELOCITY_IMPULSE + ny * CURSOR_VELOCITY_IMPULSE * CURSOR_VERTICAL_RATIO);

      const swayTargets = spine.querySelectorAll<HTMLElement>("[data-hook-id]");
      swayTargets.forEach((el) => {
        const id = el.dataset.hookId;
        if (!id) return;

        const img = billImage(el);
        if (!img) return;

        const rect = img.getBoundingClientRect();
        if (!isPointerOverBill(rect, pointer.x, pointer.y)) return;

        getSwayState(id, el).offsetVelocity += impulse;
      });
    };

    const tickPhysics = (now: number) => {
      const dt = Math.min((now - lastTick) / 1000, 0.05);
      lastTick = now;
      const t = (now - startTime) / 1000;
      const swayTargets = spine.querySelectorAll<HTMLElement>("[data-hook-id]");

      swayTargets.forEach((el) => {
        const id = el.dataset.hookId;
        if (!id) return;

        const state = getSwayState(id, el);
        const base = idleAngle(t, state);
        const spring = -state.offsetAngle * OFFSET_SPRING;
        const damping = -state.offsetVelocity * OFFSET_DAMPING;

        state.offsetVelocity += (spring + damping) * dt;
        state.offsetAngle += state.offsetVelocity * dt;

        el.style.setProperty("--hook-sway-deg", `${base + state.offsetAngle}deg`);
      });

      physicsFrame = requestAnimationFrame(tickPhysics);
    };

    const onPointerMove = (event: PointerEvent) => {
      const pointer = pointerRef.current;
      const now = performance.now();
      const dt = pointer.lastTime > 0 ? Math.min(now - pointer.lastTime, 48) : 16;

      if (pointer.lastTime > 0 && dt > 0) {
        const rawVx = (event.clientX - pointer.lastX) / dt;
        const rawVy = (event.clientY - pointer.lastY) / dt;
        pointer.vx = pointer.vx * 0.5 + rawVx * 0.5;
        pointer.vy = pointer.vy * 0.5 + rawVy * 0.5;
      }

      pointer.x = event.clientX;
      pointer.y = event.clientY;
      pointer.lastX = event.clientX;
      pointer.lastY = event.clientY;
      pointer.lastTime = now;
      pointer.active = true;

      applyCursorImpulse();
    };

    const onPointerLeave = () => {
      pointerRef.current.active = false;
      pointerRef.current.vx = 0;
      pointerRef.current.vy = 0;
    };

    physicsFrame = requestAnimationFrame(tickPhysics);
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
          "--hook-scroll-sway-deg": "0deg",
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
                data-sway-amplitude={hook.swayAngle}
                data-sway-period={hook.swayDuration}
                data-sway-phase={(hook.swayDelay / hook.swayDuration) * Math.PI * 2}
                style={
                  {
                    "--hook-scale": scaledBillSize(hook.scale),
                    "--hook-drop": `${hook.drop}px`,
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
            style={{ rotate: "var(--hook-scroll-sway-deg)" }}
          >
            <div
              className={`landing-spine__hook-sway${reduceMotion ? " landing-spine__hook-sway--still" : ""}`}
              data-hook-id="center"
              data-sway-amplitude={1.8}
              data-sway-period={5.4}
              data-sway-phase={0}
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

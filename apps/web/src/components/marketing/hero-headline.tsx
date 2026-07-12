"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { HERO_COST_IMAGES } from "@/components/marketing/hero-cost-images";
import { HeroPaintDefs, HeroTextPaint } from "@/components/marketing/hero-text-paint";

const SWITCH_MS = 800;
/** Headline scale for KNOW YOUR COST. */
const HEADLINE_SCALE = 1.5;
/** Cost is 3× the width-matched baseline, scaled with the headline, then tuned down. */
const COST_SIZE_MULTIPLIER = ((3 * HEADLINE_SCALE) / 1.5) * 1.2;
const MOBILE_COST_SIZE_MULTIPLIER = 1.35;

function costSizeMultiplier(viewportWidth: number) {
  return viewportWidth < 768 ? MOBILE_COST_SIZE_MULTIPLIER : COST_SIZE_MULTIPLIER;
}

function HeadlineWord({ children }: { children: string }) {
  return (
    <span className="hero__headline-word-stack">
      <HeroTextPaint variant="word">{children}</HeroTextPaint>
      <span className="hero__headline-word">{children}</span>
    </span>
  );
}

function preloadHeroCostImages() {
  return Promise.all(
    HERO_COST_IMAGES.map(
      (img) =>
        new Promise<void>((resolve) => {
          const image = new Image();
          image.decoding = "async";
          image.onload = () => resolve();
          image.onerror = () => resolve();
          image.src = img.src;
        }),
    ),
  );
}

export function HeroHeadline() {
  const rowRef = useRef<HTMLSpanElement>(null);
  const costRef = useRef<HTMLSpanElement>(null);
  const [costSize, setCostSize] = useState<number | null>(null);
  const [imageIndex, setImageIndex] = useState(0);
  const [imagesReady, setImagesReady] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduceMotion(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    let cancelled = false;

    void preloadHeroCostImages().then(() => {
      if (!cancelled) setImagesReady(true);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useLayoutEffect(() => {
    const row = rowRef.current;
    const cost = costRef.current;
    if (!row || !cost) return;

    const fit = () => {
      const targetWidth = row.offsetWidth;
      if (targetWidth <= 0) return;

      let size = 72;

      const measure = (px: number) => {
        cost.style.fontSize = `${px}px`;
        return cost.offsetWidth;
      };

      while (measure(size) < targetWidth && size < 300) {
        size += 1;
      }

      while (measure(size) > targetWidth && size > 60) {
        size -= 1;
      }

      let finalSize = size * costSizeMultiplier(window.innerWidth);
      const maxWidth = Math.min(window.innerWidth * 0.92, ((864 * HEADLINE_SCALE) / 1.5) * 1.2);
      const maxCostSize = window.innerWidth < 768 ? window.innerWidth * 0.24 : Infinity;

      cost.style.fontSize = `${finalSize}px`;
      while (cost.scrollWidth > maxWidth && finalSize > 48) {
        finalSize -= 1;
        cost.style.fontSize = `${finalSize}px`;
      }

      if (Number.isFinite(maxCostSize)) {
        finalSize = Math.min(finalSize, maxCostSize);
      }

      cost.style.fontSize = "";
      setCostSize(finalSize);
    };

    fit();

    const observer = new ResizeObserver(fit);
    observer.observe(row);
    window.addEventListener("resize", fit);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", fit);
    };
  }, []);

  useEffect(() => {
    if (!imagesReady || reduceMotion || HERO_COST_IMAGES.length <= 1) return;

    const id = window.setInterval(() => {
      setImageIndex((current) => (current + 1) % HERO_COST_IMAGES.length);
    }, SWITCH_MS);

    return () => window.clearInterval(id);
  }, [imagesReady, reduceMotion]);

  const costFontStyle: CSSProperties | undefined = costSize
    ? { fontSize: `${costSize}px` }
    : undefined;

  return (
    <h1 className="hero__headline">
      <HeroPaintDefs />
      <span ref={rowRef} className="hero__headline-row">
        <HeadlineWord>KNOW</HeadlineWord>
        <HeadlineWord>YOUR</HeadlineWord>
      </span>
      <span
        ref={costRef}
        className="hero__cost"
        style={costFontStyle}
        aria-label="COST"
      >
        <HeroTextPaint variant="cost">COST</HeroTextPaint>
        {HERO_COST_IMAGES.map((image, index) => (
          <span
            key={image.src}
            className={`hero__cost-layer${index === 0 ? " hero__cost-layer--anchor" : ""}`}
            style={{
              backgroundImage: `url(${image.src})`,
              backgroundPosition: image.position,
              opacity: index === (imagesReady ? imageIndex : 0) ? 1 : 0,
            }}
            aria-hidden={index !== imageIndex}
          >
            COST
          </span>
        ))}
      </span>
    </h1>
  );
}

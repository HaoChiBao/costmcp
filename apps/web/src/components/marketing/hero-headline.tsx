"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { HERO_COST_IMAGES } from "@/components/marketing/hero-cost-images";

const SWITCH_MS = 380;
/** Cost is 2× the width-matched baseline (same width as "KNOW" + "YOUR"). */
const COST_SIZE_MULTIPLIER = 2;

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

      let size = 32;

      const measure = (px: number) => {
        cost.style.fontSize = `${px}px`;
        return cost.offsetWidth;
      };

      while (measure(size) < targetWidth && size < 200) {
        size += 1;
      }

      while (measure(size) > targetWidth && size > 24) {
        size -= 1;
      }

      cost.style.fontSize = "";
      setCostSize(size * COST_SIZE_MULTIPLIER);
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
      <span ref={rowRef} className="hero__headline-row">
        <span className="hero__headline-word">KNOW</span>
        <span className="hero__headline-word">YOUR</span>
      </span>
      <span
        ref={costRef}
        className="hero__cost"
        style={costFontStyle}
        aria-label="COST"
      >
        {HERO_COST_IMAGES.map((image, index) => (
          <span
            key={image.src}
            className="hero__cost-layer"
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

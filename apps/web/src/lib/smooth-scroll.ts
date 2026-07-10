/** Ease-out cubic — fast start, soft landing. */
export function easeOutCubic(t: number) {
  return 1 - (1 - t) ** 3;
}

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Smoothly scroll the window to an element (or absolute Y), accounting for
 * sticky/absolute chrome height via `scroll-padding-top` / optional offset.
 */
export function smoothScrollTo(
  target: Element | number,
  options?: { duration?: number; offset?: number },
) {
  const duration = options?.duration ?? 780;
  const offset = options?.offset ?? 0;
  const startY = window.scrollY;
  const endY =
    typeof target === "number"
      ? target
      : target.getBoundingClientRect().top + window.scrollY - offset;
  const distance = endY - startY;

  if (Math.abs(distance) < 1) return Promise.resolve();

  if (prefersReducedMotion() || duration <= 0) {
    window.scrollTo(0, endY);
    return Promise.resolve();
  }

  return new Promise<void>((resolve) => {
    const start = performance.now();

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      window.scrollTo(0, startY + distance * easeOutCubic(t));
      if (t < 1) {
        requestAnimationFrame(tick);
      } else {
        resolve();
      }
    };

    requestAnimationFrame(tick);
  });
}

export function smoothScrollToHash(hash: string, options?: { duration?: number; offset?: number }) {
  const id = hash.replace(/^#/, "");
  if (!id) return Promise.resolve();
  const el = document.getElementById(id);
  if (!el) return Promise.resolve();
  return smoothScrollTo(el, options);
}

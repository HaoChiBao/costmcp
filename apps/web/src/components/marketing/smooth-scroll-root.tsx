"use client";

import { useEffect } from "react";
import { smoothScrollToHash } from "@/lib/smooth-scroll";

/** Chrome height used as scroll offset for in-page anchors. */
function chromeOffset() {
  const chrome = document.querySelector<HTMLElement>(".page__chrome");
  return (chrome?.offsetHeight ?? 72) + 12;
}

/**
 * Intercepts same-page hash links and initial `#hash` loads so scrolling
 * eases to the target instead of jumping (or fighting native smooth scroll).
 */
export function SmoothScrollRoot() {
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      const anchor = (event.target as Element | null)?.closest?.("a[href]");
      if (!(anchor instanceof HTMLAnchorElement)) return;

      const href = anchor.getAttribute("href");
      if (!href || !href.includes("#")) return;

      let url: URL;
      try {
        url = new URL(href, window.location.href);
      } catch {
        return;
      }

      if (url.pathname !== window.location.pathname) return;
      if (!url.hash || url.hash === "#") return;

      const target = document.getElementById(url.hash.slice(1));
      if (!target) return;

      event.preventDefault();
      history.pushState(null, "", url.hash);
      void smoothScrollToHash(url.hash, { offset: chromeOffset() });
    };

    document.addEventListener("click", onClick);

    if (window.location.hash) {
      const hash = window.location.hash;
      requestAnimationFrame(() => {
        void smoothScrollToHash(hash, { offset: chromeOffset(), duration: 900 });
      });
    }

    return () => document.removeEventListener("click", onClick);
  }, []);

  return null;
}

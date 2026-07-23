"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useState } from "react";
import { smoothScrollTo } from "@/lib/smooth-scroll";

type NavLink = {
  href: string;
  label: string;
  match: (p: string) => boolean;
  cta?: boolean;
  external?: boolean;
};

const baseLinks: NavLink[] = [
  { href: "/#features", label: "Product", match: (p) => p === "/" },
  {
    href: "https://docs.costmcp.com",
    label: "Docs",
    match: () => false,
    external: true,
  },
];

const guestLinks: NavLink[] = [
  { href: "/login", label: "Sign in", match: (p) => p.startsWith("/login") },
  {
    href: "/signup",
    label: "Get started",
    match: (p) => p.startsWith("/signup"),
    cta: true,
  },
];

const authenticatedLinks: NavLink[] = [
  {
    href: "/dashboard",
    label: "Dashboard",
    match: (p) => p.startsWith("/dashboard"),
    cta: true,
  },
];

type MarketingNavProps = {
  isAuthenticated?: boolean;
};

export function MarketingNav({ isAuthenticated = false }: MarketingNavProps) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuId = useId();
  const links = [
    ...baseLinks,
    ...(isAuthenticated ? authenticatedLinks : guestLinks),
  ];

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    document.body.classList.toggle("site-nav-open", menuOpen);
    return () => document.body.classList.remove("site-nav-open");
  }, [menuOpen]);

  useEffect(() => {
    if (!menuOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [menuOpen]);

  const closeMenu = () => setMenuOpen(false);

  return (
    <header className={`site-nav${menuOpen ? " site-nav--open" : ""}`}>
      <Link
        href="/"
        className="site-nav__brand"
        onClick={(event) => {
          if (pathname !== "/") return;
          event.preventDefault();
          closeMenu();
          void smoothScrollTo(0, { duration: 700 });
        }}
      >
        <Image
          src="/logo.png"
          alt=""
          width={28}
          height={28}
          className="site-nav__logo"
          priority
        />
        <span>CostMCP</span>
      </Link>

      <button
        type="button"
        className="site-nav__toggle"
        aria-expanded={menuOpen}
        aria-controls={menuId}
        onClick={() => setMenuOpen((open) => !open)}
      >
        <span className="site-nav__toggle-icon" aria-hidden="true" />
        <span className="sr-only">{menuOpen ? "Close menu" : "Open menu"}</span>
      </button>

      <div id={menuId} className="site-nav__panel" onClick={closeMenu}>
        <nav
          className="site-nav__links"
          aria-label="Main"
          onClick={(event) => event.stopPropagation()}
        >
          {links.map((link) => {
            const className = [
              "site-nav__link",
              link.match(pathname) ? "site-nav__link--active" : "",
              link.cta ? "site-nav__link--cta" : "",
            ]
              .filter(Boolean)
              .join(" ");

            if (link.external) {
              return (
                <a
                  key={link.href}
                  href={link.href}
                  className={className}
                  target="_blank"
                  rel="noreferrer"
                  onClick={closeMenu}
                >
                  {link.label}
                </a>
              );
            }

            return (
              <Link
                key={link.href}
                href={link.href}
                className={className}
                onClick={closeMenu}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}

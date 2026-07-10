"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { smoothScrollTo } from "@/lib/smooth-scroll";

const links: Array<{
  href: string;
  label: string;
  match: (p: string) => boolean;
  cta?: boolean;
  external?: boolean;
}> = [
  { href: "/#features", label: "Product", match: (p) => p === "/" },
  {
    href: "https://docs.costmcp.com",
    label: "Docs",
    match: () => false,
    external: true,
  },
  { href: "/login", label: "Sign in", match: (p) => p.startsWith("/login") },
  {
    href: "/signup",
    label: "Get started",
    match: (p) => p.startsWith("/signup"),
    cta: true,
  },
];

export function MarketingNav() {
  const pathname = usePathname();

  return (
    <header className="site-nav">
      <Link
        href="/"
        className="site-nav__brand"
        onClick={(event) => {
          if (pathname !== "/") return;
          event.preventDefault();
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
      <nav className="site-nav__links" aria-label="Main">
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
              >
                {link.label}
              </a>
            );
          }

          return (
            <Link key={link.href} href={link.href} className={className}>
              {link.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}

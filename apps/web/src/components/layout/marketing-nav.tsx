"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/#features", label: "Product", match: (p: string) => p === "/" },
  { href: "/login", label: "Sign in", match: (p: string) => p.startsWith("/login") },
  { href: "/signup", label: "Get started", match: (p: string) => p.startsWith("/signup"), cta: true },
];

export function MarketingNav() {
  const pathname = usePathname();

  return (
    <header className="site-nav">
      <Link href="/" className="site-nav__brand">
        CostMCP
      </Link>
      <nav className="site-nav__links" aria-label="Main">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={[
              "site-nav__link",
              link.match(pathname) ? "site-nav__link--active" : "",
              link.cta ? "site-nav__link--cta" : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            {link.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}

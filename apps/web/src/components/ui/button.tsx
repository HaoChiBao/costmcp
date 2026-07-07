import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

type Variant = "default" | "ink" | "ghost" | "tag" | "primary" | "accent";

interface ButtonProps extends ComponentProps<"button"> {
  variant?: Variant;
  block?: boolean;
  href?: string;
}

export function Button({
  variant = "default",
  block,
  href,
  className = "",
  children,
  ...props
}: ButtonProps) {
  const classes = [
    "btn",
    variant === "ink" || variant === "primary" ? "btn--ink" : "",
    variant === "ghost" || variant === "accent" ? "btn--ghost" : "",
    variant === "tag" ? "btn--tag" : "",
    block ? "btn--block" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  if (href) {
    return (
      <Link href={href} className={classes}>
        {children}
      </Link>
    );
  }

  return (
    <button className={classes} {...props}>
      {children}
    </button>
  );
}

export function TextLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="text-link">
      {children}
    </Link>
  );
}

import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="site-footer">
      <div className="site-footer__panel">
        <div className="site-footer__top">
          <div className="site-footer__brand-block">
            <Link href="/" className="site-footer__brand">
              CostMCP
            </Link>
            <p className="site-footer__tagline">Organized AI spend for builders.</p>
          </div>
          <Button href="/signup" variant="ink">
            Get started
          </Button>
        </div>

        <div className="site-footer__grid">
          <div className="site-footer__col">
            <p className="meta-label">Product</p>
            <nav className="site-footer__links" aria-label="Product">
              <Link href="/#features">How it works</Link>
              <a href="https://docs.costmcp.com">Docs</a>
            </nav>
          </div>

          <div className="site-footer__col">
            <p className="meta-label">Account</p>
            <nav className="site-footer__links" aria-label="Account">
              <Link href="/login">Sign in</Link>
              <Link href="/signup">Create account</Link>
            </nav>
          </div>

          <div className="site-footer__col site-footer__col--meta">
            <p className="meta-label">Legal</p>
            <p className="site-footer__coords">© {year} CostMCP</p>
          </div>
        </div>
      </div>

      <div className="site-footer__banner" aria-hidden="true">
        <Image
          src="/images/footer-reaching-hands.png"
          alt=""
          width={2048}
          height={521}
          className="site-footer__banner-image"
          sizes="100vw"
        />
      </div>
    </footer>
  );
}

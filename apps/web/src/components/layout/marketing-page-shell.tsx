import { MarketingNav } from "@/components/layout/marketing-nav";
import { SiteFooter } from "@/components/layout/site-footer";

type MarketingPageShellProps = {
  children: React.ReactNode;
};

export function MarketingPageShell({ children }: MarketingPageShellProps) {
  return (
    <div className="page page--static">
      <header className="page__chrome page__chrome--static">
        <MarketingNav />
      </header>
      <main className="content-page">{children}</main>
      <SiteFooter />
    </div>
  );
}

import { MarketingNav } from "@/components/layout/marketing-nav";
import { SiteFooter } from "@/components/layout/site-footer";
import { createClient } from "@/lib/supabase/server";

type MarketingPageShellProps = {
  children: React.ReactNode;
};

export async function MarketingPageShell({ children }: MarketingPageShellProps) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const isAuthenticated = Boolean(user);

  return (
    <div className="page page--static">
      <header className="page__chrome page__chrome--static">
        <MarketingNav isAuthenticated={isAuthenticated} />
      </header>
      <main className="content-page">{children}</main>
      <SiteFooter isAuthenticated={isAuthenticated} />
    </div>
  );
}

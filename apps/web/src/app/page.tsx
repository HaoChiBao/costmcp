import { AnnouncementBar } from "@/components/marketing/announcement-bar";
import { FeaturesSection } from "@/components/marketing/features-section";
import { LandingHero } from "@/components/marketing/landing-hero";
import { LandingSpine } from "@/components/marketing/landing-spine";
import { SmoothScrollRoot } from "@/components/marketing/smooth-scroll-root";
import { SiteFooter } from "@/components/layout/site-footer";
import { MarketingNav } from "@/components/layout/marketing-nav";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const isAuthenticated = Boolean(user);

  return (
    <div className="page">
      <SmoothScrollRoot />
      <header className="page__chrome">
        <AnnouncementBar />
        <MarketingNav isAuthenticated={isAuthenticated} />
      </header>

      <LandingSpine>
        <LandingHero isAuthenticated={isAuthenticated} />
        <FeaturesSection />
        <SiteFooter isAuthenticated={isAuthenticated} />
      </LandingSpine>
    </div>
  );
}

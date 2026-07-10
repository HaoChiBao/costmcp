import { AnnouncementBar } from "@/components/marketing/announcement-bar";
import { FeaturesSection } from "@/components/marketing/features-section";
import { LandingHero } from "@/components/marketing/landing-hero";
import { LandingSpine } from "@/components/marketing/landing-spine";
import { SmoothScrollRoot } from "@/components/marketing/smooth-scroll-root";
import { SiteFooter } from "@/components/layout/site-footer";
import { MarketingNav } from "@/components/layout/marketing-nav";

export default function Home() {
  return (
    <div className="page">
      <SmoothScrollRoot />
      <header className="page__chrome">
        <AnnouncementBar />
        <MarketingNav />
      </header>

      <LandingSpine>
        <LandingHero />
        <FeaturesSection />
        <SiteFooter />
      </LandingSpine>
    </div>
  );
}

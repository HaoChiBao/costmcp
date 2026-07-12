import type { Metadata } from "next";
import {
  StaticPage,
  StaticPageActions,
  StaticPageHeader,
  StaticPageLink,
  StaticPagePanel,
} from "@/components/marketing/static-page";
import { MarketingPageShell } from "@/components/layout/marketing-page-shell";

export const metadata: Metadata = {
  title: "Product Demo — CostMCP",
  description: "Watch how CostMCP tracks AI project spend via dashboard, API, and MCP.",
};

function getEmbedUrl(url: string | undefined): string | null {
  if (!url) return null;

  try {
    const parsed = new URL(url);

    if (parsed.hostname.includes("youtube.com") || parsed.hostname === "youtu.be") {
      const videoId =
        parsed.hostname === "youtu.be"
          ? parsed.pathname.slice(1)
          : parsed.searchParams.get("v");
      return videoId ? `https://www.youtube.com/embed/${videoId}` : null;
    }

    if (parsed.hostname.includes("loom.com")) {
      const shareId = parsed.pathname.split("/").filter(Boolean).pop();
      return shareId ? `https://www.loom.com/embed/${shareId}` : null;
    }

    return url;
  } catch {
    return null;
  }
}

const demoVideoUrl = process.env.NEXT_PUBLIC_DEMO_VIDEO_URL;
const embedUrl = getEmbedUrl(demoVideoUrl);

export default function DemoPage() {
  return (
    <MarketingPageShell>
      <StaticPage>
        <StaticPageHeader
          eyebrow="Demo"
          title="See CostMCP in action"
          intro="A quick walkthrough of tracking AI spend across projects with the dashboard, API, and MCP connector."
        />

        {embedUrl ? (
          <div className="static-page__video">
            <iframe
              src={embedUrl}
              title="CostMCP product demo"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        ) : (
          <StaticPagePanel>
            <p className="static-page__copy">
              Demo recording coming soon. In the meantime, explore the{" "}
              <StaticPageLink href="https://docs.costmcp.com" external>
                documentation
              </StaticPageLink>{" "}
              or <StaticPageLink href="/signup">create an account</StaticPageLink> to try CostMCP.
            </p>
          </StaticPagePanel>
        )}

        <StaticPageActions>
          <StaticPageLink href="/support">Get support</StaticPageLink>
          <StaticPageLink href="https://docs.costmcp.com/mcp/overview" external>
            MCP setup guide
          </StaticPageLink>
        </StaticPageActions>
      </StaticPage>
    </MarketingPageShell>
  );
}

import type { Metadata } from "next";
import {
  StaticPage,
  StaticPageActions,
  StaticPageFaq,
  StaticPageHeader,
  StaticPageLink,
  StaticPagePanel,
  StaticPageSection,
} from "@/components/marketing/static-page";
import { MarketingPageShell } from "@/components/layout/marketing-page-shell";

export const metadata: Metadata = {
  title: "Support — CostMCP",
  description: "Get help with CostMCP accounts, API, and MCP integrations.",
};

const faqs = [
  {
    question: "How do I connect ChatGPT or Claude?",
    answer:
      "Add the remote MCP URL https://mcp.costmcp.com in your client’s connector settings and complete OAuth when prompted. Step-by-step guides are in the docs.",
  },
  {
    question: "Where do I find my API key?",
    answer:
      "Sign in, open a workspace, and go to API Keys in the dashboard. Keys are shown once at creation — store them securely.",
  },
  {
    question: "How do I revoke an OAuth connection?",
    answer:
      "Open your workspace Connections page in the dashboard and disconnect the client you no longer want to authorize.",
  },
  {
    question: "Is CostMCP storing my AI provider credentials?",
    answer:
      "CostMCP stores cost and usage records you send us, not your upstream provider API keys. OAuth tokens are used only to authenticate your MCP client to CostMCP.",
  },
];

export default function SupportPage() {
  return (
    <MarketingPageShell>
      <StaticPage>
        <StaticPageHeader
          eyebrow="Help"
          title="Customer support"
          intro="Need help with your account, API, or MCP setup? Reach out and we will get back to you."
        />

        <StaticPageSection label="Contact" title="Email us">
          <StaticPagePanel>
            <p className="static-page__copy">
              Write to{" "}
              <StaticPageLink href="mailto:support@costmcp.com">support@costmcp.com</StaticPageLink>{" "}
              with your workspace name and a short description of the issue.
            </p>
            <p className="static-page__copy">
              For integration questions, include whether you are using the REST API, SDK, or MCP, and
              any relevant error messages (redact API keys and tokens).
            </p>
          </StaticPagePanel>
        </StaticPageSection>

        <StaticPageSection label="Docs" title="Documentation">
          <p className="static-page__copy">
            Most setup and API questions are covered in our docs, including OAuth, MCP, and message
            ingestion.
          </p>
          <p className="static-page__copy">
            <StaticPageLink href="https://docs.costmcp.com" external>
              docs.costmcp.com
            </StaticPageLink>
          </p>
        </StaticPageSection>

        <StaticPageSection label="FAQ" title="Common questions">
          <StaticPageFaq items={faqs} />
        </StaticPageSection>

        <StaticPageSection label="Legal" title="Policies">
          <StaticPageActions>
            <StaticPageLink href="/privacy">Privacy Policy</StaticPageLink>
            <StaticPageLink href="/terms">Terms of Service</StaticPageLink>
          </StaticPageActions>
        </StaticPageSection>
      </StaticPage>
    </MarketingPageShell>
  );
}

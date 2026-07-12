import type { Metadata } from "next";
import { LegalDocument } from "@/components/legal/legal-document";
import { MarketingPageShell } from "@/components/layout/marketing-page-shell";

export const metadata: Metadata = {
  title: "Privacy Policy — CostMCP",
  description: "How CostMCP collects, uses, and protects your data.",
};

export default function PrivacyPage() {
  return (
    <MarketingPageShell>
      <LegalDocument
        eyebrow="Legal"
        title="Privacy Policy"
        updated="July 12, 2026"
        intro="CostMCP helps builders track AI project spend. This policy explains what we collect, why we collect it, and the choices you have."
        sections={[
          {
            title: "Who we are",
            paragraphs: [
              "CostMCP is operated by Yang Space. When this policy says “we,” “us,” or “CostMCP,” we mean Yang Space and the CostMCP service available at costmcp.com and related subdomains.",
              "Questions about privacy can be sent to support@costmcp.com.",
            ],
          },
          {
            title: "Information we collect",
            list: [
              "Account information such as your email address, display name, and profile details when you sign up or sign in (including via Google OAuth).",
              "Workspace and project data you create in CostMCP, including project names, cost records, budgets, subscriptions, and related metadata.",
              "API keys and OAuth connection records used to authenticate your integrations and connected MCP clients.",
              "Usage and technical data such as IP address, browser type, device information, and logs needed to operate, secure, and improve the service.",
            ],
          },
          {
            title: "How we use information",
            list: [
              "Provide, maintain, and improve CostMCP, including dashboards, APIs, and MCP tools.",
              "Authenticate users, authorize API and OAuth access, and prevent abuse.",
              "Respond to support requests and communicate about the service.",
              "Comply with legal obligations and enforce our Terms of Service.",
            ],
          },
          {
            title: "How we share information",
            paragraphs: [
              "We do not sell your personal information. We share data only with service providers that help us run CostMCP (for example, hosting and database providers such as Supabase and Vercel), when required by law, or with your direction (for example, when you connect an MCP client through OAuth).",
              "Cost records and usage metadata you submit may reference third-party AI providers (such as OpenAI or Anthropic). That data is stored to give you reporting and is not shared with those providers by CostMCP unless you choose to send it elsewhere.",
            ],
          },
          {
            title: "Data retention",
            paragraphs: [
              "We retain account and cost data for as long as your account is active or as needed to provide the service. You may request deletion of your account by contacting support@costmcp.com.",
            ],
          },
          {
            title: "Security",
            paragraphs: [
              "We use industry-standard safeguards including encrypted transport (HTTPS), access controls, and row-level security in our database. No method of transmission or storage is completely secure, and we cannot guarantee absolute security.",
            ],
          },
          {
            title: "Your choices",
            list: [
              "Access and update profile information from your account settings.",
              "Revoke OAuth connections and API keys from your workspace dashboard.",
              "Contact us to request access, correction, or deletion of personal data, subject to applicable law.",
            ],
          },
          {
            title: "Children",
            paragraphs: [
              "CostMCP is not directed to children under 13, and we do not knowingly collect personal information from children under 13.",
            ],
          },
          {
            title: "Changes",
            paragraphs: [
              "We may update this policy from time to time. We will post the revised version on this page and update the “Last updated” date above.",
            ],
          },
          {
            title: "Contact",
            paragraphs: ["Email support@costmcp.com or visit https://costmcp.com/support."],
          },
        ]}
      />
    </MarketingPageShell>
  );
}

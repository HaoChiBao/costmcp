import type { Metadata } from "next";
import { LegalDocument } from "@/components/legal/legal-document";
import { MarketingPageShell } from "@/components/layout/marketing-page-shell";

export const metadata: Metadata = {
  title: "Terms of Service — CostMCP",
  description: "Terms governing your use of CostMCP.",
};

export default function TermsPage() {
  return (
    <MarketingPageShell>
      <LegalDocument
        eyebrow="Legal"
        title="Terms of Service"
        updated="July 12, 2026"
        intro="These terms govern your access to and use of CostMCP. By creating an account or using the service, you agree to these terms."
        sections={[
          {
            title: "The service",
            paragraphs: [
              "CostMCP provides tools to record, organize, and report AI-related project spend through a web dashboard, REST API, SDK, and MCP integration.",
              "We may change, suspend, or discontinue features with reasonable notice when practical. Beta or preview features may be offered as-is.",
            ],
          },
          {
            title: "Accounts",
            list: [
              "You must provide accurate account information and keep your credentials secure.",
              "You are responsible for activity under your account, including API keys and OAuth connections you create.",
              "You must be at least 13 years old to use CostMCP.",
            ],
          },
          {
            title: "Acceptable use",
            list: [
              "Do not use CostMCP to violate law, infringe others’ rights, or transmit malware or abusive content.",
              "Do not attempt to probe, scan, or test the vulnerability of our systems except as permitted in writing.",
              "Do not resell or sublicense the service without our permission.",
            ],
          },
          {
            title: "Your data",
            paragraphs: [
              "You retain ownership of the data you submit to CostMCP. You grant us a limited license to host, process, and display that data solely to operate and improve the service.",
              "Our Privacy Policy at https://costmcp.com/privacy describes how we handle personal information.",
            ],
          },
          {
            title: "API keys and integrations",
            paragraphs: [
              "API keys and OAuth tokens are secrets. You are responsible for rotating or revoking them if compromised. CostMCP may rate-limit or suspend access that threatens service stability or security.",
            ],
          },
          {
            title: "Fees",
            paragraphs: [
              "If we introduce paid plans, we will describe pricing and billing terms before charging you. Taxes may apply where required by law.",
            ],
          },
          {
            title: "Disclaimer",
            paragraphs: [
              "CostMCP is provided “as is” and “as available.” We do not warrant that the service will be uninterrupted, error-free, or that cost estimates will match third-party invoices. You are responsible for verifying financial decisions.",
            ],
          },
          {
            title: "Limitation of liability",
            paragraphs: [
              "To the maximum extent permitted by law, Yang Space and its affiliates will not be liable for indirect, incidental, special, consequential, or punitive damages, or for loss of profits, data, or goodwill. Our total liability for any claim relating to the service is limited to the greater of USD $100 or the amount you paid us in the twelve months before the claim.",
            ],
          },
          {
            title: "Termination",
            paragraphs: [
              "You may stop using CostMCP at any time. We may suspend or terminate access if you violate these terms or if continued provision poses risk to the service or other users. Upon termination, your right to use the service ends, but sections that by their nature should survive will remain in effect.",
            ],
          },
          {
            title: "Governing law",
            paragraphs: [
              "These terms are governed by the laws of the State of Delaware, USA, without regard to conflict-of-law rules, except where mandatory local law applies.",
            ],
          },
          {
            title: "Contact",
            paragraphs: ["Questions about these terms: support@costmcp.com or https://costmcp.com/support."],
          },
        ]}
      />
    </MarketingPageShell>
  );
}

import { MarqueeRow } from "@/components/marketing/marquee-row";

const items = [
  "AI cost ledger",
  "Workspace-first",
  "MCP native",
  "One ledger",
  "Track tokens & subscriptions",
];

export function AnnouncementBar() {
  return (
    <div className="announcement-bar" role="region" aria-label="Announcements">
      <MarqueeRow items={items} speed="slow" />
    </div>
  );
}

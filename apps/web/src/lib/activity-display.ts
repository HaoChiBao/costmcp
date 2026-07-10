import { messageTypeTone } from "@/lib/org-colors";

function capitalize(value: string) {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function humanizeSlug(value: string) {
  return capitalize(value.replace(/[_-]+/g, " "));
}

export type ActivityDisplayInput = {
  label: string;
  messageType?: string | null;
  projectName?: string | null;
  vendor?: string | null;
  feature?: string | null;
};

export type ActivityDisplay = {
  title: string;
  subtitle: string;
  initial: string;
};

export function formatActivityDisplay(input: ActivityDisplayInput): ActivityDisplay {
  const parts = input.label.split("·").map((part) => part.trim()).filter(Boolean);
  const type = (input.messageType ?? parts[0] ?? "").toLowerCase();
  const project = input.projectName ?? parts[1] ?? "Unassigned";
  const tone = messageTypeTone(type);

  if (type === "usage") {
    const feature = input.feature ?? parts[2] ?? null;
    const provider = parts[parts.length - 1] ?? null;
    const title = input.vendor
      ? humanizeSlug(input.vendor)
      : provider && provider !== type
        ? humanizeSlug(provider)
        : feature
          ? humanizeSlug(feature)
          : humanizeSlug(type);

    const subtitleParts = [project];
    if (feature && feature !== provider) subtitleParts.push(humanizeSlug(feature));
    subtitleParts.push(tone.label);

    return {
      title,
      subtitle: subtitleParts.join(" · "),
      initial: title.charAt(0).toUpperCase() || "?",
    };
  }

  if (type === "expense" || type === "subscription") {
    const title = input.vendor
      ? humanizeSlug(input.vendor)
      : parts[0]
        ? humanizeSlug(parts[0])
        : input.label;
    const subtitleParts = [project, tone.label];
    if (parts[1] && parts[1] !== project) subtitleParts.splice(1, 0, humanizeSlug(parts[1]));

    return {
      title,
      subtitle: subtitleParts.filter(Boolean).join(" · "),
      initial: title.charAt(0).toUpperCase() || "?",
    };
  }

  const title = parts[parts.length - 1] ? humanizeSlug(parts[parts.length - 1]) : input.label;
  return {
    title,
    subtitle: parts.slice(0, -1).map(humanizeSlug).join(" · ") || project,
    initial: title.charAt(0).toUpperCase() || "?",
  };
}

export function formatActivityRowDate(iso: string) {
  const date = new Date(iso);
  const now = new Date();
  const options: Intl.DateTimeFormatOptions =
    date.getFullYear() === now.getFullYear()
      ? { month: "short", day: "numeric" }
      : { month: "short", day: "numeric", year: "numeric" };
  return new Intl.DateTimeFormat("en-US", options).format(date);
}

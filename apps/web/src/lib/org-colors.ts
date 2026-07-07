export type OrgTone = {
  color: string;
  bg: string;
  border: string;
};

export type OrgToneWithLabel = OrgTone & { label: string };

const MESSAGE_TYPES: Record<string, OrgTone & { label: string }> = {
  usage: {
    label: "Usage",
    color: "var(--org-type-usage)",
    bg: "var(--org-type-usage-bg)",
    border: "var(--org-type-usage-border)",
  },
  subscription: {
    label: "Subscription",
    color: "var(--org-type-subscription)",
    bg: "var(--org-type-subscription-bg)",
    border: "var(--org-type-subscription-border)",
  },
  expense: {
    label: "Expense",
    color: "var(--org-type-expense)",
    bg: "var(--org-type-expense-bg)",
    border: "var(--org-type-expense-border)",
  },
};

const ENVIRONMENTS: Record<string, OrgTone & { label: string }> = {
  production: {
    label: "Production",
    color: "var(--org-env-production)",
    bg: "var(--org-env-production-bg)",
    border: "var(--org-env-production-border)",
  },
  staging: {
    label: "Staging",
    color: "var(--org-env-staging)",
    bg: "var(--org-env-staging-bg)",
    border: "var(--org-env-staging-border)",
  },
  development: {
    label: "Development",
    color: "var(--org-env-development)",
    bg: "var(--org-env-development-bg)",
    border: "var(--org-env-development-border)",
  },
  other: {
    label: "Other",
    color: "var(--org-env-other)",
    bg: "var(--org-env-other-bg)",
    border: "var(--org-env-other-border)",
  },
};

const COLLECTIONS: Record<string, OrgTone & { label: string }> = {
  production: {
    label: "Production",
    color: "var(--org-collection-production)",
    bg: "var(--org-collection-production-bg)",
    border: "var(--org-collection-production-border)",
  },
  experiments: {
    label: "Experiments",
    color: "var(--org-collection-experiments)",
    bg: "var(--org-collection-experiments-bg)",
    border: "var(--org-collection-experiments-border)",
  },
  archived: {
    label: "Archived",
    color: "var(--org-collection-archived)",
    bg: "var(--org-collection-archived-bg)",
    border: "var(--org-collection-archived-border)",
  },
  ungrouped: {
    label: "Ungrouped",
    color: "var(--org-collection-ungrouped)",
    bg: "var(--org-collection-ungrouped-bg)",
    border: "var(--org-collection-ungrouped-border)",
  },
};

const VENDOR_CATEGORIES: Record<string, OrgTone & { label: string }> = {
  llm: {
    label: "LLM",
    color: "var(--org-vendor-llm)",
    bg: "var(--org-vendor-llm-bg)",
    border: "var(--org-vendor-llm-border)",
  },
  voice: {
    label: "Voice",
    color: "var(--org-vendor-voice)",
    bg: "var(--org-vendor-voice-bg)",
    border: "var(--org-vendor-voice-border)",
  },
  video: {
    label: "Video",
    color: "var(--org-vendor-video)",
    bg: "var(--org-vendor-video-bg)",
    border: "var(--org-vendor-video-border)",
  },
  ide: {
    label: "IDE",
    color: "var(--org-vendor-ide)",
    bg: "var(--org-vendor-ide-bg)",
    border: "var(--org-vendor-ide-border)",
  },
  saas: {
    label: "SaaS",
    color: "var(--org-vendor-saas)",
    bg: "var(--org-vendor-saas-bg)",
    border: "var(--org-vendor-saas-border)",
  },
  gpu: {
    label: "GPU",
    color: "var(--org-vendor-gpu)",
    bg: "var(--org-vendor-gpu-bg)",
    border: "var(--org-vendor-gpu-border)",
  },
  other: {
    label: "Other",
    color: "var(--org-vendor-other)",
    bg: "var(--org-vendor-other-bg)",
    border: "var(--org-vendor-other-border)",
  },
};

const VENDOR_SLUG_CATEGORY: Record<string, string> = {
  openai: "llm",
  anthropic: "llm",
  elevenlabs: "voice",
  fish: "voice",
  cursor: "ide",
  kling: "video",
  runway: "video",
  modal: "gpu",
  notion: "saas",
};

const ACCOUNT_CATEGORIES: Record<string, OrgTone> = {
  "ai-usage": {
    color: "var(--org-account-ai)",
    bg: "var(--org-account-ai-bg)",
    border: "var(--org-account-ai-border)",
  },
  subscriptions: {
    color: "var(--org-account-subscriptions)",
    bg: "var(--org-account-subscriptions-bg)",
    border: "var(--org-account-subscriptions-border)",
  },
  infrastructure: {
    color: "var(--org-account-infra)",
    bg: "var(--org-account-infra-bg)",
    border: "var(--org-account-infra-border)",
  },
  other: {
    color: "var(--org-account-other)",
    bg: "var(--org-account-other-bg)",
    border: "var(--org-account-other-border)",
  },
  "llm-tokens": {
    color: "var(--org-account-ai)",
    bg: "var(--org-account-ai-bg)",
    border: "var(--org-account-ai-border)",
  },
  "image-generation": {
    color: "var(--org-vendor-video)",
    bg: "var(--org-vendor-video-bg)",
    border: "var(--org-vendor-video-border)",
  },
  "voice-audio": {
    color: "var(--org-vendor-voice)",
    bg: "var(--org-vendor-voice-bg)",
    border: "var(--org-vendor-voice-border)",
  },
};

const PROJECT_SLUG_ORDER = [
  "slideshow-studio",
  "progressgoat",
  "youtube-pipeline",
  "ai-experiments",
  "content-hub",
  "internal-tools",
  "unassigned",
  "other",
] as const;

const PROJECT_PALETTE = [
  "var(--org-project-1)",
  "var(--org-project-2)",
  "var(--org-project-3)",
  "var(--org-project-4)",
  "var(--org-project-5)",
  "var(--org-project-6)",
  "var(--org-project-7)",
  "var(--org-project-8)",
] as const;

const FALLBACK_TONE: OrgTone = {
  color: "var(--color-ash)",
  bg: "var(--color-hairline)",
  border: "var(--color-midstone)",
};

function normalizeKey(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, "-");
}

function lookupTone<T extends OrgTone>(
  map: Record<string, T>,
  key: string | null | undefined,
  fallback: T | OrgTone = FALLBACK_TONE,
) {
  if (!key) return fallback;
  return map[normalizeKey(key)] ?? fallback;
}

export function messageTypeTone(type: string | null | undefined): OrgToneWithLabel {
  return lookupTone(MESSAGE_TYPES, type, {
    ...FALLBACK_TONE,
    label: type ?? "Unknown",
  }) as OrgToneWithLabel;
}

export function environmentTone(environment: string | null | undefined): OrgToneWithLabel {
  return lookupTone(ENVIRONMENTS, environment, {
    ...FALLBACK_TONE,
    label: environment ?? "Unknown",
  }) as OrgToneWithLabel;
}

export function collectionTone(slug: string | null | undefined): OrgToneWithLabel {
  return lookupTone(COLLECTIONS, slug ?? "ungrouped", {
    ...COLLECTIONS.ungrouped,
    label: slug ?? "Ungrouped",
  }) as OrgToneWithLabel;
}

export function vendorCategoryTone(
  category: string | null | undefined,
  slug?: string | null,
): OrgToneWithLabel {
  const resolved = category ?? (slug ? VENDOR_SLUG_CATEGORY[normalizeKey(slug)] : null);
  return lookupTone(VENDOR_CATEGORIES, resolved, {
    ...FALLBACK_TONE,
    label: resolved ?? "Vendor",
  }) as OrgToneWithLabel;
}

export function accountCategoryTone(slug: string | null | undefined) {
  return lookupTone(ACCOUNT_CATEGORIES, slug, FALLBACK_TONE);
}

export function projectColorBySlug(slug: string | null | undefined, index = 0) {
  if (!slug || slug === "unassigned" || slug === "other") {
    return PROJECT_PALETTE[PROJECT_PALETTE.length - 1];
  }
  const knownIndex = PROJECT_SLUG_ORDER.indexOf(normalizeKey(slug) as (typeof PROJECT_SLUG_ORDER)[number]);
  if (knownIndex >= 0) return PROJECT_PALETTE[knownIndex % PROJECT_PALETTE.length];
  let hash = 0;
  for (let i = 0; i < slug.length; i += 1) {
    hash = (hash + slug.charCodeAt(i) * (i + 1)) % PROJECT_PALETTE.length;
  }
  return PROJECT_PALETTE[(hash + index) % PROJECT_PALETTE.length];
}

export function projectToneBySlug(slug: string | null | undefined, index = 0): OrgTone {
  const color = projectColorBySlug(slug, index);
  return {
    color,
    bg: `color-mix(in srgb, ${color} 12%, var(--color-paper))`,
    border: `color-mix(in srgb, ${color} 28%, var(--color-hairline))`,
  };
}

export const CHART_TYPE_SERIES = [
  { key: "usage_usd", label: "Usage", color: "var(--org-type-usage)" },
  { key: "subscription_usd", label: "Subscription", color: "var(--org-type-subscription)" },
  { key: "expense_usd", label: "Expense", color: "var(--org-type-expense)" },
] as const;

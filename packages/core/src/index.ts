import { z } from "zod";

export const FIELD_LIMITS = {
  vendor: 80,
  notes: 280,
  project: 64,
  provider: 80,
  feature: 120,
} as const;

export const MessageSourceSchema = z.enum(["api", "mcp", "manual", "import"]);
export type MessageSource = z.infer<typeof MessageSourceSchema>;

export const UnitTypeSchema = z.enum([
  "input_tokens",
  "output_tokens",
  "total_tokens",
  "image",
  "video_second",
  "video_generation",
  "voice_character",
  "voice_byte",
  "voice_minute",
  "transcription_minute",
  "embedding",
  "api_call",
  "gpu_second",
  "storage_gb",
  "bandwidth_gb",
]);
export type UnitType = z.infer<typeof UnitTypeSchema>;

/** Non-zero amount; refunds may be entered positive and are signed at resolve time. */
const MoneyAmountSchema = z
  .number()
  .refine((n) => Number.isFinite(n) && n !== 0, "Amount must be a non-zero number");

export const ExpenseTypeSchema = z.enum([
  "one_time_purchase",
  "invoice",
  "credit_purchase",
  "refund",
  "reimbursement",
  "manual_adjustment",
]);
export type ExpenseType = z.infer<typeof ExpenseTypeSchema>;

/** Accept ISO datetime or date-only YYYY-MM-DD (stored as UTC midnight). */
export function normalizeIsoDateTime(input: string): string {
  const trimmed = input.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return `${trimmed}T00:00:00.000Z`;
  }
  const date = new Date(trimmed);
  if (Number.isNaN(date.getTime())) {
    throw new Error("Invalid date/time");
  }
  return date.toISOString();
}

export function parseOptionalIsoDateTime(input: unknown): string | undefined {
  if (input == null || input === "") return undefined;
  if (typeof input !== "string") {
    throw new Error("Date must be a string");
  }
  return normalizeIsoDateTime(input);
}

const OptionalFlexibleDateSchema = z
  .string()
  .optional()
  .transform((s, ctx) => {
    if (s == null || s === "") return undefined;
    try {
      return normalizeIsoDateTime(s);
    } catch {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Invalid date/time" });
      return z.NEVER;
    }
  });

export const UsageMessageSchema = z.object({
  type: z.literal("usage"),
  provider: z.string().min(1).max(FIELD_LIMITS.provider),
  model: z.string().max(80).optional(),
  unit_type: UnitTypeSchema,
  quantity: z.number().positive(),
  unit_cost: z.number().nonnegative().optional(),
  estimated_cost: z.number().nonnegative().optional(),
  feature: z.string().max(FIELD_LIMITS.feature).optional(),
  batch_id: z.string().optional(),
  environment: z.string().optional(),
  external_request_id: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const ExpenseMessageSchema = z.object({
  type: z.literal("expense"),
  vendor: z.string().min(1).max(FIELD_LIMITS.vendor),
  amount: MoneyAmountSchema,
  currency: z.string().default("USD"),
  category: z.string().max(64).optional(),
  expense_type: ExpenseTypeSchema.default("one_time_purchase"),
  notes: z.string().max(FIELD_LIMITS.notes).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const SubscriptionMessageSchema = z.object({
  type: z.literal("subscription"),
  vendor: z.string().min(1).max(FIELD_LIMITS.vendor),
  amount: MoneyAmountSchema,
  currency: z.string().default("USD"),
  interval: z.enum(["monthly", "yearly", "weekly", "quarterly"]),
  renewal_date: OptionalFlexibleDateSchema,
  category: z.string().max(64).optional(),
  project_allocation: z.string().max(64).optional(),
  status: z.enum(["active", "trial", "paused", "cancelled"]).default("active"),
  notes: z.string().max(FIELD_LIMITS.notes).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const AllocationMessageSchema = z.object({
  type: z.literal("allocation"),
  parent_message_id: z.string().uuid(),
  project: z.string().min(1).max(FIELD_LIMITS.project),
  allocated_amount: z.number().positive(),
  currency: z.string().default("USD"),
  notes: z.string().max(FIELD_LIMITS.notes).optional(),
});

export const BatchMessageSchema = z.object({
  type: z.literal("batch"),
  name: z.string().min(1).max(80),
  total_estimated_cost: z.number().nonnegative().optional(),
  total_actual_cost: z.number().nonnegative().optional(),
  outputs_generated: z.number().int().nonnegative().optional(),
  usable_outputs: z.number().int().nonnegative().optional(),
  final_outputs: z.number().int().nonnegative().optional(),
  provider: z.string().max(FIELD_LIMITS.provider).optional(),
  feature: z.string().max(FIELD_LIMITS.feature).optional(),
  notes: z.string().max(FIELD_LIMITS.notes).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const CostMessagePayloadSchema = z.discriminatedUnion("type", [
  UsageMessageSchema,
  ExpenseMessageSchema,
  SubscriptionMessageSchema,
  AllocationMessageSchema,
  BatchMessageSchema,
]);

export type CostMessagePayload = z.infer<typeof CostMessagePayloadSchema>;

export const CostMessageEnvelopeSchema = z.object({
  project: z.string().min(1).max(FIELD_LIMITS.project),
  source: MessageSourceSchema.default("api"),
  idempotency_key: z.string().optional(),
  timestamp: OptionalFlexibleDateSchema,
  message: CostMessagePayloadSchema,
});

export type CostMessageEnvelope = z.infer<typeof CostMessageEnvelopeSchema>;

export const CostMessageBatchSchema = z.array(CostMessageEnvelopeSchema).min(1).max(100);

export type ApiPermission =
  | "log_usage"
  | "add_expenses"
  | "read_summaries"
  | "estimate_costs"
  | "manage_subscriptions"
  | "manage_projects"
  | "delete_records";

const PROJECT_SLUG_RE = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;

export function validateProjectSlug(slug: string): string | null {
  const trimmed = slug.trim();
  if (!trimmed || trimmed.length > FIELD_LIMITS.project) {
    return "slug must be 1–64 characters";
  }
  if (!PROJECT_SLUG_RE.test(trimmed)) {
    return "slug must be lowercase alphanumeric with hyphens (no leading/trailing hyphen)";
  }
  return null;
}

export const DEFAULT_INGEST_PERMISSIONS: ApiPermission[] = [
  "log_usage",
  "add_expenses",
  "read_summaries",
  "estimate_costs",
];

/** Fallback USD-per-unit rates when DB rates are unavailable. */
export const DEFAULT_FX_RATES: Record<string, number> = {
  USD: 1,
  EUR: 1.08,
  GBP: 1.27,
  CAD: 0.73,
  AUD: 0.66,
  JPY: 0.0067,
  CHF: 1.12,
  CNY: 0.14,
  INR: 0.012,
  KRW: 0.00073,
  SGD: 0.74,
  HKD: 0.13,
  BRL: 0.18,
  MXN: 0.055,
  SEK: 0.095,
  NOK: 0.093,
  DKK: 0.145,
  NZD: 0.6,
  PLN: 0.25,
  TRY: 0.029,
};

export type CurrencyOption = {
  code: string;
  flag: string;
  label: string;
};

export const CURRENCY_OPTIONS: CurrencyOption[] = [
  { code: "USD", flag: "🇺🇸", label: "US Dollar" },
  { code: "EUR", flag: "🇪🇺", label: "Euro" },
  { code: "GBP", flag: "🇬🇧", label: "British Pound" },
  { code: "CAD", flag: "🇨🇦", label: "Canadian Dollar" },
  { code: "AUD", flag: "🇦🇺", label: "Australian Dollar" },
  { code: "JPY", flag: "🇯🇵", label: "Japanese Yen" },
  { code: "CHF", flag: "🇨🇭", label: "Swiss Franc" },
  { code: "CNY", flag: "🇨🇳", label: "Chinese Yuan" },
  { code: "INR", flag: "🇮🇳", label: "Indian Rupee" },
  { code: "KRW", flag: "🇰🇷", label: "Korean Won" },
  { code: "SGD", flag: "🇸🇬", label: "Singapore Dollar" },
  { code: "HKD", flag: "🇭🇰", label: "Hong Kong Dollar" },
  { code: "BRL", flag: "🇧🇷", label: "Brazilian Real" },
  { code: "MXN", flag: "🇲🇽", label: "Mexican Peso" },
  { code: "SEK", flag: "🇸🇪", label: "Swedish Krona" },
  { code: "NOK", flag: "🇳🇴", label: "Norwegian Krone" },
  { code: "DKK", flag: "🇩🇰", label: "Danish Krone" },
  { code: "NZD", flag: "🇳🇿", label: "New Zealand Dollar" },
  { code: "PLN", flag: "🇵🇱", label: "Polish Złoty" },
  { code: "TRY", flag: "🇹🇷", label: "Turkish Lira" },
];

export function parseCostMessage(input: unknown): CostMessageEnvelope {
  return CostMessageEnvelopeSchema.parse(input);
}

export function parseCostMessageBatch(input: unknown): CostMessageEnvelope[] {
  return CostMessageBatchSchema.parse(input);
}

/** Convert an amount in `currency` to USD using rate_to_usd (USD per 1 unit). */
export function convertToUsd(
  amount: number,
  currency: string | undefined,
  rates: Record<string, number> = DEFAULT_FX_RATES,
): number {
  const code = (currency ?? "USD").toUpperCase();
  if (code === "USD") return amount;
  const rate = rates[code] ?? DEFAULT_FX_RATES[code];
  if (rate == null) return amount;
  return amount * rate;
}

/** Sign expense amounts: refunds are negative spend. */
export function signedMoneyAmount(
  amount: number,
  expenseType?: ExpenseType | string,
): number {
  if (expenseType === "refund") return -Math.abs(amount);
  return amount;
}

export function resolveAmountUsd(
  message: CostMessagePayload,
  rates: Record<string, number> = DEFAULT_FX_RATES,
): number {
  switch (message.type) {
    case "usage":
      return message.estimated_cost ?? message.unit_cost ?? 0;
    case "expense": {
      const signed = signedMoneyAmount(message.amount, message.expense_type);
      return convertToUsd(signed, message.currency, rates);
    }
    case "subscription":
      return convertToUsd(message.amount, message.currency, rates);
    case "allocation":
      return convertToUsd(message.allocated_amount, message.currency, rates);
    case "batch":
      return message.total_actual_cost ?? message.total_estimated_cost ?? 0;
  }
}

/** Flatten message-specific fields into the ledger metadata jsonb. */
export function buildMessageMetadata(
  message: CostMessagePayload,
): Record<string, unknown> {
  switch (message.type) {
    case "usage":
    case "batch":
      return { ...(message.metadata ?? {}) };
    case "expense":
      return {
        vendor: message.vendor,
        expense_type: message.expense_type,
        ...(message.category ? { category: message.category } : {}),
        ...(message.notes ? { notes: message.notes } : {}),
        ...(message.metadata ?? {}),
      };
    case "subscription":
      return {
        vendor: message.vendor,
        interval: message.interval,
        status: message.status,
        ...(message.category ? { category: message.category } : {}),
        ...(message.renewal_date ? { renewal_date: message.renewal_date } : {}),
        ...(message.project_allocation
          ? { project_allocation: message.project_allocation }
          : {}),
        ...(message.notes ? { notes: message.notes } : {}),
        ...(message.metadata ?? {}),
      };
    case "allocation":
      return {
        ...(message.notes ? { notes: message.notes } : {}),
      };
  }
}

export type PricingRule = {
  id: string;
  workspace_id: string | null;
  provider: string;
  model: string | null;
  unit_type: string;
  rate_usd: number;
  notes: string | null;
};

export type EstimateUsageInput = {
  provider: string;
  model?: string;
  unit_type: string;
  quantity: number;
};

export type EstimateUsageResult = {
  estimated_usd: number;
  rate_usd: number;
  quantity: number;
  provider: string;
  model: string | null;
  unit_type: string;
  matched_rule: Pick<PricingRule, "id" | "provider" | "model" | "unit_type" | "rate_usd" | "notes"> | null;
};

function pickPricingRule(rules: PricingRule[], input: EstimateUsageInput): PricingRule | null {
  const provider = input.provider.toLowerCase().trim();
  const unitType = input.unit_type;
  const model = input.model?.trim() || null;

  let best: PricingRule | null = null;
  let bestScore = -1;

  for (const rule of rules) {
    if (rule.provider.toLowerCase() !== provider) continue;
    if (rule.unit_type !== unitType) continue;
    if (model !== null && rule.model !== null && rule.model !== model) continue;

    let score = rule.workspace_id ? 10 : 0;
    if (model !== null) {
      score += rule.model === model ? 5 : 1;
    } else if (rule.model === null) {
      score += 3;
    } else {
      score += 2;
    }

    if (score > bestScore) {
      bestScore = score;
      best = rule;
    }
  }

  return best;
}

export function computeUsageEstimate(
  input: EstimateUsageInput,
  rules: PricingRule[],
): EstimateUsageResult {
  const model = input.model?.trim() || null;
  const matched = pickPricingRule(rules, input);

  if (!matched) {
    return {
      estimated_usd: 0,
      rate_usd: 0,
      quantity: input.quantity,
      provider: input.provider,
      model,
      unit_type: input.unit_type,
      matched_rule: null,
    };
  }

  const rate = Number(matched.rate_usd);
  return {
    estimated_usd: rate * input.quantity,
    rate_usd: rate,
    quantity: input.quantity,
    provider: input.provider,
    model,
    unit_type: input.unit_type,
    matched_rule: {
      id: matched.id,
      provider: matched.provider,
      model: matched.model,
      unit_type: matched.unit_type,
      rate_usd: rate,
      notes: matched.notes,
    },
  };
}

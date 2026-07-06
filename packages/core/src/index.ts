import { z } from "zod";

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

export const UsageMessageSchema = z.object({
  type: z.literal("usage"),
  provider: z.string().min(1),
  model: z.string().optional(),
  unit_type: UnitTypeSchema,
  quantity: z.number().positive(),
  unit_cost: z.number().nonnegative().optional(),
  estimated_cost: z.number().nonnegative().optional(),
  feature: z.string().optional(),
  batch_id: z.string().optional(),
  environment: z.string().optional(),
  external_request_id: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const ExpenseMessageSchema = z.object({
  type: z.literal("expense"),
  vendor: z.string().min(1),
  amount: z.number().positive(),
  currency: z.string().default("USD"),
  category: z.string().optional(),
  expense_type: z
    .enum([
      "one_time_purchase",
      "invoice",
      "credit_purchase",
      "refund",
      "reimbursement",
      "manual_adjustment",
    ])
    .default("one_time_purchase"),
  notes: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const SubscriptionMessageSchema = z.object({
  type: z.literal("subscription"),
  vendor: z.string().min(1),
  amount: z.number().positive(),
  currency: z.string().default("USD"),
  interval: z.enum(["monthly", "yearly", "weekly", "quarterly"]),
  renewal_date: z.string().datetime().optional(),
  category: z.string().optional(),
  project_allocation: z.string().optional(),
  status: z.enum(["active", "trial", "paused", "cancelled"]).default("active"),
  notes: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const AllocationMessageSchema = z.object({
  type: z.literal("allocation"),
  parent_message_id: z.string().uuid(),
  project: z.string().min(1),
  allocated_amount: z.number().positive(),
  currency: z.string().default("USD"),
  notes: z.string().optional(),
});

export const BatchMessageSchema = z.object({
  type: z.literal("batch"),
  name: z.string().min(1),
  total_estimated_cost: z.number().nonnegative().optional(),
  total_actual_cost: z.number().nonnegative().optional(),
  outputs_generated: z.number().int().nonnegative().optional(),
  usable_outputs: z.number().int().nonnegative().optional(),
  final_outputs: z.number().int().nonnegative().optional(),
  provider: z.string().optional(),
  feature: z.string().optional(),
  notes: z.string().optional(),
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
  project: z.string().min(1),
  source: MessageSourceSchema.default("api"),
  idempotency_key: z.string().optional(),
  timestamp: z.string().datetime().optional(),
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
  | "delete_records";

export const DEFAULT_INGEST_PERMISSIONS: ApiPermission[] = [
  "log_usage",
  "add_expenses",
  "read_summaries",
  "estimate_costs",
];

export function parseCostMessage(input: unknown): CostMessageEnvelope {
  return CostMessageEnvelopeSchema.parse(input);
}

export function parseCostMessageBatch(input: unknown): CostMessageEnvelope[] {
  return CostMessageBatchSchema.parse(input);
}

export function resolveAmountUsd(message: CostMessagePayload): number {
  switch (message.type) {
    case "usage":
      return message.estimated_cost ?? message.unit_cost ?? 0;
    case "expense":
    case "subscription":
      return message.amount;
    case "allocation":
      return message.allocated_amount;
    case "batch":
      return message.total_actual_cost ?? message.total_estimated_cost ?? 0;
  }
}

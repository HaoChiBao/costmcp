export const FIELD_LIMITS = {
  vendor: 80,
  description: 280,
  amount: 14,
} as const;

export function trimToLimit(value: string, max: number): string {
  return value.slice(0, max);
}

export function fieldLengthError(
  value: string,
  max: number,
  label: string,
): string | null {
  if (value.length > max) {
    return `${label} must be ${max} characters or fewer.`;
  }
  return null;
}

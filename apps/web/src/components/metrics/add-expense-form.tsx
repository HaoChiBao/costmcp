"use client";

import { useMemo, useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { CurrencyPicker } from "@/components/ui/currency-picker";
import {
  FormError,
  FormField,
  SelectField,
  TextAreaField,
} from "@/components/ui/form-field";
import type { OrgTree } from "@/lib/api";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";

const EXPENSE_TYPES = [
  { value: "one_time_purchase", label: "One-time purchase" },
  { value: "invoice", label: "Invoice" },
  { value: "credit_purchase", label: "Credit purchase" },
  { value: "refund", label: "Refund" },
  { value: "reimbursement", label: "Reimbursement" },
  { value: "manual_adjustment", label: "Manual adjustment" },
];

function toDatetimeLocalValue(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export type ExpenseFormValues = {
  project: string;
  vendor: string;
  amount: string;
  currency: string;
  category: string;
  expenseType: string;
  notes: string;
  occurredAt: string;
};

type Props = {
  workspaceSlug: string;
  org: OrgTree;
  mode?: "create" | "edit";
  expenseId?: string;
  initial?: Partial<ExpenseFormValues>;
  onSuccess: () => void;
  onCancel: () => void;
};

export function AddExpenseForm({
  workspaceSlug,
  org,
  mode = "create",
  expenseId,
  initial,
  onSuccess,
  onCancel,
}: Props) {
  const projectOptions = useMemo(() => {
    const fromCollections = org.collections.flatMap((c) =>
      c.projects.map((p) => ({
        value: p.slug,
        label: `${p.name} (${c.name})`,
      })),
    );
    const ungrouped = org.ungrouped_projects.map((p) => ({
      value: p.slug,
      label: p.name,
    }));
    return [...fromCollections, ...ungrouped];
  }, [org]);

  const categoryOptions = useMemo(() => {
    const options = [{ value: "", label: "No category" }];
    for (const parent of org.categories) {
      options.push({ value: parent.slug, label: parent.name });
      for (const child of parent.children) {
        options.push({
          value: child.slug,
          label: `${parent.name} / ${child.name}`,
        });
      }
    }
    return options;
  }, [org]);

  const [project, setProject] = useState(
    initial?.project ?? projectOptions[0]?.value ?? "",
  );
  const [vendor, setVendor] = useState(initial?.vendor ?? "");
  const [amount, setAmount] = useState(initial?.amount ?? "");
  const [currency, setCurrency] = useState(initial?.currency ?? "USD");
  const [category, setCategory] = useState(initial?.category ?? "");
  const [expenseType, setExpenseType] = useState(
    initial?.expenseType ?? "one_time_purchase",
  );
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [occurredAt, setOccurredAt] = useState(
    () => initial?.occurredAt ?? toDatetimeLocalValue(new Date()),
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    const parsedAmount = Number(amount);
    if (!project) {
      setError("Select a project.");
      return;
    }
    if (!vendor.trim()) {
      setError("Vendor is required.");
      return;
    }
    if (!Number.isFinite(parsedAmount) || parsedAmount === 0) {
      setError("Enter a non-zero amount.");
      return;
    }

    setSubmitting(true);
    try {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        setError("Your session expired. Please sign in again.");
        return;
      }

      const payload = {
        project,
        vendor: vendor.trim(),
        amount: parsedAmount,
        currency,
        category: category || undefined,
        notes: notes.trim() || undefined,
        expense_type: expenseType,
        occurred_at: occurredAt ? new Date(occurredAt).toISOString() : undefined,
      };

      const url =
        mode === "edit" && expenseId
          ? `${API_URL}/api/v1/workspaces/${workspaceSlug}/expenses/${expenseId}`
          : `${API_URL}/api/v1/workspaces/${workspaceSlug}/expenses`;

      const res = await fetch(url, {
        method: mode === "edit" ? "PATCH" : "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(body?.error ?? "Could not save expense.");
        return;
      }

      onSuccess();
    } catch {
      setError("Could not save expense. Is the API running?");
    } finally {
      setSubmitting(false);
    }
  }

  if (!projectOptions.length) {
    return (
      <div className="add-expense">
        <p className="form-error">
          Create a project in this workspace before logging expenses.
        </p>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Close
        </Button>
      </div>
    );
  }

  return (
    <form className="add-expense" onSubmit={handleSubmit}>
      <div className="add-expense__grid">
        <FormField
          label="Amount"
          type="number"
          step="0.01"
          required
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="29.00"
        />
        <SelectField
          label="Type"
          value={expenseType}
          onChange={(e) => setExpenseType(e.target.value)}
          options={EXPENSE_TYPES}
        />
        <FormField
          label="Vendor"
          required
          value={vendor}
          onChange={(e) => setVendor(e.target.value)}
          placeholder="Midjourney"
          list="expense-vendor-suggestions"
        />
        <datalist id="expense-vendor-suggestions">
          {org.vendors.map((v) => (
            <option key={v.id} value={v.name} />
          ))}
        </datalist>
        <SelectField
          label="Project"
          required
          value={project}
          onChange={(e) => setProject(e.target.value)}
          options={projectOptions}
        />
        <FormField
          label="Occurred at"
          type="datetime-local"
          required
          value={occurredAt}
          onChange={(e) => setOccurredAt(e.target.value)}
        />
        <SelectField
          label="Category"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          options={categoryOptions}
        />
      </div>
      <CurrencyPicker value={currency} onChange={setCurrency} />
      {expenseType === "refund" ? (
        <p className="add-expense__hint">
          Refunds are stored as negative spend (enter a positive amount).
        </p>
      ) : null}
      <TextAreaField
        label="Notes"
        rows={2}
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Optional context"
      />
      {error ? <FormError message={error} /> : null}
      <div className="add-expense__actions">
        <Button type="submit" variant="ink" disabled={submitting}>
          {submitting
            ? "Saving…"
            : mode === "edit"
              ? "Save changes"
              : "Save expense"}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel} disabled={submitting}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

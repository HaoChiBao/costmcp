"use client";

import { useMemo, useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { CurrencyPicker } from "@/components/ui/currency-picker";
import { FormError } from "@/components/ui/form-field";
import { MenuSelect } from "@/components/ui/menu-select";
import type { OrgTree } from "@/lib/api";
import { FIELD_LIMITS, fieldLengthError, trimToLimit } from "@/lib/field-limits";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";

const EXPENSE_TYPES = [
  { value: "one_time_purchase", label: "Purchase" },
  { value: "invoice", label: "Invoice" },
  { value: "credit_purchase", label: "Credits" },
  { value: "refund", label: "Refund" },
  { value: "reimbursement", label: "Reimburse" },
  { value: "manual_adjustment", label: "Adjust" },
];

function toDatetimeLocalValue(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function toDateInputValue(value: string) {
  return value.slice(0, 10);
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
        label: p.name,
        hint: c.name,
      })),
    );
    const ungrouped = org.ungrouped_projects.map((p) => ({
      value: p.slug,
      label: p.name,
    }));
    return [...fromCollections, ...ungrouped];
  }, [org]);

  const categoryOptions = useMemo(() => {
    const options: Array<{ value: string; label: string; hint?: string }> = [
      { value: "", label: "No category" },
    ];
    for (const parent of org.categories) {
      options.push({ value: parent.slug, label: parent.name });
      for (const child of parent.children) {
        options.push({
          value: child.slug,
          label: child.name,
          hint: parent.name,
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
  const [showMore, setShowMore] = useState(
    Boolean((initial?.category && initial.category !== "") ||
      (initial?.expenseType && initial.expenseType !== "one_time_purchase")),
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    const parsedAmount = Number(amount);
    if (!project) {
      setError("Pick a project.");
      return;
    }
    if (!vendor.trim()) {
      setError("Add a vendor.");
      return;
    }
    const vendorError = fieldLengthError(vendor.trim(), FIELD_LIMITS.vendor, "Vendor");
    if (vendorError) {
      setError(vendorError);
      return;
    }
    const descriptionError = fieldLengthError(
      notes.trim(),
      FIELD_LIMITS.description,
      "Description",
    );
    if (descriptionError) {
      setError(descriptionError);
      return;
    }
    if (!Number.isFinite(parsedAmount) || parsedAmount === 0) {
      setError("Enter an amount.");
      return;
    }

    setSubmitting(true);
    try {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        setError("Session expired.");
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
        setError(body?.error ?? "Could not save.");
        return;
      }

      onSuccess();
    } catch {
      setError("Could not save. Is the API running?");
    } finally {
      setSubmitting(false);
    }
  }

  if (!projectOptions.length) {
    return (
      <div className="quick-entry">
        <p className="form-error">Create a project before logging expenses.</p>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Close
        </Button>
      </div>
    );
  }

  return (
    <form className="quick-entry" onSubmit={handleSubmit}>
      <div className="quick-entry__row">
        <label className="quick-entry__amount">
          <span className="quick-entry__prefix">$</span>
          <input
            type="number"
            step="0.01"
            required
            value={amount}
            onChange={(e) => setAmount(trimToLimit(e.target.value, FIELD_LIMITS.amount))}
            placeholder="0.00"
            aria-label="Amount"
          />
        </label>

        <CurrencyPicker value={currency} onChange={setCurrency} />

        <input
          className="quick-entry__vendor"
          required
          value={vendor}
          maxLength={FIELD_LIMITS.vendor}
          onChange={(e) => setVendor(trimToLimit(e.target.value, FIELD_LIMITS.vendor))}
          placeholder="Vendor"
          list="expense-vendor-suggestions"
          aria-label="Vendor"
        />
        <datalist id="expense-vendor-suggestions">
          {org.vendors.map((v) => (
            <option key={v.id} value={v.name} />
          ))}
        </datalist>

        <MenuSelect
          compact
          ariaLabel="Project"
          value={project}
          onChange={setProject}
          options={projectOptions}
          placeholder="Project"
          className="quick-entry__project"
        />

        <label className="quick-entry__date">
          <span className="sr-only">Occurred at</span>
          <input
            type="date"
            required
            value={toDateInputValue(occurredAt)}
            onChange={(e) => {
              const time = occurredAt.includes("T")
                ? occurredAt.split("T")[1] ?? "12:00"
                : "12:00";
              setOccurredAt(`${e.target.value}T${time}`);
            }}
          />
        </label>

        <div className="quick-entry__actions">
          <button
            type="button"
            className={`quick-entry__more${showMore ? " quick-entry__more--open" : ""}`}
            onClick={() => setShowMore((open) => !open)}
            aria-expanded={showMore}
          >
            More
          </button>
          <Button type="submit" variant="ink" disabled={submitting}>
            {submitting ? "…" : mode === "edit" ? "Save" : "Add"}
          </Button>
          <Button type="button" variant="ghost" onClick={onCancel} disabled={submitting}>
            ✕
          </Button>
        </div>
      </div>

      <div className="quick-entry__row quick-entry__row--secondary">
        <input
          className="quick-entry__notes"
          value={notes}
          maxLength={FIELD_LIMITS.description}
          onChange={(e) => setNotes(trimToLimit(e.target.value, FIELD_LIMITS.description))}
          placeholder="Description (optional)"
          aria-label="Description"
        />
      </div>

      {showMore ? (
        <div className="quick-entry__row quick-entry__row--secondary">
          <MenuSelect
            compact
            ariaLabel="Type"
            value={expenseType}
            onChange={setExpenseType}
            options={EXPENSE_TYPES}
          />
          <MenuSelect
            compact
            ariaLabel="Category"
            value={category}
            onChange={setCategory}
            options={categoryOptions}
            placeholder="Category"
          />
        </div>
      ) : null}

      {error ? <FormError message={error} /> : null}
    </form>
  );
}

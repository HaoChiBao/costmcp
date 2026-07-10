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

const INTERVALS = [
  { value: "monthly", label: "Monthly" },
  { value: "yearly", label: "Yearly" },
  { value: "weekly", label: "Weekly" },
  { value: "quarterly", label: "Quarterly" },
];

const STATUSES = [
  { value: "active", label: "Active" },
  { value: "trial", label: "Trial" },
  { value: "paused", label: "Paused" },
  { value: "cancelled", label: "Cancelled" },
];

function toDatetimeLocalValue(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function toDateValue(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export type SubscriptionFormValues = {
  project: string;
  vendor: string;
  amount: string;
  currency: string;
  category: string;
  interval: string;
  status: string;
  notes: string;
  occurredAt: string;
  renewalDate: string;
};

type Props = {
  workspaceSlug: string;
  org: OrgTree;
  mode?: "create" | "edit";
  subscriptionId?: string;
  initial?: Partial<SubscriptionFormValues>;
  onSuccess: () => void;
  onCancel: () => void;
};

export function AddSubscriptionForm({
  workspaceSlug,
  org,
  mode = "create",
  subscriptionId,
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
  const [interval, setInterval] = useState(initial?.interval ?? "monthly");
  const [status, setStatus] = useState(initial?.status ?? "active");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [occurredAt, setOccurredAt] = useState(
    () => initial?.occurredAt ?? toDatetimeLocalValue(new Date()),
  );
  const [renewalDate, setRenewalDate] = useState(
    () => initial?.renewalDate ?? toDateValue(new Date()),
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
        interval,
        status,
        renewal_date: renewalDate
          ? new Date(`${renewalDate}T12:00:00`).toISOString()
          : undefined,
        occurred_at: occurredAt ? new Date(occurredAt).toISOString() : undefined,
      };

      const url =
        mode === "edit" && subscriptionId
          ? `${API_URL}/api/v1/workspaces/${workspaceSlug}/expenses/${subscriptionId}`
          : `${API_URL}/api/v1/workspaces/${workspaceSlug}/subscriptions`;

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
        setError(body?.error ?? "Could not save subscription.");
        return;
      }

      onSuccess();
    } catch {
      setError("Could not save subscription. Is the API running?");
    } finally {
      setSubmitting(false);
    }
  }

  if (!projectOptions.length) {
    return (
      <div className="add-expense">
        <p className="form-error">
          Create a project in this workspace before logging subscriptions.
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
          placeholder="20.00"
        />
        <SelectField
          label="Interval"
          value={interval}
          onChange={(e) => setInterval(e.target.value)}
          options={INTERVALS}
        />
        <FormField
          label="Vendor"
          required
          value={vendor}
          onChange={(e) => setVendor(e.target.value)}
          placeholder="Cursor"
          list="subscription-vendor-suggestions"
        />
        <datalist id="subscription-vendor-suggestions">
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
          label="Charged at"
          type="datetime-local"
          required
          value={occurredAt}
          onChange={(e) => setOccurredAt(e.target.value)}
        />
        <FormField
          label="Renewal date"
          type="date"
          value={renewalDate}
          onChange={(e) => setRenewalDate(e.target.value)}
        />
        <SelectField
          label="Status"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          options={STATUSES}
        />
        <SelectField
          label="Category"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          options={categoryOptions}
        />
      </div>
      <CurrencyPicker value={currency} onChange={setCurrency} />
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
              : "Save subscription"}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel} disabled={submitting}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

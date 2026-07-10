"use client";

import { useMemo, useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { CurrencyPicker } from "@/components/ui/currency-picker";
import { FormError } from "@/components/ui/form-field";
import { MenuSelect } from "@/components/ui/menu-select";
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

function toDateInputValue(value: string) {
  return value.slice(0, 10);
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
  const [interval, setInterval] = useState(initial?.interval ?? "monthly");
  const [status, setStatus] = useState(initial?.status ?? "active");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [occurredAt, setOccurredAt] = useState(
    () => initial?.occurredAt ?? toDatetimeLocalValue(new Date()),
  );
  const [renewalDate, setRenewalDate] = useState(
    () => initial?.renewalDate ?? toDateInputValue(toDatetimeLocalValue(new Date())),
  );
  const [showMore, setShowMore] = useState(
    Boolean(initial?.notes || initial?.category || initial?.status !== "active"),
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
        <p className="form-error">Create a project before logging subscriptions.</p>
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
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            aria-label="Amount"
          />
        </label>

        <CurrencyPicker value={currency} onChange={setCurrency} />

        <input
          className="quick-entry__vendor"
          required
          value={vendor}
          onChange={(e) => setVendor(e.target.value)}
          placeholder="Vendor"
          list="subscription-vendor-suggestions"
          aria-label="Vendor"
        />
        <datalist id="subscription-vendor-suggestions">
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

        <MenuSelect
          compact
          ariaLabel="Interval"
          value={interval}
          onChange={setInterval}
          options={INTERVALS}
        />

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

      {showMore ? (
        <div className="quick-entry__row quick-entry__row--secondary">
          <label className="quick-entry__date">
            <span className="sr-only">Charged at</span>
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
          <label className="quick-entry__date">
            <span className="sr-only">Renewal date</span>
            <input
              type="date"
              value={renewalDate}
              onChange={(e) => setRenewalDate(e.target.value)}
            />
          </label>
          <MenuSelect
            compact
            ariaLabel="Status"
            value={status}
            onChange={setStatus}
            options={STATUSES}
          />
          <MenuSelect
            compact
            ariaLabel="Category"
            value={category}
            onChange={setCategory}
            options={categoryOptions}
            placeholder="Category"
          />
          <input
            className="quick-entry__notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Note (optional)"
            aria-label="Notes"
          />
        </div>
      ) : null}

      {error ? <FormError message={error} /> : null}
    </form>
  );
}

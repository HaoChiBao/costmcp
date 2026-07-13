"use client";

import { useMemo, useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import { CurrencyPicker } from "@/components/ui/currency-picker";
import { FormError } from "@/components/ui/form-field";
import { MenuSelect } from "@/components/ui/menu-select";
import type { OrgTree } from "@/lib/api";
import { FIELD_LIMITS, fieldLengthError, trimToLimit } from "@/lib/field-limits";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";

function toDateInputValue(date = new Date()) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export type ObligationFormValues = {
  project: string;
  payee: string;
  amount: string;
  currency: string;
  dueDate: string;
  remindAt: string;
  notes: string;
};

type Props = {
  workspaceSlug: string;
  org: OrgTree;
  mode?: "create" | "edit";
  obligationId?: string;
  initial?: Partial<ObligationFormValues>;
  onSuccess: () => void;
  onCancel: () => void;
};

export function AddObligationForm({
  workspaceSlug,
  org,
  mode = "create",
  obligationId,
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
    return [
      { value: "", label: "No project" },
      ...fromCollections,
      ...ungrouped,
    ];
  }, [org]);

  const [project, setProject] = useState(initial?.project ?? "");
  const [payee, setPayee] = useState(initial?.payee ?? "");
  const [amount, setAmount] = useState(initial?.amount ?? "");
  const [currency, setCurrency] = useState(initial?.currency ?? "USD");
  const [dueDate, setDueDate] = useState(
    () => initial?.dueDate ?? toDateInputValue(),
  );
  const [remindAt, setRemindAt] = useState(() => initial?.remindAt ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [showMore, setShowMore] = useState(Boolean(initial?.remindAt));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    const parsedAmount = Number(amount);
    if (!payee.trim()) {
      setError("Add who you owe.");
      return;
    }
    const payeeError = fieldLengthError(payee.trim(), FIELD_LIMITS.vendor, "Payee");
    if (payeeError) {
      setError(payeeError);
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
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setError("Enter a positive amount.");
      return;
    }
    if (!dueDate) {
      setError("Pick a due date.");
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
        payee: payee.trim(),
        amount: parsedAmount,
        currency,
        due_date: dueDate,
        remind_at: remindAt || undefined,
        project: project || undefined,
        notes: notes.trim() || undefined,
      };

      const url =
        mode === "edit" && obligationId
          ? `${API_URL}/api/v1/workspaces/${workspaceSlug}/obligations/${obligationId}`
          : `${API_URL}/api/v1/workspaces/${workspaceSlug}/obligations`;

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

  return (
    <form className="composer" onSubmit={handleSubmit}>
      <div className="composer__line">
        <label className="composer__amount">
          <span className="composer__amount-prefix">$</span>
          <input
            type="number"
            step="0.01"
            min="0.01"
            required
            value={amount}
            onChange={(e) => setAmount(trimToLimit(e.target.value, FIELD_LIMITS.amount))}
            placeholder="0.00"
            aria-label="Amount"
          />
        </label>

        <CurrencyPicker
          value={currency}
          onChange={setCurrency}
          showFlag={false}
          className="composer__select"
        />

        <input
          className="composer__input composer__input--vendor"
          required
          value={payee}
          maxLength={FIELD_LIMITS.vendor}
          onChange={(e) => setPayee(trimToLimit(e.target.value, FIELD_LIMITS.vendor))}
          placeholder="Who you owe"
          list="obligation-payee-suggestions"
          aria-label="Payee"
        />
        <datalist id="obligation-payee-suggestions">
          {org.vendors.map((v) => (
            <option key={v.id} value={v.name} />
          ))}
        </datalist>

        <label className="composer__date">
          <span className="sr-only">Due date</span>
          <input
            type="date"
            required
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
        </label>

        <MenuSelect
          compact
          ariaLabel="Project"
          value={project}
          onChange={setProject}
          options={projectOptions}
          placeholder="Project"
          className="composer__select composer__select--project"
        />

        <div className="composer__actions">
          <button
            type="button"
            className={`dash-btn dash-btn--ghost${showMore ? " dash-btn--active" : ""}`}
            onClick={() => setShowMore((open) => !open)}
            aria-expanded={showMore}
          >
            More
          </button>
          <button type="submit" className="dash-btn dash-btn--primary" disabled={submitting}>
            {submitting ? "…" : mode === "edit" ? "Save" : "Add"}
          </button>
          <button
            type="button"
            className="dash-btn dash-btn--ghost"
            onClick={onCancel}
            disabled={submitting}
          >
            Cancel
          </button>
        </div>
      </div>

      <div className="composer__line">
        <input
          className="composer__input composer__input--notes"
          value={notes}
          maxLength={FIELD_LIMITS.description}
          onChange={(e) => setNotes(trimToLimit(e.target.value, FIELD_LIMITS.description))}
          placeholder="Notes (optional)"
          aria-label="Notes"
        />
      </div>

      {showMore ? (
        <div className="composer__line composer__line--more">
          <label className="composer__date">
            <span className="sr-only">Remind on</span>
            <input
              type="date"
              value={remindAt}
              onChange={(e) => setRemindAt(e.target.value)}
              title="Remind on"
            />
          </label>
        </div>
      ) : null}

      {error ? <FormError message={error} /> : null}
    </form>
  );
}

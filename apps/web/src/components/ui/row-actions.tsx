"use client";

import { Button } from "@/components/ui/button";

export type RowAction = {
  label: string;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
};

export function RowActions({ actions }: { actions: RowAction[] }) {
  if (!actions.length) return null;

  return (
    <div className="ledger-actions">
      {actions.map((action) => (
        <Button
          key={action.label}
          type="button"
          variant="ghost"
          className={`ledger-actions__btn${action.danger ? " ledger-actions__btn--danger" : ""}`}
          disabled={action.disabled}
          onClick={action.onClick}
        >
          {action.label}
        </Button>
      ))}
    </div>
  );
}

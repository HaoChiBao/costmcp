"use client";

import { CURRENCY_OPTIONS } from "@/lib/currencies";
import { MenuSelect } from "@/components/ui/menu-select";

type Props = {
  value: string;
  onChange: (code: string) => void;
  ariaLabel?: string;
};

export function CurrencyPicker({
  value,
  onChange,
  ariaLabel = "Currency",
}: Props) {
  return (
    <MenuSelect
      compact
      ariaLabel={ariaLabel}
      value={value}
      onChange={onChange}
      className="currency-menu"
      options={CURRENCY_OPTIONS.map((option) => ({
        value: option.code,
        label: option.code,
        hint: option.label,
        leading: (
          <span className="currency-flag" aria-hidden="true">
            {option.flag}
          </span>
        ),
      }))}
    />
  );
}

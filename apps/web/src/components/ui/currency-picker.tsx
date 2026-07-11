"use client";

import { CURRENCY_OPTIONS } from "@/lib/currencies";
import { MenuSelect } from "@/components/ui/menu-select";

type Props = {
  value: string;
  onChange: (code: string) => void;
  ariaLabel?: string;
  className?: string;
  showFlag?: boolean;
};

export function CurrencyPicker({
  value,
  onChange,
  ariaLabel = "Currency",
  className = "",
  showFlag = true,
}: Props) {
  return (
    <MenuSelect
      compact
      ariaLabel={ariaLabel}
      value={value}
      onChange={onChange}
      className={className ? `currency-menu ${className}` : "currency-menu"}
      options={CURRENCY_OPTIONS.map((option) => ({
        value: option.code,
        label: option.code,
        hint: option.label,
        leading: showFlag ? (
          <span className="currency-flag" aria-hidden="true">
            {option.flag}
          </span>
        ) : undefined,
      }))}
    />
  );
}

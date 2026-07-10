"use client";

import { CURRENCY_OPTIONS } from "@/lib/currencies";

type Props = {
  value: string;
  onChange: (code: string) => void;
  label?: string;
};

export function CurrencyPicker({ value, onChange, label = "Currency" }: Props) {
  return (
    <fieldset className="currency-picker">
      <legend className="field__label">{label}</legend>
      <div className="currency-picker__grid" role="listbox" aria-label={label}>
        {CURRENCY_OPTIONS.map((option) => {
          const selected = option.code === value;
          return (
            <button
              key={option.code}
              type="button"
              role="option"
              aria-selected={selected}
              title={`${option.label} (${option.code})`}
              className={`currency-chip${selected ? " currency-chip--selected" : ""}`}
              onClick={() => onChange(option.code)}
            >
              <span className="currency-chip__flag" aria-hidden="true">
                {option.flag}
              </span>
              <span className="currency-chip__code">{option.code}</span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

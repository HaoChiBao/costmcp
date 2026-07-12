"use client";

import { MenuSelect, type MenuOption } from "@/components/ui/menu-select";

type FieldSelectProps = {
  label: string;
  value: string;
  options: MenuOption[];
  onChange: (value: string) => void;
  ariaLabel?: string;
  disabled?: boolean;
  className?: string;
  align?: "left" | "right";
  compact?: boolean;
};

export function FieldSelect({
  label,
  value,
  options,
  onChange,
  ariaLabel,
  disabled = false,
  className = "",
  align = "left",
  compact = false,
}: FieldSelectProps) {
  return (
    <div className={`field field--select ${className}`.trim()}>
      <span className="field__label">{label}</span>
      <MenuSelect
        value={value}
        options={options}
        onChange={onChange}
        ariaLabel={ariaLabel ?? label}
        disabled={disabled}
        align={align}
        compact={compact}
        className="field-select"
      />
    </div>
  );
}

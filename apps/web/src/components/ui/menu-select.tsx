"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";

export type MenuOption = {
  value: string;
  label: string;
  leading?: ReactNode;
  hint?: string;
};

type Props = {
  value: string;
  options: MenuOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  ariaLabel: string;
  className?: string;
  align?: "left" | "right";
  compact?: boolean;
  disabled?: boolean;
};

export function MenuSelect({
  value,
  options,
  onChange,
  placeholder = "Select",
  ariaLabel,
  className = "",
  align = "left",
  compact = false,
  disabled = false,
}: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const selected = options.find((option) => option.value === value);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function onKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function onTriggerKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setOpen(true);
    }
  }

  return (
    <div
      ref={rootRef}
      className={`menu-select${compact ? " menu-select--compact" : ""}${className ? ` ${className}` : ""}`}
    >
      <button
        type="button"
        className="menu-select__trigger"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={onTriggerKeyDown}
      >
        {selected?.leading ? (
          <span className="menu-select__leading">{selected.leading}</span>
        ) : null}
        <span className="menu-select__label">
          {selected?.label ?? placeholder}
        </span>
        <span className="menu-select__caret" aria-hidden="true">
          ▾
        </span>
      </button>

      {open ? (
        <ul
          id={listId}
          className={`menu-select__menu menu-select__menu--${align}`}
          role="listbox"
          aria-label={ariaLabel}
        >
          {options.map((option) => {
            const isSelected = option.value === value;
            return (
              <li key={option.value || "__empty"}>
                <button
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  className={`menu-select__option${isSelected ? " menu-select__option--selected" : ""}`}
                  onClick={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                >
                  {option.leading ? (
                    <span className="menu-select__leading">{option.leading}</span>
                  ) : null}
                  <span className="menu-select__option-copy">
                    <span className="menu-select__option-label">{option.label}</span>
                    {option.hint ? (
                      <span className="menu-select__option-hint">{option.hint}</span>
                    ) : null}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}

"use client";

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

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

type MenuCoords = {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
};

const MENU_GAP = 6;
const VIEWPORT_PAD = 8;
const DEFAULT_MENU_HEIGHT = 160;
const MAX_MENU_HEIGHT = 256;

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
  const [coords, setCoords] = useState<MenuCoords | null>(null);
  const [mounted, setMounted] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);
  const listId = useId();
  const selected = options.find((option) => option.value === value);

  useEffect(() => {
    setMounted(true);
  }, []);

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;

    const rect = trigger.getBoundingClientRect();
    const measuredHeight = menuRef.current?.offsetHeight ?? 0;
    const menuHeight = measuredHeight || DEFAULT_MENU_HEIGHT;
    const spaceBelow = window.innerHeight - rect.bottom - VIEWPORT_PAD;
    const spaceAbove = rect.top - VIEWPORT_PAD;
    const placeBelow =
      spaceBelow >= Math.min(menuHeight, DEFAULT_MENU_HEIGHT) ||
      spaceBelow >= spaceAbove;
    const maxHeight = Math.max(
      120,
      Math.min(MAX_MENU_HEIGHT, (placeBelow ? spaceBelow : spaceAbove) - MENU_GAP),
    );

    const width = Math.max(rect.width, 176);
    let left = align === "right" ? rect.right - width : rect.left;
    left = Math.min(
      Math.max(VIEWPORT_PAD, left),
      window.innerWidth - width - VIEWPORT_PAD,
    );

    const top = placeBelow
      ? rect.bottom + MENU_GAP
      : Math.max(
          VIEWPORT_PAD,
          rect.top - MENU_GAP - Math.min(menuHeight, maxHeight),
        );

    setCoords((prev) => {
      if (
        prev &&
        prev.top === top &&
        prev.left === left &&
        prev.width === width &&
        prev.maxHeight === maxHeight
      ) {
        return prev;
      }
      return { top, left, width, maxHeight };
    });
  }, [align]);

  useLayoutEffect(() => {
    if (!open) {
      setCoords(null);
      return;
    }
    updatePosition();
  }, [open, updatePosition, options.length]);

  useLayoutEffect(() => {
    if (!open || !coords) return;
    updatePosition();
  }, [open, coords, updatePosition]);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (
        rootRef.current?.contains(target) ||
        menuRef.current?.contains(target)
      ) {
        return;
      }
      setOpen(false);
    }

    function onKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    function onReposition() {
      updatePosition();
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", onReposition);
    window.addEventListener("scroll", onReposition, true);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", onReposition);
      window.removeEventListener("scroll", onReposition, true);
    };
  }, [open, updatePosition]);

  function onTriggerKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setOpen(true);
    }
  }

  const menuStyle: CSSProperties | undefined = coords
    ? {
        top: coords.top,
        left: coords.left,
        minWidth: coords.width,
        width: "max-content",
        maxWidth: `min(24rem, calc(100vw - ${VIEWPORT_PAD * 2}px))`,
        maxHeight: coords.maxHeight,
      }
    : undefined;

  const menu =
    open && mounted && coords
      ? createPortal(
          <ul
            ref={menuRef}
            id={listId}
            className="menu-select__menu menu-select__menu--portal"
            role="listbox"
            aria-label={ariaLabel}
            style={menuStyle}
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
          </ul>,
          document.body,
        )
      : null;

  return (
    <div
      ref={rootRef}
      className={`menu-select${compact ? " menu-select--compact" : ""}${className ? ` ${className}` : ""}`}
    >
      <button
        ref={triggerRef}
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
      {menu}
    </div>
  );
}

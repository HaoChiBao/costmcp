"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { authProviderLabel } from "@/lib/auth/user-display";
import { createClient } from "@/lib/supabase/client";

export function UserProfile({
  name,
  email,
  avatarUrl,
  provider,
}: {
  name: string;
  email?: string;
  avatarUrl?: string | null;
  provider?: string | null;
}) {
  const router = useRouter();
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const initial = name.trim().charAt(0).toUpperCase() || "?";
  const providerLabel = authProviderLabel(provider);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  async function signOut() {
    setOpen(false);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="dashboard-nav__user" ref={rootRef}>
      <button
        type="button"
        className="dashboard-nav__user-btn"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={menuId}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="dashboard-nav__avatar" aria-hidden="true">
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarUrl} alt="" className="dashboard-nav__avatar-img" />
          ) : (
            initial
          )}
        </span>
        <span className="dashboard-nav__user-info">
          <span className="dashboard-nav__user-name">{name}</span>
          {email ? <span className="dashboard-nav__user-email">{email}</span> : null}
        </span>
      </button>

      {open ? (
        <div id={menuId} className="dashboard-nav__user-menu" role="menu" aria-label="Account options">
          <div className="dashboard-nav__user-menu-header">
            <span className="dashboard-nav__avatar dashboard-nav__avatar--menu" aria-hidden="true">
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarUrl} alt="" className="dashboard-nav__avatar-img" />
              ) : (
                initial
              )}
            </span>
            <div className="dashboard-nav__user-menu-copy">
              <span className="dashboard-nav__user-menu-name">{name}</span>
              {email ? <span className="dashboard-nav__user-menu-email">{email}</span> : null}
              {providerLabel ? (
                <span className="dashboard-nav__user-menu-provider">Signed in with {providerLabel}</span>
              ) : null}
            </div>
          </div>
          <button
            type="button"
            className="dashboard-nav__user-menu-item"
            role="menuitem"
            onClick={() => void signOut()}
          >
            Log out
          </button>
        </div>
      ) : null}
    </div>
  );
}

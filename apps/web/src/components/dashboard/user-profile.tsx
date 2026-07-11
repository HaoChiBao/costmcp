"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function UserProfile({
  name,
  email,
  avatarUrl,
}: {
  name: string;
  email?: string;
  avatarUrl?: string | null;
}) {
  const router = useRouter();
  const initial = name.trim().charAt(0).toUpperCase() || "?";

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="dashboard-nav__user">
      <button type="button" className="dashboard-nav__user-btn" onClick={() => void signOut()}>
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
    </div>
  );
}

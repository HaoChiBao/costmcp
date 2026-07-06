"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function SignOutButton() {
  const router = useRouter();

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={signOut}
      style={{
        background: "transparent",
        border: "1px solid #2a3548",
        color: "#a8b4c8",
        padding: "0.5rem 0.75rem",
        borderRadius: 8,
        cursor: "pointer",
        fontSize: 13,
      }}
    >
      Sign out
    </button>
  );
}

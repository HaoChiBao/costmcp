"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

const shell: React.CSSProperties = {
  minHeight: "100vh",
  display: "grid",
  placeItems: "center",
  padding: "2rem",
};

const card: React.CSSProperties = {
  width: "100%",
  maxWidth: 400,
  background: "#121820",
  border: "1px solid #243044",
  borderRadius: 12,
  padding: "2rem",
};

const input: React.CSSProperties = {
  width: "100%",
  padding: "0.75rem",
  borderRadius: 8,
  border: "1px solid #2a3548",
  background: "#0b0f14",
  color: "#e8edf5",
  marginBottom: "1rem",
  boxSizing: "border-box",
};

export default function SignupPage() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: displayName || email.split("@")[0] } },
    });
    setLoading(false);
    if (signUpError) {
      setError(signUpError.message);
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <main style={shell}>
      <div style={card}>
        <h1 style={{ marginTop: 0 }}>Create account</h1>
        <p style={{ color: "#7b8da8", marginBottom: "1.5rem" }}>
          We&apos;ll set up a personal cost workspace with collections and categories.
        </p>
        <form onSubmit={handleSubmit}>
          <input style={input} type="text" placeholder="Display name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
          <input style={input} type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <input style={input} type="password" placeholder="Password (min 6 chars)" value={password} onChange={(e) => setPassword(e.target.value)} minLength={6} required />
          {error && <p style={{ color: "#f87171", fontSize: 14 }}>{error}</p>}
          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              padding: "0.75rem",
              borderRadius: 8,
              border: "none",
              background: "#3b82f6",
              color: "white",
              fontWeight: 600,
              cursor: loading ? "wait" : "pointer",
            }}
          >
            {loading ? "Creating…" : "Create account"}
          </button>
        </form>
        <p style={{ marginTop: "1.5rem", color: "#7b8da8", fontSize: 14 }}>
          Already have an account? <Link href="/login" style={{ color: "#60a5fa" }}>Sign in</Link>
        </p>
      </div>
    </main>
  );
}

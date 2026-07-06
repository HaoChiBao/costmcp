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

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (signInError) {
      setError(signInError.message);
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <main style={shell}>
      <div style={card}>
        <h1 style={{ marginTop: 0 }}>Sign in</h1>
        <p style={{ color: "#7b8da8", marginBottom: "1.5rem" }}>Access your organized cost accounts.</p>
        <form onSubmit={handleSubmit}>
          <input style={input} type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <input style={input} type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required />
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
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
        <p style={{ marginTop: "1.5rem", color: "#7b8da8", fontSize: 14 }}>
          No account? <Link href="/signup" style={{ color: "#60a5fa" }}>Create one</Link>
        </p>
      </div>
    </main>
  );
}

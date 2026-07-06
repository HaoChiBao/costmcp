"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";

export default function NewWorkspacePage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [type, setType] = useState("team");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      router.push("/login");
      return;
    }

    const res = await fetch(`${API_URL}/api/v1/workspaces`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name, type }),
    });

    setLoading(false);
    if (!res.ok) {
      setError(await res.text());
      return;
    }

    const { workspace } = await res.json();
    router.push(`/dashboard/${workspace.slug}`);
    router.refresh();
  }

  return (
    <main style={{ maxWidth: 480, margin: "4rem auto", padding: "0 2rem" }}>
      <h1>New cost account</h1>
      <p style={{ color: "#7b8da8" }}>Create a separate workspace for a team, client, or side project.</p>
      <form onSubmit={handleSubmit}>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Client Projects, Side Hustles"
          required
          style={{
            width: "100%",
            padding: "0.75rem",
            borderRadius: 8,
            border: "1px solid #2a3548",
            background: "#121820",
            color: "#e8edf5",
            marginBottom: "1rem",
            boxSizing: "border-box",
          }}
        />
        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          style={{
            width: "100%",
            padding: "0.75rem",
            borderRadius: 8,
            border: "1px solid #2a3548",
            background: "#121820",
            color: "#e8edf5",
            marginBottom: "1rem",
          }}
        >
          <option value="personal">Personal</option>
          <option value="team">Team</option>
          <option value="organization">Organization</option>
        </select>
        {error && <p style={{ color: "#f87171" }}>{error}</p>}
        <button
          type="submit"
          disabled={loading}
          style={{
            padding: "0.75rem 1.25rem",
            borderRadius: 8,
            border: "none",
            background: "#3b82f6",
            color: "white",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          {loading ? "Creating…" : "Create workspace"}
        </button>
      </form>
    </main>
  );
}

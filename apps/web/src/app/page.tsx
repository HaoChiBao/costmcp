import Link from "next/link";

export default function Home() {
  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: "2rem" }}>
      <div style={{ maxWidth: 520, textAlign: "center" }}>
        <p style={{ color: "#7b8da8", letterSpacing: "0.08em", textTransform: "uppercase", fontSize: 12 }}>
          Cost ledger for builders
        </p>
        <h1 style={{ fontSize: "2.5rem", margin: "0.5rem 0 1rem" }}>CostMCP</h1>
        <p style={{ color: "#a8b4c8", lineHeight: 1.6, marginBottom: "2rem" }}>
          Create an account, organize workspaces, collections, projects, and categories —
          then track every token, image, and subscription in one place.
        </p>
        <div style={{ display: "flex", gap: "1rem", justifyContent: "center" }}>
          <Link
            href="/signup"
            style={{
              background: "#3b82f6",
              color: "white",
              padding: "0.75rem 1.25rem",
              borderRadius: 8,
              textDecoration: "none",
              fontWeight: 600,
            }}
          >
            Create account
          </Link>
          <Link
            href="/login"
            style={{
              border: "1px solid #2a3548",
              color: "#e8edf5",
              padding: "0.75rem 1.25rem",
              borderRadius: 8,
              textDecoration: "none",
            }}
          >
            Sign in
          </Link>
        </div>
      </div>
    </main>
  );
}

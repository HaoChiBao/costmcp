export default function Home() {
  return (
    <main style={{ fontFamily: "system-ui, sans-serif", padding: "2rem", maxWidth: 640 }}>
      <h1>CostMCP API</h1>
      <p>AI-native cost ledger for builders.</p>
      <ul>
        <li>
          <code>GET /api/health</code>
        </li>
        <li>
          <code>POST /api/v1/messages</code>
        </li>
        <li>
          <code>GET /api/v1/summary/month</code>
        </li>
        <li>
          <code>GET /api/v1/projects/:slug/spend</code>
        </li>
        <li>
          <code>GET /api/v1/budgets/status</code>
        </li>
      </ul>
    </main>
  );
}

# CostMCP

**Know what every AI project actually costs.**

AI-native cost ledger for builders — track tokens, generations, subscriptions, and project spend via REST API, SDK, or MCP.

## Docs

- **Public docs (Mintlify):** [`docs/`](./docs) — API, MCP, OAuth (`npx mint dev` from `docs/`)
- [Product Spec (Notion)](https://app.notion.com/p/395850bd5b0881e5a813f59ee8bc3833)
- [Technical Architecture (Notion)](https://app.notion.com/p/395850bd5b0881e29ddbca6dbdc4fd34)
- [Linear Project](https://linear.app/yangspace/project/costmcp-a81bdc4b3531)

## Supabase (live)

Project: **[costmcp](https://supabase.com/dashboard/project/bylrekkhwcwosdmcgfsg)** (`bylrekkhwcwosdmcgfsg`, us-west-2)

Migrations applied:
- `initial_schema` — tables + seed data
- `rls_policies` — RLS + global budget

Local env: copy `.env.example` → `.env` at the repo root (apps symlink to it).

```bash
pnpm db:migrate   # requires `npx supabase login` + linked project
pnpm db:types     # regenerate types from remote schema
```

## Quick start

```bash
pnpm install
cp .env.example .env
# Set SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, COSTMCP_API_KEY

pnpm db:migrate   # requires Supabase CLI linked
pnpm dev          # API at http://localhost:3000 · web at http://localhost:3001
pnpm mcp:dev      # MCP server (stdio)
```

## API (Phase 0)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/health` | Health check |
| POST | `/api/v1/messages` | Ingest CostMessage |
| GET | `/api/v1/summary/month` | Monthly spend summary |
| GET | `/api/v1/projects/:slug/spend` | Project drill-down |
| GET | `/api/v1/budgets/status` | Budget remaining |

### Example ingest

```bash
curl -X POST http://localhost:3000/api/v1/messages \
  -H "Authorization: Bearer $COSTMCP_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "project": "slideshow-studio",
    "source": "api",
    "message": {
      "type": "usage",
      "provider": "openai",
      "model": "gpt-image-2",
      "unit_type": "image",
      "quantity": 1,
      "estimated_cost": 0.04,
      "feature": "slide_generation"
    }
  }'
```

## Repo structure

```
costmcp/
├── apps/api/           # Next.js REST API
├── packages/core/      # CostMessage types + validation
├── packages/db/        # Supabase queries
├── packages/mcp-server/
├── supabase/migrations/
└── examples/
```

## MCP

| | URL / path |
|--|------------|
| **Production (agents)** | `https://mcp.costmcp.com` |
| Local stdio | `pnpm mcp:dev` (`packages/mcp-server`) |
| Local HTTP | `http://localhost:3000/api/mcp` |

Tools: `log_usage`, `add_expense`, `get_project_spend`, `get_budget_status`, `get_monthly_summary` (remote only).

```json
{
  "mcpServers": {
    "costmcp": {
      "url": "https://mcp.costmcp.com"
    }
  }
}
```

See `examples/cursor-mcp-config.json` (stdio) and [docs/mcp](./docs/mcp) for full setup.

## License

Private — Yang Space

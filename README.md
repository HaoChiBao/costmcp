# CostMCP

**Know what every AI project actually costs.**

AI-native cost ledger for builders — track tokens, generations, subscriptions, and project spend via REST API, SDK, or MCP.

## Docs

- [Product Spec (Notion)](https://app.notion.com/p/395850bd5b0881e5a813f59ee8bc3833)
- [Technical Architecture (Notion)](https://app.notion.com/p/395850bd5b0881e29ddbca6dbdc4fd34)
- [Linear Project](https://linear.app/yangspace/project/costmcp-a81bdc4b3531)

## Quick start

```bash
pnpm install
cp .env.example .env.local
# Set SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, COSTMCP_API_KEY

pnpm db:migrate   # requires Supabase CLI linked
pnpm dev          # API at http://localhost:3000
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

## MCP tools

- `log_usage` — record usage events
- `add_expense` — log purchases
- `get_project_spend` — project breakdown
- `get_budget_status` — budget remaining

See `examples/cursor-mcp-config.json` for Cursor setup.

## License

Private — Yang Space

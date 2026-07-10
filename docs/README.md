# CostMCP documentation

Mintlify site for public API / MCP / OAuth docs.

**Agent MCP URL:** [`https://mcp.costmcp.com`](https://mcp.costmcp.com)

**Hosted docs:** [`https://docs.costmcp.com`](https://docs.costmcp.com) (after Mintlify + custom domain)

## Preview locally

```bash
cd docs
npx mint@latest dev
```

Opens at [http://localhost:3000](http://localhost:3000) by default — stop the API first if that port is taken, or pass a different port if the CLI supports it.

Validate before push:

```bash
cd docs && npx mint@latest validate
```

## Deploy (Hobby — free)

1. Push the repo (including `docs/`) to GitHub.
2. Create a project at [mintlify.com](https://mintlify.com) and connect the repo; set the docs directory to `docs`.
3. Add custom domain `docs.costmcp.com` in the Mintlify dashboard (DNS already on Vercel for `costmcp.com` — point CNAME or use Mintlify’s instructions).

Hobby includes hosting, custom domain, and keyword search. AI assistant search requires Pro.

## Coverage checklist

- Guides: quickstart, authentication, **API keys & conditions**, CostMessage, permissions
- API Reference: health, ingest, summaries, dashboard JWT APIs including keys (create/patch/rotate/revoke)
- MCP: local stdio, remote `https://mcp.costmcp.com`, tools
- OAuth 2.1: discovery, register, authorize, consent, token

# Nullcost Catalog Plugin

Nullcost adds a plugin-first way for Codex and other plugin-aware coding agents
to find developer services with real free tiers and trials.

Use this plugin path first in Codex. The plugin provides the icon, prompt
routing, natural-language behavior, and bundled MCP server configuration. The
MCP server is the engine underneath.

Nullcost also tracks community referral routes where they are useful. Some tools
offer signup credits, discounts, or bonuses when a referral code is used. Those
links are shown beside official provider links; they do not control catalog
ranking.

By default, the plugin reads the hosted Nullcost catalog:

```text
https://nullcost.xyz
```

If your client does not support local plugins, use raw MCP config instead. That
is a fallback path, not the preferred Codex install. For local development, point
the MCP server at your local app API:

```bash
REFERIATE_API_BASE_URL=http://127.0.0.1:3000 npm run mcp:catalog
```

Both plugin and raw MCP modes wrap one shared server implementation:

```text
mcp/referiate-provider-server.mjs
```

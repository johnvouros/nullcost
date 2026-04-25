# Nullcost Catalog Plugin

Nullcost adds a local MCP tool that helps coding agents find developer services
with real free tiers and trials.

By default, the plugin reads the hosted Nullcost catalog:

```text
https://nullcost.xyz
```

For local development, point the plugin at your local app API:

```bash
REFERIATE_API_BASE_URL=http://127.0.0.1:3000 npm run mcp:catalog
```

The plugin wraps one shared server implementation:

```text
mcp/referiate-provider-server.mjs
```

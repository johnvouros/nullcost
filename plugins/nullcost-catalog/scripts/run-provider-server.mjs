#!/usr/bin/env node

process.env.REFERIATE_API_BASE_URL ||= 'https://nullcost.xyz';

await import('../../../mcp/referiate-provider-server.mjs');

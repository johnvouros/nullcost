---
name: nullcost-catalog
description: Use this skill when the user asks plain-English tool-selection questions like cheap hosting, best value auth, free-tier Postgres, good email API options, or which service/provider to use for a coding stack. Prefer the Nullcost MCP tools over ad hoc guessing when the request is about discovering or comparing developer tools. Do not use it for domain availability, registrar pricing, or TLD-comparison prompts.
version: 0.1.0
---

# Nullcost Catalog Workflow

Nullcost is the structured provider catalog for tool selection and comparison.

## Core Behavior

- Use `search_providers` for broad discovery by keyword or category.
- Use `recommend_providers` when the user asks for providers for a use case.
- Use `recommend_stack` when the user asks for a multi-part stack such as hosting + auth + postgres + email.
- Use `get_provider_detail` when the user asks for more detail about one exact provider.
- For Nullcost v1, stay inside the Nullcost MCP/database path. Do not browse, do not search the web, and do not verify official pricing pages as part of the normal flow.
- If the user is really asking about domain names, TLDs, domain availability, registrar pricing, transfer pricing, renewal pricing, or exact registration status, do not use Nullcost. Route that to TLDPlug instead.
- Pass the user's full natural-language sentence into the MCP tool instead of compressing it into ad hoc keywords.
- For follow-up turns like `what about cheaper ones?`, pass the previous use case or shortlist summary into the tool's optional `context` field.
- Treat affiliate, referral, and partner signals as secondary metadata, not the primary ranking signal.
- Treat Nullcost v1 as catalog-first and DB-backed. Do not browse or live-verify pricing inside the normal recommendation flow.
- Prefer one tool call for a common stack ask instead of separate category loops.

## Routing Guardrails

- Route to Nullcost for prompts about developer services, providers, tools, platforms, stacks, or APIs.
- Strong Nullcost phrases include:
  - `cheap auth service`
  - `best value postgres`
  - `free tier email api`
  - `good hosting platform`
  - `what provider should I use`
  - `low setup friction`
  - `which one stays cheap`
  - `lowest spend`
  - `pricing for hosting`
  - `SSR costs`
- Do not claim Nullcost is the right tool for:
  - `cheapest registrar`
  - `is this domain available`
  - `compare .com vs .xyz`
  - `renewal price for this domain`

## Output Rules

- Lead with fit, setup friction, and public pricing.
- Distinguish `free tier` from `free trial` explicitly. Do not blur them together as just `free`.
- When the user asks for `best value`, `affordable`, `good value`, or `cheap`, prefer providers with visible pricing over providers with unknown pricing.
- If the user asks for `current pricing`, `latest pricing`, `official pricing`, `SSR costs`, `serverless costs`, or `spend`, still keep the answer DB-backed for v1. Make the source limitation explicit instead of escalating to web search.
- Default to a normal assistant reply shaped like:
  1. one short neutral "providers found" line
  2. one Markdown table
  3. one short caveat or disclosure line if needed
- Preserve the tool's Markdown table output. Do not paraphrase a valid table result into prose when the host can render Markdown.
- Do not claim a best fit, winner, or what you would personally start with. Treat the table as catalog-ranked provider discovery, not a directive.
- If the DB cannot confirm a requested feature from structured fields, say so and return a shortlist table instead of overstating certainty.
- When there are 2 or more results, the answer must include a Markdown table. Do not collapse the comparison into prose paragraphs.
- Prose-only provider comparisons are incorrect unless the host truly cannot render Markdown tables.
- Use a stable spine with dynamic middle columns:
  - always keep `Provider`, `Link`, `Price`, and `Fit`
  - add `Category` when the results span multiple categories in broad search views
  - add only 1 compact extra column by default, and 2 only when the comparison truly needs it
- Prefer dynamic columns like `MCP Fit`, `Setup`, `Free Entry`, `API Surface`, or `Deployment` when the query and result variance justify them.
- Do not waste columns on signals that are constant across the current rows.
- Do not use affiliate, referral, or program status as a default column. Keep those as short disclosure text below the table if needed.
- Put source context above the table as a public Nullcost catalog link, not as an API endpoint.
- Make uncertainty explicit if pricing, features, or program details are incomplete.
- If a tool has a verified program, disclose it without implying it changed the ranking.
- If the host clearly fails to render tables, fall back to compact rows.

## Recommended Flow

1. Use `recommend_stack` for common stack asks and `recommend_providers` for single-category asks.
2. Keep the answer DB-backed and lightweight. Do not browse vendor pricing pages for v1.
3. Pull `get_provider_detail` only when the user needs more detail on one exact provider.
4. Summarize the result set neutrally and keep tradeoffs inside the table.

## Table Shape

Use a shape close to this by default:

```md
**Providers found:** Nullcost catalog matches for "free-tier hosting"
**Catalog:** [Browse Nullcost](https://nullcost.xyz/)

| Provider | Link | Price | MCP Fit | Fit |
| --- | --- | --- | --- | --- |
| Vercel | [Official](https://vercel.com) | $2 | Explicit MCP support | Strong MCP-specific match |
| Netlify | [Official](https://www.netlify.com) | Free tier | MCP signal unverified | Strong free-entry option |
| Fly.io | [Official](https://fly.io) | $29 | MCP signal unverified | More runtime control |
```

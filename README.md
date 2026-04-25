# Nullcost

Find developer tools you can actually start using for free.

Nullcost is a free-tier catalog for people building with coding agents. Ask for
cheap hosting, free-tier auth, Postgres, email APIs, workflow tools, or a small
SaaS stack, and the MCP server returns a short catalog-backed shortlist instead
of making your agent browse pricing pages one by one.

The feeling we are selling is simple: stop burning focus on vendor tabs. Get a
small, useful list of tools that have a free tier or free trial, then move on.

## What It Includes

- A Next.js site for browsing free-entry developer tools.
- A Supabase-backed catalog and referral router.
- A local MCP server for Codex, Claude, and other MCP clients.
- Plugin packaging for local Codex and Claude workflows.
- Seed data and migrations so contributors can run their own copy.

## How Users Use It

Install the MCP server, then ask normal questions:

```text
What is a cheap auth service with a real free tier?
```

```text
Free-tier Postgres for a small Next.js SaaS.
```

```text
I need hosting, auth, Postgres, and transactional email with real free tiers.
```

By default, the packaged plugin points at the hosted catalog API:

```text
https://nullcost.xyz
```

That means catalog updates happen on the hosted database. Users only need a
plugin update when the recommendation logic or MCP server code changes.

## Local Development

Install dependencies:

```bash
npm install
```

Start local Supabase and copy local keys into `.env.local`:

```bash
npm run supabase:start
npx supabase status -o env
cp .env.local.example .env.local
```

Seed the catalog:

```bash
npm run db:seed
```

Start the site:

```bash
npm run dev
```

Start the MCP server against the local site:

```bash
REFERIATE_API_BASE_URL=http://127.0.0.1:3000 npm run mcp:catalog
```

## Production Shape

The low-cost launch setup is:

- `Netlify Free` for the Next.js site and API.
- `Supabase Free` for auth and database.
- `Resend Free` for email.
- Local MCP server pointing at `https://nullcost.xyz`.

Required production environment variables:

```text
NEXT_PUBLIC_SITE_URL
SITE_URL
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_URL
SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
NULLCOST_REVIEWER_EMAILS
```

Never commit production environment values. Store them in Netlify and Supabase.

## MCP Tools

- `search_providers`
- `recommend_providers`
- `recommend_stack`
- `get_provider_detail`

The v1 behavior is intentionally DB-backed. It should not browse the web or
live-check pricing pages during normal recommendations.

## Useful Commands

```bash
npm run lint
npm run build
npm run smoke
npm run version:check
```

`npm run smoke` expects the local site and Supabase stack to be running.

## Versioning

Nullcost uses SemVer.

The current version lives in:

- `VERSION`
- `package.json`
- plugin manifests
- skill frontmatter
- MCP server metadata

Run this before release:

```bash
npm run version:check
```

## Open Source Boundary

This repo is Apache-2.0 licensed. You can fork it, run your own copy, and use it
commercially under the license terms.

The hosted Nullcost site, hosted database contents, production credentials,
referral routing data, and user data are not part of the open-source grant.

## Security Notes

- Do not commit `.env.local`, backups, production Supabase keys, or Netlify
  tokens.
- `SUPABASE_SERVICE_ROLE_KEY` must only live in trusted server environments.
- Public APIs are designed to hide private referral fields, internal notes, and
  raw metadata.

## License

Apache-2.0. See [LICENSE](LICENSE).

# Nullcost Handoff

Last updated: 2026-05-06

## Project Snapshot

Nullcost is a Next.js catalog for developer tools with real free tiers, free trials, and approved community referral or affiliate routes. The public v1 goal is simple: let users and coding agents find free-entry tools without live-browsing pricing pages on every recommendation.

The repo contains:

- Public website and API in `app/`
- Dense catalog UI in `components/provider-catalog.tsx`
- Supabase-backed provider and referral data helpers in `lib/`
- Local MCP server in `mcp/referiate-provider-server.mjs`
- Codex plugin wrapper in `plugins/nullcost-catalog/`
- Provider seed data in `data/providers_seed.csv`
- Curated plan seed data in `data/provider_plans_seed.json`
- Supabase schema/migrations in `supabase/migrations/`

## Current Stack

- Framework: Next.js 16 / React 19
- Styling: plain CSS in `app/globals.css`; no Tailwind config is present
- Database/auth: Supabase
- Hosting: Netlify
- Plugin/MCP: local stdio MCP server exposed through `plugins/nullcost-catalog/scripts/run-provider-server.mjs`
- Package manager: npm

Useful commands:

```bash
npm run dev
npm run lint
npm run build
npm run smoke
npm run db:seed
npm run mcp:catalog
```

`npm run smoke` expects the relevant local app/Supabase environment to be running.

## Product Rules

- The public catalog should only show providers with a real free tier or free trial.
- Do not expose paid-only providers in public site/API/MCP outputs unless explicitly building an admin/internal surface.
- Normal MCP/plugin recommendations are DB-backed for v1. Do not add live web pricing checks to the default recommendation path.
- If the DB cannot confirm a requested feature, prefer a shortlist with caveats over a single confident winner.
- Keep the main catalog rows dense. Extra detail belongs in the expanded row or dashboard/profile pages.
- Provider profile pages under `/providers/[slug]` are intentionally disabled for now and should return `notFound()`.
- Public referral/profile pages are separate from provider profile/catalog pages.
- User-submitted referral or affiliate codes should wait for review before going live.
- Profile claiming should remain admin-controlled; no instant public claiming.

## UI Direction

The catalog should feel like a compact operator dashboard, not a marketing page.

- Dense rows, small headers, 1px borders, minimal vertical padding
- Avoid large empty space, oversized hero text, and card-heavy layouts
- Expanded provider rows can show compact subtables for free-entry paths, trials, referrals, affiliate links, coupons, bonuses, and stackability
- Main row should stay scan-first: provider, short info, signals, status, and expand affordance
- Use the existing `cb-*` styles in `app/globals.css` before creating new patterns

Recent UI issue fixed locally:

- Providers such as LambdaTest can have `free_tier=yes` but no dedicated plan rows from `/api/providers/[slug]`.
- The expanded free-entry subtable now renders a provider-level free-entry row when plan rows are empty or incomplete.
- It suppresses that fallback row when a matching free plan/trial row already exists, to avoid duplicated `Free tier` lines.
- The `What it means` column has been widened and allowed to wrap so summaries are not clipped while other columns have spare room.

## Data State

Current public catalog is driven by Supabase and seeded from `data/providers_seed.csv`.

Important data fields:

- `free_tier`
- `free_trial`
- `pricing_url`
- `signup_url`
- `docs_url`
- `pricing_notes`
- `pricing_confidence`
- `last_pricing_checked`
- `program_url`
- `program_type`
- `commission_model`
- `user_discount_available`

The enrichment strategy is conservative:

- Prefer `data/provider_plans_seed.json` for curated official plan data.
- Use official provider pages when enriching.
- Do not overwrite confirmed `yes`/`no` free-entry flags with weaker `unknown` crawler output.
- Public rows with missing CTA/provenance should be prioritized before long-tail expansion.

Known example:

- `lambdatest` has `free_tier=yes`, pricing/signup URLs, and pricing notes: `Freemium plan for life; free plan has 60 minutes/month.`
- It currently has no plan rows in the provider API, so the provider-level fallback subrow is necessary.

## Referral And Offer Model

Do not collapse these into one vague field:

- Coupon: user gets a discount, no referrer benefit required
- Referral: user may get a bonus and referrer may get credit
- Affiliate: submitter may get commission; user may or may not get a special bonus
- Trial: temporary access window
- Free tier: ongoing free plan

Expanded rows should put the user benefit first, then referrer/submitter benefit second. Stacking should be explicit:

- `yes`
- `no`
- `unknown`
- `maybe`

Never infer that an affiliate link and referral code stack unless the provider terms confirm it.

## Security And Auth

Supabase project ref used in this repo has been linked previously: `fzgkgbiamraxvdriznes`.

Security decisions already made:

- App-owned auth routes exist under `app/api/auth/` so the app can rate-limit auth attempts.
- Redirect safety is handled in `lib/security/redirects.ts`.
- Request rate limiting is backed by Supabase tables/functions.
- RLS was enabled for `referral_router_controls` and `request_rate_limits` after a Supabase warning.
- Public referral APIs should avoid leaking internal ids, contact emails, notes, metadata, or review notes.

Do not print or commit secrets. `.env.local` may contain live Supabase values and should stay local.

## Deployment State

GitHub remote:

```text
origin https://github.com/johnvouros/nullcost.git
```

Main branch is the deploy branch.

Recent known commits:

- `22bcdce` - `fix: unblock netlify build for disabled provider pages`
- `9e22ebd` - `feat: publish catalog and referral updates`
- `3dac95b` - `fix: enable supabase email confirmations`

Netlify deploy previously failed because the disabled provider page still type-checked unreachable provider-detail code. That was fixed by reducing `app/providers/[slug]/page.tsx` to a minimal `notFound()` route.

Before pushing, run at least:

```bash
npm run lint
npm run build
```

## Current Local Work

At the time this handoff was created, local changes included:

- `components/provider-catalog.tsx`: provider-level free-entry fallback row in expanded subtables
- `app/globals.css`: expanded subtable column width and wrapping adjustments
- `handoff.md`: this file

These should be committed and pushed with this handoff.

## Next Useful Work

1. Recheck the deployed Netlify run after the next push.
2. Visually inspect expanded rows for providers with and without plan rows:
   - `lambdatest`
   - `browserless`
   - `vercel`
   - `supabase`
3. Continue filling plan rows for high-intent public providers so fewer rows rely on provider-level fallback notes.
4. Run smoke tests against the deployed production URL, not just local dev.
5. Keep improving referral/affiliate/coupon metadata, but avoid widening the main table.

## Warnings For The Next LLM

- Do not rebuild the mistaken Android apps tab unless the user explicitly asks in this repo context. That request was previously pasted into the wrong window and reverted.
- Do not re-enable `/providers/[slug]` public pages without an explicit user request.
- Do not replace the dense catalog layout with a marketing/landing-page layout.
- Do not add live web search to default MCP recommendations.
- Do not assume pricing data is perfectly complete. The catalog is useful, but some public rows still rely on provider-level metadata instead of curated plan rows.

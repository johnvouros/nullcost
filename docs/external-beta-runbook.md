# Nullcost External Beta Runbook

Last updated: 2026-04-23

## Goal

Launch an external beta with:

- a working Nullcost site
- a working Supabase database
- the existing abuse guards enabled
- a repeatable validation path
- a clear rollback path

This runbook is intentionally minimal. It documents the exact steps that are already supported by the repo and leaves explicit TODOs where real production identifiers or credentials are still required.

## Release gate

Do not push an external beta until all three pass in the current workspace:

```bash
npm run lint
npm run build
npm run smoke
```

`npm run smoke` now verifies:

- local auth sign-up and sign-in through the app-owned auth routes
- account profile sync
- duplicate provider-code rejection for the same account
- public referral API privacy boundaries
- empty-provider fallback routing
- end-to-end routed contributor traffic and Nullcost metrics
- MCP detail and recommendation sanity

## Required production inputs

These values are required before a real external beta deploy:

- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NULLCOST_REVIEWER_EMAILS`

If the MCP catalog server is deployed separately, also set one of:

- `REFERIATE_API_BASE_URL`
- `REFERIATE_BASE_URL`

TODO:

- fill in the real production site base URL
- fill in the real production Supabase project URL
- fill in the real reviewer allowlist
- decide whether the MCP server runs as a sidecar or points at the public site API

## Deploy checklist

1. Prepare production env values.
   Copy `.env.local.example` into your deployment platform secret manager and replace all local/demo values.

2. Apply database migrations.
   Use the normal Supabase migration path for the target project before deploying the app code.

3. Seed the provider catalog if the production database is empty.
   This repo already supports seeding through:

   ```bash
   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npm run db:seed
   ```

4. Deploy the app.
   The app already builds clean with:

   ```bash
   npm run build
   ```

5. Run a post-deploy smoke test against the deployed site.
   Point the smoke suite at the deployed base URL and production Supabase values:

   ```bash
   BASE_URL=https://TODO-your-beta-domain \
   NEXT_PUBLIC_SUPABASE_URL=https://TODO-your-supabase-project \
   SUPABASE_SERVICE_ROLE_KEY=TODO-production-service-role \
   npm run smoke
   ```

6. Manually verify one public route and one contributor route.

- `GET /`
- `GET /api/providers/vercel`
- `GET /go/vercel`
- sign in at `/auth`
- add or update one provider code from the signed-in dashboard flow

## Backup and restore

The repo currently has catalog seed files and migrations checked in, but an external beta still needs real database backups before release changes.

### Minimum backup requirement

Before the first external beta deploy and before any later risky migration:

- capture one full PostgreSQL backup of the production Supabase database
- keep the backup artifact outside the app host
- record the timestamp and release version that the backup corresponds to

### Suggested backup command

If you have a direct PostgreSQL connection string for production:

```bash
mkdir -p backups
pg_dump "$PRODUCTION_DATABASE_URL" --format=custom --file "backups/nullcost-$(date +%F-%H%M%S).dump"
```

TODO:

- set and store the real `PRODUCTION_DATABASE_URL`
- decide where backup artifacts live long term
- decide who has restore permission

### Restore note

Only restore during a declared incident window. A restore will overwrite newer writes.

If you have a compatible custom-format dump and need to roll the database back:

```bash
pg_restore --clean --if-exists --no-owner --dbname "$PRODUCTION_DATABASE_URL" "backups/TODO.dump"
```

After restore:

- rerun `npm run smoke` against the deployed site
- verify the provider API, router, and auth flows again

## Rollback path

If the beta deploy is bad, keep the rollback order simple:

1. Roll back the application deployment to the last known-good build.
2. Revert any bad env change.
3. Only restore the database if the issue is data- or migration-related.
4. Rerun the smoke suite against the rolled-back deployment.

### App-only rollback

Use this when:

- the UI is broken
- routing is broken
- MCP/API output is wrong
- auth is failing because of app logic rather than data corruption

Do not restore the database for an app-only bug unless writes were corrupted.

### Data rollback

Use this when:

- a migration damaged data
- a seed/import job corrupted the catalog
- referral or account rows were written incorrectly in bulk

Required input:

- the exact backup artifact taken before the bad change

## Minimal monitoring for beta

The repo does not yet include a monitoring provider integration. For external beta, set up at least:

- one uptime check on `/`
- one uptime check on `/api/providers/vercel`
- one alert channel for failed deploys or repeated smoke failures

TODO:

- choose the monitoring provider
- choose the alert destination
- add the monitoring links to this runbook

## Known acceptable beta limitations

These do not need to block external beta:

- incomplete plan coverage for every provider
- no polished admin dashboard
- Nullcost metrics are router-side metrics, not provider-dashboard conversion truth

## Known beta blockers

Do not call it ready if any of these are unresolved:

- `npm run smoke` is failing
- production envs still point at local/demo Supabase values
- no recent production database backup exists
- no rollback owner is named

# Nullcost Referral Platform Master Todo

Last updated: 2026-04-23

This is the trackable build sheet for the referral-profile and router stack.

## Ground Rules

- Do not build owner settings before ownership exists.
- Do not build version history before edit flows exist.
- Do not expose private contact or review data through public profile surfaces.
- Keep provider pages and referral-profile pages as separate product concepts.

## Current State Snapshot

- [x] Public provider catalog at `/`
- [x] Public provider pages at `/providers/[slug]`
- [x] Anonymous provider-profile referral intake form
- [x] `referral_profiles`, `referral_entries`, `referral_rotations` tables exist
- [x] Randomized router exists at `/go/[slug]`
- [x] Public referral profile API exists at `/api/referrals/profiles/[slug]`
- [x] Profile creation API exists at `/api/referrals/profiles`
- [x] Referral entry creation API exists at `/api/referrals/submissions`
- [x] Public referral profile page exists at `/profiles/[slug]`
- [x] Real user auth exists at `/auth`
- [x] Protected account handoff exists at `/account`
- [x] Owner dashboard exists at `/dashboard`
- [x] Profile claim flow exists at `/dashboard/claim/[slug]`
- [x] Reviewer queue exists at `/dashboard/review`
- [x] Router controls UI exists at `/dashboard/router`
- [ ] Versioning is missing

## Phase 0: Domain Cleanup

Status: `active`

- [ ] Standardize terminology in UI and docs
  - [ ] `Provider page` = catalog entity
  - [ ] `Referral profile` = contributor identity
  - [ ] `Referral entry` = rotatable link/code
  - [ ] `Router` = randomizer/fallback system
- [ ] Remove language that implies provider pages are editable owner dashboards
- [ ] Add route and navigation language for public referral profiles

Validation

- [ ] README and product copy use the same terms
- [ ] Provider page copy no longer implies contributor ownership

## Phase 1: Privacy and Ownership Foundation

Status: `active`

- [ ] Add profile ownership model
  - [ ] Add profile membership/claim table
  - [ ] Support `owner` and `editor` roles
  - [ ] Support pending claim or invited state
- [ ] Introduce auth/identity strategy
  - [x] Choose Supabase Auth as the default identity layer
  - [ ] Decide public profile creation vs claim-only flow
  - [x] Add minimal sign-in gate for management routes
- [ ] Fix privacy boundaries
  - [ ] Stop storing private contact/review data only on public-active tables
  - [ ] Split private profile fields from public profile fields if needed
  - [ ] Split internal review/moderation notes from public disclosure fields
  - [x] Tighten direct table/RPC public exposure for referral profile and entry data
- [ ] Define canonical submission lifecycle
  - [x] Direct live profile creation API disabled
  - [x] Direct live entry creation API disabled
  - [ ] Anonymous submission queue
  - [x] Authenticated owner draft flow
  - [ ] Moderation transition from queue item to active referral entry

Validation

- [x] Unauthenticated users hit a sign-in gate for management routes
- [ ] Public profile reads exclude private contact/review fields
- [ ] Existing provider pages and router still work after policy changes

## Phase 2: Public Referral Profile Surface

Status: `active`

- [x] Add public referral profile route at `/profiles/[slug]`
  - [x] Summary block
  - [x] Public bio and website
  - [x] Stats: active entries, providers, selections, clicks
  - [x] Active entry inventory
  - [x] Public disclosure snippets where relevant
- [x] Link provider-page rotation rows to referral profiles
- [ ] Add metadata for profile pages
- [ ] Keep this surface public-only and read-only

Validation

- [x] Missing profile slugs return not found
- [x] Active entries render from the current directory API
- [ ] No private fields appear on the page

## Phase 3: Owner Dashboard

Status: `pending`

- [ ] Add owner route group
  - [x] `/dashboard`
  - [x] `/dashboard/profiles/[slug]`
- [ ] Profile management
  - [x] Edit display name
  - [x] Edit bio
  - [x] Edit public website
  - [ ] Pause/archive profile
- [ ] Basic settings
  - [ ] Public visibility
  - [ ] Attribution display
  - [x] Contact preference
  - [x] Default disclosure
- [ ] Link inventory
  - [x] Create draft link/code
  - [x] Edit draft link/code
  - [x] Pause/archive link
  - [x] View status and review outcome

Validation

- [ ] Owner can edit only claimed profiles
- [x] Owner can edit only claimed profiles
- [x] Dashboard changes reflect on the public profile after publish/approve rules

## Phase 4: Moderation Pipeline

Status: `pending`

- [ ] Add moderation state model
  - [x] `draft`
  - [x] `pending`
  - [x] `active`
  - [x] `paused`
  - [x] `rejected`
  - [ ] `archived`
- [ ] Add moderation metadata
  - [x] rejection reason
  - [x] reviewer note
  - [x] approved at
  - [x] reviewed by
- [ ] Add duplicate detection
  - [x] same provider + same referral URL
  - [x] same provider + same referral code
- [ ] Build minimal moderation surface
  - [x] queue list
  - [x] approve
  - [x] reject
  - [x] pause

Validation

- [x] Rejected submissions show a reason to the owner
- [x] Only active entries can enter the router

## Phase 5: Router Controls

Status: `active`

- [ ] Make router behavior inspectable in UI
  - [x] current fallback target
  - [x] active pool count
  - [x] recent selections
  - [x] recent recorded redirects
- [ ] Add router configuration model
  - [x] equal rotation
  - [x] weighted rotation
  - [x] paused
  - [x] fallback only
- [ ] Improve fairness/session behavior
  - [ ] pass session id consistently
  - [ ] suppress immediate repeats where appropriate
- [ ] Clarify analytics semantics
  - [x] redirect recorded
  - [ ] click recorded
  - [ ] outbound confirmed only if technically supported

Validation

- [x] Empty pools fall back cleanly
- [x] Router only selects approved active entries
- [x] Metrics naming matches actual behavior

## Phase 6: Versioning

Status: `pending`

- [ ] Add profile revision table
- [ ] Add referral entry revision table
- [ ] Write revisions on every edit
- [ ] Expose `last updated` on public surfaces
- [ ] Show revision history in dashboard
- [ ] Add restore workflow later if needed

Validation

- [ ] Every profile edit creates a revision row
- [ ] Every entry edit creates a revision row

## Phase 7: Quality and Operations

Status: `pending`

- [ ] Add integration checks for
  - [ ] profile create
  - [ ] entry submit
  - [ ] profile page load
  - [ ] router resolve
  - [ ] router fallback
- [x] Add seed/demo data for referral profiles and entries
- [ ] Add operator notes to README
- [ ] Add migration notes for local Supabase resets

Validation

- [x] `npm run lint`
- [x] `npm run build`
- [x] local Supabase reset/reseed passes
- [x] public profile route and provider route both render with demo data

## Immediate Execution Order

- [x] Ship public referral profile route
- [x] Link provider rotation rows to public referral profiles
- [x] Introduce ownership/privacy schema groundwork
- [x] Add dashboard/auth after the ownership layer exists

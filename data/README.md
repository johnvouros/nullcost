# Provider DB Seed

This directory contains a large seed database of providers that developers using AI coding tools commonly buy or evaluate.

The dataset is intentionally opinionated toward:

- hosting and cloud
- domains, DNS, and CDN
- LLM and inference APIs
- search, scraping, proxy, and browser automation APIs
- databases, vector stores, caches, and storage
- auth and identity
- payments
- email, messaging, and notifications
- observability and developer tooling
- CI/CD, code, and workflow infrastructure
- media APIs and asset pipelines
- headless CMS and content platforms
- testing infrastructure
- secrets and configuration tooling
- docs and API platform tooling
- agent telemetry and LLM evaluation stacks
- collaboration, project, and knowledge tools commonly wired into coding workflows
- support, ticketing, and customer inbox tooling used by product engineering teams
- location, geolocation, and utility APIs often consumed in app builds

It explicitly excludes vibe-coding app builders such as Lovable.

## File

- `providers_seed.csv`

## Important fields

- `pricing_url`, `docs_url`, `signup_url`
  - official-site URLs discovered from homepage navigation or conservative path checks

- `pricing_model`
  - conservative pricing shape inferred from official pricing text when explicit
  - common values: `usage_based`, `seat_based`, `tiered`, `contact_sales`

- `starting_price`
  - only populated when the official pricing page exposes a clear entry-price phrase or an obvious free plan signal
  - not normalized across currencies or billing units yet

- `starting_price_amount`, `starting_price_currency`, `starting_price_currency_symbol`, `starting_price_unit`
  - second-pass normalized views of `starting_price`
  - `starting_price_currency` is only filled when the pricing page makes the currency explicit enough to avoid guessing
  - `starting_price_currency_symbol` preserves raw symbols like `$`, `€`, or `£` when present
  - `starting_price_unit` is intentionally sparse and only filled when the entry-price context strongly suggests a unit such as `month`, `user`, `year`, or `gb`

- `starting_price_source`
  - explains how the normalized price was derived
  - current values include `explicit_phrase` and `free_tier_inferred`

- `pricing_confidence`
  - conservative confidence score for the normalized pricing interpretation
  - current values: `high`, `medium`, `low`

- `pricing_notes`
  - short explanation of why the pricing fields were or were not filled, such as `free tier detected on pricing page` or `pricing page found but entry price not extracted`

- `pricing_normalized_at`
  - date of the latest pricing-normalization pass

- `free_tier`, `free_trial`, `contact_sales_only`
  - tri-state fields: `yes`, `no`, or `unknown`
  - `unknown` means the scan did not find enough evidence to safely assert either direction

- `deployment_model`
  - conservative classification from official-site wording
  - common values: `hosted`, `self_hosted`, `hybrid`

- `open_source`, `api_available`, `cli_available`, `mcp_available`
  - tri-state capability signals from official site or docs text
  - these are intentionally strict and default to `unknown` unless explicit

- `setup_friction`
  - heuristic field derived from verified signup, pricing, docs, and self-serve signals
  - common values: `low`, `medium`, `high`

- `target_customer`
  - coarse audience signal from explicit official-site language
  - common values: `developer`, `startup`, `enterprise`, `teams`, `mixed`

- `program_url`, `program_type`, `commission_model`, `user_discount_available`
  - only treated as trustworthy when backed by an official `source_url` or an explicit official program page
  - `program_type` is a compact summary such as `affiliate`, `referral`, `partner`, or a `+` combination
  - `commission_model` is intentionally sparse and only filled when the official page clearly states a pattern such as `credits`, `discount`, `percentage_commission`, or `flat_bounty`

- `last_pricing_checked`, `last_program_checked`
  - date of the latest automated official-site pass for those parts of the row

- `affiliate_status`
  - `available`: an affiliate program was found on an official or clearly provider-controlled source
  - `not_found_quick_check`: a quick official check found other program types but no obvious public affiliate page
  - `unknown`: not yet verified

- `referral_status`
  - `available`: a referral program was found on an official or clearly provider-controlled source
  - `not_found_quick_check`: a quick official check found other program types but no obvious public referral page
  - `unknown`: not yet verified

- `other_programs`
  - captures adjacent monetization/distribution motions such as `partner`, `creator`, `ambassador`, `startup`, or `open_source`

- `research_status`
  - `verified_program`: program fields were backed by a source URL during this pass
  - `quick_official_check`: an official page was found for a related partner/creator motion, but affiliate/referral may still need deeper research
  - `seed_only`: provider included for breadth; monetization program status still needs verification

## Caveat

Affiliate and referral programs change often. Treat this file as a high-value seed database, not a final source of truth. Before using a row for monetization logic, re-check the `source_url` and the provider's current terms.

Some of the new metadata is direct evidence from official pages, while some fields are conservative derived signals from that evidence. In particular, `setup_friction`, `target_customer`, `pricing_model`, and `starting_price` should be treated as useful recommendation inputs, not perfect contractual facts.

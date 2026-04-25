import { createClient } from '@supabase/supabase-js';

const LOCAL_SUPABASE_URL = 'http://127.0.0.1:54321';

const PROVIDER_COLUMNS = [
  'id',
  'slug',
  'name',
  'category',
  'subcategory',
  'website',
  'use_case',
  'self_serve',
  'affiliate_status',
  'referral_status',
  'other_programs',
  'program_notes',
  'source_url',
  'research_status',
  'last_verified',
  'pricing_url',
  'docs_url',
  'signup_url',
  'pricing_model',
  'starting_price',
  'free_tier',
  'free_trial',
  'contact_sales_only',
  'deployment_model',
  'open_source',
  'api_available',
  'cli_available',
  'mcp_available',
  'setup_friction',
  'target_customer',
  'program_url',
  'program_type',
  'commission_model',
  'user_discount_available',
  'last_pricing_checked',
  'last_program_checked',
  'starting_price_amount',
  'starting_price_currency',
  'starting_price_currency_symbol',
  'starting_price_unit',
  'starting_price_source',
  'pricing_confidence',
  'pricing_notes',
  'pricing_normalized_at',
].join(',');

const PROVIDER_PLAN_COLUMNS = [
  'id',
  'provider_id',
  'slug',
  'name',
  'summary',
  'price_label',
  'price_amount',
  'currency',
  'billing_period',
  'plan_type',
  'best_for_tags',
  'official_url',
  'source_url',
  'sort_order',
  'trial_available',
  'contact_sales_only',
  'last_checked',
].join(',');

export type ProviderFlag = 'yes' | 'no' | 'unknown';
export type ProviderResearchStatus = 'verified_program' | 'quick_official_check' | 'seed_only';
export type ProviderSurfaceFilter = 'all' | 'mcp' | 'api' | 'cli' | 'open_source' | 'program';

export interface ProviderRow {
  id: string;
  slug: string;
  name: string;
  category: string | null;
  subcategory: string | null;
  website: string | null;
  use_case: string | null;
  self_serve: ProviderFlag;
  affiliate_status: string | null;
  referral_status: string | null;
  other_programs: string | null;
  program_notes: string | null;
  source_url: string | null;
  research_status: ProviderResearchStatus;
  last_verified: string | null;
  pricing_url: string | null;
  docs_url: string | null;
  signup_url: string | null;
  pricing_model: string | null;
  starting_price: string | null;
  free_tier: ProviderFlag;
  free_trial: ProviderFlag;
  contact_sales_only: ProviderFlag;
  deployment_model: string | null;
  open_source: ProviderFlag;
  api_available: ProviderFlag;
  cli_available: ProviderFlag;
  mcp_available: ProviderFlag;
  setup_friction: string | null;
  target_customer: string | null;
  program_url: string | null;
  program_type: string | null;
  commission_model: string | null;
  user_discount_available: ProviderFlag;
  last_pricing_checked: string | null;
  last_program_checked: string | null;
  starting_price_amount: number | null;
  starting_price_currency: string | null;
  starting_price_currency_symbol: string | null;
  starting_price_unit: string | null;
  starting_price_source: string | null;
  pricing_confidence: string | null;
  pricing_notes: string | null;
  pricing_normalized_at: string | null;
}

export interface ProviderPlanRow {
  id: string;
  provider_id: string;
  slug: string;
  name: string;
  summary: string | null;
  price_label: string;
  price_amount: number | null;
  currency: string | null;
  billing_period: 'month' | 'year' | 'usage' | 'custom' | null;
  plan_type: 'free' | 'paid' | 'enterprise';
  best_for_tags: string[];
  official_url: string | null;
  source_url: string | null;
  sort_order: number;
  trial_available: boolean;
  contact_sales_only: boolean;
  last_checked: string | null;
}

export interface ProviderFilters {
  query?: string;
  category?: string;
  subcategory?: string;
  limit?: number;
  surface?: ProviderSurfaceFilter;
}

interface PlanSelectionIntent {
  contextText?: string;
  preferValue?: boolean;
  preferFreeTier?: boolean;
  preferFreeTrial?: boolean;
}

function compact(value: string | null | undefined): string {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim();
}

function lower(value: string | null | undefined): string {
  return compact(value).toLowerCase();
}

function normalizePlanTags(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => compact(item))
    .filter(Boolean);
}

function matchesQuery(provider: ProviderRow, query: string): boolean {
  const terms = compact(query)
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);

  if (terms.length === 0) {
    return true;
  }

  const haystack = [
    provider.slug,
    provider.name,
    provider.category,
    provider.subcategory,
    provider.use_case,
    provider.pricing_model,
    provider.starting_price,
    provider.setup_friction,
    provider.target_customer,
    provider.deployment_model,
    provider.program_type,
    provider.other_programs,
    provider.program_notes,
  ]
    .map(lower)
    .filter(Boolean)
    .join(' ');

  return terms.every((term) => haystack.includes(term));
}

function matchesSurface(provider: ProviderRow, surface: ProviderSurfaceFilter): boolean {
  switch (surface) {
    case 'mcp':
      return isYes(provider.mcp_available);
    case 'api':
      return isYes(provider.api_available);
    case 'cli':
      return isYes(provider.cli_available);
    case 'open_source':
      return isYes(provider.open_source);
    case 'program':
      return hasProgram(provider);
    default:
      return true;
  }
}

function getSupabaseClient() {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || LOCAL_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.SUPABASE_PUBLISHABLE_KEY;

  if (!key) {
    throw new Error(
      'Missing Supabase anon key. Set NEXT_PUBLIC_SUPABASE_ANON_KEY or SUPABASE_ANON_KEY.',
    );
  }

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function planHasTag(plan: ProviderPlanRow, tag: string): boolean {
  return plan.best_for_tags.some((candidate) => lower(candidate) === lower(tag));
}

export function isYes(value: string | null | undefined): boolean {
  return lower(value) === 'yes';
}

export function getDefaultPlanSelectionIntent(provider: ProviderRow): PlanSelectionIntent {
  return {
    contextText: [provider.category, provider.subcategory, provider.name].filter(Boolean).join(' '),
    preferFreeTier: isYes(provider.free_tier),
    preferFreeTrial: isYes(provider.free_trial),
  };
}

export function hasProgram(provider: ProviderRow): boolean {
  return Boolean(
    compact(provider.program_url) ||
      compact(provider.program_type) ||
      compact(provider.commission_model) ||
      lower(provider.affiliate_status) === 'available' ||
      lower(provider.referral_status) === 'available' ||
      isYes(provider.user_discount_available),
  );
}

export function getDisplayPrice(provider: ProviderRow): string {
  if (isYes(provider.free_tier)) {
    return 'Free tier';
  }

  if (isYes(provider.free_trial)) {
    return 'Free trial';
  }

  if (compact(provider.starting_price)) {
    return compact(provider.starting_price);
  }

  switch (provider.pricing_model) {
    case 'usage_based':
      return 'Usage based';
    case 'seat_based':
      return 'Seat based';
    case 'tiered':
      return 'Tiered plans';
    case 'contact_sales':
      return 'Contact sales';
    default:
      return 'Pricing unknown';
  }
}

export function getFreeEntryLabel(provider: ProviderRow): string {
  if (isYes(provider.free_tier)) {
    return 'Free tier';
  }

  if (isYes(provider.free_trial)) {
    return 'Free trial';
  }

  if (isYes(provider.contact_sales_only)) {
    return 'Talk to sales';
  }

  return 'No free entry';
}

export function getPlanPriceText(plan: ProviderPlanRow): string {
  return compact(plan.price_label) || 'Pricing unknown';
}

function formatPlanTags(tags: string[]): string {
  return tags
    .map((tag) => compact(tag).replace(/_/g, ' '))
    .filter(Boolean)
    .join(' · ');
}

export function getFreeEntrySummary(
  provider: ProviderRow,
  plan?: ProviderPlanRow | null,
): string {
  const planSummary = compact(plan?.summary);
  if (planSummary) {
    return planSummary;
  }

  const pricingNotes = compact(provider.pricing_notes);
  if (pricingNotes) {
    return pricingNotes;
  }

  if (isYes(provider.free_tier)) {
    return 'Free tier is available. Exact limits are not modeled yet.';
  }

  if (isYes(provider.free_trial)) {
    return 'Free trial is available. Exact trial terms are not modeled yet.';
  }

  return 'Free entry details are not captured yet.';
}

export function getProviderFitSummary(
  provider: ProviderRow,
  plan?: ProviderPlanRow | null,
): string {
  const planTags = formatPlanTags(plan?.best_for_tags ?? []);
  if (planTags) {
    return planTags;
  }

  const useCase = compact(provider.use_case);
  if (useCase) {
    return useCase;
  }

  const fallback = [compact(provider.subcategory), compact(provider.category)].filter(Boolean).join(' · ');
  return fallback || 'General use';
}

export function getStartPathSummary(provider: ProviderRow): string {
  if (isYes(provider.contact_sales_only)) {
    return 'Sales-led onboarding';
  }

  const selfServe = isYes(provider.self_serve);
  const friction = lower(provider.setup_friction);

  if (selfServe && friction === 'low') {
    return 'Self-serve and easy to start';
  }

  if (selfServe && friction === 'medium') {
    return 'Self-serve with some setup';
  }

  if (selfServe) {
    return 'Self-serve';
  }

  if (friction === 'low') {
    return 'Low-friction setup';
  }

  if (friction === 'medium') {
    return 'Some setup required';
  }

  return 'Setup path not captured';
}

export function chooseBestStartingPlan(
  plans: ProviderPlanRow[],
  intent: PlanSelectionIntent = {},
): ProviderPlanRow | undefined {
  if (plans.length === 0) {
    return undefined;
  }

  const contextText = lower(intent.contextText);
  const wantsEnterprise = /\b(enterprise|compliance|hipaa|soc ?2|sso|scim|audit|sla)\b/.test(contextText);
  const wantsProduction = /\b(production|prod|ship|launch|live|scale)\b/.test(contextText);
  const wantsTeam = /\b(team|teams|collaboration|collaborative|multi[- ]user|shared)\b/.test(contextText);
  const wantsSolo = /\b(solo|indie|freelancer|personal|side project|prototype|hobby)\b/.test(contextText);
  const wantsFree =
    intent.preferFreeTier ||
    /\b(free|budget|cheap|value|affordable|trial|prototype|side project|hobby)\b/.test(contextText);
  const wantsTrial = intent.preferFreeTrial || /\btrial\b/.test(contextText);

  const ranked = [...plans].sort((left, right) => {
    const leftScore = scorePlan(left);
    const rightScore = scorePlan(right);
    return rightScore - leftScore || left.sort_order - right.sort_order || left.name.localeCompare(right.name);
  });

  return ranked[0];

  function scorePlan(plan: ProviderPlanRow): number {
    let score = 0;

    if (plan.plan_type === 'enterprise') {
      score += wantsEnterprise ? 30 : -18;
    } else if (plan.plan_type === 'free') {
      score += wantsFree ? 22 : 10;
    } else {
      score += 8;
    }

    if (plan.trial_available) {
      score += wantsTrial ? 10 : 2;
    }

    if (plan.contact_sales_only) {
      score += wantsEnterprise ? 8 : -16;
    }

    if (Number.isFinite(plan.price_amount ?? NaN)) {
      score += Math.max(0, 18 - Number(plan.price_amount ?? 0));
    }

    if (planHasTag(plan, 'prototype')) score += wantsFree || wantsSolo ? 14 : 4;
    if (planHasTag(plan, 'solo_dev')) score += wantsSolo || wantsFree ? 12 : 4;
    if (planHasTag(plan, 'small_team')) score += wantsTeam ? 16 : wantsProduction ? 6 : 2;
    if (planHasTag(plan, 'production')) score += wantsProduction ? 18 : wantsTeam ? 8 : 2;
    if (planHasTag(plan, 'enterprise')) score += wantsEnterprise ? 18 : -6;
    if (planHasTag(plan, 'compliance')) score += wantsEnterprise ? 12 : 0;

    score += Math.max(0, 30 - plan.sort_order);

    return score;
  }
}

export function getResearchLabel(status: ProviderResearchStatus | string | null | undefined): string {
  switch (status) {
    case 'verified_program':
      return 'verified';
    case 'quick_official_check':
      return 'checked';
    case 'seed_only':
      return 'seed';
    default:
      return 'unknown';
  }
}

export function getSurfaceLabels(provider: ProviderRow): string[] {
  const labels = [];

  if (isYes(provider.mcp_available)) labels.push('MCP');
  if (isYes(provider.api_available)) labels.push('API');
  if (isYes(provider.cli_available)) labels.push('CLI');
  if (isYes(provider.open_source)) labels.push('Open source');
  if (isYes(provider.free_tier)) labels.push('Free tier');
  if (hasProgram(provider)) labels.push('Program');

  return labels;
}

export function getProviderLinks(provider: ProviderRow): Array<{ label: string; url: string }> {
  const pairs: Array<{ label: string; url: string | null }> = [
    { label: 'Official site', url: provider.website },
    { label: 'Docs', url: provider.docs_url },
    { label: 'Pricing', url: provider.pricing_url },
    { label: 'Signup', url: provider.signup_url },
    { label: 'Program', url: provider.program_url },
    { label: 'Source', url: provider.source_url },
  ];

  const seen = new Set<string>();

  return pairs.flatMap((pair) => {
    const url = compact(pair.url);
    if (!url || seen.has(url)) {
      return [];
    }
    seen.add(url);
    return [{ label: pair.label, url }];
  });
}

export function getCatalogStats(providers: ProviderRow[]) {
  return {
    total: providers.length,
    mcpReady: providers.filter((provider) => isYes(provider.mcp_available)).length,
    programReady: providers.filter((provider) => hasProgram(provider)).length,
    lowFriction: providers.filter((provider) => lower(provider.setup_friction) === 'low').length,
  };
}

function planHasFreeEntry(plan: ProviderPlanRow): boolean {
  return plan.plan_type === 'free' || plan.trial_available;
}

function buildProviderPlansMap(plans: ProviderPlanRow[]) {
  const byProviderId = new Map<string, ProviderPlanRow[]>();

  for (const plan of plans) {
    const existing = byProviderId.get(plan.provider_id);
    if (existing) {
      existing.push(plan);
    } else {
      byProviderId.set(plan.provider_id, [plan]);
    }
  }

  return byProviderId;
}

function applyPublicCatalogSignals(provider: ProviderRow, plans: ProviderPlanRow[]): ProviderRow {
  const hasFreeTier = isYes(provider.free_tier) || plans.some((plan) => plan.plan_type === 'free');
  const hasFreeTrial = isYes(provider.free_trial) || plans.some((plan) => plan.trial_available);

  return {
    ...provider,
    free_tier: hasFreeTier ? 'yes' : provider.free_tier,
    free_trial: hasFreeTrial ? 'yes' : provider.free_trial,
    contact_sales_only: hasFreeTier || hasFreeTrial ? 'no' : provider.contact_sales_only,
  };
}

function isPublicCatalogProvider(provider: ProviderRow): boolean {
  return isYes(provider.free_tier) || isYes(provider.free_trial);
}

async function loadPublicProviders(): Promise<ProviderRow[]> {
  const [providers, plans] = await Promise.all([loadAllProviders(), loadAllProviderPlans()]);
  const plansByProviderId = buildProviderPlansMap(plans);

  return providers
    .map((provider) => applyPublicCatalogSignals(provider, plansByProviderId.get(provider.id) ?? []))
    .filter((provider) => isPublicCatalogProvider(provider));
}

async function loadAllProviders(): Promise<ProviderRow[]> {
  const supabase = getSupabaseClient();
  const pageSize = 1000;
  const rows: ProviderRow[] = [];
  let page = 0;

  while (true) {
    const from = page * pageSize;
    const to = from + pageSize - 1;
    const { data, error } = await supabase
      .from('providers')
      .select(PROVIDER_COLUMNS)
      .order('name')
      .range(from, to);

    if (error) {
      throw new Error(`Failed to load providers from Supabase: ${error.message}`);
    }

    const batch = (data ?? []) as unknown as ProviderRow[];
    rows.push(...batch);

    if (batch.length < pageSize) {
      break;
    }

    page += 1;
  }

  return rows;
}

async function loadAllProviderPlans(): Promise<ProviderPlanRow[]> {
  const supabase = getSupabaseClient();
  const pageSize = 1000;
  const rows: ProviderPlanRow[] = [];
  let page = 0;

  while (true) {
    const from = page * pageSize;
    const to = from + pageSize - 1;
    const { data, error } = await supabase
      .from('provider_plans')
      .select(PROVIDER_PLAN_COLUMNS)
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true })
      .range(from, to);

    if (error) {
      throw new Error(`Failed to load provider plans from Supabase: ${error.message}`);
    }

    const batch = ((data ?? []) as unknown as ProviderPlanRow[]).map((plan) => ({
      ...plan,
      best_for_tags: normalizePlanTags((plan as ProviderPlanRow).best_for_tags),
    }));
    rows.push(...batch);

    if (batch.length < pageSize) {
      break;
    }

    page += 1;
  }

  return rows;
}

export async function getProviderRows(filters: ProviderFilters = {}): Promise<ProviderRow[]> {
  const providers = await loadPublicProviders();

  return providers
    .filter((provider) => {
      if (filters.category && lower(provider.category) !== lower(filters.category)) {
        return false;
      }

      if (filters.subcategory && lower(provider.subcategory) !== lower(filters.subcategory)) {
        return false;
      }

      if (filters.surface && filters.surface !== 'all' && !matchesSurface(provider, filters.surface)) {
        return false;
      }

      if (filters.query && !matchesQuery(provider, filters.query)) {
        return false;
      }

      return true;
    })
    .slice(0, filters.limit && filters.limit > 0 ? filters.limit : undefined);
}

export async function getProviderBySlug(slug: string): Promise<ProviderRow | undefined> {
  const providers = await loadPublicProviders();
  const needle = lower(slug);

  return providers.find((provider) => lower(provider.slug) === needle);
}

export async function getProviderPlansByProviderId(providerId: string): Promise<ProviderPlanRow[]> {
  const plans = await loadAllProviderPlans();

  return plans
    .filter((plan) => planHasFreeEntry(plan))
    .filter((plan) => plan.provider_id === providerId)
    .sort((left, right) => left.sort_order - right.sort_order || left.name.localeCompare(right.name));
}

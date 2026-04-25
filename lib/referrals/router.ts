import { createClient } from '@supabase/supabase-js';
import { getProviderBySlug, type ProviderRow } from '@/lib/providers';
import { getSupabaseServiceRoleKey, getSupabaseUrl } from '@/lib/supabase/config';

export type RouterMode = 'weighted' | 'equal' | 'paused' | 'fallback_only';
export type RouterFallbackPreference = 'official' | 'docs' | 'pricing' | 'signup' | 'provider_page';

export interface RouterProviderSummary {
  slug: string;
  name: string;
  mode: RouterMode;
  activeEntries: number;
  pendingEntries: number;
  pausedEntries: number;
  lastCloudbrokerSelectionAt: string | null;
  lastCloudbrokerRedirectAt: string | null;
}

export interface RouterEntryRow {
  id: string;
  status: 'active' | 'pending' | 'paused';
  kind: string;
  title: string | null;
  weight: number;
  referralUrl: string | null;
  destinationUrl: string | null;
  referralCode: string | null;
  disclosure: string | null;
  cloudbrokerSelectionCount: number;
  cloudbrokerRedirectCount: number;
  lastCloudbrokerSelectionAt: string | null;
  lastCloudbrokerRedirectAt: string | null;
  profile: {
    slug: string;
    displayName: string;
  } | null;
}

export interface RouterRotationRow {
  rotationId: string;
  source: string;
  selectedAt: string;
  clickedAt: string | null;
  resolvedUrl: string | null;
  resolvedCode: string | null;
  entry: {
    id: string;
    kind: string;
    title: string | null;
  } | null;
  profile: {
    slug: string;
    displayName: string;
  } | null;
}

export interface RouterWorkspace {
  provider: ProviderRow;
  control: {
    mode: RouterMode;
    fallbackPreference: RouterFallbackPreference;
    updatedAt: string | null;
  };
  metrics: {
    activePool: number;
    pending: number;
    paused: number;
    totalCloudbrokerSelections: number;
    totalCloudbrokerRedirects: number;
  };
  fallback: {
    label: string;
    url: string;
  };
  providers: RouterProviderSummary[];
  entries: RouterEntryRow[];
  rotations: RouterRotationRow[];
}

function getServiceSupabaseClient() {
  return createClient(getSupabaseUrl(), getSupabaseServiceRoleKey(), {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function compact(value: string | null | undefined) {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim();
}

function requireText(value: string | null | undefined, label: string) {
  const text = compact(value);
  if (!text) {
    throw new Error(`${label} is required`);
  }
  return text;
}

function normalizeSlug(value: string | null | undefined) {
  return compact(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function firstRelation<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

function parseRouterMode(value: string | null | undefined): RouterMode {
  switch (compact(value)) {
    case 'equal':
    case 'paused':
    case 'fallback_only':
      return compact(value) as RouterMode;
    case 'weighted':
    case '':
      return 'weighted';
    default:
      throw new Error('mode must be weighted, equal, paused, or fallback_only');
  }
}

function parseFallbackPreference(value: string | null | undefined): RouterFallbackPreference {
  switch (compact(value)) {
    case 'docs':
    case 'pricing':
    case 'signup':
    case 'provider_page':
      return compact(value) as RouterFallbackPreference;
    case 'official':
    case '':
      return 'official';
    default:
      throw new Error('fallbackPreference must be official, docs, pricing, signup, or provider_page');
  }
}

export function getProviderFallbackTarget(
  provider: ProviderRow,
  preference: RouterFallbackPreference,
  requestUrl?: string,
) {
  const providerPageUrl = requestUrl
    ? new URL(`/providers/${provider.slug}`, requestUrl).toString()
    : `/providers/${provider.slug}`;

  const candidates = {
    official: provider.website,
    docs: provider.docs_url,
    pricing: provider.pricing_url,
    signup: provider.signup_url,
    provider_page: providerPageUrl,
  } as const;

  const orderMap: Record<RouterFallbackPreference, Array<keyof typeof candidates>> = {
    official: ['official', 'docs', 'pricing', 'signup', 'provider_page'],
    docs: ['docs', 'official', 'pricing', 'signup', 'provider_page'],
    pricing: ['pricing', 'official', 'docs', 'signup', 'provider_page'],
    signup: ['signup', 'official', 'docs', 'pricing', 'provider_page'],
    provider_page: ['provider_page', 'official', 'docs', 'pricing', 'signup'],
  };

  for (const key of orderMap[preference]) {
    const url = candidates[key];
    if (url) {
      return {
        label:
          key === 'official'
            ? 'Official site'
            : key === 'docs'
              ? 'Docs'
              : key === 'pricing'
                ? 'Pricing'
                : key === 'signup'
                  ? 'Signup'
                  : 'Provider page',
        url,
      };
    }
  }

  return {
    label: 'Provider page',
    url: providerPageUrl,
  };
}

async function getProviderControl(providerId: string) {
  const supabase = getServiceSupabaseClient();
  const { data, error } = await supabase
    .from('referral_router_controls')
    .select('mode, fallback_preference, updated_at')
    .eq('provider_id', requireText(providerId, 'providerId'))
    .maybeSingle();

  if (error) {
    throw new Error(`Router control lookup failed: ${error.message}`);
  }

  return {
    mode: parseRouterMode(data?.mode),
    fallbackPreference: parseFallbackPreference(data?.fallback_preference),
    updatedAt: data?.updated_at ?? null,
  };
}

export async function getProviderRouterControlBySlug(providerSlug: string) {
  const providerId = await getProviderId(providerSlug);
  return getProviderControl(providerId);
}

async function getProviderId(providerSlug: string) {
  const supabase = getServiceSupabaseClient();
  const { data, error } = await supabase
    .from('providers')
    .select('id')
    .eq('slug', normalizeSlug(providerSlug))
    .single();

  if (error) {
    throw new Error(`Provider id lookup failed: ${error.message}`);
  }

  return data.id as string;
}

export async function listRouterProviderSummaries(limit = 80): Promise<RouterProviderSummary[]> {
  const supabase = getServiceSupabaseClient();
  const [{ data: entryRows, error: entryError }, { data: controlRows, error: controlError }] = await Promise.all([
    supabase
      .from('referral_entries')
      .select('provider_id, status, last_selected_at, last_clicked_at, providers ( slug, name )')
      .in('status', ['active', 'pending', 'paused']),
    supabase.from('referral_router_controls').select('provider_id, mode'),
  ]);

  if (entryError) {
    throw new Error(`Router summary entry lookup failed: ${entryError.message}`);
  }
  if (controlError) {
    throw new Error(`Router summary control lookup failed: ${controlError.message}`);
  }

  const modeByProvider = new Map<string, RouterMode>();
  ((controlRows ?? []) as Array<{ provider_id: string; mode: string }>).forEach((row) => {
    modeByProvider.set(row.provider_id, parseRouterMode(row.mode));
  });

  const summaries = new Map<string, RouterProviderSummary & { providerId: string }>();

  ((entryRows ?? []) as Array<{
    provider_id: string;
    status: 'active' | 'pending' | 'paused';
    last_selected_at: string | null;
    last_clicked_at: string | null;
    providers: { slug: string; name: string } | Array<{ slug: string; name: string }> | null;
  }>).forEach((row) => {
    const provider = firstRelation(row.providers);
    if (!provider) {
      return;
    }

    const existing = summaries.get(row.provider_id) ?? {
      providerId: row.provider_id,
      slug: provider.slug,
      name: provider.name,
      mode: modeByProvider.get(row.provider_id) ?? 'weighted',
      activeEntries: 0,
      pendingEntries: 0,
      pausedEntries: 0,
      lastCloudbrokerSelectionAt: null,
      lastCloudbrokerRedirectAt: null,
    };

    if (row.status === 'active') existing.activeEntries += 1;
    if (row.status === 'pending') existing.pendingEntries += 1;
    if (row.status === 'paused') existing.pausedEntries += 1;
    if (!existing.lastCloudbrokerSelectionAt || (row.last_selected_at && row.last_selected_at > existing.lastCloudbrokerSelectionAt)) {
      existing.lastCloudbrokerSelectionAt = row.last_selected_at;
    }
    if (!existing.lastCloudbrokerRedirectAt || (row.last_clicked_at && row.last_clicked_at > existing.lastCloudbrokerRedirectAt)) {
      existing.lastCloudbrokerRedirectAt = row.last_clicked_at;
    }

    summaries.set(row.provider_id, existing);
  });

  return Array.from(summaries.values())
    .sort((a, b) => {
      const left = a.lastCloudbrokerSelectionAt || '';
      const right = b.lastCloudbrokerSelectionAt || '';
      return right.localeCompare(left) || b.activeEntries - a.activeEntries || a.name.localeCompare(b.name);
    })
    .slice(0, limit)
    .map((row) => ({
      slug: row.slug,
      name: row.name,
      mode: row.mode,
      activeEntries: row.activeEntries,
      pendingEntries: row.pendingEntries,
      pausedEntries: row.pausedEntries,
      lastCloudbrokerSelectionAt: row.lastCloudbrokerSelectionAt,
      lastCloudbrokerRedirectAt: row.lastCloudbrokerRedirectAt,
    }));
}

export async function getRouterWorkspace(providerSlug?: string | null): Promise<RouterWorkspace> {
  const providerSummaries = await listRouterProviderSummaries();
  const targetSlug = normalizeSlug(providerSlug) || providerSummaries[0]?.slug || 'vercel';
  const provider = await getProviderBySlug(targetSlug);

  if (!provider) {
    throw new Error('Router provider not found');
  }

  const providerId = await getProviderId(provider.slug);
  const [control, entryResult, rotationResult] = await Promise.all([
    getProviderControl(providerId),
    getServiceSupabaseClient()
      .from('referral_entries')
      .select(
        'id, status, kind, title, weight, referral_url, destination_url, referral_code, disclosure, selection_count, click_count, last_selected_at, last_clicked_at, referral_profiles ( slug, display_name )',
      )
      .eq('provider_id', providerId)
      .in('status', ['active', 'pending', 'paused'])
      .order('status', { ascending: true })
      .order('selection_count', { ascending: false }),
    getServiceSupabaseClient()
      .from('referral_rotations')
      .select(
        'id, source, selected_at, clicked_at, resolved_url, resolved_code, referral_entries ( id, kind, title ), referral_profiles ( slug, display_name )',
      )
      .eq('provider_id', providerId)
      .order('selected_at', { ascending: false })
      .limit(25),
  ]);

  if (entryResult.error) {
    throw new Error(`Router entry lookup failed: ${entryResult.error.message}`);
  }
  if (rotationResult.error) {
    throw new Error(`Router rotation lookup failed: ${rotationResult.error.message}`);
  }

  const entries = ((entryResult.data ?? []) as Array<{
    id: string;
    status: 'active' | 'pending' | 'paused';
    kind: string;
    title: string | null;
    weight: number;
    referral_url: string | null;
    destination_url: string | null;
    referral_code: string | null;
    disclosure: string | null;
    selection_count: number;
    click_count: number;
    last_selected_at: string | null;
    last_clicked_at: string | null;
    referral_profiles:
      | { slug: string; display_name: string }
      | Array<{ slug: string; display_name: string }>
      | null;
  }>).map((row) => {
    const profile = firstRelation(row.referral_profiles);
    return {
      id: row.id,
      status: row.status,
      kind: row.kind,
      title: row.title,
      weight: row.weight,
      referralUrl: row.referral_url,
      destinationUrl: row.destination_url,
      referralCode: row.referral_code,
      disclosure: row.disclosure,
      cloudbrokerSelectionCount: row.selection_count,
      cloudbrokerRedirectCount: row.click_count,
      lastCloudbrokerSelectionAt: row.last_selected_at,
      lastCloudbrokerRedirectAt: row.last_clicked_at,
      profile: profile
        ? {
            slug: profile.slug,
            displayName: profile.display_name,
          }
        : null,
    };
  });

  const rotations = ((rotationResult.data ?? []) as Array<{
    id: string;
    source: string;
    selected_at: string;
    clicked_at: string | null;
    resolved_url: string | null;
    resolved_code: string | null;
    referral_entries:
      | { id: string; kind: string; title: string | null }
      | Array<{ id: string; kind: string; title: string | null }>
      | null;
    referral_profiles:
      | { slug: string; display_name: string }
      | Array<{ slug: string; display_name: string }>
      | null;
  }>).map((row) => ({
    rotationId: row.id,
    source: row.source,
    selectedAt: row.selected_at,
    clickedAt: row.clicked_at,
    resolvedUrl: row.resolved_url,
    resolvedCode: row.resolved_code,
    entry: (() => {
      const entry = firstRelation(row.referral_entries);
      return entry
        ? {
            id: entry.id,
            kind: entry.kind,
            title: entry.title,
          }
        : null;
    })(),
    profile: (() => {
      const profile = firstRelation(row.referral_profiles);
      return profile
        ? {
            slug: profile.slug,
            displayName: profile.display_name,
          }
        : null;
    })(),
  }));

  return {
    provider,
    control,
    metrics: {
      activePool: entries.filter((entry) => entry.status === 'active').length,
      pending: entries.filter((entry) => entry.status === 'pending').length,
      paused: entries.filter((entry) => entry.status === 'paused').length,
      totalCloudbrokerSelections: entries.reduce((sum, entry) => sum + entry.cloudbrokerSelectionCount, 0),
      totalCloudbrokerRedirects: entries.reduce((sum, entry) => sum + entry.cloudbrokerRedirectCount, 0),
    },
    fallback: getProviderFallbackTarget(provider, control.fallbackPreference),
    providers: providerSummaries,
    entries,
    rotations,
  };
}

export async function updateRouterControl(
  providerSlug: string,
  input: {
    mode: string | null | undefined;
    fallbackPreference: string | null | undefined;
  },
) {
  const providerId = await getProviderId(providerSlug);
  const supabase = getServiceSupabaseClient();
  const { error } = await supabase.from('referral_router_controls').upsert({
    provider_id: providerId,
    mode: parseRouterMode(input.mode),
    fallback_preference: parseFallbackPreference(input.fallbackPreference),
  });

  if (error) {
    throw new Error(`Router control update failed: ${error.message}`);
  }
}

export async function updateRouterEntryWeight(providerSlug: string, entryId: string, weightInput: string | null | undefined) {
  const providerId = await getProviderId(providerSlug);
  const parsed = Number(weightInput ?? '');
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error('weight must be a positive number');
  }

  const supabase = getServiceSupabaseClient();
  const { error } = await supabase
    .from('referral_entries')
    .update({ weight: Math.floor(parsed) })
    .eq('provider_id', providerId)
    .eq('id', requireText(entryId, 'entryId'))
    .in('status', ['active', 'pending', 'paused']);

  if (error) {
    throw new Error(`Router weight update failed: ${error.message}`);
  }
}

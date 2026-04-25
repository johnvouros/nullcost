import { createClient } from '@supabase/supabase-js';
import { getSupabaseServiceRoleKey, getSupabaseUrl } from '@/lib/supabase/config';

export type ReferralEntryKind = 'affiliate_link' | 'referral_link' | 'coupon_code';

export interface ReferralProfileCreateInput {
  slug: string;
  displayName: string;
  bio?: string | null;
  website?: string | null;
  contactEmail?: string | null;
  metadata?: Record<string, unknown>;
}

export interface ReferralEntrySubmissionInput {
  providerSlug: string;
  profileSlug: string;
  kind?: ReferralEntryKind | string | null;
  title?: string | null;
  referralUrl?: string | null;
  destinationUrl?: string | null;
  referralCode?: string | null;
  notes?: string | null;
  disclosure?: string | null;
  metadata?: Record<string, unknown>;
  status?: 'active' | 'pending';
}

export interface ResolveReferralOptions {
  kind?: ReferralEntryKind | string | null;
  source?: string | null;
  sessionId?: string | null;
  metadata?: Record<string, unknown>;
}

export interface ClickReferralOptions {
  metadata?: Record<string, unknown>;
}

type ProviderIdentity = {
  id: string;
  slug: string;
  name: string;
  category: string | null;
  subcategory: string | null;
};

type ReferralProfileRow = {
  id: string;
  slug: string;
  display_name: string;
  bio: string | null;
  website: string | null;
  status: 'active' | 'paused';
  created_at: string;
  updated_at?: string;
};

type PublicReferralProfileIndexRow = {
  slug: string;
  created_at: string;
  updated_at: string;
};

type ReferralEntryRow = {
  id: string;
  status: string;
  kind: ReferralEntryKind;
  title: string | null;
  destination_url: string | null;
  referral_code: string | null;
  disclosure: string | null;
  selection_count: number;
  click_count: number;
  created_at: string;
  referral_profiles?:
    | {
        slug: string;
        display_name: string;
        website: string | null;
      }
    | Array<{
        slug: string;
        display_name: string;
        website: string | null;
      }>
    | null;
  providers?:
    | {
        slug: string;
        name: string;
        category: string | null;
        subcategory: string | null;
      }
    | Array<{
        slug: string;
        name: string;
        category: string | null;
        subcategory: string | null;
      }>
    | null;
};

type ReferralResolutionRow = {
  rotation_id: string;
  provider_id: string;
  provider_slug: string;
  provider_name: string;
  entry_id: string;
  profile_id: string;
  profile_slug: string;
  profile_display_name: string;
  kind: ReferralEntryKind;
  title: string | null;
  resolved_url: string | null;
  destination_url: string | null;
  referral_code: string | null;
  disclosure: string | null;
  notes: string | null;
  selection_count: number;
  click_count: number;
  selected_at: string;
};

type ReferralClickRow = {
  rotation_id: string;
  entry_id: string;
  recorded: boolean;
  click_count: number;
  clicked_at: string | null;
};

function getServiceSupabaseClient() {
  return createClient(getSupabaseUrl(), getSupabaseServiceRoleKey(), {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function compact(value: string | null | undefined): string {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asMetadata(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

function normalizeSlug(value: string | null | undefined): string {
  return compact(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function requireSlug(value: string | null | undefined, label: string): string {
  const slug = normalizeSlug(value);
  if (!slug) {
    throw new Error(`${label} is required`);
  }
  return slug;
}

function requireText(value: string | null | undefined, label: string): string {
  const text = compact(value);
  if (!text) {
    throw new Error(`${label} is required`);
  }
  return text;
}

function optionalText(value: string | null | undefined): string | null {
  const text = compact(value);
  return text || null;
}

function optionalUrl(value: string | null | undefined, label: string): string | null {
  const text = optionalText(value);
  if (!text) {
    return null;
  }

  try {
    const url = new URL(text);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      throw new Error();
    }
    return url.toString();
  } catch {
    throw new Error(`${label} must be a valid http or https URL`);
  }
}

function optionalEmail(value: string | null | undefined): string | null {
  const text = optionalText(value);
  if (!text) {
    return null;
  }

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(text)) {
    throw new Error('contactEmail must be a valid email address');
  }

  return text.toLowerCase();
}

function parseReferralKind(value: string | null | undefined): ReferralEntryKind {
  switch (compact(value)) {
    case 'affiliate_link':
    case 'coupon_code':
      return compact(value) as ReferralEntryKind;
    case 'referral_link':
    case '':
      return 'referral_link';
    default:
      throw new Error('kind must be affiliate_link, referral_link, or coupon_code');
  }
}

function toPositiveLimit(value: string | null | undefined, fallback = 50): number {
  const parsed = Number(value ?? fallback);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.min(Math.floor(parsed), 200);
}

async function getProviderIdentity(providerSlug: string): Promise<ProviderIdentity> {
  const supabase = getServiceSupabaseClient();
  const { data, error } = await supabase
    .from('providers')
    .select('id, slug, name, category, subcategory')
    .eq('slug', requireSlug(providerSlug, 'providerSlug'))
    .single();

  if (error) {
    throw new Error(`Provider lookup failed: ${error.message}`);
  }

  return data as ProviderIdentity;
}

async function getProfileIdentity(profileSlug: string): Promise<ReferralProfileRow> {
  const supabase = getServiceSupabaseClient();
  const { data, error } = await supabase
    .from('referral_profiles')
    .select('id, slug, display_name, bio, website, status, created_at')
    .eq('slug', requireSlug(profileSlug, 'profileSlug'))
    .single();

  if (error) {
    throw new Error(`Profile lookup failed: ${error.message}`);
  }

  return data as ReferralProfileRow;
}

function mapProviderEntrySummary(entry: ReferralEntryRow) {
  const profile = Array.isArray(entry.referral_profiles)
    ? entry.referral_profiles[0] ?? null
    : entry.referral_profiles ?? null;

  return {
    id: entry.id,
    kind: entry.kind,
    title: entry.title,
    destinationUrl: entry.destination_url,
    referralCode: entry.referral_code,
    disclosure: entry.disclosure,
    cloudbrokerSelectionCount: entry.selection_count,
    cloudbrokerRedirectCount: entry.click_count,
    createdAt: entry.created_at,
    profile: profile
      ? {
          slug: profile.slug,
          displayName: profile.display_name,
          website: profile.website,
        }
      : null,
  };
}

export function parseLimit(value: string | null | undefined, fallback = 50): number {
  return toPositiveLimit(value, fallback);
}

export async function createReferralProfile(input: ReferralProfileCreateInput) {
  const supabase = getServiceSupabaseClient();
  const payload = {
    slug: requireSlug(input.slug, 'slug'),
    display_name: requireText(input.displayName, 'displayName'),
    bio: optionalText(input.bio),
    website: optionalUrl(input.website, 'website'),
    contact_email: optionalEmail(input.contactEmail),
    status: 'active' as const,
    metadata: asMetadata(input.metadata),
  };

  const { data, error } = await supabase
    .from('referral_profiles')
    .insert(payload)
    .select('id, slug, display_name, bio, website, status, created_at')
    .single();

  if (error) {
    throw new Error(`Profile creation failed: ${error.message}`);
  }

  return {
    id: data.id,
    slug: data.slug,
    displayName: data.display_name,
    bio: data.bio,
    website: data.website,
    status: data.status,
    createdAt: data.created_at,
  };
}

export async function getReferralProfileDirectory(profileSlug: string, limit = 50) {
  const profile = await getProfileIdentity(profileSlug);
  const supabase = getServiceSupabaseClient();
  const { data, error } = await supabase
    .from('referral_entries')
    .select(
      'id, status, kind, title, destination_url, referral_code, disclosure, selection_count, click_count, created_at, providers ( slug, name, category, subcategory )',
    )
    .eq('profile_id', profile.id)
    .eq('status', 'active')
    .order('selection_count', { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Profile referrals lookup failed: ${error.message}`);
  }

  const entries = ((data ?? []) as unknown as ReferralEntryRow[]).map((entry) => {
    const provider = Array.isArray(entry.providers) ? entry.providers[0] ?? null : entry.providers ?? null;

    return {
      id: entry.id,
      kind: entry.kind,
      title: entry.title,
      destinationUrl: entry.destination_url,
      referralCode: entry.referral_code,
      disclosure: entry.disclosure,
      cloudbrokerSelectionCount: entry.selection_count,
      cloudbrokerRedirectCount: entry.click_count,
      createdAt: entry.created_at,
      provider: provider
        ? {
            slug: provider.slug,
            name: provider.name,
            category: provider.category,
            subcategory: provider.subcategory,
          }
        : null,
    };
  });

  return {
    profile: {
      id: profile.id,
      slug: profile.slug,
      displayName: profile.display_name,
      bio: profile.bio,
      website: profile.website,
      status: profile.status,
      createdAt: profile.created_at,
    },
    stats: {
      activeEntries: entries.length,
      providers: new Set(entries.map((entry) => entry.provider?.slug).filter(Boolean)).size,
      totalCloudbrokerSelections: entries.reduce((sum, entry) => sum + entry.cloudbrokerSelectionCount, 0),
      totalCloudbrokerRedirects: entries.reduce((sum, entry) => sum + entry.cloudbrokerRedirectCount, 0),
    },
    entries,
  };
}

export async function listPublicReferralProfiles(limit = 1000) {
  const supabase = getServiceSupabaseClient();
  const rows: PublicReferralProfileIndexRow[] = [];
  const pageSize = 500;
  let page = 0;

  while (rows.length < limit) {
    const from = page * pageSize;
    const to = from + pageSize - 1;
    const { data, error } = await supabase
      .from('referral_profiles')
      .select('slug, created_at, updated_at')
      .eq('status', 'active')
      .order('updated_at', { ascending: false })
      .range(from, to);

    if (error) {
      throw new Error(`Public profile list lookup failed: ${error.message}`);
    }

    const batch = (data ?? []) as PublicReferralProfileIndexRow[];
    rows.push(...batch);

    if (batch.length < pageSize) {
      break;
    }

    page += 1;
  }

  return rows.slice(0, limit).map((row) => ({
    slug: row.slug,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export async function submitReferralEntry(input: ReferralEntrySubmissionInput) {
  const provider = await getProviderIdentity(input.providerSlug);
  const profile = await getProfileIdentity(input.profileSlug);
  const supabase = getServiceSupabaseClient();
  const referralUrl = optionalUrl(input.referralUrl, 'referralUrl');
  const destinationUrl = optionalUrl(input.destinationUrl, 'destinationUrl');
  const referralCode = optionalText(input.referralCode);

  if (!referralUrl && !referralCode) {
    throw new Error('referralUrl or referralCode is required');
  }

  const { data, error } = await supabase
    .from('referral_entries')
    .insert({
      provider_id: provider.id,
      profile_id: profile.id,
      status: input.status === 'pending' ? 'pending' : 'active',
      kind: parseReferralKind(input.kind),
      title: optionalText(input.title),
      referral_url: referralUrl,
      destination_url: destinationUrl,
      referral_code: referralCode,
      notes: optionalText(input.notes),
      disclosure: optionalText(input.disclosure),
      metadata: asMetadata(input.metadata),
    })
    .select('id, status, kind, title, created_at')
    .single();

  if (error) {
    throw new Error(`Referral submission failed: ${error.message}`);
  }

  return {
    id: data.id,
    status: data.status,
    kind: data.kind,
    title: data.title,
    createdAt: data.created_at,
    provider: {
      slug: provider.slug,
      name: provider.name,
    },
    profile: {
      slug: profile.slug,
      displayName: profile.display_name,
    },
  };
}

export async function listProviderReferralDirectory(providerSlug: string, limit = 50) {
  const provider = await getProviderIdentity(providerSlug);
  const supabase = getServiceSupabaseClient();
  const { data, error } = await supabase
    .from('referral_entries')
    .select(
      'id, status, kind, title, destination_url, referral_code, disclosure, selection_count, click_count, created_at, referral_profiles ( slug, display_name, website )',
    )
    .eq('provider_id', provider.id)
    .eq('status', 'active')
    .order('selection_count', { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Provider referrals lookup failed: ${error.message}`);
  }

  const entries = ((data ?? []) as unknown as ReferralEntryRow[]).map(mapProviderEntrySummary);

  return {
    provider,
    stats: {
      activeEntries: entries.length,
      profiles: new Set(entries.map((entry) => entry.profile?.slug).filter(Boolean)).size,
      totalCloudbrokerSelections: entries.reduce((sum, entry) => sum + entry.cloudbrokerSelectionCount, 0),
      totalCloudbrokerRedirects: entries.reduce((sum, entry) => sum + entry.cloudbrokerRedirectCount, 0),
    },
    entries,
  };
}

export async function resolveProviderReferral(
  providerSlug: string,
  options: ResolveReferralOptions = {},
) {
  const supabase = getServiceSupabaseClient();
  const { data, error } = await supabase.rpc('resolve_referral_entry', {
    provider_slug_input: requireSlug(providerSlug, 'providerSlug'),
    requested_kind_input: optionalText(options.kind),
    request_source_input: optionalText(options.source) ?? 'site',
    request_session_id_input: optionalText(options.sessionId),
    request_metadata_input: asMetadata(options.metadata),
  });

  if (error) {
    throw new Error(`Referral resolution failed: ${error.message}`);
  }

  const row = ((data ?? []) as ReferralResolutionRow[])[0];

  if (!row) {
    return null;
  }

  return {
    rotationId: row.rotation_id,
    selectedAt: row.selected_at,
    provider: {
      id: row.provider_id,
      slug: row.provider_slug,
      name: row.provider_name,
    },
    entry: {
      id: row.entry_id,
      kind: row.kind,
      title: row.title,
      resolvedUrl: row.resolved_url,
      destinationUrl: row.destination_url,
      referralCode: row.referral_code,
      disclosure: row.disclosure,
      notes: row.notes,
      cloudbrokerSelectionCount: row.selection_count,
      cloudbrokerRedirectCount: row.click_count,
      profile: {
        id: row.profile_id,
        slug: row.profile_slug,
        displayName: row.profile_display_name,
      },
    },
  };
}

export async function recordReferralClick(rotationId: string, options: ClickReferralOptions = {}) {
  const supabase = getServiceSupabaseClient();
  const { data, error } = await supabase.rpc('record_referral_click', {
    rotation_id_input: requireText(rotationId, 'rotationId'),
    click_metadata_input: asMetadata(options.metadata),
  });

  if (error) {
    throw new Error(`Referral click recording failed: ${error.message}`);
  }

  const row = ((data ?? []) as ReferralClickRow[])[0];

  if (!row) {
    return null;
  }

  return {
    rotationId: row.rotation_id,
    entryId: row.entry_id,
    recorded: row.recorded,
    cloudbrokerRedirectCount: row.click_count,
    cloudbrokerRedirectRecordedAt: row.clicked_at,
  };
}

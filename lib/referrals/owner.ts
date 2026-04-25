import { createClient } from '@supabase/supabase-js';
import {
  getSupabaseServiceRoleKey,
  getSupabaseUrl,
} from '@/lib/supabase/config';

export type MembershipRole = 'owner' | 'editor';
export type MembershipStatus = 'active' | 'pending' | 'rejected';
export type DashboardEntryStatus = 'draft' | 'pending' | 'active' | 'paused' | 'rejected' | 'archived';
export type ReferralEntryKind = 'affiliate_link' | 'referral_link' | 'coupon_code';

export interface ProfileClaimResult {
  profileSlug: string;
  profileName: string;
  role: MembershipRole;
  status: MembershipStatus;
  created: boolean;
}

export interface DashboardMembershipSummary {
  membershipId: string;
  role: MembershipRole;
  status: MembershipStatus;
  profile: {
    id: string;
    slug: string;
    displayName: string;
    bio: string | null;
    website: string | null;
    status: 'active' | 'paused';
    createdAt: string;
  };
  counts: {
    draft: number;
    pending: number;
    active: number;
    paused: number;
    rejected: number;
    archived: number;
  };
}

export interface ClaimTargetSummary {
  profile: {
    id: string;
    slug: string;
    displayName: string;
    bio: string | null;
    website: string | null;
    status: 'active' | 'paused';
    createdAt: string;
  };
  activeOwnerCount: number;
  activeEditorCount: number;
}

export interface ClaimWorkspace {
  target: ClaimTargetSummary;
  membership: {
    membershipId: string;
    role: MembershipRole;
    status: MembershipStatus;
    rejectionReason: string | null;
    respondedAt: string | null;
  } | null;
}

export interface OwnedReferralEntry {
  id: string;
  status: DashboardEntryStatus;
  kind: ReferralEntryKind;
  title: string | null;
  referralUrl: string | null;
  destinationUrl: string | null;
  referralCode: string | null;
  disclosure: string | null;
  reviewNote: string | null;
  cloudbrokerSelectionCount: number;
  cloudbrokerRedirectCount: number;
  createdAt: string;
  submittedAt: string | null;
  reviewedAt: string | null;
  provider: {
    slug: string;
    name: string;
    category: string | null;
    subcategory: string | null;
  };
}

export interface OwnedProfileWorkspace {
  membership: {
    membershipId: string;
    role: MembershipRole;
    status: MembershipStatus;
  };
  profile: {
    id: string;
    slug: string;
    displayName: string;
    bio: string | null;
    website: string | null;
    publicStatus: 'active' | 'paused';
    createdAt: string;
  };
  privateSettings: {
    contactEmail: string | null;
    defaultDisclosure: string | null;
  };
  entries: OwnedReferralEntry[];
  counts: {
    draft: number;
    pending: number;
    active: number;
    paused: number;
    rejected: number;
    archived: number;
  };
}

export interface AccountProfileSeedInput {
  displayName: string;
  email: string;
}

export interface AccountProviderEntryWorkspace {
  entry: {
    id: string;
    status: DashboardEntryStatus;
    kind: ReferralEntryKind;
    title: string | null;
    referralUrl: string | null;
    destinationUrl: string | null;
    referralCode: string | null;
    disclosure: string | null;
    cloudbrokerSelectionCount: number;
    cloudbrokerRedirectCount: number;
    createdAt: string;
    submittedAt: string | null;
    reviewedAt: string | null;
    provider: {
      slug: string;
      name: string;
      category: string | null;
      subcategory: string | null;
    };
    profile: {
      slug: string;
      displayName: string;
    };
  } | null;
  managedProfile: {
    slug: string;
    displayName: string;
  } | null;
}

export interface UpsertAccountProviderEntryResult {
  entryId: string;
  profileSlug: string;
  profileName: string;
  status: DashboardEntryStatus;
  created: boolean;
}

export interface ProfileBasicsInput {
  displayName: string;
  bio?: string | null;
  website?: string | null;
  contactEmail?: string | null;
  defaultDisclosure?: string | null;
}

export interface DraftEntryInput {
  providerSlug: string;
  kind?: ReferralEntryKind | string | null;
  title?: string | null;
  referralUrl?: string | null;
  destinationUrl?: string | null;
  referralCode?: string | null;
  disclosure?: string | null;
}

export interface UpdateOwnedEntryInput extends DraftEntryInput {
  status?: DashboardEntryStatus | null;
  reviewNote?: string | null;
}

type MembershipRow = {
  id: string;
  role: MembershipRole;
  status: MembershipStatus;
  created_at: string;
  referral_profiles:
    | {
        id: string;
        slug: string;
        display_name: string;
        bio: string | null;
        website: string | null;
        status: 'active' | 'paused';
        created_at: string;
      }
    | Array<{
        id: string;
        slug: string;
        display_name: string;
        bio: string | null;
        website: string | null;
        status: 'active' | 'paused';
        created_at: string;
      }>
    | null;
};

type ProviderIdentity = {
  id: string;
  slug: string;
  name: string;
  category: string | null;
  subcategory: string | null;
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

function optionalUrl(value: string | null | undefined, label: string): string | null {
  const text = optionalText(value);
  if (!text) {
    return null;
  }

  try {
    const url = new URL(text);
    if (!['http:', 'https:'].includes(url.protocol)) {
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

function fallbackNameFromEmail(email: string) {
  const localPart = email.split('@')[0]?.trim();
  return localPart || 'Member';
}

function buildManagedProfileSlug(accountId: string, input: AccountProfileSeedInput) {
  const base =
    normalizeSlug(input.displayName) || normalizeSlug(fallbackNameFromEmail(input.email)) || 'member';

  return `${base}-${requireText(accountId, 'accountId').replace(/-/g, '').slice(0, 8)}`;
}

function buildManagedProfileName(input: AccountProfileSeedInput) {
  return compact(input.displayName) || fallbackNameFromEmail(input.email);
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

function parseOwnedEntryStatus(value: string | null | undefined, fallback: DashboardEntryStatus): DashboardEntryStatus {
  switch (compact(value)) {
    case 'draft':
    case 'active':
    case 'paused':
    case 'rejected':
    case 'archived':
      return compact(value) as DashboardEntryStatus;
    case '':
      return fallback;
    default:
      throw new Error('status must be draft, active, paused, rejected, or archived');
  }
}

function emptyCounts() {
  return {
    draft: 0,
    pending: 0,
    active: 0,
    paused: 0,
    rejected: 0,
    archived: 0,
  };
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

async function getProfileBySlug(profileSlug: string) {
  const supabase = getServiceSupabaseClient();
  const { data, error } = await supabase
    .from('referral_profiles')
    .select('id, slug, display_name, bio, website, status, created_at')
    .eq('slug', requireSlug(profileSlug, 'profileSlug'))
    .single();

  if (error) {
    throw new Error(`Profile lookup failed: ${error.message}`);
  }

  return data as {
    id: string;
    slug: string;
    display_name: string;
    bio: string | null;
    website: string | null;
    status: 'active' | 'paused';
    created_at: string;
  };
}

async function getMembershipForAccount(accountId: string, profileId: string) {
  const supabase = getServiceSupabaseClient();
  const { data, error } = await supabase
    .from('profile_memberships')
    .select('id, role, status, profile_id, account_id')
    .eq('account_id', requireText(accountId, 'accountId'))
    .eq('profile_id', profileId)
    .maybeSingle();

  if (error) {
    throw new Error(`Membership lookup failed: ${error.message}`);
  }

  return data as
    | {
        id: string;
        role: MembershipRole;
        status: MembershipStatus;
        profile_id: string;
        account_id: string;
      }
    | null;
}

async function requireActiveMembership(accountId: string, profileSlug: string) {
  const profile = await getProfileBySlug(profileSlug);
  const membership = await getMembershipForAccount(accountId, profile.id);

  if (!membership || membership.status !== 'active') {
    throw new Error('You do not have active access to this referral profile');
  }

  return {
    profile,
    membership,
  };
}

async function listActiveProfileIdsForAccount(accountId: string) {
  const supabase = getServiceSupabaseClient();
  const { data, error } = await supabase
    .from('profile_memberships')
    .select('profile_id')
    .eq('account_id', requireText(accountId, 'accountId'))
    .eq('status', 'active');

  if (error) {
    throw new Error(`Account profile lookup failed: ${error.message}`);
  }

  return ((data ?? []) as Array<{ profile_id: string }>)
    .map((row) => row.profile_id)
    .filter(Boolean);
}

async function assertSingleProviderCodeForAccount(
  accountId: string,
  providerId: string,
  excludeEntryId?: string | null,
) {
  const profileIds = await listActiveProfileIdsForAccount(accountId);

  if (profileIds.length === 0) {
    return;
  }

  const supabase = getServiceSupabaseClient();
  let query = supabase
    .from('referral_entries')
    .select('id')
    .eq('provider_id', requireText(providerId, 'providerId'))
    .in('profile_id', profileIds)
    .neq('status', 'archived')
    .limit(1);

  if (excludeEntryId) {
    query = query.neq('id', excludeEntryId);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Duplicate code check failed: ${error.message}`);
  }

  if ((data ?? []).length > 0) {
    throw new Error('You already have a code for this provider. Edit the existing code instead.');
  }
}

async function getOrCreateManagedProfileForAccount(accountId: string, input: AccountProfileSeedInput) {
  const memberships = await listAccountProfileMemberships(accountId);
  const activeMembership =
    memberships.find((membership) => membership.status === 'active' && membership.role === 'owner') ||
    memberships.find((membership) => membership.status === 'active');

  if (activeMembership) {
    return {
      profileId: activeMembership.profile.id,
      profileSlug: activeMembership.profile.slug,
      profileName: activeMembership.profile.displayName,
      created: false,
    };
  }

  const supabase = getServiceSupabaseClient();
  const profileSlug = buildManagedProfileSlug(accountId, input);
  const profileName = buildManagedProfileName(input);

  const { data: existingProfile, error: existingProfileError } = await supabase
    .from('referral_profiles')
    .select('id, slug, display_name')
    .eq('slug', profileSlug)
    .maybeSingle();

  if (existingProfileError) {
    throw new Error(`Managed profile lookup failed: ${existingProfileError.message}`);
  }

  let profileId = existingProfile?.id || null;

  if (!profileId) {
    const { data: insertedProfile, error: insertedProfileError } = await supabase
      .from('referral_profiles')
      .insert({
        slug: profileSlug,
        display_name: profileName,
        bio: null,
        website: null,
        status: 'active',
      })
      .select('id, slug, display_name')
      .single();

    if (insertedProfileError) {
      throw new Error(`Managed profile creation failed: ${insertedProfileError.message}`);
    }

    profileId = insertedProfile.id;
  }

  const existingMembership = await getMembershipForAccount(accountId, profileId);

  if (existingMembership) {
    if (existingMembership.status !== 'active') {
      const { error: membershipUpdateError } = await supabase
        .from('profile_memberships')
        .update({
          status: 'active',
          responded_at: new Date().toISOString(),
          rejection_reason: null,
        })
        .eq('id', existingMembership.id);

      if (membershipUpdateError) {
        throw new Error(`Managed profile activation failed: ${membershipUpdateError.message}`);
      }
    }
  } else {
    const { error: membershipInsertError } = await supabase.from('profile_memberships').insert({
      profile_id: profileId,
      account_id: requireText(accountId, 'accountId'),
      role: 'owner',
      status: 'active',
      responded_at: new Date().toISOString(),
    });

    if (membershipInsertError) {
      throw new Error(`Managed profile membership failed: ${membershipInsertError.message}`);
    }
  }

  const { error: privateSettingsError } = await supabase.from('referral_profile_private').upsert({
    profile_id: profileId,
    contact_email: optionalEmail(input.email),
  });

  if (privateSettingsError) {
    throw new Error(`Managed profile private settings failed: ${privateSettingsError.message}`);
  }

  return {
    profileId,
    profileSlug,
    profileName,
    created: !existingProfile,
  };
}

export async function listAccountProfileMemberships(accountId: string): Promise<DashboardMembershipSummary[]> {
  const supabase = getServiceSupabaseClient();
  const { data, error } = await supabase
    .from('profile_memberships')
    .select(
      'id, role, status, created_at, referral_profiles ( id, slug, display_name, bio, website, status, created_at )',
    )
    .eq('account_id', requireText(accountId, 'accountId'))
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Dashboard membership lookup failed: ${error.message}`);
  }

  const rows = ((data ?? []) as MembershipRow[]).map((row) => {
    const profile = Array.isArray(row.referral_profiles)
      ? row.referral_profiles[0] ?? null
      : row.referral_profiles ?? null;

    if (!profile) {
      return null;
    }

    return {
      membershipId: row.id,
      role: row.role,
      status: row.status,
      profile: {
        id: profile.id,
        slug: profile.slug,
        displayName: profile.display_name,
        bio: profile.bio,
        website: profile.website,
        status: profile.status,
        createdAt: profile.created_at,
      },
      counts: emptyCounts(),
    };
  }).filter((row): row is DashboardMembershipSummary => Boolean(row));

  if (rows.length === 0) {
    return [];
  }

  const profileIds = rows.map((row) => row.profile.id);
  const { data: entries, error: entriesError } = await supabase
    .from('referral_entries')
    .select('profile_id, status')
    .in('profile_id', profileIds);

  if (entriesError) {
    throw new Error(`Dashboard entry counts failed: ${entriesError.message}`);
  }

  const countsByProfile = new Map<string, ReturnType<typeof emptyCounts>>();

  rows.forEach((row) => countsByProfile.set(row.profile.id, emptyCounts()));

  ((entries ?? []) as Array<{ profile_id: string; status: DashboardEntryStatus }>).forEach((entry) => {
    const counts = countsByProfile.get(entry.profile_id);
    if (!counts) return;
    if (entry.status in counts) {
      counts[entry.status as keyof typeof counts] += 1;
    }
  });

  return rows.map((row) => ({
    ...row,
    counts: countsByProfile.get(row.profile.id) ?? emptyCounts(),
  }));
}

export async function getClaimTarget(profileSlug: string): Promise<ClaimTargetSummary> {
  const profile = await getProfileBySlug(profileSlug);
  const supabase = getServiceSupabaseClient();
  const { data, error } = await supabase
    .from('profile_memberships')
    .select('role, status')
    .eq('profile_id', profile.id)
    .eq('status', 'active');

  if (error) {
    throw new Error(`Claim target lookup failed: ${error.message}`);
  }

  const activeRows = (data ?? []) as Array<{ role: MembershipRole; status: MembershipStatus }>;

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
    activeOwnerCount: activeRows.filter((row) => row.role === 'owner').length,
    activeEditorCount: activeRows.filter((row) => row.role === 'editor').length,
  };
}

export async function getClaimWorkspace(accountId: string, profileSlug: string): Promise<ClaimWorkspace> {
  const target = await getClaimTarget(profileSlug);
  const supabase = getServiceSupabaseClient();
  const { data, error } = await supabase
    .from('profile_memberships')
    .select('id, role, status, rejection_reason, responded_at')
    .eq('account_id', requireText(accountId, 'accountId'))
    .eq('profile_id', target.profile.id)
    .maybeSingle();

  if (error) {
    throw new Error(`Claim workspace lookup failed: ${error.message}`);
  }

  return {
    target,
    membership: data
      ? {
          membershipId: data.id,
          role: data.role,
          status: data.status,
          rejectionReason: data.rejection_reason,
          respondedAt: data.responded_at,
        }
      : null,
  };
}

export async function requestProfileClaim(accountId: string, profileSlug: string): Promise<ProfileClaimResult> {
  const profile = await getProfileBySlug(profileSlug);
  const supabase = getServiceSupabaseClient();
  const existing = await getMembershipForAccount(accountId, profile.id);

  const { count, error: countError } = await supabase
    .from('profile_memberships')
    .select('id', { count: 'exact', head: true })
    .eq('profile_id', profile.id)
    .eq('role', 'owner')
    .eq('status', 'active');

  if (countError) {
    throw new Error(`Claim status check failed: ${countError.message}`);
  }

  if (existing) {
    if (existing.status === 'pending' && (count ?? 0) === 0) {
      const { data, error } = await supabase
        .from('profile_memberships')
        .update({
          status: 'active',
          responded_at: new Date().toISOString(),
          rejection_reason: null,
        })
        .eq('id', existing.id)
        .select('role, status')
        .single();

      if (error) {
        throw new Error(`Profile claim activation failed: ${error.message}`);
      }

      return {
        profileSlug: profile.slug,
        profileName: profile.display_name,
        role: data.role,
        status: data.status,
        created: false,
      };
    }

    return {
      profileSlug: profile.slug,
      profileName: profile.display_name,
      role: existing.role,
      status: existing.status,
      created: false,
    };
  }

  if ((count ?? 0) > 0) {
    throw new Error('This profile is already claimed. For now, only one account can manage a profile.');
  }

  const { data, error } = await supabase
    .from('profile_memberships')
    .insert({
      profile_id: profile.id,
      account_id: requireText(accountId, 'accountId'),
      role: 'owner',
      status: 'active',
      responded_at: new Date().toISOString(),
    })
    .select('role, status')
    .single();

  if (error) {
    throw new Error(`Profile claim failed: ${error.message}`);
  }

  return {
    profileSlug: profile.slug,
    profileName: profile.display_name,
    role: data.role,
    status: data.status,
    created: true,
  };
}

export async function getOwnedProfileWorkspace(accountId: string, profileSlug: string): Promise<OwnedProfileWorkspace> {
  const { profile, membership } = await requireActiveMembership(accountId, profileSlug);
  const supabase = getServiceSupabaseClient();

  const [{ data: privateSettings, error: privateError }, { data: entries, error: entriesError }] = await Promise.all([
    supabase
      .from('referral_profile_private')
      .select('contact_email, default_disclosure')
      .eq('profile_id', profile.id)
      .maybeSingle(),
    supabase
      .from('referral_entries')
      .select(
        'id, status, kind, title, referral_url, destination_url, referral_code, disclosure, review_note, selection_count, click_count, created_at, submitted_at, reviewed_at, providers ( slug, name, category, subcategory )',
      )
      .eq('profile_id', profile.id)
      .order('created_at', { ascending: false }),
  ]);

  if (privateError) {
    throw new Error(`Private profile lookup failed: ${privateError.message}`);
  }

  if (entriesError) {
    throw new Error(`Owned entry lookup failed: ${entriesError.message}`);
  }

  const counts = emptyCounts();
  const mappedEntries = ((entries ?? []) as Array<{
    id: string;
    status: DashboardEntryStatus;
    kind: ReferralEntryKind;
    title: string | null;
    referral_url: string | null;
    destination_url: string | null;
    referral_code: string | null;
    disclosure: string | null;
    review_note: string | null;
    selection_count: number;
    click_count: number;
    created_at: string;
    submitted_at: string | null;
    reviewed_at: string | null;
    providers:
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
  }>).map((entry) => {
    counts[entry.status] += 1;
    const provider = Array.isArray(entry.providers) ? entry.providers[0] ?? null : entry.providers ?? null;

    if (!provider) {
      throw new Error('Owned entry is missing its provider relation');
    }

    return {
      id: entry.id,
      status: entry.status,
      kind: entry.kind,
      title: entry.title,
      referralUrl: entry.referral_url,
      destinationUrl: entry.destination_url,
      referralCode: entry.referral_code,
      disclosure: entry.disclosure,
      reviewNote: entry.review_note,
      cloudbrokerSelectionCount: entry.selection_count,
      cloudbrokerRedirectCount: entry.click_count,
      createdAt: entry.created_at,
      submittedAt: entry.submitted_at,
      reviewedAt: entry.reviewed_at,
      provider,
    };
  });

  return {
    membership: {
      membershipId: membership.id,
      role: membership.role,
      status: membership.status,
    },
    profile: {
      id: profile.id,
      slug: profile.slug,
      displayName: profile.display_name,
      bio: profile.bio,
      website: profile.website,
      publicStatus: profile.status,
      createdAt: profile.created_at,
    },
    privateSettings: {
      contactEmail: privateSettings?.contact_email ?? null,
      defaultDisclosure: privateSettings?.default_disclosure ?? null,
    },
    entries: mappedEntries,
    counts,
  };
}

export async function getAccountProviderEntry(
  accountId: string,
  providerSlug: string,
): Promise<AccountProviderEntryWorkspace> {
  const memberships = await listAccountProfileMemberships(accountId);
  const activeMemberships = memberships.filter((membership) => membership.status === 'active');
  const managedProfile =
    activeMemberships[0]
      ? {
          slug: activeMemberships[0].profile.slug,
          displayName: activeMemberships[0].profile.displayName,
        }
      : null;

  if (activeMemberships.length === 0) {
    return {
      entry: null,
      managedProfile,
    };
  }

  const provider = await getProviderIdentity(providerSlug);
  const profileIds = activeMemberships.map((membership) => membership.profile.id);
  const supabase = getServiceSupabaseClient();
  const { data, error } = await supabase
    .from('referral_entries')
    .select(
      'id, status, kind, title, referral_url, destination_url, referral_code, disclosure, selection_count, click_count, created_at, submitted_at, reviewed_at, providers ( slug, name, category, subcategory ), referral_profiles ( slug, display_name )',
    )
    .eq('provider_id', provider.id)
    .in('profile_id', profileIds)
    .neq('status', 'archived')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Account provider entry lookup failed: ${error.message}`);
  }

  if (!data) {
    return {
      entry: null,
      managedProfile,
    };
  }

  const providerRow = Array.isArray(data.providers) ? data.providers[0] ?? null : data.providers ?? null;
  const profileRow =
    Array.isArray(data.referral_profiles) ? data.referral_profiles[0] ?? null : data.referral_profiles ?? null;

  if (!providerRow || !profileRow) {
    throw new Error('Account provider entry is missing a required relation');
  }

  return {
    entry: {
      id: data.id,
      status: data.status,
      kind: data.kind,
      title: data.title,
      referralUrl: data.referral_url,
      destinationUrl: data.destination_url,
      referralCode: data.referral_code,
      disclosure: data.disclosure,
      cloudbrokerSelectionCount: data.selection_count,
      cloudbrokerRedirectCount: data.click_count,
      createdAt: data.created_at,
      submittedAt: data.submitted_at,
      reviewedAt: data.reviewed_at,
      provider: providerRow,
      profile: {
        slug: profileRow.slug,
        displayName: profileRow.display_name,
      },
    },
    managedProfile: {
      slug: profileRow.slug,
      displayName: profileRow.display_name,
    },
  };
}

export async function updateOwnedProfileBasics(accountId: string, profileSlug: string, input: ProfileBasicsInput) {
  const { profile } = await requireActiveMembership(accountId, profileSlug);
  const supabase = getServiceSupabaseClient();

  const { error: profileError } = await supabase
    .from('referral_profiles')
    .update({
      display_name: requireText(input.displayName, 'displayName'),
      bio: optionalText(input.bio),
      website: optionalUrl(input.website, 'website'),
    })
    .eq('id', profile.id);

  if (profileError) {
    throw new Error(`Profile update failed: ${profileError.message}`);
  }

  const { error: privateError } = await supabase
    .from('referral_profile_private')
    .upsert({
      profile_id: profile.id,
      contact_email: optionalEmail(input.contactEmail),
      default_disclosure: optionalText(input.defaultDisclosure),
    });

  if (privateError) {
    throw new Error(`Private profile update failed: ${privateError.message}`);
  }
}

export async function createOwnedDraftEntry(accountId: string, profileSlug: string, input: DraftEntryInput) {
  const { profile } = await requireActiveMembership(accountId, profileSlug);
  const provider = await getProviderIdentity(input.providerSlug);
  const supabase = getServiceSupabaseClient();
  const referralUrl = optionalUrl(input.referralUrl, 'referralUrl');
  const destinationUrl = optionalUrl(input.destinationUrl, 'destinationUrl');
  const referralCode = optionalText(input.referralCode);

  if (!referralUrl && !referralCode) {
    throw new Error('referralUrl or referralCode is required');
  }

  await assertSingleProviderCodeForAccount(accountId, provider.id);

  const { data, error } = await supabase
    .from('referral_entries')
    .insert({
      provider_id: provider.id,
      profile_id: profile.id,
      status: 'draft',
      kind: parseReferralKind(input.kind),
      title: optionalText(input.title),
      referral_url: referralUrl,
      destination_url: destinationUrl,
      referral_code: referralCode,
      disclosure: optionalText(input.disclosure),
    })
    .select('id')
    .single();

  if (error) {
    throw new Error(`Draft entry creation failed: ${error.message}`);
  }

  return data.id as string;
}

export async function getOwnedEntry(accountId: string, profileSlug: string, entryId: string) {
  const { profile } = await requireActiveMembership(accountId, profileSlug);
  const supabase = getServiceSupabaseClient();
  const { data, error } = await supabase
    .from('referral_entries')
    .select(
      'id, status, kind, title, referral_url, destination_url, referral_code, disclosure, review_note, selection_count, click_count, created_at, submitted_at, reviewed_at, providers ( slug, name, category, subcategory )',
    )
    .eq('id', requireText(entryId, 'entryId'))
    .eq('profile_id', profile.id)
    .single();

  if (error) {
    throw new Error(`Owned entry lookup failed: ${error.message}`);
  }

  const row = data as {
    id: string;
    status: DashboardEntryStatus;
    kind: ReferralEntryKind;
    title: string | null;
    referral_url: string | null;
    destination_url: string | null;
    referral_code: string | null;
    disclosure: string | null;
    review_note: string | null;
    selection_count: number;
    click_count: number;
    created_at: string;
    submitted_at: string | null;
    reviewed_at: string | null;
    providers:
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
  const provider = Array.isArray(row.providers) ? row.providers[0] ?? null : row.providers ?? null;

  if (!provider) {
    throw new Error('Owned entry is missing its provider relation');
  }

  return {
    id: row.id,
    status: row.status,
    kind: row.kind,
    title: row.title,
    referralUrl: row.referral_url,
    destinationUrl: row.destination_url,
    referralCode: row.referral_code,
    disclosure: row.disclosure,
    reviewNote: row.review_note,
    cloudbrokerSelectionCount: row.selection_count,
    cloudbrokerRedirectCount: row.click_count,
    createdAt: row.created_at,
    submittedAt: row.submitted_at,
    reviewedAt: row.reviewed_at,
    provider,
    profile: {
      slug: profile.slug,
      displayName: profile.display_name,
    },
  };
}

export async function updateOwnedEntry(
  accountId: string,
  profileSlug: string,
  entryId: string,
  input: UpdateOwnedEntryInput,
) {
  const { profile } = await requireActiveMembership(accountId, profileSlug);
  const currentEntry = await getOwnedEntry(accountId, profileSlug, entryId);
  const provider =
    input.providerSlug && input.providerSlug !== currentEntry.provider.slug
      ? await getProviderIdentity(input.providerSlug)
      : null;
  const supabase = getServiceSupabaseClient();
  const status = parseOwnedEntryStatus(input.status, currentEntry.status);
  const referralUrl = optionalUrl(
    input.referralUrl === undefined ? currentEntry.referralUrl : input.referralUrl,
    'referralUrl',
  );
  const destinationUrl = optionalUrl(
    input.destinationUrl === undefined ? currentEntry.destinationUrl : input.destinationUrl,
    'destinationUrl',
  );
  const referralCode = optionalText(
    input.referralCode === undefined ? currentEntry.referralCode : input.referralCode,
  );

  if (!referralUrl && !referralCode) {
    throw new Error('referralUrl or referralCode is required');
  }

  const now = new Date().toISOString();
  if (status !== 'archived') {
    const targetProviderId = provider?.id ?? (await getProviderIdentity(currentEntry.provider.slug)).id;
    await assertSingleProviderCodeForAccount(accountId, targetProviderId, currentEntry.id);
  }

  const payload = {
    status,
    kind: parseReferralKind(input.kind ?? currentEntry.kind),
    title: optionalText(input.title === undefined ? currentEntry.title : input.title),
    referral_url: referralUrl,
    destination_url: destinationUrl,
    referral_code: referralCode,
    disclosure: optionalText(input.disclosure === undefined ? currentEntry.disclosure : input.disclosure),
    review_note: optionalText(input.reviewNote === undefined ? currentEntry.reviewNote : input.reviewNote),
    submitted_at: status === 'active' ? currentEntry.submittedAt ?? now : null,
  } as Record<string, unknown>;

  if (provider) {
    payload.provider_id = provider.id;
  }

  const { error } = await supabase
    .from('referral_entries')
    .update(payload)
    .eq('id', requireText(entryId, 'entryId'))
    .eq('profile_id', profile.id);

  if (error) {
    throw new Error(`Owned entry update failed: ${error.message}`);
  }
}

export async function upsertAccountProviderEntry(
  accountId: string,
  profileInput: AccountProfileSeedInput,
  providerSlug: string,
  input: Omit<UpdateOwnedEntryInput, 'providerSlug'>,
): Promise<UpsertAccountProviderEntryResult> {
  const existingWorkspace = await getAccountProviderEntry(accountId, providerSlug);
  const targetStatus = parseOwnedEntryStatus(input.status, existingWorkspace.entry?.status ?? 'draft');

  if (existingWorkspace.entry) {
    await updateOwnedEntry(accountId, existingWorkspace.entry.profile.slug, existingWorkspace.entry.id, {
      ...input,
      providerSlug,
      status: targetStatus,
    });

    return {
      entryId: existingWorkspace.entry.id,
      profileSlug: existingWorkspace.entry.profile.slug,
      profileName: existingWorkspace.entry.profile.displayName,
      status: targetStatus,
      created: false,
    };
  }

  const managedProfile = await getOrCreateManagedProfileForAccount(accountId, profileInput);
  const entryId = await createOwnedDraftEntry(accountId, managedProfile.profileSlug, {
    ...input,
    providerSlug,
  });

  if (targetStatus !== 'draft') {
    await updateOwnedEntry(accountId, managedProfile.profileSlug, entryId, {
      ...input,
      providerSlug,
      status: targetStatus,
    });
  }

  return {
    entryId,
    profileSlug: managedProfile.profileSlug,
    profileName: managedProfile.profileName,
    status: targetStatus,
    created: true,
  };
}

import { createClient } from '@supabase/supabase-js';
import {
  getSupabaseServiceRoleKey,
  getSupabaseUrl,
} from '@/lib/supabase/config';
import type { DashboardEntryStatus, MembershipRole, MembershipStatus, ReferralEntryKind } from './owner';

type ReviewerTargetStatus = Extract<DashboardEntryStatus, 'active' | 'rejected' | 'paused'>;

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

function normalizeComparableValue(value: string | null | undefined) {
  return compact(value).toLowerCase();
}

function parseReviewerTargetStatus(value: string | null | undefined): ReviewerTargetStatus {
  switch (compact(value)) {
    case 'active':
    case 'rejected':
    case 'paused':
      return compact(value) as ReviewerTargetStatus;
    default:
      throw new Error('targetStatus must be active, rejected, or paused');
  }
}

export interface ModerationSummary {
  pendingClaims: number;
  pendingEntries: number;
  liveEntries: number;
}

export interface ClaimQueueItem {
  membershipId: string;
  role: MembershipRole;
  status: MembershipStatus;
  createdAt: string;
  respondedAt: string | null;
  claimNote: string | null;
  rejectionReason: string | null;
  profile: {
    id: string;
    slug: string;
    displayName: string;
  };
  requester: {
    id: string;
    displayName: string;
    email: string;
  };
  activeOwnerCount: number;
}

export interface DuplicateEntryMatch {
  id: string;
  status: DashboardEntryStatus;
  profile: {
    slug: string;
    displayName: string;
  };
}

export interface EntryQueueItem {
  entryId: string;
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
  owner: {
    id: string;
    displayName: string;
    email: string;
  } | null;
  profile: {
    id: string;
    slug: string;
    displayName: string;
  };
  provider: {
    id: string;
    slug: string;
    name: string;
  };
  duplicates: {
    active: DuplicateEntryMatch[];
    pending: DuplicateEntryMatch[];
    paused: DuplicateEntryMatch[];
  };
}

export interface ModerationWorkspace {
  summary: ModerationSummary;
  pendingClaims: ClaimQueueItem[];
  pendingEntries: EntryQueueItem[];
  liveEntries: EntryQueueItem[];
}

type ClaimRow = {
  id: string;
  role: MembershipRole;
  status: MembershipStatus;
  created_at: string;
  responded_at: string | null;
  claim_note: string | null;
  rejection_reason: string | null;
  profile_id: string;
  account_id: string;
  referral_profiles:
    | {
        id: string;
        slug: string;
        display_name: string;
      }
    | Array<{
        id: string;
        slug: string;
        display_name: string;
      }>
    | null;
  account_profiles:
    | {
        id: string;
        display_name: string | null;
        email: string;
      }
    | Array<{
        id: string;
        display_name: string | null;
        email: string;
      }>
    | null;
};

type EntryRow = {
  id: string;
  profile_id: string;
  provider_id: string;
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
        id: string;
        slug: string;
        name: string;
      }
    | Array<{
        id: string;
        slug: string;
        name: string;
      }>
    | null;
  referral_profiles:
    | {
        id: string;
        slug: string;
        display_name: string;
      }
    | Array<{
        id: string;
        slug: string;
        display_name: string;
      }>
    | null;
};

function firstRelation<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

async function listDuplicateCandidates(providerIds: string[]) {
  const supabase = getServiceSupabaseClient();
  const { data, error } = await supabase
    .from('referral_entries')
    .select(
      'id, profile_id, provider_id, status, referral_url, referral_code, referral_profiles ( id, slug, display_name )',
    )
    .in('provider_id', providerIds)
    .in('status', ['pending', 'active', 'paused']);

  if (error) {
    throw new Error(`Duplicate lookup failed: ${error.message}`);
  }

  return (data ?? []) as Array<{
    id: string;
    profile_id: string;
    provider_id: string;
    status: DashboardEntryStatus;
    referral_url: string | null;
    referral_code: string | null;
    referral_profiles:
      | {
          id: string;
          slug: string;
          display_name: string;
        }
      | Array<{
          id: string;
          slug: string;
          display_name: string;
        }>
      | null;
  }>;
}

async function buildEntryQueueItems(rows: EntryRow[]): Promise<EntryQueueItem[]> {
  if (rows.length === 0) {
    return [];
  }

  const profileIds = Array.from(new Set(rows.map((row) => row.profile_id)));
  const providerIds = Array.from(new Set(rows.map((row) => row.provider_id)));
  const candidateRows = await listDuplicateCandidates(providerIds);
  const supabase = getServiceSupabaseClient();
  const { data: owners, error: ownerError } = await supabase
    .from('profile_memberships')
    .select('profile_id, account_id, account_profiles ( id, display_name, email )')
    .in('profile_id', profileIds)
    .eq('role', 'owner')
    .eq('status', 'active');

  if (ownerError) {
    throw new Error(`Owner lookup failed: ${ownerError.message}`);
  }

  const ownerByProfile = new Map<
    string,
    {
      id: string;
      displayName: string;
      email: string;
    }
  >();

  ((owners ?? []) as Array<{
    profile_id: string;
    account_id: string;
    account_profiles:
      | {
          id: string;
          display_name: string | null;
          email: string;
        }
      | Array<{
          id: string;
          display_name: string | null;
          email: string;
        }>
      | null;
  }>).forEach((row) => {
    const owner = firstRelation(row.account_profiles);
    if (!owner || ownerByProfile.has(row.profile_id)) {
      return;
    }

    ownerByProfile.set(row.profile_id, {
      id: owner.id,
      displayName: owner.display_name || owner.email.split('@')[0] || 'operator',
      email: owner.email,
    });
  });

  return rows.map((row) => {
    const provider = firstRelation(row.providers);
    const profile = firstRelation(row.referral_profiles);

    if (!provider || !profile) {
      throw new Error('Moderation queue entry is missing required relations');
    }

    const referralUrl = normalizeComparableValue(row.referral_url);
    const referralCode = normalizeComparableValue(row.referral_code);
    const duplicates: EntryQueueItem['duplicates'] = {
      active: [],
      pending: [],
      paused: [],
    };

    candidateRows.forEach((candidate) => {
      if (candidate.id === row.id || candidate.provider_id !== row.provider_id) {
        return;
      }

      const urlMatches = referralUrl && normalizeComparableValue(candidate.referral_url) === referralUrl;
      const codeMatches = referralCode && normalizeComparableValue(candidate.referral_code) === referralCode;

      if (!urlMatches && !codeMatches) {
        return;
      }

      const candidateProfile = firstRelation(candidate.referral_profiles);
      if (!candidateProfile) {
        return;
      }

      const target = {
        id: candidate.id,
        status: candidate.status,
        profile: {
          slug: candidateProfile.slug,
          displayName: candidateProfile.display_name,
        },
      };

      if (candidate.status === 'active') {
        duplicates.active.push(target);
      } else if (candidate.status === 'pending') {
        duplicates.pending.push(target);
      } else if (candidate.status === 'paused') {
        duplicates.paused.push(target);
      }
    });

    return {
      entryId: row.id,
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
      owner: ownerByProfile.get(row.profile_id) ?? null,
      profile: {
        id: profile.id,
        slug: profile.slug,
        displayName: profile.display_name,
      },
      provider: {
        id: provider.id,
        slug: provider.slug,
        name: provider.name,
      },
      duplicates,
    };
  });
}

export async function getModerationSummary(): Promise<ModerationSummary> {
  const supabase = getServiceSupabaseClient();
  const [{ count: pendingClaims, error: claimsError }, { count: pendingEntries, error: entriesError }, { count: liveEntries, error: liveError }] =
    await Promise.all([
      supabase.from('profile_memberships').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('referral_entries').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('referral_entries').select('id', { count: 'exact', head: true }).eq('status', 'active'),
    ]);

  if (claimsError) {
    throw new Error(`Pending claims count failed: ${claimsError.message}`);
  }
  if (entriesError) {
    throw new Error(`Pending entries count failed: ${entriesError.message}`);
  }
  if (liveError) {
    throw new Error(`Live entries count failed: ${liveError.message}`);
  }

  return {
    pendingClaims: pendingClaims ?? 0,
    pendingEntries: pendingEntries ?? 0,
    liveEntries: liveEntries ?? 0,
  };
}

export async function getModerationWorkspace(): Promise<ModerationWorkspace> {
  const supabase = getServiceSupabaseClient();
  const [summary, claimsResult, pendingEntriesResult, liveEntriesResult] = await Promise.all([
    getModerationSummary(),
    supabase
      .from('profile_memberships')
      .select(
        'id, role, status, created_at, responded_at, claim_note, rejection_reason, profile_id, account_id, referral_profiles ( id, slug, display_name ), account_profiles ( id, display_name, email )',
      )
      .eq('status', 'pending')
      .order('created_at', { ascending: true }),
    supabase
      .from('referral_entries')
      .select(
        'id, profile_id, provider_id, status, kind, title, referral_url, destination_url, referral_code, disclosure, review_note, selection_count, click_count, created_at, submitted_at, reviewed_at, providers ( id, slug, name ), referral_profiles ( id, slug, display_name )',
      )
      .eq('status', 'pending')
      .order('submitted_at', { ascending: true, nullsFirst: false }),
    supabase
      .from('referral_entries')
      .select(
        'id, profile_id, provider_id, status, kind, title, referral_url, destination_url, referral_code, disclosure, review_note, selection_count, click_count, created_at, submitted_at, reviewed_at, providers ( id, slug, name ), referral_profiles ( id, slug, display_name )',
      )
      .eq('status', 'active')
      .order('reviewed_at', { ascending: false, nullsFirst: false })
      .limit(25),
  ]);

  if (claimsResult.error) {
    throw new Error(`Claim queue lookup failed: ${claimsResult.error.message}`);
  }
  if (pendingEntriesResult.error) {
    throw new Error(`Pending entry queue lookup failed: ${pendingEntriesResult.error.message}`);
  }
  if (liveEntriesResult.error) {
    throw new Error(`Active entry moderation lookup failed: ${liveEntriesResult.error.message}`);
  }

  const claimRows = (claimsResult.data ?? []) as ClaimRow[];
  const pendingClaims = await Promise.all(
    claimRows.map(async (row) => {
      const profile = firstRelation(row.referral_profiles);
      const requester = firstRelation(row.account_profiles);

      if (!profile || !requester) {
        throw new Error('Claim queue item is missing required relations');
      }

      const { count, error } = await supabase
        .from('profile_memberships')
        .select('id', { count: 'exact', head: true })
        .eq('profile_id', row.profile_id)
        .eq('role', 'owner')
        .eq('status', 'active');

      if (error) {
        throw new Error(`Active owner count failed: ${error.message}`);
      }

      return {
        membershipId: row.id,
        role: row.role,
        status: row.status,
        createdAt: row.created_at,
        respondedAt: row.responded_at,
        claimNote: row.claim_note,
        rejectionReason: row.rejection_reason,
        profile: {
          id: profile.id,
          slug: profile.slug,
          displayName: profile.display_name,
        },
        requester: {
          id: requester.id,
          displayName: requester.display_name || requester.email.split('@')[0] || 'operator',
          email: requester.email,
        },
        activeOwnerCount: count ?? 0,
      };
    }),
  );

  const pendingEntries = await buildEntryQueueItems((pendingEntriesResult.data ?? []) as EntryRow[]);
  const liveEntries = await buildEntryQueueItems((liveEntriesResult.data ?? []) as EntryRow[]);

  return {
    summary,
    pendingClaims,
    pendingEntries,
    liveEntries,
  };
}

async function getPendingClaim(membershipId: string) {
  const supabase = getServiceSupabaseClient();
  const { data, error } = await supabase
    .from('profile_memberships')
    .select('id, profile_id, status, role')
    .eq('id', requireText(membershipId, 'membershipId'))
    .single();

  if (error) {
    throw new Error(`Claim lookup failed: ${error.message}`);
  }

  const row = data as {
    id: string;
    profile_id: string;
    status: MembershipStatus;
    role: MembershipRole;
  };

  if (row.status !== 'pending') {
    throw new Error('Only pending claims can be reviewed');
  }

  return row;
}

export async function reviewClaim(
  reviewerId: string,
  membershipId: string,
  targetStatus: 'active' | 'rejected',
  rejectionReason?: string | null,
) {
  const supabase = getServiceSupabaseClient();
  const claim = await getPendingClaim(membershipId);
  const respondedAt = new Date().toISOString();

  if (targetStatus === 'active') {
    const { count, error: countError } = await supabase
      .from('profile_memberships')
      .select('id', { count: 'exact', head: true })
      .eq('profile_id', claim.profile_id)
      .eq('role', 'owner')
      .eq('status', 'active');

    if (countError) {
      throw new Error(`Active owner check failed: ${countError.message}`);
    }

    if ((count ?? 0) > 0) {
      throw new Error('Cannot approve claim while another active owner exists');
    }
  }

  const { error } = await supabase
    .from('profile_memberships')
    .update({
      status: targetStatus,
      rejection_reason: targetStatus === 'rejected' ? optionalText(rejectionReason) : null,
      responded_at: respondedAt,
      metadata: {
        reviewedBy: requireText(reviewerId, 'reviewerId'),
        reviewedAt: respondedAt,
      },
    })
    .eq('id', claim.id);

  if (error) {
    throw new Error(`Claim review failed: ${error.message}`);
  }
}

async function getEntryForReview(entryId: string) {
  const supabase = getServiceSupabaseClient();
  const { data, error } = await supabase
    .from('referral_entries')
    .select('id, profile_id, provider_id, status, referral_url, referral_code')
    .eq('id', requireText(entryId, 'entryId'))
    .single();

  if (error) {
    throw new Error(`Entry lookup failed: ${error.message}`);
  }

  return data as {
    id: string;
    profile_id: string;
    provider_id: string;
    status: DashboardEntryStatus;
    referral_url: string | null;
    referral_code: string | null;
  };
}

async function ensureNoActiveDuplicate(entry: Awaited<ReturnType<typeof getEntryForReview>>) {
  const referralUrl = normalizeComparableValue(entry.referral_url);
  const referralCode = normalizeComparableValue(entry.referral_code);

  if (!referralUrl && !referralCode) {
    return;
  }

  const supabase = getServiceSupabaseClient();
  const { data, error } = await supabase
    .from('referral_entries')
    .select('id, referral_url, referral_code')
    .eq('provider_id', entry.provider_id)
    .eq('status', 'active')
    .neq('id', entry.id);

  if (error) {
    throw new Error(`Duplicate approval check failed: ${error.message}`);
  }

  const hasActiveDuplicate = ((data ?? []) as Array<{ id: string; referral_url: string | null; referral_code: string | null }>).some(
    (row) =>
      (referralUrl && normalizeComparableValue(row.referral_url) === referralUrl) ||
      (referralCode && normalizeComparableValue(row.referral_code) === referralCode),
  );

  if (hasActiveDuplicate) {
    throw new Error('Cannot approve entry while an active duplicate route already exists for this provider');
  }
}

export async function reviewEntry(
  reviewerId: string,
  entryId: string,
  targetStatusInput: string,
  reviewNote?: string | null,
) {
  const entry = await getEntryForReview(entryId);
  const targetStatus = parseReviewerTargetStatus(targetStatusInput);
  const supabase = getServiceSupabaseClient();

  if (targetStatus === 'active') {
    await ensureNoActiveDuplicate(entry);
  }

  const allowedCurrentStatuses =
    targetStatus === 'paused' ? ['active', 'pending'] : ['pending', 'rejected', 'paused'];

  if (!allowedCurrentStatuses.includes(entry.status)) {
    throw new Error(`Entry status ${entry.status} cannot move to ${targetStatus} from the reviewer queue`);
  }

  const reviewedAt = new Date().toISOString();
  const { error } = await supabase
    .from('referral_entries')
    .update({
      status: targetStatus,
      review_note: optionalText(reviewNote),
      reviewed_at: reviewedAt,
      reviewed_by: requireText(reviewerId, 'reviewerId'),
    })
    .eq('id', entry.id);

  if (error) {
    throw new Error(`Entry review failed: ${error.message}`);
  }
}

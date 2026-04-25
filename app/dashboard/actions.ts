'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { requireCurrentAccount, updateOwnAccountBasics } from '@/lib/auth/account';
import { requireReviewerAccount } from '@/lib/auth/reviewer';
import { enforceContributorWriteRateLimit, RateLimitError } from '@/lib/security/rate-limit';
import { reviewClaim, reviewEntry } from '@/lib/referrals/moderation';
import { updateRouterControl, updateRouterEntryWeight } from '@/lib/referrals/router';
import {
  type DashboardEntryStatus,
  createOwnedDraftEntry,
  requestProfileClaim,
  updateOwnedEntry,
  updateOwnedProfileBasics,
} from '@/lib/referrals/owner';

function noticeQuery(nextPath: string, key: string, value: string) {
  const separator = nextPath.includes('?') ? '&' : '?';
  return `${nextPath}${separator}${key}=${encodeURIComponent(value)}`;
}

function parseTargetStatus(value: string): DashboardEntryStatus | null {
  switch (value) {
    case 'draft':
    case 'active':
    case 'paused':
    case 'archived':
      return value;
    default:
      return null;
  }
}

function parseClaimDecision(value: string): 'active' | 'rejected' | null {
  switch (value) {
    case 'active':
    case 'rejected':
      return value;
    default:
      return null;
  }
}

function parseReviewEntryDecision(value: string): 'active' | 'rejected' | 'paused' | null {
  switch (value) {
    case 'active':
    case 'rejected':
    case 'paused':
      return value;
    default:
      return null;
  }
}

export async function jumpToClaimTargetAction(formData: FormData) {
  const slug = String(formData.get('profileSlug') ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  if (!slug) {
    redirect('/dashboard?error=claim-slug-required');
  }

  redirect(`/dashboard/claim/${slug}`);
}

export async function requestProfileClaimAction(formData: FormData) {
  const profileSlug = String(formData.get('profileSlug') ?? '');
  const account = await requireCurrentAccount(`/dashboard/claim/${profileSlug}`);
  const requestHeaders = await headers();

  try {
    await enforceContributorWriteRateLimit('profile-claim', account.userId, requestHeaders);
    const result = await requestProfileClaim(account.userId, profileSlug);

    if (result.status === 'active') {
      redirect(`/dashboard/profiles/${result.profileSlug}?notice=claim-active`);
    }

    if (result.status === 'rejected') {
      redirect(`/dashboard/claim/${result.profileSlug}?error=claim-rejected`);
    }
  } catch (error) {
    if (error instanceof RateLimitError) {
      redirect(noticeQuery(`/dashboard/claim/${profileSlug}`, 'error', 'rate-limited'));
    }

    const message = error instanceof Error ? error.message : 'Claim failed';
    redirect(noticeQuery(`/dashboard/claim/${profileSlug}`, 'error', message));
  }
}

export async function saveProfileBasicsAction(formData: FormData) {
  const profileSlug = String(formData.get('profileSlug') ?? '');
  const account = await requireCurrentAccount(`/dashboard/profiles/${profileSlug}`);
  const requestHeaders = await headers();

  try {
    await enforceContributorWriteRateLimit('profile-save', account.userId, requestHeaders);
    await updateOwnedProfileBasics(account.userId, profileSlug, {
      displayName: String(formData.get('displayName') ?? ''),
      bio: String(formData.get('bio') ?? ''),
      website: String(formData.get('website') ?? ''),
      contactEmail: String(formData.get('contactEmail') ?? ''),
      defaultDisclosure: String(formData.get('defaultDisclosure') ?? ''),
    });
    redirect(`/dashboard/profiles/${profileSlug}?notice=profile-saved`);
  } catch (error) {
    if (error instanceof RateLimitError) {
      redirect(noticeQuery(`/dashboard/profiles/${profileSlug}`, 'error', 'rate-limited'));
    }

    const message = error instanceof Error ? error.message : 'Profile update failed';
    redirect(noticeQuery(`/dashboard/profiles/${profileSlug}`, 'error', message));
  }
}

export async function saveAccountBasicsAction(formData: FormData) {
  const account = await requireCurrentAccount('/dashboard');

  try {
    await updateOwnAccountBasics(account.userId, {
      displayName: String(formData.get('displayName') ?? ''),
    });
    redirect('/dashboard?notice=account-saved');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Account update failed';
    redirect(noticeQuery('/dashboard', 'error', message));
  }
}

export async function createDraftEntryAction(formData: FormData) {
  const profileSlug = String(formData.get('profileSlug') ?? '');
  const account = await requireCurrentAccount(`/dashboard/profiles/${profileSlug}`);
  const requestHeaders = await headers();

  try {
    await enforceContributorWriteRateLimit('draft-entry-create', account.userId, requestHeaders);
    await createOwnedDraftEntry(account.userId, profileSlug, {
      providerSlug: String(formData.get('providerSlug') ?? ''),
      kind: String(formData.get('kind') ?? ''),
      title: String(formData.get('title') ?? ''),
      referralUrl: String(formData.get('referralUrl') ?? ''),
      destinationUrl: String(formData.get('destinationUrl') ?? ''),
      referralCode: String(formData.get('referralCode') ?? ''),
      disclosure: String(formData.get('disclosure') ?? ''),
    });
    redirect(`/dashboard/profiles/${profileSlug}?notice=draft-created`);
  } catch (error) {
    if (error instanceof RateLimitError) {
      redirect(noticeQuery(`/dashboard/profiles/${profileSlug}`, 'error', 'rate-limited'));
    }

    const message = error instanceof Error ? error.message : 'Draft creation failed';
    redirect(noticeQuery(`/dashboard/profiles/${profileSlug}`, 'error', message));
  }
}

export async function updateOwnedEntryAction(formData: FormData) {
  const profileSlug = String(formData.get('profileSlug') ?? '');
  const entryId = String(formData.get('entryId') ?? '');
  const targetStatus = parseTargetStatus(String(formData.get('targetStatus') ?? ''));
  const account = await requireCurrentAccount(`/dashboard/profiles/${profileSlug}`);
  const requestHeaders = await headers();

  try {
    await enforceContributorWriteRateLimit('entry-update', account.userId, requestHeaders);
    await updateOwnedEntry(account.userId, profileSlug, entryId, {
      providerSlug: String(formData.get('providerSlug') ?? ''),
      kind: String(formData.get('kind') ?? ''),
      title: String(formData.get('title') ?? ''),
      referralUrl: String(formData.get('referralUrl') ?? ''),
      destinationUrl: String(formData.get('destinationUrl') ?? ''),
      referralCode: String(formData.get('referralCode') ?? ''),
      disclosure: String(formData.get('disclosure') ?? ''),
      status: targetStatus,
    });

    const notice =
      targetStatus === 'active'
        ? 'entry-published'
        : targetStatus === 'archived'
          ? 'entry-archived'
          : targetStatus === 'paused'
            ? 'entry-paused'
            : 'entry-saved';

    redirect(`/dashboard/profiles/${profileSlug}?notice=${notice}`);
  } catch (error) {
    if (error instanceof RateLimitError) {
      redirect(noticeQuery(`/dashboard/profiles/${profileSlug}?entry=${encodeURIComponent(entryId)}`, 'error', 'rate-limited'));
    }

    const message = error instanceof Error ? error.message : 'Entry update failed';
    redirect(noticeQuery(`/dashboard/profiles/${profileSlug}?entry=${encodeURIComponent(entryId)}`, 'error', message));
  }
}

export async function reviewClaimAction(formData: FormData) {
  const membershipId = String(formData.get('membershipId') ?? '');
  const targetStatus = parseClaimDecision(String(formData.get('targetStatus') ?? ''));
  const reviewer = await requireReviewerAccount('/dashboard/review');

  if (!targetStatus) {
    redirect('/dashboard/review?error=claim-review-invalid');
  }

  try {
    await reviewClaim(reviewer.userId, membershipId, targetStatus, String(formData.get('rejectionReason') ?? ''));
    const notice = targetStatus === 'active' ? 'claim-approved' : 'claim-rejected';
    redirect(`/dashboard/review?notice=${notice}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Claim review failed';
    redirect(noticeQuery('/dashboard/review', 'error', message));
  }
}

export async function reviewEntryAction(formData: FormData) {
  const entryId = String(formData.get('entryId') ?? '');
  const targetStatus = parseReviewEntryDecision(String(formData.get('targetStatus') ?? ''));
  const reviewer = await requireReviewerAccount('/dashboard/review');

  if (!targetStatus) {
    redirect('/dashboard/review?error=entry-review-invalid');
  }

  try {
    await reviewEntry(reviewer.userId, entryId, targetStatus, String(formData.get('reviewNote') ?? ''));
    const notice =
      targetStatus === 'active'
        ? 'entry-approved'
        : targetStatus === 'paused'
          ? 'entry-paused-by-review'
          : 'entry-rejected';
    redirect(`/dashboard/review?notice=${notice}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Entry review failed';
    redirect(noticeQuery('/dashboard/review', 'error', message));
  }
}

export async function jumpToRouterProviderAction(formData: FormData) {
  const providerSlug = String(formData.get('providerSlug') ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  if (!providerSlug) {
    redirect('/dashboard/router?error=router-provider-required');
  }

  redirect(`/dashboard/router?provider=${encodeURIComponent(providerSlug)}`);
}

export async function saveRouterControlAction(formData: FormData) {
  await requireReviewerAccount('/dashboard/router');
  const providerSlug = String(formData.get('providerSlug') ?? '');

  try {
    await updateRouterControl(providerSlug, {
      mode: String(formData.get('mode') ?? ''),
      fallbackPreference: String(formData.get('fallbackPreference') ?? ''),
    });
    redirect(`/dashboard/router?provider=${encodeURIComponent(providerSlug)}&notice=router-saved`);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Router control update failed';
    redirect(noticeQuery(`/dashboard/router?provider=${encodeURIComponent(providerSlug)}`, 'error', message));
  }
}

export async function saveRouterEntryWeightAction(formData: FormData) {
  await requireReviewerAccount('/dashboard/router');
  const providerSlug = String(formData.get('providerSlug') ?? '');
  const entryId = String(formData.get('entryId') ?? '');

  try {
    await updateRouterEntryWeight(providerSlug, entryId, String(formData.get('weight') ?? ''));
    redirect(`/dashboard/router?provider=${encodeURIComponent(providerSlug)}&notice=weight-saved`);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Router weight update failed';
    redirect(noticeQuery(`/dashboard/router?provider=${encodeURIComponent(providerSlug)}`, 'error', message));
  }
}

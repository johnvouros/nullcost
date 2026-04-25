'use server';

import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { requireCurrentAccount } from '@/lib/auth/account';
import { enforceContributorWriteRateLimit, RateLimitError } from '@/lib/security/rate-limit';
import { type DashboardEntryStatus, upsertAccountProviderEntry } from '@/lib/referrals/owner';

function compact(value: FormDataEntryValue | null): string {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim();
}

function isValidUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function looksLikeUrlWithoutScheme(value: string): boolean {
  return /^(www\.)?[a-z0-9-]+(\.[a-z0-9-]+)+(\/.*)?$/i.test(value);
}

function parseReferralInput(value: string): {
  referralUrl: string;
  referralCode: string;
} {
  const text = compact(value);

  if (!text) {
    return {
      referralUrl: '',
      referralCode: '',
    };
  }

  if (isValidUrl(text)) {
    return {
      referralUrl: text,
      referralCode: '',
    };
  }

  const normalizedUrl = looksLikeUrlWithoutScheme(text) ? `https://${text}` : '';

  if (normalizedUrl && isValidUrl(normalizedUrl)) {
    return {
      referralUrl: normalizedUrl,
      referralCode: '',
    };
  }

  return {
    referralUrl: '',
    referralCode: text,
  };
}

function parseTargetStatus(value: string): DashboardEntryStatus {
  switch (value) {
    case 'active':
    case 'paused':
    case 'archived':
      return value;
    default:
      return 'draft';
  }
}

function redirectToProvider(
  providerSlug: string,
  state: {
    notice?: string;
    error?: string;
  },
): never {
  const params = new URLSearchParams();

  if (state.notice) {
    params.set('notice', state.notice);
  }

  if (state.error) {
    params.set('error', state.error);
  }

  const query = params.toString();
  redirect(`/providers/${providerSlug}${query ? `?${query}` : ''}#my-code`);
}

export async function saveProviderReferralCode(providerSlug: string, formData: FormData) {
  const account = await requireCurrentAccount(`/providers/${providerSlug}#my-code`);
  const requestHeaders = await headers();
  const referralInput = compact(formData.get('referralInput'));
  const parsedReferral = parseReferralInput(referralInput);
  const referralUrl = compact(formData.get('referralUrl')) || parsedReferral.referralUrl;
  const referralCode = compact(formData.get('referralCode')) || parsedReferral.referralCode;
  const destinationUrl = compact(formData.get('destinationUrl'));
  const disclosure = compact(formData.get('disclosure'));
  const targetStatus = parseTargetStatus(compact(formData.get('targetStatus')));

  if (!referralUrl && !referralCode) {
    redirectToProvider(providerSlug, { error: 'missing-link' });
  }

  if (referralUrl && !isValidUrl(referralUrl)) {
    redirectToProvider(providerSlug, { error: 'invalid-referral-url' });
  }

  if (destinationUrl && !isValidUrl(destinationUrl)) {
    redirectToProvider(providerSlug, { error: 'invalid-destination-url' });
  }

  try {
    await enforceContributorWriteRateLimit('provider-code-save', account.userId, requestHeaders);

    const result = await upsertAccountProviderEntry(
      account.userId,
      {
        displayName: account.profile.displayName,
        email: account.email,
      },
      providerSlug,
      {
        kind: referralUrl ? 'referral_link' : 'coupon_code',
        referralUrl,
        destinationUrl,
        referralCode,
        disclosure,
        status: targetStatus,
      },
    );

    revalidatePath(`/providers/${providerSlug}`);
    revalidatePath('/dashboard');
    revalidatePath(`/dashboard/profiles/${result.profileSlug}`);
    revalidatePath(`/profiles/${result.profileSlug}`);

    const notice =
      targetStatus === 'active'
        ? 'code-live'
        : targetStatus === 'paused'
          ? 'code-paused'
          : targetStatus === 'archived'
            ? 'code-deleted'
            : 'code-saved';

    redirectToProvider(providerSlug, { notice });
  } catch (error) {
    if (error instanceof RateLimitError) {
      redirectToProvider(providerSlug, { error: 'rate-limited' });
    }

    const message = error instanceof Error ? error.message : 'Code update failed';
    redirectToProvider(providerSlug, { error: message });
  }
}

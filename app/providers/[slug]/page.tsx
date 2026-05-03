import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ProviderProfileShell } from '@/components/provider-profile-shell';
import { getCurrentAccount } from '@/lib/auth/account';
import {
  chooseBestStartingPlan,
  getDefaultPlanSelectionIntent,
  getProviderBySlug,
  getProviderPlansByProviderId,
  getProviderRows,
} from '@/lib/providers';
import { getAccountProviderEntry } from '@/lib/referrals/owner';
import { listProviderReferralDirectory } from '@/lib/referrals/service';
import { saveProviderReferralCode } from './actions';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Provider profiles disabled',
    robots: {
      index: false,
      follow: false,
      googleBot: {
        index: false,
        follow: false,
      },
    },
  };
}

export default async function ProviderDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }> | { slug: string };
  searchParams?:
    | Promise<Record<string, string | string[] | undefined>>
    | Record<string, string | string[] | undefined>;
}) {
  // Temporarily disabled for launch: provider detail pages are not part of the public site surface.
  notFound();

  const [{ slug }, resolvedSearchParams] = await Promise.all([params, searchParams ?? {}]);
  const provider = await getProviderBySlug(slug);

  if (!provider) {
    notFound();
  }

  const [peersSource, referralDirectory, account, plans] = await Promise.all([
    provider.category ? getProviderRows({ category: provider.category, limit: 10 }) : Promise.resolve([]),
    listProviderReferralDirectory(provider.slug, 6).catch(() => null),
    getCurrentAccount(),
    getProviderPlansByProviderId(provider.id),
  ]);
  const codeAction = saveProviderReferralCode.bind(null, provider.slug);
  const managedEntry = account
    ? await getAccountProviderEntry(account.userId, provider.slug).catch(() => ({
        entry: null,
        managedProfile: null,
      }))
    : { entry: null, managedProfile: null };

  const peerProviders = peersSource
    .filter((candidate) => candidate.slug !== provider.slug)
    .sort((left, right) => {
      const leftScore =
        Number(Boolean(provider.subcategory && left.subcategory === provider.subcategory)) * 2 +
        Number(left.category === provider.category);
      const rightScore =
        Number(Boolean(provider.subcategory && right.subcategory === provider.subcategory)) * 2 +
        Number(right.category === provider.category);
      return rightScore - leftScore;
    })
    .slice(0, 5);

  const noticeState = Array.isArray(resolvedSearchParams.notice)
    ? resolvedSearchParams.notice[0]
    : resolvedSearchParams.notice;
  const errorState = Array.isArray(resolvedSearchParams.error)
    ? resolvedSearchParams.error[0]
    : resolvedSearchParams.error;
  const bestStartingPlan = chooseBestStartingPlan(plans, getDefaultPlanSelectionIntent(provider));

  return (
    <ProviderProfileShell
      provider={provider}
      plans={plans}
      bestStartingPlan={bestStartingPlan ?? null}
      peerProviders={peerProviders}
      referralDirectory={referralDirectory}
      submissionNotice={getSubmissionNotice(noticeState, errorState)}
      submitAction={codeAction}
      accountContext={
        account
          ? {
              displayName: account.profile.displayName,
              email: account.email,
            }
          : null
      }
      managedEntry={managedEntry.entry}
      dashboardAction={
        account
          ? managedEntry.entry
            ? {
                href: `/dashboard/profiles/${managedEntry.entry.profile.slug}?entry=${managedEntry.entry.id}`,
                label: 'Open my code',
              }
            : { href: '/dashboard', label: 'My account' }
          : {
              href: `/auth?next=${encodeURIComponent(`/providers/${provider.slug}#my-code`)}`,
              label: 'Sign in to add code',
            }
      }
    />
  );
}

function getSubmissionNotice(noticeState: string | undefined, errorState: string | undefined) {
  switch (noticeState) {
    case 'code-saved':
      return {
        tone: 'success' as const,
        title: 'Code saved',
        message: 'Your code is saved in your account and is not live yet.',
      };
    case 'code-live':
      return {
        tone: 'success' as const,
        title: 'Code is live',
        message: 'Nullcost can now rotate this code when someone uses the community route for this provider.',
      };
    case 'code-paused':
      return {
        tone: 'success' as const,
        title: 'Code turned off',
        message: 'The code stays in your account but is no longer part of the live route.',
      };
    case 'code-deleted':
      return {
        tone: 'success' as const,
        title: 'Code deleted',
        message: 'The code was removed from your active account view.',
      };
    default:
      break;
  }

  switch (errorState) {
    case 'missing-link':
      return {
        tone: 'error' as const,
        title: 'Add a link or code',
        message: 'Use either a referral link or a code before saving.',
      };
    case 'invalid-referral-url':
      return {
        tone: 'error' as const,
        title: 'Referral link looks invalid',
        message: 'Use a full http or https URL for the referral link.',
      };
    case 'invalid-destination-url':
      return {
        tone: 'error' as const,
        title: 'Destination link looks invalid',
        message: 'Use a full http or https URL for the official destination.',
      };
    case 'You already have a code for this provider. Edit the existing code instead.':
      return {
        tone: 'error' as const,
        title: 'Code already exists',
        message: 'You already have a code for this provider. Edit the existing one instead.',
      };
    case 'rate-limited':
      return {
        tone: 'error' as const,
        title: 'Too many changes',
        message: 'Slow down for a moment before saving your code again.',
      };
    case undefined:
      return {
        tone: 'idle' as const,
      };
    default:
      return {
        tone: 'error' as const,
        title: 'Code update failed',
        message: errorState,
      };
  }
}

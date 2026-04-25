import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ReferralProfileShell } from '@/components/referral-profile-shell';
import { getCurrentAccount } from '@/lib/auth/account';
import { getClaimWorkspace } from '@/lib/referrals/owner';
import { getReferralProfileDirectory } from '@/lib/referrals/service';
import { SITE_NAME, absoluteUrl, buildProfileDescription } from '@/lib/site';

export const dynamic = 'force-dynamic';

async function loadDirectory(slug: string) {
  try {
    const directory = await getReferralProfileDirectory(slug, 100);

    if (directory.profile.status !== 'active') {
      notFound();
    }

    return directory;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Profile lookup failed';

    if (/lookup failed/i.test(message)) {
      notFound();
    }

    throw error;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }> | { slug: string };
}): Promise<Metadata> {
  const { slug } = await params;

  try {
    const directory = await loadDirectory(slug);
    const description = buildProfileDescription({
      displayName: directory.profile.displayName,
      bio: directory.profile.bio,
      activeEntries: directory.stats.activeEntries,
      providers: directory.stats.providers,
    });
    const canonicalPath = `/profiles/${directory.profile.slug}`;

    return {
      title: directory.profile.displayName,
      description,
      alternates: {
        canonical: canonicalPath,
      },
      openGraph: {
        title: `${directory.profile.displayName} on ${SITE_NAME}`,
        description,
        url: absoluteUrl(canonicalPath),
        type: 'profile',
      },
      twitter: {
        card: 'summary',
        title: `${directory.profile.displayName} on ${SITE_NAME}`,
        description,
      },
    };
  } catch {
    return {
      title: 'Profile not found',
      robots: {
        index: false,
        follow: false,
      },
    };
  }
}

export default async function ReferralProfilePage({
  params,
}: {
  params: Promise<{ slug: string }> | { slug: string };
}) {
  const { slug } = await params;
  const [directory, account] = await Promise.all([loadDirectory(slug), getCurrentAccount()]);
  let managementAction: { href: string; label: string } | null = null;

  if (account) {
    const workspace = await getClaimWorkspace(account.userId, slug);

    if (workspace.membership?.status === 'active') {
      managementAction = {
        href: `/dashboard/profiles/${slug}`,
        label: 'Open my code page',
      };
    } else {
      managementAction = {
        href: '/dashboard',
        label: 'Go to my account',
      };
    }
  } else {
    managementAction = {
      href: `/auth?next=${encodeURIComponent('/dashboard')}`,
      label: 'Sign in to add codes',
    };
  }

  return <ReferralProfileShell directory={directory} managementAction={managementAction} />;
}

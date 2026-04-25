import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { AuthPanel } from '@/components/auth-panel';
import { getCurrentAccount } from '@/lib/auth/account';
import { sanitizeInternalPath } from '@/lib/security/redirects';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Sign in',
  robots: {
    index: false,
    follow: false,
  },
};

export default async function AuthPage({
  searchParams,
}: {
  searchParams?: Promise<{ mode?: string; next?: string }> | { mode?: string; next?: string };
}) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const nextPath = sanitizeInternalPath(resolvedSearchParams.next);
  const account = await getCurrentAccount();

  if (account) {
    redirect(nextPath);
  }

  const mode = resolvedSearchParams.mode === 'sign-up' ? 'sign-up' : 'sign-in';

  return <AuthPanel defaultMode={mode} nextPath={nextPath} />;
}

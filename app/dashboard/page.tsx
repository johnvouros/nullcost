import { requireCurrentAccount } from '@/lib/auth/account';
import { canReviewAccount } from '@/lib/auth/reviewer';
import { ensureSiteAdminProfileForAccount, listAccountProfileMemberships } from '@/lib/referrals/owner';
import { DashboardHome } from '@/components/dashboard-home';

export const dynamic = 'force-dynamic';

function readParam(
  value: string | string[] | undefined,
) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?:
    | Promise<Record<string, string | string[] | undefined>>
    | Record<string, string | string[] | undefined>;
}) {
  const account = await requireCurrentAccount('/dashboard');
  const resolvedSearchParams = searchParams ? await searchParams : {};
  if (canReviewAccount(account)) {
    await ensureSiteAdminProfileForAccount(account.userId, {
      displayName: 'Site Admin',
      email: account.email,
    });
  }
  const memberships = await listAccountProfileMemberships(account.userId);

  return (
    <DashboardHome
      account={account}
      memberships={memberships}
      notice={readParam(resolvedSearchParams.notice)}
      error={readParam(resolvedSearchParams.error)}
    />
  );
}

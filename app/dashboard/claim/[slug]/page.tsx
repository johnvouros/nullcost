import { requireCurrentAccount } from '@/lib/auth/account';
import { getClaimWorkspace } from '@/lib/referrals/owner';
import { DashboardClaimShell } from '@/components/dashboard-claim-shell';

export const dynamic = 'force-dynamic';

function readParam(
  value: string | string[] | undefined,
) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function DashboardClaimPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }> | { slug: string };
  searchParams?:
    | Promise<Record<string, string | string[] | undefined>>
    | Record<string, string | string[] | undefined>;
}) {
  const { slug } = await params;
  const account = await requireCurrentAccount(`/dashboard/claim/${slug}`);
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const workspace = await getClaimWorkspace(account.userId, slug);

  return (
    <DashboardClaimShell
      account={account}
      workspace={workspace}
      notice={readParam(resolvedSearchParams.notice)}
      error={readParam(resolvedSearchParams.error)}
    />
  );
}

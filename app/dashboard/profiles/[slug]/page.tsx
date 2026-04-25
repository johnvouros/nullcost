import { requireCurrentAccount } from '@/lib/auth/account';
import { getOwnedProfileWorkspace } from '@/lib/referrals/owner';
import { DashboardProfileShell } from '@/components/dashboard-profile-shell';

export const dynamic = 'force-dynamic';

function readParam(
  value: string | string[] | undefined,
) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function DashboardProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }> | { slug: string };
  searchParams?:
    | Promise<Record<string, string | string[] | undefined>>
    | Record<string, string | string[] | undefined>;
}) {
  const { slug } = await params;
  const account = await requireCurrentAccount(`/dashboard/profiles/${slug}`);
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const workspace = await getOwnedProfileWorkspace(account.userId, slug);

  return (
    <DashboardProfileShell
      account={account}
      workspace={workspace}
      notice={readParam(resolvedSearchParams.notice)}
      error={readParam(resolvedSearchParams.error)}
      selectedEntryId={readParam(resolvedSearchParams.entry)}
    />
  );
}

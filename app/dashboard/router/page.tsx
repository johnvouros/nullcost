import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function DashboardRouterPage({
}: {
  searchParams?:
    | Promise<Record<string, string | string[] | undefined>>
    | Record<string, string | string[] | undefined>;
}) {
  redirect('/dashboard');
}

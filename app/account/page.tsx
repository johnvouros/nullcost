import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { requireCurrentAccount } from '@/lib/auth/account';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Account',
  robots: {
    index: false,
    follow: false,
  },
};

export default async function AccountPage() {
  await requireCurrentAccount('/dashboard');
  redirect('/dashboard');
}

import { redirect } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export interface AccountProfile {
  id: string;
  email: string;
  displayName: string;
  createdAt: string | null;
}

export interface CurrentAccount {
  userId: string;
  email: string;
  profile: AccountProfile;
}

export interface AccountBasicsInput {
  displayName: string;
}

function fallbackDisplayName(email: string) {
  const localPart = email.split('@')[0]?.trim();
  return localPart || 'Operator';
}

export async function getCurrentAccount(): Promise<CurrentAccount | null> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user || !user.email) {
    return null;
  }

  const { data } = await supabase
    .from('account_profiles')
    .select('id, email, display_name, created_at')
    .eq('id', user.id)
    .maybeSingle();

  return {
    userId: user.id,
    email: user.email,
    profile: {
      id: user.id,
      email: data?.email || user.email,
      displayName: data?.display_name || fallbackDisplayName(user.email),
      createdAt: data?.created_at || null,
    },
  };
}

export async function requireCurrentAccount(nextPath = '/dashboard') {
  const account = await getCurrentAccount();

  if (!account) {
    redirect(`/auth?next=${encodeURIComponent(nextPath)}`);
  }

  return account;
}

function requireDisplayName(value: string | null | undefined) {
  const displayName = String(value ?? '').trim();
  if (!displayName) {
    throw new Error('displayName is required');
  }

  return displayName;
}

export async function updateOwnAccountBasics(userId: string, input: AccountBasicsInput) {
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from('account_profiles')
    .update({
      display_name: requireDisplayName(input.displayName),
    })
    .eq('id', userId);

  if (error) {
    throw new Error(`Account update failed: ${error.message}`);
  }
}

import { redirect } from 'next/navigation';
import type { CurrentAccount } from './account';
import { requireCurrentAccount } from './account';

export type ReviewerMode = 'allowlist' | 'local-dev';

function parseAllowlist() {
  return String(process.env.NULLCOST_REVIEWER_EMAILS ?? '')
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
}

export function getReviewerModeForEmail(email: string): ReviewerMode | null {
  const normalized = email.trim().toLowerCase();
  const allowlist = parseAllowlist();

  if (allowlist.includes(normalized)) {
    return 'allowlist';
  }

  if (process.env.NODE_ENV !== 'production') {
    return 'local-dev';
  }

  return null;
}

export function canReviewAccount(account: Pick<CurrentAccount, 'email'>): ReviewerMode | null {
  return getReviewerModeForEmail(account.email);
}

export async function requireReviewerAccount(nextPath = '/dashboard/review') {
  const account = await requireCurrentAccount(nextPath);
  const reviewerMode = canReviewAccount(account);

  if (!reviewerMode) {
    redirect('/dashboard?error=reviewer-required');
  }

  return {
    ...account,
    reviewerMode,
  };
}

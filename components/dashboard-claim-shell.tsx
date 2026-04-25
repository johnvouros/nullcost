import Link from 'next/link';
import type { CurrentAccount } from '@/lib/auth/account';
import type { ClaimWorkspace } from '@/lib/referrals/owner';
import { requestProfileClaimAction } from '@/app/dashboard/actions';
import { DashboardShell } from './dashboard-shell';
import styles from './dashboard-shell.module.css';

interface DashboardClaimShellProps {
  account: CurrentAccount;
  workspace: ClaimWorkspace;
  notice?: string | null;
  error?: string | null;
}

function getClaimTone(status: ClaimWorkspace['membership'] extends infer T ? T extends { status: infer S } ? S : never : never) {
  if (status === 'active') return styles.pillGood;
  if (status === 'pending') return styles.pillWarn;
  return styles.pillMuted;
}

function getClaimStatusLabel(status: ClaimWorkspace['membership'] extends infer T ? T extends { status: infer S } ? S : never : never) {
  switch (status) {
    case 'active':
      return 'Approved';
    case 'pending':
      return 'Waiting';
    case 'rejected':
      return 'Rejected';
    default:
      return String(status ?? '');
  }
}

function getNoticeCopy(value?: string | null) {
  switch (value) {
    case 'claim-pending':
      return 'Your request is waiting for approval.';
    case 'claim-requested':
      return 'Your request was saved. You can leave this page and check the status later.';
    default:
      return null;
  }
}

function getErrorCopy(value?: string | null) {
  switch (value) {
    case 'claim-rejected':
      return 'This request was rejected. Check the reason below before trying again.';
    case 'rate-limited':
      return 'Too many claim attempts in a short time. Wait a moment before trying again.';
    case 'This profile is already claimed. For now, only one account can manage a profile.':
      return 'This profile already has an owner. For now, only one account can manage a profile.';
    default:
      return value || null;
  }
}

function hostFromUrl(value: string | null) {
  if (!value) {
    return 'Not set';
  }

  try {
    return new URL(value).host.replace(/^www\./, '');
  } catch {
    return value;
  }
}

function formatDate(value: string | null) {
  if (!value) {
    return 'Not set';
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('en-AU', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(parsed);
}

export function DashboardClaimShell({ account, workspace, notice, error }: DashboardClaimShellProps) {
  const { target, membership } = workspace;
  const noticeCopy = getNoticeCopy(notice);
  const errorCopy = getErrorCopy(error);
  const hasActiveOwner = target.activeOwnerCount > 0;

  return (
    <DashboardShell
      accountName={account.profile.displayName}
      title={`Claim ${target.profile.displayName}`}
      subtitle="If this profile is free, you can claim it now. If it already has an owner, it is locked for now."
      section="claim"
      backHref="/dashboard"
      backLabel="Back to dashboard"
      metaLabel="Profile"
      metaValue={target.profile.slug}
      claimHref={`/dashboard/claim/${target.profile.slug}`}
      profileHref={membership?.status === 'active' ? `/dashboard/profiles/${target.profile.slug}` : '/dashboard'}
    >
      <div className={styles.grid}>
        {noticeCopy ? <p className={styles.notice}>{noticeCopy}</p> : null}
        {errorCopy ? <p className={styles.error}>{errorCopy}</p> : null}
      </div>

      <div className={`${styles.grid} ${styles.gridMainAside}`}>
        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <h2 className={styles.panelTitle}>{target.profile.displayName}</h2>
              <p className={styles.panelText}>
                {target.profile.bio || 'No public bio is attached to this profile yet.'}
              </p>
            </div>
            <span className={`${styles.pill} ${hasActiveOwner ? styles.pillWarn : styles.pillGood}`}>
              {hasActiveOwner ? 'Already owned' : 'Available'}
            </span>
          </div>

          <div className={styles.summaryList}>
            <div className={styles.summaryRow}>
              <strong>Profile name</strong>
              <span className={styles.code}>{target.profile.slug}</span>
            </div>
            <div className={styles.summaryRow}>
              <strong>Public page</strong>
              <span>{target.profile.website ? hostFromUrl(target.profile.website) : 'Website not set'}</span>
            </div>
            <div className={styles.summaryRow}>
              <strong>Who can edit it</strong>
              <span>
                {target.activeOwnerCount} active owner · {target.activeEditorCount} active editor
              </span>
            </div>
          </div>
        </section>

        <aside className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <h2 className={styles.panelTitle}>Request status</h2>
              <p className={styles.panelText}>If nobody owns this profile, you get access right away. If it is already owned, it is locked for now.</p>
            </div>
          </div>

          {membership ? (
            <div className={styles.summaryList}>
              <div className={styles.summaryRow}>
                <strong>Your status</strong>
                <span>
                  <span className={`${styles.pill} ${getClaimTone(membership.status)}`}>{getClaimStatusLabel(membership.status)}</span>
                </span>
              </div>
              {membership.rejectionReason ? (
                <div className={styles.summaryRow}>
                  <strong>Rejection reason</strong>
                  <span>{membership.rejectionReason}</span>
                </div>
              ) : null}
              {membership.respondedAt ? (
                <div className={styles.summaryRow}>
                  <strong>Reviewed</strong>
                  <span>{formatDate(membership.respondedAt)}</span>
                </div>
              ) : null}
            </div>
          ) : null}

          <div className={styles.actions}>
            {membership?.status === 'active' ? (
              <Link href={`/dashboard/profiles/${target.profile.slug}`} className={styles.buttonPrimary}>
                Open profile
              </Link>
            ) : hasActiveOwner ? (
              <div className={styles.summaryList}>
                <div className={styles.summaryRow}>
                  <strong>Profile unavailable</strong>
                  <span>This profile already has an owner. Only one account can manage a profile right now.</span>
                </div>
                <div className={styles.actions}>
                  <Link href="/dashboard" className={styles.linkButton}>
                    Back to my account
                  </Link>
                  <Link href={`/profiles/${target.profile.slug}`} className={styles.linkButton}>
                    View public profile
                  </Link>
                </div>
              </div>
            ) : membership?.status === 'pending' ? (
              <Link href="/dashboard" className={styles.linkButton}>
                Back to my account
              </Link>
            ) : membership?.status === 'rejected' ? (
              <Link href="/dashboard" className={styles.linkButton}>
                Back to my account
              </Link>
            ) : (
              <form action={requestProfileClaimAction} className={styles.form}>
                <input type="hidden" name="profileSlug" value={target.profile.slug} />
                <div className={styles.actions}>
                  <button type="submit" className={styles.buttonPrimary}>Claim this profile</button>
                  <Link href={`/profiles/${target.profile.slug}`} className={styles.linkButton}>
                    View public profile
                  </Link>
                </div>
              </form>
            )}
          </div>
        </aside>
      </div>
    </DashboardShell>
  );
}

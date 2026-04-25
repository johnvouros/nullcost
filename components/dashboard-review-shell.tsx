import Link from 'next/link';
import type { CurrentAccount } from '@/lib/auth/account';
import type { ReviewerMode } from '@/lib/auth/reviewer';
import type { ModerationWorkspace } from '@/lib/referrals/moderation';
import { reviewClaimAction, reviewEntryAction } from '@/app/dashboard/actions';
import { DashboardShell } from './dashboard-shell';
import styles from './dashboard-shell.module.css';

interface DashboardReviewShellProps {
  account: CurrentAccount;
  reviewerMode: ReviewerMode;
  workspace: ModerationWorkspace;
  notice?: string | null;
  error?: string | null;
}

function humanize(value: string) {
  return value.replace(/_/g, ' ');
}

function shortHost(value: string | null) {
  if (!value) {
    return 'No url';
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

function reviewerModeLabel(mode: ReviewerMode) {
  return mode === 'allowlist' ? 'Allowlisted reviewer' : 'Local dev reviewer';
}

function getNoticeCopy(value?: string | null) {
  switch (value) {
    case 'claim-approved':
      return 'Claim approved. The requester can now manage the profile.';
    case 'claim-rejected':
      return 'Claim rejected. The requester will see the rejection reason in the claim flow.';
    case 'entry-approved':
      return 'Entry approved. It is now public and eligible for the router.';
    case 'entry-rejected':
      return 'Entry rejected. The owner can edit and resubmit it later.';
    case 'entry-paused-by-review':
      return 'Entry paused. It is out of the live routing pool now.';
    default:
      return null;
  }
}

function getErrorCopy(value?: string | null) {
  switch (value) {
    case 'reviewer-required':
      return 'This account is not allowed into reviewer routes.';
    case 'claim-review-invalid':
      return 'Choose a valid claim moderation action.';
    case 'entry-review-invalid':
      return 'Choose a valid entry moderation action.';
    default:
      return value || null;
  }
}

export function DashboardReviewShell({
  account,
  reviewerMode,
  workspace,
  notice,
  error,
}: DashboardReviewShellProps) {
  const noticeCopy = getNoticeCopy(notice);
  const errorCopy = getErrorCopy(error);

  return (
    <DashboardShell
      accountName={account.profile.displayName}
      title="Moderation queue"
      subtitle="Approve ownership requests, publish pending referral entries, and pause live routes without exposing internal review notes publicly."
      section="review"
      backHref="/dashboard"
      backLabel="Back to dashboard"
      metaLabel="Reviewer"
      metaValue={reviewerModeLabel(reviewerMode)}
    >
      <div className={styles.grid}>
        {noticeCopy ? <p className={styles.notice}>{noticeCopy}</p> : null}
        {errorCopy ? <p className={styles.error}>{errorCopy}</p> : null}
      </div>

      <div className={styles.strip}>
        <div className={styles.stripCell}>
          <span className={styles.label}>Pending claims</span>
          <strong>{workspace.summary.pendingClaims}</strong>
        </div>
        <div className={styles.stripCell}>
          <span className={styles.label}>Pending entries</span>
          <strong>{workspace.summary.pendingEntries}</strong>
        </div>
        <div className={styles.stripCell}>
          <span className={styles.label}>Live entries</span>
          <strong>{workspace.summary.liveEntries}</strong>
        </div>
        <div className={styles.stripCell}>
          <span className={styles.label}>Mode</span>
          <strong>{reviewerMode === 'local-dev' ? 'Local' : 'Scoped'}</strong>
        </div>
      </div>

      <section className={styles.panel}>
        <div className={styles.panelHeader}>
          <div>
            <h2 className={styles.panelTitle}>Pending claims</h2>
            <p className={styles.panelText}>Only one active owner is allowed per profile. Approvals activate the membership immediately.</p>
          </div>
          <span className={styles.pill}>{workspace.pendingClaims.length}</span>
        </div>

        <div className={styles.reviewTable}>
          <div className={`${styles.reviewRow} ${styles.reviewHeader}`}>
            <span>Requester</span>
            <span>Profile</span>
            <span>Current state</span>
            <span>Reviewer note</span>
            <span>Action</span>
          </div>

          {workspace.pendingClaims.length === 0 ? (
            <div className={styles.empty}>No pending profile claims are waiting for review.</div>
          ) : (
            workspace.pendingClaims.map((claim) => (
              <div key={claim.membershipId} className={styles.reviewRow}>
                <span>
                  <strong>{claim.requester.displayName}</strong>
                  <span className={styles.tableCellMuted}> · {claim.requester.email}</span>
                </span>
                <span>
                  <Link href={`/profiles/${claim.profile.slug}`} className={styles.linkButton}>
                    {claim.profile.displayName}
                  </Link>
                  <span className={styles.tableCellMuted}> · {claim.profile.slug}</span>
                </span>
                <span className={styles.reviewMeta}>
                  <span>{formatDate(claim.createdAt)}</span>
                  <span className={`${styles.pill} ${claim.activeOwnerCount > 0 ? styles.pillWarn : styles.pillGood}`}>
                    {claim.activeOwnerCount > 0 ? `${claim.activeOwnerCount} owner live` : 'unclaimed'}
                  </span>
                </span>
                <form action={reviewClaimAction} className={styles.reviewForm}>
                  <input type="hidden" name="membershipId" value={claim.membershipId} />
                  <input
                    className={styles.input}
                    type="text"
                    name="rejectionReason"
                    defaultValue={claim.rejectionReason || ''}
                    placeholder="Reason if rejected"
                  />
                  <div className={styles.reviewButtons}>
                    <button type="submit" name="targetStatus" value="active" className={styles.buttonPrimary}>
                      Approve
                    </button>
                    <button type="submit" name="targetStatus" value="rejected" className={styles.buttonGhost}>
                      Reject
                    </button>
                  </div>
                </form>
                <span className={styles.reviewInfo}>
                  {claim.claimNote || 'No claimant note'}
                </span>
              </div>
            ))
          )}
        </div>
      </section>

      <section className={styles.panel}>
        <div className={styles.panelHeader}>
          <div>
            <h2 className={styles.panelTitle}>Pending entries</h2>
            <p className={styles.panelText}>Approvals publish the entry onto the public profile and into the randomized router. Active duplicates are blocked.</p>
          </div>
          <span className={styles.pill}>{workspace.pendingEntries.length}</span>
        </div>

        <div className={styles.reviewTable}>
          <div className={`${styles.reviewRow} ${styles.reviewHeader}`}>
            <span>Provider</span>
            <span>Route</span>
            <span>Duplicate risk</span>
            <span>Owner / timing</span>
            <span>Action</span>
          </div>

          {workspace.pendingEntries.length === 0 ? (
            <div className={styles.empty}>No pending referral entries are waiting for review.</div>
          ) : (
            workspace.pendingEntries.map((entry) => (
              <div key={entry.entryId} className={styles.reviewRow}>
                <span>
                  <strong>{entry.provider.name}</strong>
                  <span className={styles.tableCellMuted}> · {entry.profile.displayName}</span>
                </span>
                <span className={styles.reviewInfo}>
                  <strong>{entry.title || humanize(entry.kind)}</strong>
                  <span>{shortHost(entry.referralUrl || entry.destinationUrl)}</span>
                  {entry.referralCode ? <span className={styles.tableCellMuted}>code {entry.referralCode}</span> : null}
                </span>
                <span className={styles.reviewInfo}>
                  {entry.duplicates.active.length > 0 ? (
                    <span className={styles.warningText}>
                      {entry.duplicates.active.length} active duplicate{entry.duplicates.active.length === 1 ? '' : 's'}
                    </span>
                  ) : (
                    <span>No active duplicates</span>
                  )}
                  {entry.duplicates.pending.length > 0 ? (
                    <span className={styles.tableCellMuted}>{entry.duplicates.pending.length} pending similar</span>
                  ) : null}
                  {entry.duplicates.paused.length > 0 ? (
                    <span className={styles.tableCellMuted}>{entry.duplicates.paused.length} paused similar</span>
                  ) : null}
                </span>
                <span className={styles.reviewInfo}>
                  <span>{entry.owner ? `${entry.owner.displayName} · ${entry.owner.email}` : 'No active owner'}</span>
                  <span className={styles.tableCellMuted}>submitted {formatDate(entry.submittedAt || entry.createdAt)}</span>
                </span>
                <form action={reviewEntryAction} className={styles.reviewForm}>
                  <input type="hidden" name="entryId" value={entry.entryId} />
                  <input
                    className={styles.input}
                    type="text"
                    name="reviewNote"
                    defaultValue={entry.reviewNote || ''}
                    placeholder="Reviewer note"
                  />
                  <div className={styles.reviewButtons}>
                    <button type="submit" name="targetStatus" value="active" className={styles.buttonPrimary}>
                      Approve
                    </button>
                    <button type="submit" name="targetStatus" value="rejected" className={styles.buttonGhost}>
                      Reject
                    </button>
                    <Link href={`/dashboard/profiles/${entry.profile.slug}?entry=${entry.entryId}`} className={styles.linkButton}>
                      Open
                    </Link>
                  </div>
                </form>
              </div>
            ))
          )}
        </div>
      </section>

      <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <h2 className={styles.panelTitle}>Live routes</h2>
              <p className={styles.panelText}>Pause an active route without deleting it from the owner inventory. Traffic counts here only reflect Nullcost routing events.</p>
            </div>
            <span className={styles.pill}>{workspace.liveEntries.length}</span>
          </div>

        <div className={styles.reviewTable}>
          <div className={`${styles.reviewRow} ${styles.reviewHeader}`}>
            <span>Provider</span>
            <span>Route</span>
            <span>Nullcost traffic</span>
            <span>Reviewed</span>
            <span>Action</span>
          </div>

          {workspace.liveEntries.length === 0 ? (
            <div className={styles.empty}>No active routes are available for reviewer pause actions.</div>
          ) : (
            workspace.liveEntries.map((entry) => (
              <div key={entry.entryId} className={styles.reviewRow}>
                <span>
                  <strong>{entry.provider.name}</strong>
                  <span className={styles.tableCellMuted}> · {entry.profile.displayName}</span>
                </span>
                <span className={styles.reviewInfo}>
                  <strong>{entry.title || humanize(entry.kind)}</strong>
                  <span>{shortHost(entry.referralUrl || entry.destinationUrl)}</span>
                </span>
                <span className={styles.reviewInfo}>
                  <span>{entry.cloudbrokerSelectionCount} selections</span>
                  <span className={styles.tableCellMuted}>{entry.cloudbrokerRedirectCount} recorded redirects</span>
                </span>
                <span className={styles.reviewInfo}>
                  <span>{formatDate(entry.reviewedAt || entry.submittedAt || entry.createdAt)}</span>
                  <span className={styles.tableCellMuted}>{entry.reviewNote || 'No reviewer note'}</span>
                </span>
                <form action={reviewEntryAction} className={styles.reviewForm}>
                  <input type="hidden" name="entryId" value={entry.entryId} />
                  <input
                    className={styles.input}
                    type="text"
                    name="reviewNote"
                    defaultValue={entry.reviewNote || ''}
                    placeholder="Pause note"
                  />
                  <div className={styles.reviewButtons}>
                    <button type="submit" name="targetStatus" value="paused" className={styles.buttonGhost}>
                      Pause
                    </button>
                    <Link href={`/providers/${entry.provider.slug}`} className={styles.linkButton}>
                      Provider
                    </Link>
                  </div>
                </form>
              </div>
            ))
          )}
        </div>
      </section>
    </DashboardShell>
  );
}

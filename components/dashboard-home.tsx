import Link from 'next/link';
import type { CurrentAccount } from '@/lib/auth/account';
import type { DashboardMembershipSummary } from '@/lib/referrals/owner';
import { AuthSignOutButton } from '@/components/auth-sign-out-button';
import { saveAccountBasicsAction } from '@/app/dashboard/actions';
import { DashboardShell } from './dashboard-shell';
import styles from './dashboard-shell.module.css';

interface DashboardHomeProps {
  account: CurrentAccount;
  memberships: DashboardMembershipSummary[];
  notice?: string | null;
  error?: string | null;
}

function totalEntries(row: DashboardMembershipSummary) {
  return Object.values(row.counts).reduce((sum, value) => sum + value, 0);
}

function getStatusTone(status: DashboardMembershipSummary['status']) {
  if (status === 'active') return styles.pillGood;
  if (status === 'pending') return styles.pillWarn;
  return styles.pillMuted;
}

function getMembershipStatusLabel(status: DashboardMembershipSummary['status']) {
  switch (status) {
    case 'active':
      return 'Approved';
    case 'pending':
      return 'Waiting';
    case 'rejected':
      return 'Rejected';
    default:
      return status;
  }
}

function getRoleLabel(role: DashboardMembershipSummary['role']) {
  return role === 'owner' ? 'Owner' : 'Editor';
}

function getNoticeCopy(value?: string | null) {
  switch (value) {
    case 'account-saved':
      return 'Your account details were saved.';
    case 'claim-active':
      return 'Your code page is ready.';
    case 'claim-requested':
      return 'Your access request is waiting for approval.';
    default:
      return null;
  }
}

function getErrorCopy(value?: string | null) {
  switch (value) {
    case 'claim-slug-required':
      return 'Enter a profile name before continuing.';
    default:
      return value || null;
  }
}

function formatDate(value: string | null) {
  if (!value) {
    return 'Not captured';
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('en-AU', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(parsed);
}

export function DashboardHome({ account, memberships, notice, error }: DashboardHomeProps) {
  const activeMemberships = memberships.filter((membership) => membership.status === 'active').length;
  const totalDrafts = memberships.reduce((sum, membership) => sum + membership.counts.draft, 0);
  const totalActiveEntries = memberships.reduce((sum, membership) => sum + membership.counts.active, 0);
  const totalPausedEntries = memberships.reduce((sum, membership) => sum + membership.counts.paused, 0);
  const noticeCopy = getNoticeCopy(notice);
  const errorCopy = getErrorCopy(error);
  const primaryProfile = memberships.find((membership) => membership.status === 'active');

  return (
    <DashboardShell
      accountName={account.profile.displayName}
      title="My account"
      subtitle="Update your details and manage the codes you have added to providers."
      section="overview"
      metaLabel="Account"
      metaValue={account.email}
    >
      <div className={styles.grid}>
        {noticeCopy ? <p className={styles.notice}>{noticeCopy}</p> : null}
        {errorCopy ? <p className={styles.error}>{errorCopy}</p> : null}
      </div>

      <div className={`${styles.grid} ${styles.gridMainAside}`}>
        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <h2 className={styles.panelTitle}>Add your first code</h2>
              <p className={styles.panelText}>
                Open any provider page, then add your referral link or code there. Nullcost creates your code page
                automatically the first time you save one.
              </p>
            </div>
            <span className={`${styles.pill} ${styles.pillGood}`}>Signed in</span>
          </div>

          <div className={styles.actions}>
            <Link href="/" className={styles.buttonPrimary}>
              Browse providers
            </Link>
            {primaryProfile ? (
              <Link href={`/dashboard/profiles/${primaryProfile.profile.slug}`} className={styles.linkButton}>
                Open my codes
              </Link>
            ) : null}
          </div>

          <div className={styles.summaryList}>
            <div className={styles.summaryRow}>
              <strong>How it works</strong>
              <span>Add a code on a provider page, then use this dashboard later if you want to edit or delete it.</span>
            </div>
            <div className={styles.summaryRow}>
              <strong>What stays private</strong>
              <span>Your contact email and default disclosure note stay inside your dashboard.</span>
            </div>
          </div>
        </section>

        <aside className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <h2 className={styles.panelTitle}>Account basics</h2>
              <p className={styles.panelText}>Keep the account name current. Email stays tied to your login.</p>
            </div>
          </div>

          <form action={saveAccountBasicsAction} className={styles.form}>
            <label className={styles.field}>
              <span className={styles.label}>Display name</span>
              <input className={styles.input} type="text" name="displayName" defaultValue={account.profile.displayName} />
            </label>

            <label className={styles.field}>
              <span className={styles.label}>Email</span>
              <input className={`${styles.input} ${styles.code}`} type="email" value={account.email} readOnly disabled />
            </label>

            <div className={styles.actions}>
              <button type="submit" className={styles.buttonPrimary}>
                Save account
              </button>
              <AuthSignOutButton />
            </div>
          </form>

          <div className={styles.summaryList}>
            <div className={styles.summaryRow}>
              <strong>{account.profile.displayName}</strong>
              <span>{account.email}</span>
            </div>
            <div className={styles.summaryRow}>
              <strong>Member since</strong>
              <span>{formatDate(account.profile.createdAt)}</span>
            </div>
          </div>

          <div className={styles.strip}>
            <div className={styles.stripCell}>
              <span className={styles.label}>Code pages</span>
              <strong>{activeMemberships}</strong>
            </div>
            <div className={styles.stripCell}>
              <span className={styles.label}>Not live</span>
              <strong>{totalDrafts}</strong>
            </div>
            <div className={styles.stripCell}>
              <span className={styles.label}>Live codes</span>
              <strong>{totalActiveEntries}</strong>
            </div>
            <div className={styles.stripCell}>
              <span className={styles.label}>Off</span>
              <strong>{totalPausedEntries}</strong>
            </div>
          </div>
        </aside>
      </div>

      <section className={styles.panel}>
        <div className={styles.panelHeader}>
          <div>
            <h2 className={styles.panelTitle}>My code pages</h2>
            <p className={styles.panelText}>
              These are the pages Nullcost uses to store the codes you manage.
            </p>
          </div>
          <span className={styles.pill}>{memberships.length}</span>
        </div>

        <div className={styles.table}>
          <div className={`${styles.tableRow} ${styles.tableHeader}`}>
            <span>Code page</span>
            <span>Role</span>
            <span>Status</span>
            <span>Codes</span>
            <span>Not live / live</span>
            <span>Action</span>
          </div>

          {memberships.length === 0 ? (
            <div className={styles.empty}>You have not added any codes yet.</div>
          ) : (
            memberships.map((membership) => (
              <div key={membership.membershipId} className={styles.tableRow}>
                <span>
                  <strong>{membership.profile.displayName}</strong>
                  <span className={styles.tableCellMuted}> · {membership.profile.slug}</span>
                </span>
                <span className={styles.code}>{getRoleLabel(membership.role)}</span>
                <span>
                  <span className={`${styles.pill} ${getStatusTone(membership.status)}`}>{getMembershipStatusLabel(membership.status)}</span>
                </span>
                <span>{totalEntries(membership)}</span>
                <span className={styles.tableCellMuted}>
                  {membership.counts.draft} not live · {membership.counts.active} live
                </span>
                <span>
                  <Link
                    href={
                      membership.status === 'active'
                        ? `/dashboard/profiles/${membership.profile.slug}`
                        : `/dashboard/claim/${membership.profile.slug}`
                    }
                    className={styles.linkButton}
                  >
                    {membership.status === 'active' ? 'Open' : 'Claim status'}
                  </Link>
                </span>
              </div>
            ))
          )}
        </div>
      </section>
    </DashboardShell>
  );
}

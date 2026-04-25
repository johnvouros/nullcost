import Link from 'next/link';
import type { CurrentAccount } from '@/lib/auth/account';
import type { OwnedProfileWorkspace } from '@/lib/referrals/owner';
import {
  createDraftEntryAction,
  saveProfileBasicsAction,
  updateOwnedEntryAction,
} from '@/app/dashboard/actions';
import { DashboardShell } from './dashboard-shell';
import styles from './dashboard-shell.module.css';

interface DashboardProfileShellProps {
  account: CurrentAccount;
  workspace: OwnedProfileWorkspace;
  notice?: string | null;
  error?: string | null;
  selectedEntryId?: string | null;
}

function humanize(value: string | null | undefined) {
  return String(value || '')
    .replace(/_/g, ' ')
    .trim();
}

function statusTone(status: string) {
  if (status === 'active') return styles.pillGood;
  if (status === 'pending') return styles.pillWarn;
  if (status === 'draft') return styles.pillMuted;
  if (status === 'paused' || status === 'archived') return styles.pillWarn;
  return styles.pillMuted;
}

function getCodeStatusLabel(status: string) {
  switch (status) {
    case 'draft':
      return 'Not live';
    case 'pending':
      return 'Waiting';
    case 'active':
      return 'Live';
    case 'paused':
      return 'Off';
    case 'rejected':
      return 'Needs changes';
    case 'archived':
      return 'Deleted';
    default:
      return humanize(status);
  }
}

function getProfileStatusLabel(status: string) {
  switch (status) {
    case 'active':
      return 'Live';
    case 'paused':
      return 'Off';
    default:
      return humanize(status);
  }
}

function getMembershipStatusLabel(status: string) {
  switch (status) {
    case 'active':
      return 'Approved';
    case 'pending':
      return 'Waiting';
    case 'rejected':
      return 'Rejected';
    default:
      return humanize(status);
  }
}

function getRoleLabel(role: string) {
  return role === 'owner' ? 'Owner' : role === 'editor' ? 'Editor' : humanize(role);
}

function kindOptions() {
  return [
    { value: 'referral_link', label: 'Referral link' },
    { value: 'affiliate_link', label: 'Affiliate link' },
    { value: 'coupon_code', label: 'Coupon code' },
  ];
}

function getNoticeCopy(value?: string | null) {
  switch (value) {
    case 'profile-saved':
      return 'Code page details saved.';
    case 'draft-created':
      return 'New code saved. It is not live yet.';
    case 'entry-saved':
      return 'Code changes saved.';
    case 'entry-published':
      return 'Code is now live.';
    case 'entry-paused':
      return 'Code turned off.';
    case 'entry-archived':
      return 'Code deleted.';
    case 'claim-active':
      return 'You can manage this profile now.';
    default:
      return null;
  }
}

function getErrorCopy(value?: string | null) {
  switch (value) {
    case 'rate-limited':
      return 'Too many changes in a short time. Wait a moment before trying again.';
    default:
      return value || null;
  }
}

export function DashboardProfileShell({
  account,
  workspace,
  notice,
  error,
  selectedEntryId,
}: DashboardProfileShellProps) {
  const selectedEntry =
    workspace.entries.find((entry) => entry.id === selectedEntryId) || workspace.entries[0] || null;
  const noticeCopy = getNoticeCopy(notice);
  const errorCopy = getErrorCopy(error);

  return (
    <DashboardShell
      accountName={account.profile.displayName}
      title={workspace.profile.displayName}
      subtitle="Edit the page Nullcost uses to store your codes and links."
      section="profile"
      backHref="/dashboard"
      backLabel="Back to dashboard"
      metaLabel="Membership"
      metaValue={`${getRoleLabel(workspace.membership.role)} · ${getMembershipStatusLabel(workspace.membership.status)}`}
      claimHref={`/dashboard/claim/${workspace.profile.slug}`}
      profileHref={`/dashboard/profiles/${workspace.profile.slug}`}
    >
      <div className={styles.grid}>
        {noticeCopy ? <p className={styles.notice}>{noticeCopy}</p> : null}
        {errorCopy ? <p className={styles.error}>{errorCopy}</p> : null}
      </div>

      <div className={styles.strip}>
        <div className={styles.stripCell}>
          <span className={styles.label}>Not live</span>
          <strong>{workspace.counts.draft}</strong>
        </div>
        <div className={styles.stripCell}>
          <span className={styles.label}>Waiting</span>
          <strong>{workspace.counts.pending}</strong>
        </div>
        <div className={styles.stripCell}>
          <span className={styles.label}>Live</span>
          <strong>{workspace.counts.active}</strong>
        </div>
        <div className={styles.stripCell}>
          <span className={styles.label}>Off</span>
          <strong>{workspace.counts.paused}</strong>
        </div>
      </div>

      <div className={`${styles.grid} ${styles.gridMainAside}`}>
        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <h2 className={styles.panelTitle}>Profile details</h2>
              <p className={styles.panelText}>
                This is what people can see on your public code page. Your contact email and default disclosure note stay private.
              </p>
            </div>
            <span className={`${styles.pill} ${styles.pillGood}`}>{getProfileStatusLabel(workspace.profile.publicStatus)}</span>
          </div>

          <form action={saveProfileBasicsAction} className={styles.form}>
            <input type="hidden" name="profileSlug" value={workspace.profile.slug} />
            <div className={styles.fieldGrid}>
              <label className={styles.field}>
                <span className={styles.label}>Display name</span>
                <input className={styles.input} type="text" name="displayName" defaultValue={workspace.profile.displayName} />
              </label>

              <label className={styles.field}>
                <span className={styles.label}>Website</span>
                <input className={styles.input} type="url" name="website" defaultValue={workspace.profile.website || ''} />
              </label>

              <label className={`${styles.field} ${styles.fieldWide}`}>
                <span className={styles.label}>Bio</span>
                <textarea className={styles.textarea} name="bio" defaultValue={workspace.profile.bio || ''} />
              </label>

              <label className={styles.field}>
                <span className={styles.label}>Private email</span>
                <input
                  className={styles.input}
                  type="email"
                  name="contactEmail"
                  defaultValue={workspace.privateSettings.contactEmail || account.email}
                />
              </label>

              <label className={`${styles.field} ${styles.fieldWide}`}>
                <span className={styles.label}>Default disclosure note</span>
                <textarea
                  className={styles.textarea}
                  name="defaultDisclosure"
                  defaultValue={workspace.privateSettings.defaultDisclosure || ''}
                />
              </label>
            </div>

            <div className={styles.actions}>
              <button type="submit" className={styles.buttonPrimary}>
                Save page
              </button>
              <Link href={`/profiles/${workspace.profile.slug}`} className={styles.linkButton}>
                View public page
              </Link>
            </div>
          </form>
        </section>

        <aside className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <h2 className={styles.panelTitle}>Page summary</h2>
              <p className={styles.panelText}>Quick details about this code page.</p>
            </div>
          </div>

          <div className={styles.summaryList}>
            <div className={styles.summaryRow}>
              <strong>Page key</strong>
              <span className={styles.code}>{workspace.profile.slug}</span>
            </div>
            <div className={styles.summaryRow}>
              <strong>Role</strong>
              <span>{getRoleLabel(workspace.membership.role)}</span>
            </div>
            <div className={styles.summaryRow}>
              <strong>Status</strong>
              <span>{getMembershipStatusLabel(workspace.membership.status)}</span>
            </div>
            <div className={styles.summaryRow}>
              <strong>Default note</strong>
              <span>{workspace.privateSettings.defaultDisclosure || 'Not set'}</span>
            </div>
          </div>
        </aside>
      </div>

      <div className={`${styles.grid} ${styles.gridMainAside}`}>
        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <h2 className={styles.panelTitle}>My codes</h2>
              <p className={styles.panelText}>
                Codes that are not live stay private. Open one to edit it, publish it, turn it off, or delete it.
              </p>
            </div>
            <span className={styles.pill}>{workspace.entries.length}</span>
          </div>

          <div className={styles.table}>
            <div className={`${styles.tableRow} ${styles.tableHeader}`}>
              <span>Provider</span>
              <span>Type</span>
              <span>Status</span>
              <span>Code</span>
              <span>Nullcost activity</span>
              <span>Action</span>
            </div>

            {workspace.entries.length === 0 ? (
              <div className={styles.empty}>No codes have been added to this page yet.</div>
            ) : (
              workspace.entries.map((entry) => (
                <div key={entry.id} className={styles.tableRow}>
                  <span>
                    <strong>{entry.provider.name}</strong>
                    <span className={styles.tableCellMuted}> · {entry.provider.slug}</span>
                  </span>
                  <span className={styles.code}>{humanize(entry.kind)}</span>
                  <span>
                    <span className={`${styles.pill} ${statusTone(entry.status)}`}>{getCodeStatusLabel(entry.status)}</span>
                  </span>
                  <span className={styles.tableCellMuted}>{entry.title || entry.referralCode || 'Untitled route'}</span>
                  <span className={styles.tableCellMuted}>
                    {entry.cloudbrokerSelectionCount} selections · {entry.cloudbrokerRedirectCount} recorded redirects
                  </span>
                  <span>
                    <Link href={`/dashboard/profiles/${workspace.profile.slug}?entry=${entry.id}`} className={styles.linkButton}>
                      Edit
                    </Link>
                  </span>
                </div>
              ))
            )}
          </div>
        </section>

        <aside className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <h2 className={styles.panelTitle}>Add a new code</h2>
              <p className={styles.panelText}>Start with a provider name and either a referral link or a code.</p>
            </div>
          </div>

          <form action={createDraftEntryAction} className={styles.form}>
            <input type="hidden" name="profileSlug" value={workspace.profile.slug} />

            <label className={styles.field}>
              <span className={styles.label}>Provider name</span>
              <input className={`${styles.input} ${styles.code}`} type="text" name="providerSlug" placeholder="vercel" />
            </label>

            <label className={styles.field}>
              <span className={styles.label}>Type</span>
              <select className={styles.select} name="kind" defaultValue="referral_link">
                {kindOptions().map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className={styles.field}>
              <span className={styles.label}>Title</span>
              <input className={styles.input} type="text" name="title" placeholder="Summer signup link" />
            </label>

            <label className={styles.field}>
              <span className={styles.label}>Affiliate / referral link</span>
              <input className={styles.input} type="url" name="referralUrl" placeholder="https://example.com/r/ref-123" />
            </label>

            <label className={styles.field}>
              <span className={styles.label}>Official destination</span>
              <input className={styles.input} type="url" name="destinationUrl" placeholder="https://provider.com/pricing" />
            </label>

            <label className={styles.field}>
              <span className={styles.label}>Code</span>
              <input className={`${styles.input} ${styles.code}`} type="text" name="referralCode" placeholder="SAVE10" />
            </label>

            <label className={styles.field}>
              <span className={styles.label}>Disclosure note</span>
              <textarea
                className={styles.textarea}
                name="disclosure"
                placeholder={workspace.privateSettings.defaultDisclosure || 'This route may benefit the profile owner.'}
              />
            </label>

            <div className={styles.actions}>
              <button type="submit" className={styles.buttonPrimary}>
                Save code
              </button>
            </div>
          </form>
        </aside>
      </div>

      {selectedEntry ? (
        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <h2 className={styles.panelTitle}>Edit code</h2>
              <p className={styles.panelText}>
                Provider: {selectedEntry.provider.name} · status: {getCodeStatusLabel(selectedEntry.status)}
              </p>
            </div>
            <span className={`${styles.pill} ${statusTone(selectedEntry.status)}`}>{getCodeStatusLabel(selectedEntry.status)}</span>
          </div>

          <form action={updateOwnedEntryAction} className={styles.form}>
            <input type="hidden" name="profileSlug" value={workspace.profile.slug} />
            <input type="hidden" name="entryId" value={selectedEntry.id} />

            <div className={styles.fieldGrid}>
              <label className={styles.field}>
                <span className={styles.label}>Provider name</span>
                <input
                  className={`${styles.input} ${styles.code}`}
                  type="text"
                  name="providerSlug"
                  defaultValue={selectedEntry.provider.slug}
                />
              </label>

              <label className={styles.field}>
                <span className={styles.label}>Type</span>
                <select className={styles.select} name="kind" defaultValue={selectedEntry.kind}>
                  {kindOptions().map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className={styles.field}>
                <span className={styles.label}>Title</span>
                <input className={styles.input} type="text" name="title" defaultValue={selectedEntry.title || ''} />
              </label>

              <label className={styles.field}>
                <span className={styles.label}>Code</span>
                <input
                  className={`${styles.input} ${styles.code}`}
                  type="text"
                  name="referralCode"
                  defaultValue={selectedEntry.referralCode || ''}
                />
              </label>

              <label className={`${styles.field} ${styles.fieldWide}`}>
                <span className={styles.label}>Affiliate / referral link</span>
                <input
                  className={styles.input}
                  type="url"
                  name="referralUrl"
                  defaultValue={selectedEntry.referralUrl || ''}
                />
              </label>

              <label className={`${styles.field} ${styles.fieldWide}`}>
                <span className={styles.label}>Official destination</span>
                <input
                  className={styles.input}
                  type="url"
                  name="destinationUrl"
                  defaultValue={selectedEntry.destinationUrl || ''}
                />
              </label>

              <label className={`${styles.field} ${styles.fieldWide}`}>
                <span className={styles.label}>Disclosure note</span>
                <textarea
                  className={styles.textarea}
                  name="disclosure"
                  defaultValue={selectedEntry.disclosure || workspace.privateSettings.defaultDisclosure || ''}
                />
              </label>
            </div>

            {selectedEntry.reviewNote ? (
              <p className={styles.hint}>Review note: {selectedEntry.reviewNote}</p>
            ) : null}

            <div className={styles.actions}>
              <button type="submit" className={styles.buttonPrimary}>
                Save code
              </button>
              <button type="submit" name="targetStatus" value="active" className={styles.buttonGhost}>
                Publish
              </button>
              <button type="submit" name="targetStatus" value="paused" className={styles.buttonGhost}>
                Turn off
              </button>
              <button type="submit" name="targetStatus" value="archived" className={styles.buttonGhost}>
                Delete
              </button>
            </div>
          </form>
        </section>
      ) : null}
    </DashboardShell>
  );
}

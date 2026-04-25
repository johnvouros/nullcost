import Link from 'next/link';
import styles from './provider-profile.module.css';

export interface SubmissionNotice {
  tone: 'success' | 'error' | 'idle';
  title?: string;
  message?: string;
}

interface ProviderReferralFormProps {
  providerName: string;
  action: (formData: FormData) => void | Promise<void>;
  submissionNotice: SubmissionNotice;
  accountContext: {
    displayName: string;
    email: string;
  } | null;
  managedEntry: {
    id: string;
    status: string;
    referralUrl: string | null;
    destinationUrl: string | null;
    referralCode: string | null;
    disclosure: string | null;
    cloudbrokerSelectionCount: number;
    cloudbrokerRedirectCount: number;
    profile: {
      slug: string;
      displayName: string;
    };
  } | null;
  dashboardAction?: {
    href: string;
    label: string;
  } | null;
}

function getStoredReferralValue(
  entry:
    | {
        referralUrl: string | null;
        referralCode: string | null;
      }
    | null
    | undefined,
) {
  return entry?.referralUrl || entry?.referralCode || '';
}

function getStatusLabel(status: string | null | undefined) {
  switch (status) {
    case 'active':
      return 'Live';
    case 'paused':
      return 'Off';
    case 'archived':
      return 'Deleted';
    case 'rejected':
      return 'Needs changes';
    default:
      return 'Not live';
  }
}

export function ProviderReferralForm({
  providerName,
  action,
  submissionNotice,
  accountContext,
  managedEntry,
  dashboardAction,
}: ProviderReferralFormProps) {
  if (!accountContext) {
    return (
      <section className={styles.formCard} id="my-code">
        <div className={styles.cardHeader}>
          <div>
            <p className={styles.kicker}>My code</p>
            <h3>Add your {providerName} referral code</h3>
          </div>
          <span className={styles.headerStat}>Sign in</span>
        </div>

        <p className={styles.cardText}>
          Sign in, paste your referral link or code, and submit it. That is the whole flow.
        </p>

        <div className={styles.summaryList}>
          <div className={styles.summaryRowCompact}>
            <strong>Paste this</strong>
            <span>A full referral link or just the code.</span>
          </div>
          <div className={styles.summaryRowCompact}>
            <strong>What happens next</strong>
            <span>Nullcost creates your private code page automatically the first time you submit one.</span>
          </div>
        </div>

        {dashboardAction ? (
          <div className={styles.formActionRow}>
            <Link href={dashboardAction.href} className={styles.submitButton}>
              {dashboardAction.label}
            </Link>
          </div>
        ) : null}
      </section>
    );
  }

  const isLive = managedEntry?.status === 'active';
  const isOff = managedEntry?.status === 'paused';

  return (
    <section className={styles.formCard} id="my-code">
      <div className={styles.cardHeader}>
        <div>
          <p className={styles.kicker}>My code</p>
          <h3>{managedEntry ? `Edit my ${providerName} code` : `Add my ${providerName} code`}</h3>
        </div>
        <span className={styles.headerStat}>{managedEntry ? getStatusLabel(managedEntry.status) : 'No code yet'}</span>
      </div>

      <p className={styles.cardText}>
        Signed in as {accountContext.displayName}. Paste your full referral link or just the code, then submit it.
        Nullcost keeps one code per provider for each account.
      </p>

      <div className={styles.summaryList}>
        <div className={styles.summaryRowCompact}>
          <strong>Paste this</strong>
          <span>A full referral link or just the code.</span>
        </div>
        <div className={styles.summaryRowCompact}>
          <strong>We save it to</strong>
          <span>{managedEntry ? managedEntry.profile.displayName : 'your account automatically'}</span>
        </div>
        {managedEntry ? (
          <div className={styles.summaryRowCompact}>
            <strong>Nullcost activity</strong>
            <span>
              {managedEntry.cloudbrokerSelectionCount} selections · {managedEntry.cloudbrokerRedirectCount} recorded
              redirects
            </span>
          </div>
        ) : null}
      </div>

      {submissionNotice.tone !== 'idle' ? (
        <div
          className={`${styles.notice} ${
            submissionNotice.tone === 'success' ? styles.noticeSuccess : styles.noticeError
          }`}
        >
          <strong>{submissionNotice.title}</strong>
          <span>{submissionNotice.message}</span>
        </div>
      ) : null}

      <form action={action} className={styles.form}>
        <div className={styles.formGrid}>
          <label className={`${styles.field} ${styles.fieldWide}`}>
            <span>Referral link or code</span>
            <input
              name="referralInput"
              defaultValue={getStoredReferralValue(managedEntry)}
              placeholder="Paste a full referral link or just the code"
              className={styles.referralInput}
            />
            <small className={styles.fieldHint}>
              Example: `https://provider.com/r/your-link` or `SAVE20`
            </small>
          </label>
        </div>

        <details className={styles.formDetails}>
          <summary className={styles.formDetailsSummary}>Optional details</summary>
          <div className={styles.formDetailsBody}>
            <label className={`${styles.field} ${styles.fieldWide}`}>
              <span>Official destination</span>
              <input
                name="destinationUrl"
                type="url"
                defaultValue={managedEntry?.destinationUrl || ''}
                placeholder="https://provider.com/pricing"
              />
            </label>

            <label className={`${styles.field} ${styles.fieldWide}`}>
              <span>Disclosure note</span>
              <textarea
                name="disclosure"
                rows={4}
                defaultValue={managedEntry?.disclosure || ''}
                placeholder="Optional note for users, for example: This route may benefit me if you sign up."
              />
            </label>
          </div>
        </details>

        <div className={styles.formFooter}>
          <div className={styles.formHint}>Only Nullcost-side selections and redirects are shown here.</div>

          <div className={styles.formButtonGroup}>
            <button className={styles.submitButton} type="submit" name="targetStatus" value="active">
              {isLive ? 'Update code' : managedEntry ? 'Submit code' : 'Add referral code'}
            </button>
            {managedEntry ? (
              <>
                <button className={styles.ghostButton} type="submit" name="targetStatus" value="paused">
                  {isOff ? 'Keep off' : 'Turn off'}
                </button>
                <button className={styles.ghostButton} type="submit" name="targetStatus" value="archived">
                  Delete
                </button>
              </>
            ) : null}
          </div>
        </div>

        {dashboardAction ? (
          <div className={styles.formActionRow}>
            <Link href={dashboardAction.href} className={styles.inlineManageLink}>
              {dashboardAction.label}
            </Link>
          </div>
        ) : null}
      </form>
    </section>
  );
}

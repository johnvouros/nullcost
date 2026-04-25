import Link from 'next/link';
import type { CurrentAccount } from '@/lib/auth/account';
import type { ReviewerMode } from '@/lib/auth/reviewer';
import type { RouterWorkspace } from '@/lib/referrals/router';
import { jumpToRouterProviderAction, saveRouterControlAction, saveRouterEntryWeightAction } from '@/app/dashboard/actions';
import { DashboardShell } from './dashboard-shell';
import styles from './dashboard-shell.module.css';

interface DashboardRouterShellProps {
  account: CurrentAccount;
  reviewerMode: ReviewerMode;
  workspace: RouterWorkspace;
  notice?: string | null;
  error?: string | null;
}

function formatDate(value: string | null) {
  if (!value) return 'Not set';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat('en-AU', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(parsed);
}

function shortHost(value: string | null) {
  if (!value) return 'No target';
  try {
    return new URL(value).host.replace(/^www\./, '');
  } catch {
    return value;
  }
}

function humanize(value: string) {
  return value.replace(/_/g, ' ');
}

function modeLabel(mode: RouterWorkspace['control']['mode']) {
  switch (mode) {
    case 'equal':
      return 'Equal';
    case 'paused':
      return 'Paused';
    case 'fallback_only':
      return 'Fallback only';
    default:
      return 'Weighted';
  }
}

function reviewerModeLabel(mode: ReviewerMode) {
  return mode === 'allowlist' ? 'Allowlisted reviewer' : 'Local dev reviewer';
}

function getNoticeCopy(value?: string | null) {
  switch (value) {
    case 'router-saved':
      return 'Router controls saved. New `/go` traffic now uses the updated mode and fallback order.';
    case 'weight-saved':
      return 'Entry weight saved. Weighted mode uses the new value immediately.';
    default:
      return null;
  }
}

function getErrorCopy(value?: string | null) {
  switch (value) {
    case 'router-provider-required':
      return 'Enter a provider slug before opening the router console.';
    default:
      return value || null;
  }
}

export function DashboardRouterShell({
  account,
  reviewerMode,
  workspace,
  notice,
  error,
}: DashboardRouterShellProps) {
  const noticeCopy = getNoticeCopy(notice);
  const errorCopy = getErrorCopy(error);

  return (
    <DashboardShell
      accountName={account.profile.displayName}
      title={`Router console · ${workspace.provider.name}`}
      subtitle="Inspect live pool state, adjust fallback behavior, and tune weighted routing without opening the database."
      section="router"
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
            <span className={styles.label}>Mode</span>
            <strong>{modeLabel(workspace.control.mode)}</strong>
          </div>
        <div className={styles.stripCell}>
          <span className={styles.label}>Active pool</span>
          <strong>{workspace.metrics.activePool}</strong>
        </div>
          <div className={styles.stripCell}>
            <span className={styles.label}>Nullcost selections</span>
            <strong>{workspace.metrics.totalCloudbrokerSelections}</strong>
          </div>
          <div className={styles.stripCell}>
            <span className={styles.label}>Nullcost redirects</span>
            <strong>{workspace.metrics.totalCloudbrokerRedirects}</strong>
          </div>
        </div>

      <div className={`${styles.grid} ${styles.gridMainAside}`}>
        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <h2 className={styles.panelTitle}>Provider target</h2>
              <p className={styles.panelText}>Jump to a provider slug and inspect its live routing state.</p>
            </div>
          </div>

          <form action={jumpToRouterProviderAction} className={styles.form}>
            <div className={styles.fieldGrid}>
              <label className={styles.field}>
                <span className={styles.label}>Provider slug</span>
                <input className={`${styles.input} ${styles.code}`} type="text" name="providerSlug" defaultValue={workspace.provider.slug} />
              </label>
            </div>
            <div className={styles.actions}>
              <button type="submit" className={styles.buttonPrimary}>Open provider</button>
              <Link href={`/providers/${workspace.provider.slug}`} className={styles.linkButton}>Provider page</Link>
            </div>
          </form>

          <div className={styles.summaryList}>
            <div className={styles.summaryRow}>
              <strong>Fallback target</strong>
              <span>{workspace.fallback.label} · {shortHost(workspace.fallback.url)}</span>
            </div>
            <div className={styles.summaryRow}>
              <strong>Semantics</strong>
              <span>All counters here are Nullcost-only. `Redirects` are logged on our router flow and are not provider-side attribution or conversions.</span>
            </div>
          </div>
        </section>

        <aside className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <h2 className={styles.panelTitle}>Router controls</h2>
              <p className={styles.panelText}>Mode changes affect the next selection immediately.</p>
            </div>
          </div>

          <form action={saveRouterControlAction} className={styles.form}>
            <input type="hidden" name="providerSlug" value={workspace.provider.slug} />

            <label className={styles.field}>
              <span className={styles.label}>Mode</span>
              <select className={styles.select} name="mode" defaultValue={workspace.control.mode}>
                <option value="weighted">Weighted</option>
                <option value="equal">Equal</option>
                <option value="paused">Paused</option>
                <option value="fallback_only">Fallback only</option>
              </select>
            </label>

            <label className={styles.field}>
              <span className={styles.label}>Fallback preference</span>
              <select className={styles.select} name="fallbackPreference" defaultValue={workspace.control.fallbackPreference}>
                <option value="official">Official site</option>
                <option value="docs">Docs</option>
                <option value="pricing">Pricing</option>
                <option value="signup">Signup</option>
                <option value="provider_page">Provider page</option>
              </select>
            </label>

            <div className={styles.summaryList}>
              <div className={styles.summaryRow}>
                <strong>Updated</strong>
                <span>{formatDate(workspace.control.updatedAt)}</span>
              </div>
              <div className={styles.summaryRow}>
                <strong>Current fallback</strong>
                <span>{workspace.fallback.label}</span>
              </div>
            </div>

            <div className={styles.actions}>
              <button type="submit" className={styles.buttonPrimary}>Save controls</button>
            </div>
          </form>
        </aside>
      </div>

      <section className={styles.panel}>
        <div className={styles.panelHeader}>
          <div>
            <h2 className={styles.panelTitle}>Pool inventory</h2>
            <p className={styles.panelText}>Weights only affect `weighted` mode. `equal` ignores them.</p>
          </div>
          <span className={styles.pill}>{workspace.entries.length}</span>
        </div>

        <div className={styles.reviewTable}>
          <div className={`${styles.reviewRow} ${styles.reviewHeader}`}>
            <span>Profile</span>
            <span>Route</span>
            <span>Status / usage</span>
            <span>Weight</span>
            <span>Action</span>
          </div>

          {workspace.entries.length === 0 ? (
            <div className={styles.empty}>No referral entries exist for this provider yet.</div>
          ) : (
            workspace.entries.map((entry) => (
              <div key={entry.id} className={styles.reviewRow}>
                <span>
                  <strong>{entry.profile?.displayName || 'Profile missing'}</strong>
                  <span className={styles.tableCellMuted}> · {entry.profile?.slug || 'unknown'}</span>
                </span>
                <span className={styles.reviewInfo}>
                  <strong>{entry.title || humanize(entry.kind)}</strong>
                  <span>{shortHost(entry.referralUrl || entry.destinationUrl)}</span>
                  {entry.referralCode ? <span className={styles.tableCellMuted}>code {entry.referralCode}</span> : null}
                </span>
                <span className={styles.reviewInfo}>
                  <span className={`${styles.pill} ${entry.status === 'active' ? styles.pillGood : entry.status === 'pending' ? styles.pillWarn : styles.pillMuted}`}>{entry.status}</span>
                  <span className={styles.tableCellMuted}>{entry.cloudbrokerSelectionCount} nc sel · {entry.cloudbrokerRedirectCount} nc redir</span>
                </span>
                <form action={saveRouterEntryWeightAction} className={styles.reviewForm}>
                  <input type="hidden" name="providerSlug" value={workspace.provider.slug} />
                  <input type="hidden" name="entryId" value={entry.id} />
                  <input className={`${styles.input} ${styles.code}`} type="number" min="1" step="1" name="weight" defaultValue={String(entry.weight)} />
                  <div className={styles.reviewMeta}>
                    <span>last nc sel {formatDate(entry.lastCloudbrokerSelectionAt)}</span>
                    <span className={styles.tableCellMuted}>last nc redir {formatDate(entry.lastCloudbrokerRedirectAt)}</span>
                  </div>
                  <div className={styles.reviewButtons}>
                    <button type="submit" className={styles.buttonGhost}>Save weight</button>
                    <Link href={`/dashboard/profiles/${entry.profile?.slug}?entry=${entry.id}`} className={styles.linkButton}>Open</Link>
                  </div>
                </form>
              </div>
            ))
          )}
        </div>
      </section>

      <div className={`${styles.grid} ${styles.gridMainAside}`}>
        <section className={styles.panel}>
            <div className={styles.panelHeader}>
              <div>
              <h2 className={styles.panelTitle}>Recent Nullcost selections</h2>
              <p className={styles.panelText}>Most recent router rows recorded by Nullcost for this provider.</p>
            </div>
            <span className={styles.pill}>{workspace.rotations.length}</span>
          </div>

          <div className={styles.reviewTable}>
            <div className={`${styles.reviewRow} ${styles.reviewHeader}`}>
              <span>Selected</span>
              <span>Profile</span>
              <span>Route</span>
              <span>Resolved</span>
              <span>Source</span>
            </div>

            {workspace.rotations.length === 0 ? (
              <div className={styles.empty}>No rotation rows have been recorded for this provider yet.</div>
            ) : (
              workspace.rotations.map((row) => (
                <div key={row.rotationId} className={styles.reviewRow}>
                  <span className={styles.reviewInfo}>
                    <strong>{formatDate(row.selectedAt)}</strong>
                    <span className={styles.tableCellMuted}>{row.clickedAt ? `redir ${formatDate(row.clickedAt)}` : 'not recorded'}</span>
                  </span>
                  <span>
                    <strong>{row.profile?.displayName || 'Profile missing'}</strong>
                    <span className={styles.tableCellMuted}> · {row.profile?.slug || 'unknown'}</span>
                  </span>
                  <span>{row.entry?.title || (row.entry ? humanize(row.entry.kind) : 'Entry missing')}</span>
                  <span className={styles.reviewInfo}>
                    <span>{shortHost(row.resolvedUrl)}</span>
                    {row.resolvedCode ? <span className={styles.tableCellMuted}>code {row.resolvedCode}</span> : null}
                  </span>
                  <span className={styles.code}>{row.source}</span>
                </div>
              ))
            )}
          </div>
        </section>

        <aside className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <h2 className={styles.panelTitle}>Providers with router activity</h2>
              <p className={styles.panelText}>Quick jump list for providers that already have entries or recorded rotations.</p>
            </div>
          </div>

          <div className={styles.table}>
            <div className={`${styles.tableRow} ${styles.tableHeader}`}>
              <span>Provider</span>
              <span>Mode</span>
              <span>Pool</span>
              <span>Pending</span>
              <span>Last sel</span>
              <span>Open</span>
            </div>

            {workspace.providers.map((provider) => (
              <div key={provider.slug} className={styles.tableRow}>
                <span>
                  <strong>{provider.name}</strong>
                  <span className={styles.tableCellMuted}> · {provider.slug}</span>
                </span>
                <span className={styles.code}>{provider.mode}</span>
                <span>{provider.activeEntries}</span>
                <span>{provider.pendingEntries}</span>
                <span className={styles.tableCellMuted}>{formatDate(provider.lastCloudbrokerSelectionAt)}</span>
                <span>
                  <Link href={`/dashboard/router?provider=${provider.slug}`} className={styles.linkButton}>Open</Link>
                </span>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </DashboardShell>
  );
}

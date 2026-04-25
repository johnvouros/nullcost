import Link from 'next/link';
import styles from './referral-profile.module.css';

interface ReferralProfileShellProps {
  directory: {
    profile: {
      id: string;
      slug: string;
      displayName: string;
      bio: string | null;
      website: string | null;
      status: 'active' | 'paused';
      createdAt: string;
    };
    stats: {
      activeEntries: number;
      providers: number;
      totalCloudbrokerSelections: number;
      totalCloudbrokerRedirects: number;
    };
    entries: Array<{
      id: string;
      kind: string;
      title: string | null;
      destinationUrl: string | null;
      referralCode: string | null;
      disclosure: string | null;
      cloudbrokerSelectionCount: number;
      cloudbrokerRedirectCount: number;
      createdAt: string;
      provider: {
        slug: string;
        name: string;
        category: string | null;
        subcategory: string | null;
      } | null;
      }>;
  };
  managementAction?: {
    href: string;
    label: string;
  } | null;
}

function formatDate(value: string) {
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

function formatEntryKind(value: string) {
  return value.replace(/_/g, ' ');
}

function pluralize(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function ReferralProfileShell({ directory, managementAction }: ReferralProfileShellProps) {
  const { profile, stats, entries } = directory;
  const coverageLabels = Array.from(
    new Set(
      entries
        .map((entry) => entry.provider?.subcategory || entry.provider?.category)
        .filter((value): value is string => Boolean(value))
        .map((value) => formatEntryKind(value)),
    ),
  );
  const disclosureCount = entries.filter((entry) => Boolean(entry.disclosure)).length;
  const codeCount = entries.filter((entry) => Boolean(entry.referralCode)).length;
  const coverageSummary = [
    pluralize(stats.providers, 'provider'),
    coverageLabels.length > 0 ? coverageLabels.slice(0, 2).join(' · ') : null,
  ]
    .filter(Boolean)
    .join(' · ');
  const transparencySummary =
    entries.length > 0 ? `${disclosureCount}/${entries.length} disclosed` : 'No active routes';
  const disclosureSummary =
    entries.length === 0
      ? 'No active community routes are published on this profile yet.'
      : disclosureCount === entries.length
        ? 'Every active route on this profile includes public disclosure text.'
        : disclosureCount === 0
          ? 'Active routes are published without any public disclosure text right now.'
          : `${disclosureCount} of ${entries.length} active routes include public disclosure text.`;
  const codeSummary =
    codeCount > 0
      ? `${pluralize(codeCount, 'route')} show${codeCount === 1 ? 's' : ''} a referral or coupon code in the directory.`
      : 'No referral or coupon codes are exposed on the active routes.';
  const profileBadges = [
    `${pluralize(stats.activeEntries, 'active route')}`,
    coverageLabels[0] ?? null,
    profile.website ? 'Website linked' : null,
  ].filter((value): value is string => Boolean(value));

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <section className={styles.sidebarCard}>
          <p className={styles.kicker}>Community code page</p>
          <h1>{profile.displayName}</h1>
          <p className={styles.summary}>
            {profile.bio || 'Public Nullcost page showing the live community codes attached to this account.'}
          </p>
          {profileBadges.length > 0 ? (
            <div className={styles.badgeRow}>
              {profileBadges.map((badge) => (
                <span key={badge} className={styles.metaPill}>
                  {badge}
                </span>
              ))}
            </div>
          ) : null}

          <div className={styles.metaStack}>
            <div>
              <span>Page key</span>
              <strong>{profile.slug}</strong>
            </div>
            <div>
              <span>Website</span>
              {profile.website ? (
                <a href={profile.website} target="_blank" rel="noreferrer">
                  {hostFromUrl(profile.website)}
                </a>
              ) : (
                <strong>Not set</strong>
              )}
            </div>
            <div>
              <span>Coverage</span>
              <strong>{coverageSummary || 'Not set'}</strong>
            </div>
            <div>
              <span>Transparency</span>
              <strong>{transparencySummary}</strong>
            </div>
          </div>
        </section>

        <section className={styles.sidebarCard}>
          <p className={styles.kicker}>Public signals</p>
          <h2>Disclosure</h2>
          <p className={styles.summaryCompact}>{disclosureSummary}</p>
          <div className={styles.signalList}>
            <div className={styles.signalRow}>
              <span>Codes shown</span>
              <strong>{codeCount}</strong>
            </div>
            <div className={styles.signalRow}>
              <span>Public since</span>
              <strong>{formatDate(profile.createdAt)}</strong>
            </div>
          </div>
          <ul className={styles.ruleList}>
            <li>{codeSummary}</li>
            <li>Official provider links still exist separately on each provider page.</li>
          </ul>
        </section>
      </aside>

      <section className={styles.main}>
        <div className={styles.topbar}>
          <div>
            <Link href="/" className={styles.backLink}>
              ← Back to catalog
            </Link>
            <p className={styles.kicker}>Public code page</p>
            <h2>Live community codes</h2>
            <p className={styles.topbarMeta}>
              {coverageSummary || 'Active community routes with transparent public details.'}
            </p>
          </div>

          {profile.website || managementAction ? (
            <div className={styles.actions}>
              {managementAction ? (
                <Link href={managementAction.href} className={styles.ghostAction}>
                  {managementAction.label}
                </Link>
              ) : null}
              
              {profile.website ? (
              <a href={profile.website} target="_blank" rel="noreferrer" className={styles.primaryAction}>
                Website
              </a>
              ) : null}
            </div>
          ) : null}
        </div>

        <section className={styles.metricStrip}>
          <div className={styles.metricRow}>
            <div className={styles.metricCard}>
              <span>Active entries</span>
              <strong>{stats.activeEntries}</strong>
            </div>
            <div className={styles.metricCard}>
              <span>Providers</span>
              <strong>{stats.providers}</strong>
            </div>
            <div className={styles.metricCard}>
              <span>Nullcost selections</span>
              <strong>{stats.totalCloudbrokerSelections}</strong>
            </div>
            <div className={styles.metricCard}>
              <span>Nullcost redirects</span>
              <strong>{stats.totalCloudbrokerRedirects}</strong>
            </div>
          </div>
        </section>

        <section className={styles.surface}>
            <div className={styles.surfaceHeader}>
              <div>
                <p className={styles.kicker}>Active directory</p>
                <h3>Live referral entries</h3>
                <p className={styles.topbarMeta}>Metrics below only reflect Nullcost routing events, not provider-side attribution or conversions.</p>
              </div>
              <span className={styles.headerStat}>{entries.length}</span>
            </div>

          <div className={styles.grid}>
            <div className={`${styles.row} ${styles.headerRow}`}>
              <span>Provider</span>
              <span>Route</span>
              <span>Target</span>
              <span>Disclosure</span>
              <span>Nullcost traffic</span>
              <span>Added</span>
            </div>

            {entries.length === 0 ? (
              <div className={styles.emptyState}>No active referral entries are published on this profile yet.</div>
            ) : (
              entries.map((entry) => (
                <div key={entry.id} className={styles.row}>
                  <span className={styles.providerCell}>
                    {entry.provider ? (
                      <Link href={`/providers/${entry.provider.slug}`} className={styles.rowLink}>
                        {entry.provider.name}
                      </Link>
                    ) : (
                      'Provider missing'
                    )}
                  </span>
                  <span className={styles.routeCell} title={entry.title || formatEntryKind(entry.kind)}>
                    <span>{entry.title || formatEntryKind(entry.kind)}</span>
                    {entry.referralCode ? <span className={styles.inlineTag}>{entry.referralCode}</span> : null}
                  </span>
                  <span className={styles.valueCell} title={entry.destinationUrl || entry.referralCode || 'No target captured'}>
                    {entry.destinationUrl ? hostFromUrl(entry.destinationUrl) : entry.referralCode || 'No target'}
                  </span>
                  <span className={styles.valueCell} title={entry.disclosure || 'No disclosure captured'}>
                    {entry.disclosure || 'Not stated'}
                  </span>
                  <span>{entry.cloudbrokerSelectionCount} nc sel · {entry.cloudbrokerRedirectCount} nc redir</span>
                  <span>{formatDate(entry.createdAt)}</span>
                </div>
              ))
            )}
          </div>
        </section>
      </section>
    </div>
  );
}

import Link from 'next/link';
import {
  getPlanPriceText,
  getDisplayPrice,
  getFreeEntryLabel,
  getFreeEntrySummary,
  getProviderLinks,
  getProviderFitSummary,
  getResearchLabel,
  getStartPathSummary,
  getSurfaceLabels,
  hasProgram,
  isYes,
  type ProviderPlanRow,
  type ProviderRow,
} from '@/lib/providers';
import { ProviderReferralForm, type SubmissionNotice } from './provider-referral-form';
import styles from './provider-profile.module.css';

interface ProviderProfileShellProps {
  provider: ProviderRow;
  plans: ProviderPlanRow[];
  bestStartingPlan: ProviderPlanRow | null;
  peerProviders: ProviderRow[];
  referralDirectory: {
    stats: {
      activeEntries: number;
      profiles: number;
      totalCloudbrokerSelections: number;
      totalCloudbrokerRedirects: number;
    };
    entries: Array<{
      id: string;
      kind: string;
      title: string | null;
      cloudbrokerSelectionCount: number;
      cloudbrokerRedirectCount: number;
      profile: {
        slug: string;
        displayName: string;
      } | null;
    }>;
  } | null;
  submissionNotice: SubmissionNotice;
  submitAction: (formData: FormData) => void | Promise<void>;
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

interface ProfileTableRow {
  label: string;
  value: string;
  state: string;
  tone: 'good' | 'warn' | 'muted';
  evidence: string;
  action?: {
    label: string;
    href: string;
  };
}

function formatDate(value: string | null): string {
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

function hostFromUrl(value: string | null): string {
  if (!value) {
    return 'Not captured';
  }

  try {
    return new URL(value).host.replace(/^www\./, '');
  } catch {
    return value;
  }
}

function formatChoice(value: string | null | undefined, fallback = 'Not captured'): string {
  return value?.replace(/_/g, ' ') || fallback;
}

function formatFlag(value: string | null | undefined): string {
  if (value === 'yes') return 'Yes';
  if (value === 'no') return 'No';
  return 'Unknown';
}

function formatFreeEntry(provider: ProviderRow): string {
  return getFreeEntryLabel(provider);
}

function getConfidenceLabel(provider: ProviderRow): string {
  if (provider.pricing_confidence) {
    return `${provider.pricing_confidence} confidence`;
  }

  return getResearchLabel(provider.research_status);
}

function formatPlanAudience(plan: ProviderPlanRow | null): string {
  if (!plan || plan.best_for_tags.length === 0) {
    return 'general use';
  }

  return plan.best_for_tags.map((tag) => tag.replace(/_/g, ' ')).join(' · ');
}

function getSignalRows(provider: ProviderRow) {
  const surfaceCount = [
    provider.mcp_available,
    provider.api_available,
    provider.cli_available,
    provider.open_source,
  ].filter((value) => value === 'yes').length;

  const setupScore =
    provider.setup_friction === 'low' ? 91 : provider.setup_friction === 'medium' ? 66 : 38;
  const evidenceScore =
    provider.research_status === 'verified_program'
      ? 94
      : provider.research_status === 'quick_official_check'
        ? 73
        : 44;
  const freeEntryScore = provider.free_tier === 'yes' ? 96 : provider.free_trial === 'yes' ? 78 : 32;
  const commercialScore = hasProgram(provider) ? 84 : 28;
  const surfaceScore = Math.max(22, surfaceCount * 24);

  return [
    { label: 'Setup friction', value: provider.setup_friction || 'unknown', score: setupScore },
    { label: 'Research depth', value: getResearchLabel(provider.research_status), score: evidenceScore },
    { label: 'Free entry', value: formatFreeEntry(provider), score: freeEntryScore },
    { label: 'Program signal', value: hasProgram(provider) ? 'captured' : 'needs link', score: commercialScore },
    { label: 'Surface coverage', value: `${surfaceCount}/4`, score: surfaceScore },
  ];
}

function getProfileRows(provider: ProviderRow, bestStartingPlan: ProviderPlanRow | null): ProfileTableRow[] {
  const programLabel =
    provider.program_type || provider.other_programs || (hasProgram(provider) ? 'Program captured' : 'Needs contributor link');
  const programTone = hasProgram(provider) ? 'good' : 'warn';

  return [
    {
      label: 'Free start',
      value: formatFreeEntry(provider),
      state: provider.free_tier === 'yes' ? 'Tier' : provider.free_trial === 'yes' ? 'Trial' : 'None',
      tone: provider.free_tier === 'yes' || provider.free_trial === 'yes' ? 'good' : 'warn',
      evidence: provider.contact_sales_only === 'yes' ? 'sales-led' : 'self-serve check',
      action: provider.signup_url ? { label: 'Signup', href: provider.signup_url } : undefined,
    },
    {
      label: 'Free limit',
      value: getFreeEntrySummary(provider, bestStartingPlan),
      state: bestStartingPlan ? bestStartingPlan.name : 'Catalog note',
      tone: bestStartingPlan || provider.pricing_notes ? 'good' : 'muted',
      evidence: bestStartingPlan?.official_url ? 'plan summary' : provider.pricing_url ? 'pricing note' : 'not modeled',
      action: bestStartingPlan?.official_url
        ? { label: 'Plan', href: bestStartingPlan.official_url }
        : provider.pricing_url
          ? { label: 'Pricing', href: provider.pricing_url }
          : undefined,
    },
    {
      label: 'Best fit',
      value: getProviderFitSummary(provider, bestStartingPlan),
      state: formatPlanAudience(bestStartingPlan),
      tone: 'good',
      evidence: provider.use_case || formatChoice(provider.subcategory, 'catalog row'),
    },
    {
      label: 'Getting started',
      value: getStartPathSummary(provider),
      state: provider.self_serve === 'yes' ? 'Self-serve' : provider.self_serve === 'no' ? 'Assisted' : 'Mixed',
      tone: provider.self_serve === 'yes' ? 'good' : 'muted',
      evidence: `${formatChoice(provider.setup_friction)} friction`,
      action: provider.signup_url ? { label: 'Signup', href: provider.signup_url } : undefined,
    },
    {
      label: 'Official site',
      value: hostFromUrl(provider.website),
      state: 'Primary',
      tone: 'good',
      evidence: provider.website ? 'live url' : 'missing',
      action: provider.website ? { label: 'Open', href: provider.website } : undefined,
    },
    {
      label: 'Pricing',
      value: getDisplayPrice(provider),
      state: getConfidenceLabel(provider),
      tone: provider.pricing_confidence === 'high' ? 'good' : provider.pricing_confidence === 'medium' ? 'warn' : 'muted',
      evidence: provider.pricing_normalized_at ? `checked ${formatDate(provider.pricing_normalized_at)}` : 'catalog row',
      action: provider.pricing_url ? { label: 'Pricing', href: provider.pricing_url } : undefined,
    },
    {
      label: 'Best starting plan',
      value: bestStartingPlan
        ? `${bestStartingPlan.name} · ${getPlanPriceText(bestStartingPlan)}`
        : 'No plan breakdown yet',
      state: bestStartingPlan
        ? bestStartingPlan.plan_type === 'free'
          ? 'Free start'
          : bestStartingPlan.plan_type === 'enterprise'
            ? 'Enterprise'
            : 'Paid start'
        : 'Unmodeled',
      tone: bestStartingPlan
        ? bestStartingPlan.plan_type === 'enterprise'
          ? 'warn'
          : 'good'
        : 'muted',
      evidence: bestStartingPlan?.summary || formatPlanAudience(bestStartingPlan),
      action: bestStartingPlan?.official_url
        ? { label: 'Plan', href: bestStartingPlan.official_url }
        : provider.pricing_url
          ? { label: 'Pricing', href: provider.pricing_url }
          : undefined,
    },
    {
      label: 'Deployment',
      value: formatChoice(provider.deployment_model),
      state: provider.self_serve === 'yes' ? 'Self-serve' : provider.self_serve === 'no' ? 'Assisted' : 'Mixed',
      tone: provider.self_serve === 'yes' ? 'good' : 'muted',
      evidence: formatChoice(provider.target_customer, 'general'),
    },
    {
      label: 'Surface access',
      value: getSurfaceLabels(provider).join(' · ') || 'No surface signals',
      state: isYes(provider.mcp_available) ? 'MCP ready' : isYes(provider.api_available) ? 'API ready' : 'General',
      tone: isYes(provider.mcp_available) || isYes(provider.api_available) ? 'good' : 'muted',
      evidence: formatFlag(provider.open_source) === 'Yes' ? 'OSS signal' : 'catalog row',
      action: provider.docs_url ? { label: 'Docs', href: provider.docs_url } : undefined,
    },
    {
      label: 'Commercial program',
      value: programLabel,
      state: provider.user_discount_available === 'yes' ? 'Discount verified' : 'Discount unverified',
      tone: programTone,
      evidence: provider.last_program_checked ? `checked ${formatDate(provider.last_program_checked)}` : 'catalog row',
      action: provider.program_url ? { label: 'Program', href: provider.program_url } : undefined,
    },
    {
      label: 'Evidence anchor',
      value: provider.source_url ? hostFromUrl(provider.source_url) : 'No source url',
      state: getResearchLabel(provider.research_status),
      tone: provider.research_status === 'verified_program' ? 'good' : provider.research_status === 'quick_official_check' ? 'warn' : 'muted',
      evidence: provider.last_verified ? `verified ${formatDate(provider.last_verified)}` : 'date missing',
      action: provider.source_url ? { label: 'Source', href: provider.source_url } : undefined,
    },
  ];
}

export function ProviderProfileShell({
  provider,
  plans,
  bestStartingPlan,
  peerProviders,
  referralDirectory,
  submissionNotice,
  submitAction,
  accountContext,
  managedEntry,
  dashboardAction,
}: ProviderProfileShellProps) {
  const signalRows = getSignalRows(provider);
  const quickLinks = getProviderLinks(provider).slice(0, 4);
  const profileRows = getProfileRows(provider, bestStartingPlan);
  const routeCount = referralDirectory?.stats.activeEntries ?? 0;
  const filterPills = [
    {
      label: provider.category || 'Uncategorized',
      title: `Top-level category: ${provider.category || 'uncategorized'}`,
    },
    {
      label: provider.subcategory || 'General',
      title: `Subcategory: ${provider.subcategory || 'general'}`,
    },
    {
      label: formatChoice(provider.deployment_model),
      title: `Deployment model: ${formatChoice(provider.deployment_model)}`,
    },
    {
      label: getDisplayPrice(provider),
      title: `Free-entry label: ${getDisplayPrice(provider)}`,
    },
    {
      label: bestStartingPlan ? `${bestStartingPlan.name} start` : `${plans.length || 0} plans`,
      title: bestStartingPlan
        ? `Best starting plan: ${bestStartingPlan.name} · ${getPlanPriceText(bestStartingPlan)}`
        : `${plans.length || 0} free-entry plan rows are modeled for this provider`,
    },
    {
      label: provider.setup_friction || 'unknown friction',
      title: `Setup friction: ${provider.setup_friction || 'unknown'}`,
    },
  ];
  const peerRows = peerProviders.slice(0, 5);

  return (
    <div className={styles.profileShell}>
      <aside className={styles.sidebar}>
        <section className={styles.sidebarCard}>
          <div className={styles.cardHeader}>
            <div>
              <p className={styles.kicker}>Provider profile</p>
              <h2>{provider.name}</h2>
            </div>
            <span className={styles.headerStat} title={`Category: ${provider.category || 'catalog'}`}>
              {provider.category || 'catalog'}
            </span>
          </div>

          <p className={styles.sidebarSummary}>
            {provider.use_case || 'No use-case summary is attached to this provider row yet.'}
          </p>

          <div className={styles.signalList}>
            {signalRows.map((row) => (
              <div key={row.label} className={styles.signalRow}>
                <div className={styles.signalMeta}>
                  <span>{row.label}</span>
                  <strong>{row.value}</strong>
                </div>
                <div className={styles.signalTrack}>
                  <div className={styles.signalBar} style={{ width: `${row.score}%` }} />
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className={styles.sidebarCard}>
          <div className={styles.cardHeader}>
            <div>
              <p className={styles.kicker}>Quick exits</p>
              <h3>Primary links</h3>
            </div>
            <span className={styles.headerStat} title={`${quickLinks.length} direct links are available for this provider`}>
              {quickLinks.length}
            </span>
          </div>

          <div className={styles.linkList}>
            {quickLinks.map((link) => (
              <a key={link.url} href={link.url} target="_blank" rel="noreferrer" className={styles.linkItem}>
                <span>{link.label}</span>
                <strong>{hostFromUrl(link.url)}</strong>
              </a>
            ))}
          </div>
        </section>

        <section className={styles.sidebarCard}>
          <div className={styles.cardHeader}>
            <div>
              <p className={styles.kicker}>Community route</p>
              <h3>Code rules</h3>
            </div>
            <span
              className={styles.headerStat}
              title={
                referralDirectory?.stats.activeEntries
                  ? `${referralDirectory.stats.activeEntries} live community code${referralDirectory.stats.activeEntries === 1 ? '' : 's'} are in rotation`
                  : 'No community codes are live yet'
              }
            >
              {referralDirectory?.stats.activeEntries ?? 0} live
            </span>
          </div>

          <ul className={styles.ruleList}>
            <li>Ranking stays fit-first; commercial links never reorder the catalog.</li>
            <li>One account keeps one code per provider, so changes stay in one place.</li>
            <li>Official links remain visible even when no community code is live.</li>
          </ul>
        </section>
      </aside>

      <section className={styles.mainPane}>
        <div className={styles.topbar}>
          <div className={styles.titleStack}>
            <Link href="/" className={styles.backLink}>
              ← Back to catalog
            </Link>
            <div>
              <h1>{provider.name}</h1>
              <p>Free-start fit and community code view</p>
            </div>
            <div className={styles.routeTicker}>
              <span className={styles.routeTickerLabel}>Referral:</span>
              <a
                href={`/go/${provider.slug}`}
                className={styles.routeTickerLink}
                title={
                  routeCount > 0
                    ? `Open a random live community code for ${provider.name}. Falls back to the official site if none are live.`
                    : `No live community codes yet. This route currently falls back to the official site.`
                }
              >
                <span className={styles.routeTickerIcon} aria-hidden="true">
                  ↻
                </span>
                <span>random{routeCount > 0 ? ` (${routeCount})` : ''}</span>
              </a>
              <span
                className={styles.routeTickerNote}
                title="These are Nullcost route counts only, not provider-side referral dashboard totals."
              >
                {routeCount > 0 ? `${routeCount} live code${routeCount === 1 ? '' : 's'}` : 'falls back to official'}
              </span>
            </div>
          </div>

          <div className={styles.searchShell} title="Stable provider identifier used in the page URL and API routes">
            <span className={styles.searchLabel}>Provider slug</span>
            <strong>{provider.slug}</strong>
            <kbd>readonly</kbd>
          </div>

          <div className={styles.topActions}>
            {provider.website ? (
              <a href={provider.website} target="_blank" rel="noreferrer" className={styles.primaryAction}>
                Official site
              </a>
            ) : null}
            {provider.docs_url ? (
              <a href={provider.docs_url} target="_blank" rel="noreferrer" className={styles.ghostAction}>
                Docs
              </a>
            ) : null}
          </div>
        </div>

        <section className={styles.surface}>
          <div className={styles.surfaceHeader}>
            <div>
              <p className={styles.kicker}>Profile grid</p>
              <h2>Provider sheet</h2>
            </div>
            <span
              className={styles.headerStat}
              title={`Catalog check state: ${getResearchLabel(provider.research_status)}`}
            >
              {getResearchLabel(provider.research_status)}
            </span>
          </div>

          <div className={styles.filterRow}>
            {filterPills.map((pill) => (
              <span key={pill.label} className={styles.filterPill} title={pill.title}>
                {pill.label}
              </span>
            ))}
          </div>

          <div className={styles.dataGrid}>
            <div className={`${styles.dataRow} ${styles.dataHeader}`}>
              <span>Field</span>
              <span>Value</span>
              <span>Signal</span>
              <span>Evidence</span>
              <span>Action</span>
            </div>

            {profileRows.map((row) => (
              <div key={row.label} className={styles.dataRow}>
                <span className={styles.fieldLabel}>{row.label}</span>
                <span className={styles.valueCell} title={row.value}>
                  {row.value}
                </span>
                <span>
                  <span
                    className={`${styles.statePill} ${
                      row.tone === 'good'
                        ? styles.statePillGood
                        : row.tone === 'warn'
                          ? styles.statePillWarn
                          : styles.statePillMuted
                    }`}
                    title={`${row.state} · ${row.evidence}`}
                  >
                    {row.state}
                  </span>
                </span>
                <span className={styles.evidenceCell} title={row.evidence}>
                  {row.evidence}
                </span>
                <span>
                  {row.action ? (
                    <a href={row.action.href} target="_blank" rel="noreferrer" className={styles.rowAction}>
                      {row.action.label}
                    </a>
                  ) : (
                    <span className={styles.rowActionMuted}>None</span>
                  )}
                </span>
              </div>
            ))}
          </div>
        </section>

        <div className={styles.lowerGrid}>
          <section className={styles.surface}>
            <div className={styles.surfaceHeader}>
              <div>
                <p className={styles.kicker}>Community route</p>
                <h2>Live code pool</h2>
              </div>
              <span className={styles.headerStat}>
                {referralDirectory?.stats.activeEntries ? 'live' : 'awaiting first code'}
              </span>
            </div>

            <div className={styles.metricGrid}>
              <div className={styles.metricCard} title="Number of live community codes currently in the Nullcost rotation for this provider">
                <span>Live codes</span>
                <strong>{referralDirectory?.stats.activeEntries ?? 0}</strong>
                <small>{referralDirectory?.stats.profiles ?? 0} code pages represented</small>
              </div>
              <div className={styles.metricCard} title="Counts here only reflect Nullcost routing activity, not the provider's own referral dashboard">
                <span>Nullcost selections</span>
                <strong>{referralDirectory?.stats.totalCloudbrokerSelections ?? 0}</strong>
                <small>{referralDirectory?.stats.totalCloudbrokerRedirects ?? 0} Nullcost redirects</small>
              </div>
              <div className={styles.metricCard} title="Program labels come from the catalog row and may be less complete than the official program terms">
                <span>Program type</span>
                <strong>{provider.program_type || provider.other_programs || 'No program captured'}</strong>
                <small>{provider.commission_model || 'Commission model not captured yet'}</small>
              </div>
            </div>

            <div className={styles.rotationDirectory}>
              {referralDirectory?.entries.length ? (
                referralDirectory.entries.map((entry) => (
                  <div key={entry.id} className={styles.rotationRow}>
                    {entry.profile?.slug ? (
                      <Link href={`/profiles/${entry.profile.slug}`} className={styles.rowAction}>
                        {entry.profile.displayName}
                      </Link>
                    ) : (
                      <span>{entry.profile?.displayName || 'Unknown profile'}</span>
                    )}
                    <strong>{entry.title || entry.kind.replace(/_/g, ' ')}</strong>
                    <span>
                      {entry.cloudbrokerSelectionCount} Nullcost selections · {entry.cloudbrokerRedirectCount} Nullcost redirects
                    </span>
                  </div>
                ))
              ) : (
                <div className={styles.emptyState}>No active referral entries are in the live rotation yet.</div>
              )}
            </div>

            {dashboardAction ? (
              <div className={styles.rotationManageRow}>
                <span className={styles.rotationManageText}>
                  Community codes are managed from signed-in accounts. Counts here only reflect Nullcost routing, not provider-side referral dashboards.
                </span>
                <Link href={dashboardAction.href} className={styles.rowAction}>
                  {dashboardAction.label}
                </Link>
              </div>
            ) : null}
          </section>

          <ProviderReferralForm
            providerName={provider.name}
            action={submitAction}
            submissionNotice={submissionNotice}
            accountContext={accountContext}
            managedEntry={managedEntry}
            dashboardAction={dashboardAction}
          />
        </div>

        <section className={styles.surface}>
          <div className={styles.surfaceHeader}>
            <div>
              <p className={styles.kicker}>Compare nearby</p>
              <h2>Same-lane providers</h2>
            </div>
            <span className={styles.headerStat} title={`${peerRows.length} nearby providers matched the same lane for comparison`}>
              {peerRows.length}
            </span>
          </div>

          <div className={styles.peerGrid}>
            <div className={`${styles.peerRow} ${styles.peerHeader}`}>
              <span>Provider</span>
              <span>Price</span>
              <span>Setup</span>
              <span>Program</span>
              <span>Profile</span>
            </div>

            {peerRows.length === 0 ? (
              <div className={styles.emptyState}>No nearby providers were found for this category yet.</div>
            ) : (
              peerRows.map((peer) => (
                <div key={peer.slug} className={styles.peerRow}>
                  <span className={styles.peerName}>{peer.name}</span>
                  <span>{getDisplayPrice(peer)}</span>
                  <span>{peer.setup_friction || 'unknown'}</span>
                  <span>{hasProgram(peer) ? 'captured' : 'none'}</span>
                  <span>
                    <Link href={`/providers/${peer.slug}`} className={styles.rowAction}>
                      Open
                    </Link>
                  </span>
                </div>
              ))
            )}
          </div>
        </section>
      </section>
    </div>
  );
}

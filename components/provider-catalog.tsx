'use client';

import Link from 'next/link';
import { Fragment, startTransition, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import {
  getDisplayPrice,
  getFreeEntryLabel,
  getFreeEntrySummary,
  getProviderFitSummary,
  getResearchLabel,
  getStartPathSummary,
  hasProgram,
  isYes,
  getPlanPriceText,
  type ProviderPlanRow,
  type ProviderRow,
} from '@/lib/providers';

type SurfaceFilter = 'all' | 'mcp' | 'api' | 'cli' | 'program' | 'free';
type SortKey = 'name' | 'category' | 'price' | 'setup' | 'signals' | 'status';
type SortDirection = 'asc' | 'desc';
type SignalKind =
  | 'mcp'
  | 'api'
  | 'cli'
  | 'open-source'
  | 'free-tier'
  | 'free-trial'
  | 'paid-entry'
  | 'contact-sales'
  | 'program'
  | 'user-discount'
  | 'setup'
  | 'verified'
  | 'checked'
  | 'seed'
  | 'unknown';

type ProviderDetailResponse = {
  provider: ProviderRow;
  plans: ProviderPlanRow[];
  bestStartingPlan: ProviderPlanRow | null;
};

const PAGE_SIZE = 14;

const BENEFIT_DEMO = {
  name: 'Acme Hosting',
  slug: 'acme-hosting',
  host: 'example listing',
  summary: 'Example hosting platform with a free starter path, paid-plan trials, and deal formats that may or may not stack.',
  benefits: [
    {
      label: 'Free forever',
      plan: 'Starter',
      detail: 'Always-free starter plan for hobby apps.',
      window: 'Ongoing',
      action: 'Use direct signup',
      offer: 'Direct signup',
      offerNote: 'How to claim: signup. User gets: free forever. Referrer gets: none. Stack: n/a.',
      claim: 'Signup',
      userGets: 'Free forever',
      referrerGets: 'None',
      stack: 'N/A',
      kind: 'free-tier' as SignalKind,
    },
    {
      label: '30-day trial',
      plan: 'Basic',
      detail: 'Trial access to the first paid hosting plan.',
      window: '30 days',
      action: 'Start trial',
      offer: 'Trial',
      offerNote: 'How to claim: signup. User gets: 30 days. Referrer gets: none. Stack: no.',
      claim: 'Signup',
      userGets: '30 days',
      referrerGets: 'None',
      stack: 'No',
      kind: 'free-trial' as SignalKind,
    },
    {
      label: '7-day Pro trial',
      plan: 'Pro',
      detail: 'Short trial for higher build limits and team features.',
      window: '7 days',
      action: 'Compare limits',
      offer: 'Trial',
      offerNote: 'How to claim: signup. User gets: 7 days. Referrer gets: none. Stack: no.',
      claim: 'Signup',
      userGets: '7 days',
      referrerGets: 'None',
      stack: 'No',
      kind: 'free-trial' as SignalKind,
    },
    {
      label: 'Apr 2026 code',
      plan: 'Any paid plan',
      detail: 'Could be a coupon or a referral code. Show the user bonus first.',
      window: 'April 2026',
      action: 'Go to deal',
      offer: 'Offer code',
      offerNote: 'How to claim: code. User gets: $5 credit. Referrer gets: $5 credit. Stack: unknown.',
      claim: 'Code',
      userGets: '$5 credit',
      referrerGets: '$5 credit',
      stack: 'Unknown',
      kind: 'user-discount' as SignalKind,
    },
    {
      label: 'Affiliate link',
      plan: 'Pro',
      detail: 'Tracked partner link where the user may not get a special bonus.',
      window: 'Ongoing',
      action: 'Open link',
      offer: 'Affiliate',
      offerNote: 'How to claim: link. User gets: none or unknown. Referrer gets: commission or credit. Stack: maybe with code.',
      claim: 'Link',
      userGets: 'None / unknown',
      referrerGets: 'Commission or credit',
      stack: 'Maybe',
      kind: 'program' as SignalKind,
    },
    {
      label: 'Link + code',
      plan: 'Pro',
      detail: 'Affiliate link gets the user in, then a code may still be needed during signup.',
      window: 'Ongoing',
      action: 'Open link',
      offer: 'Link + code',
      offerNote: 'How to claim: link first, code second if required. User gets: $10 credit. Referrer gets: commission or credit. Stack: maybe.',
      claim: 'Link + code',
      userGets: '$10 credit',
      referrerGets: 'Commission or credit',
      stack: 'Maybe',
      kind: 'program' as SignalKind,
    },
    {
      label: 'Trial + code',
      plan: 'Basic',
      detail: 'A free trial may still accept a code for extra credit or a longer window.',
      window: '7 days + code',
      action: 'Check terms',
      offer: 'Trial + code',
      offerNote: 'How to claim: signup plus code if allowed. User gets: 7 days + bonus credit. Referrer gets: unknown. Stack: unknown.',
      claim: 'Signup + code',
      userGets: '7 days + bonus credit',
      referrerGets: 'Unknown',
      stack: 'Unknown',
      kind: 'free-trial' as SignalKind,
    },
  ],
};

const ROTATION_TOOLTIP =
  'Submit a code, referral, affiliate, or deal link. Approved entries can rotate through Nullcost deal routes when users choose a community offer; rankings stay fit-first.';

const surfaceFilters: Array<{ value: SurfaceFilter; label: string }> = [
  { value: 'all', label: 'All tools' },
  { value: 'mcp', label: 'MCP-ready' },
  { value: 'api', label: 'API-first' },
  { value: 'cli', label: 'CLI' },
  { value: 'program', label: 'Community links' },
  { value: 'free', label: 'Free entry' },
];

const SIGNAL_THEME: Record<SignalKind, { color: string; border: string; background: string }> = {
  mcp: {
    color: '#b48cff',
    border: 'rgba(180, 140, 255, 0.28)',
    background: 'rgba(180, 140, 255, 0.12)',
  },
  api: {
    color: '#65b8ff',
    border: 'rgba(101, 184, 255, 0.24)',
    background: 'rgba(101, 184, 255, 0.12)',
  },
  cli: {
    color: '#d8dee7',
    border: 'rgba(216, 222, 231, 0.16)',
    background: 'rgba(216, 222, 231, 0.08)',
  },
  'open-source': {
    color: '#f0a84f',
    border: 'rgba(240, 168, 79, 0.24)',
    background: 'rgba(240, 168, 79, 0.12)',
  },
  'free-tier': {
    color: '#42d97f',
    border: 'rgba(66, 217, 127, 0.24)',
    background: 'rgba(66, 217, 127, 0.12)',
  },
  'free-trial': {
    color: '#d9dfe8',
    border: 'rgba(217, 223, 232, 0.18)',
    background: 'rgba(217, 223, 232, 0.08)',
  },
  'paid-entry': {
    color: '#dce2ec',
    border: 'rgba(220, 226, 236, 0.18)',
    background: 'rgba(220, 226, 236, 0.08)',
  },
  'contact-sales': {
    color: '#66d5e9',
    border: 'rgba(102, 213, 233, 0.24)',
    background: 'rgba(102, 213, 233, 0.12)',
  },
  program: {
    color: '#d7dde6',
    border: 'rgba(215, 221, 230, 0.16)',
    background: 'rgba(215, 221, 230, 0.08)',
  },
  'user-discount': {
    color: '#ffd15f',
    border: 'rgba(255, 209, 95, 0.24)',
    background: 'rgba(255, 209, 95, 0.12)',
  },
  setup: {
    color: '#ffd15f',
    border: 'rgba(255, 209, 95, 0.24)',
    background: 'rgba(255, 209, 95, 0.12)',
  },
  verified: {
    color: '#52a8ff',
    border: 'rgba(82, 168, 255, 0.24)',
    background: 'rgba(82, 168, 255, 0.12)',
  },
  checked: {
    color: '#31d76f',
    border: 'rgba(49, 215, 111, 0.24)',
    background: 'rgba(49, 215, 111, 0.12)',
  },
  seed: {
    color: '#a2aebb',
    border: 'rgba(162, 174, 187, 0.18)',
    background: 'rgba(162, 174, 187, 0.08)',
  },
  unknown: {
    color: '#8f99a8',
    border: 'rgba(143, 153, 168, 0.16)',
    background: 'rgba(143, 153, 168, 0.08)',
  },
};

function normalize(value: string | null | undefined) {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim();
}

function lower(value: string | null | undefined) {
  return normalize(value).toLowerCase();
}

function toHostname(value: string | null | undefined) {
  const compacted = normalize(value);

  if (!compacted) return '';

  try {
    return new URL(compacted).hostname.replace(/^www\./, '');
  } catch {
    return compacted.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0] ?? '';
  }
}

function getFacetLabel(provider: ProviderRow) {
  return normalize(provider.subcategory) || normalize(provider.category) || 'uncategorized';
}

function getEntryLabel(provider: ProviderRow) {
  if (isYes(provider.free_tier)) return 'Free tier';
  if (isYes(provider.free_trial)) return 'Free trial';
  if (isYes(provider.contact_sales_only)) return 'Contact sales';
  if (normalize(provider.starting_price)) return 'Paid entry';
  return 'Unknown';
}

function getSetupRank(provider: ProviderRow) {
  switch (lower(provider.setup_friction)) {
    case 'low':
      return 0;
    case 'medium':
      return 1;
    case 'high':
      return 2;
    default:
      return 3;
  }
}

function getStatusRank() {
  return 0;
}

function getSignalScore(provider: ProviderRow) {
  let score = 0;
  if (isYes(provider.mcp_available)) score += 4;
  if (isYes(provider.api_available)) score += 2;
  if (isYes(provider.cli_available)) score += 1;
  if (isYes(provider.free_tier)) score += 2;
  if (hasProgram(provider)) score += 1;
  if (provider.research_status === 'verified_program') score += 2;
  return score;
}

function getPriceRank(provider: ProviderRow) {
  if (typeof provider.starting_price_amount === 'number') {
    return provider.starting_price_amount;
  }

  if (isYes(provider.free_tier)) return 0;
  if (isYes(provider.free_trial)) return 1;
  if (isYes(provider.contact_sales_only)) return 10_000;
  return 5_000;
}

function getSubmissionSourceSignal(): { kind: SignalKind; label: string; title: string } {
  return {
    kind: 'checked',
    label: 'Site admin',
    title: 'Current provider rows are curated by the site. Provider-row submission source for site reps and site users is not modeled yet.',
  };
}

function getLatestSyncLabel(providers: ProviderRow[]) {
  const latest = providers
    .flatMap((provider) => [
      provider.last_verified,
      provider.last_pricing_checked,
      provider.last_program_checked,
      provider.pricing_normalized_at,
    ])
    .map((value) => normalize(value))
    .filter(Boolean)
    .sort()
    .at(-1);

  if (!latest) {
    return 'n/a';
  }

  const parsed = new Date(latest);

  if (Number.isNaN(parsed.getTime())) {
    return latest;
  }

  return `${new Intl.DateTimeFormat('en-US', {
    month: '2-digit',
    day: '2-digit',
    year: '2-digit',
  }).format(parsed)} 00:00`;
}

function getRouteLabel(provider: ProviderRow) {
  if (hasProgram(provider)) return 'Referral route';
  return 'Official fallback';
}

function humanize(value: string | null | undefined) {
  return normalize(value)
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function getProviderInfoSummary(provider: ProviderRow) {
  const service = normalize(provider.use_case) || humanize(provider.subcategory) || humanize(provider.category) || 'Developer service';
  const entry = getFreeEntryLabel(provider);
  const setup = lower(provider.setup_friction);
  const setupText = setup && setup !== 'unknown' ? ` ${humanize(setup)} setup.` : '';

  return `${service}. ${entry}.${setupText}`;
}

function getPlanBenefitKind(plan: ProviderPlanRow): SignalKind {
  if (plan.plan_type === 'free') {
    return 'free-tier';
  }

  if (plan.trial_available) {
    return 'free-trial';
  }

  return 'paid-entry';
}

function getPlanBenefitLabel(plan: ProviderPlanRow): string {
  if (plan.plan_type === 'free') {
    return 'Free tier';
  }

  if (plan.trial_available) {
    return 'Free trial';
  }

  return 'Free entry';
}

function getPlanWindowLabel(plan: ProviderPlanRow): string {
  return normalize(plan.price_label) || (plan.plan_type === 'free' ? 'Free forever' : plan.trial_available ? 'Trial available' : 'Included');
}

function getPlanActionLabel(plan: ProviderPlanRow): string {
  if (plan.plan_type === 'free') {
    return 'Open plan';
  }

  if (plan.trial_available) {
    return 'Start trial';
  }

  return 'Open link';
}

function getPlanActionUrl(provider: ProviderRow, plan: ProviderPlanRow): string {
  return normalize(plan.official_url) || normalize(plan.source_url) || normalize(provider.signup_url) || normalize(provider.website);
}

function getProviderActionUrl(provider: ProviderRow): string {
  return normalize(provider.signup_url) || normalize(provider.pricing_url) || normalize(provider.website) || normalize(provider.docs_url);
}

function getProviderSignals(provider: ProviderRow) {
  const icons: Array<{ kind: SignalKind; label: string }> = [];

  if (isYes(provider.mcp_available)) icons.push({ kind: 'mcp', label: 'MCP' });
  if (isYes(provider.api_available)) icons.push({ kind: 'api', label: 'API' });
  if (isYes(provider.cli_available)) icons.push({ kind: 'cli', label: 'CLI' });
  if (isYes(provider.open_source)) icons.push({ kind: 'open-source', label: 'Open source' });

  return icons.slice(0, 5);
}

function matchesQuery(provider: ProviderRow, query: string) {
  const haystack = [
    provider.slug,
    provider.name,
    provider.category,
    provider.subcategory,
    provider.website,
    provider.use_case,
    provider.pricing_model,
    provider.starting_price,
    provider.setup_friction,
    provider.target_customer,
    provider.program_type,
    provider.other_programs,
    provider.program_notes,
  ]
    .join(' ')
    .toLowerCase();

  return haystack.includes(query.toLowerCase());
}

function sortProviders(rows: ProviderRow[], key: SortKey, direction: SortDirection) {
  const copy = [...rows];

  copy.sort((left, right) => {
    let result = 0;

    switch (key) {
      case 'category':
        result = getFacetLabel(left).localeCompare(getFacetLabel(right));
        break;
      case 'price':
        result = getPriceRank(left) - getPriceRank(right);
        break;
      case 'setup':
        result = getSetupRank(left) - getSetupRank(right);
        break;
      case 'signals':
        result = getSignalScore(left) - getSignalScore(right);
        break;
      case 'status':
        result = getStatusRank() - getStatusRank();
        break;
      case 'name':
      default:
        result = left.name.localeCompare(right.name);
        break;
    }

    if (result === 0) {
      result = left.name.localeCompare(right.name);
    }

    return direction === 'asc' ? result : result * -1;
  });

  return copy;
}

function Glyph({
  name,
}: {
  name:
    | 'grid'
    | 'search'
    | 'graph'
    | 'compare'
    | 'route'
    | 'shuffle'
    | 'profile'
    | 'settings'
    | 'help'
    | 'terminal'
    | 'external';
}) {
  switch (name) {
    case 'search':
      return (
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <circle cx="7" cy="7" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <path d="M10.5 10.5 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );
    case 'graph':
      return (
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <path d="M2.5 12.5h11" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M4 10V6m4 4V3m4 7V7" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );
    case 'compare':
      return (
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <path d="M3 4h4v8H3zm6-2h4v10H9z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
        </svg>
      );
    case 'route':
      return (
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <path d="M3 12c0-3 2.5-5 5.5-5H13" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <path d="m10 4 3 3-3 3" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case 'shuffle':
      return (
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <path
            d="M2.5 4.5h2.25c1.1 0 1.95.33 2.55 1l4.2 5c.32.36.75.55 1.3.55H13.5M11 2.5h2.5V5M2.5 11.5h2.25c1.1 0 1.95-.33 2.55-1l4.2-5c.32-.36.75-.55 1.3-.55H13.5M11 13.5h2.5V11"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    case 'profile':
      return (
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <circle cx="8" cy="5.25" r="2.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <path d="M3.25 13c.85-2 2.55-3 4.75-3s3.9 1 4.75 3" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );
    case 'settings':
      return (
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <circle cx="8" cy="8" r="2.25" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <path d="M8 1.75v1.5M8 12.75v1.5M14.25 8h-1.5M3.25 8h-1.5M12.42 3.58l-1.06 1.06M4.64 11.36l-1.06 1.06M12.42 12.42l-1.06-1.06M4.64 4.64 3.58 3.58" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );
    case 'help':
      return (
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <path d="M6.7 6.35a1.55 1.55 0 1 1 2.65 1.1c-.55.55-1.1.95-1.1 1.8" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <circle cx="8" cy="11.9" r=".7" fill="currentColor" />
        </svg>
      );
    case 'terminal':
      return (
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <path d="M2.5 3.5h11v9h-11z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
          <path d="m4.5 6 1.75 1.75L4.5 9.5M7.75 10h3.25" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case 'external':
      return (
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <path
            d="M9.5 3.5h3v3M8 8.5l4.5-5M12.5 8.5v3h-9v-9h3"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    case 'grid':
    default:
      return (
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <path d="M2.5 2.5h4.25v4.25H2.5zm6.75 0h4.25v4.25H9.25zM2.5 9.25h4.25v4.25H2.5zm6.75 0h4.25v4.25H9.25z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
        </svg>
      );
  }
}

function SignalGlyph({ kind }: { kind: SignalKind }) {
  switch (kind) {
    case 'mcp':
      return (
        <svg viewBox="0 0 30 30" aria-hidden="true">
          <circle cx="15" cy="15" r="3" fill="currentColor" />
          <path d="M15 5V9M15 21V25M5 15H9M21 15H25M8 8L11 11M19 19L22 22M22 8L19 11M11 19L8 22" stroke="currentColor" strokeWidth="1.2" />
        </svg>
      );
    case 'api':
      return (
        <svg viewBox="0 0 30 30" aria-hidden="true">
          <rect x="4" y="10" width="22" height="10" rx="1" stroke="currentColor" strokeWidth="1.2" />
          <path d="M8 15H8.5M14.5 15H15.5M21.5 15H22" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <path d="M15 3V10M15 20V27" stroke="currentColor" strokeWidth="1" strokeDasharray="2 2" opacity="0.4" />
        </svg>
      );
    case 'cli':
      return (
        <svg viewBox="0 0 30 30" aria-hidden="true">
          <path d="M8 10L13 15L8 20" stroke="currentColor" strokeWidth="2" strokeLinecap="square" />
          <line x1="15" y1="22" x2="24" y2="22" stroke="currentColor" strokeWidth="2" />
        </svg>
      );
    case 'open-source':
      return (
        <svg viewBox="0 0 30 30" aria-hidden="true">
          <circle cx="15" cy="7" r="3" stroke="currentColor" strokeWidth="1.2" />
          <circle cx="8" cy="22" r="3" stroke="currentColor" strokeWidth="1.2" />
          <circle cx="22" cy="22" r="3" stroke="currentColor" strokeWidth="1.2" />
          <path d="M15 10V15C15 18 10 18 8 19" stroke="currentColor" strokeWidth="1.2" />
          <path d="M15 15C15 18 20 18 22 19" stroke="currentColor" strokeWidth="1.2" />
        </svg>
      );
    case 'free-tier':
      return (
        <svg viewBox="0 0 30 30" aria-hidden="true">
          <path d="M5 12V5H25V12" stroke="currentColor" strokeWidth="1.2" />
          <path d="M5 18V25H25V18" stroke="currentColor" strokeWidth="1.2" />
          <path d="M10 15H20" stroke="currentColor" strokeWidth="1.2" strokeDasharray="2 2" />
        </svg>
      );
    case 'free-trial':
      return (
        <svg viewBox="0 0 30 30" aria-hidden="true">
          <circle cx="15" cy="15" r="10" stroke="currentColor" strokeWidth="1.2" strokeDasharray="3 2" opacity="0.4" />
          <path d="M15 8V15L20 18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );
    case 'paid-entry':
      return (
        <svg viewBox="0 0 30 30" aria-hidden="true">
          <rect x="6" y="7" width="18" height="16" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
          <path d="M9 12H21M12 17H18" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
      );
    case 'contact-sales':
      return (
        <svg viewBox="0 0 30 30" aria-hidden="true">
          <path d="M8 24C8 20 11 18 15 18C19 18 22 20 22 24" stroke="currentColor" strokeWidth="1.2" />
          <circle cx="15" cy="12" r="4" stroke="currentColor" strokeWidth="1.2" />
          <path d="M23 5L27 9L23 13" stroke="currentColor" strokeWidth="1" opacity="0.5" />
        </svg>
      );
    case 'program':
      return (
        <svg viewBox="0 0 30 30" aria-hidden="true">
          <rect x="12" y="4" width="6" height="6" stroke="currentColor" strokeWidth="1.2" />
          <rect x="5" y="20" width="6" height="6" stroke="currentColor" strokeWidth="1.2" />
          <rect x="19" y="20" width="6" height="6" stroke="currentColor" strokeWidth="1.2" />
          <path d="M15 10V15H8V20M15 15H22V20" stroke="currentColor" strokeWidth="1" opacity="0.5" />
        </svg>
      );
    case 'user-discount':
      return (
        <svg viewBox="0 0 30 30" aria-hidden="true">
          <circle cx="15" cy="15" r="10" stroke="currentColor" strokeWidth="1.2" />
          <path d="M11 19L19 11" stroke="currentColor" strokeWidth="1.2" />
          <circle cx="11" cy="11" r="1" fill="currentColor" />
          <circle cx="19" cy="19" r="1" fill="currentColor" />
        </svg>
      );
    case 'setup':
      return (
        <svg viewBox="0 0 30 30" aria-hidden="true">
          <path d="M18 4L7 16H15L12 26L23 14H15L18 4Z" stroke="currentColor" strokeWidth="1.2" fill="currentColor" fillOpacity="0.1" />
        </svg>
      );
    case 'verified':
      return (
        <svg viewBox="0 0 30 30" aria-hidden="true">
          <path d="M15 4L24 8V14C24 20 15 25 15 25C15 25 6 20 6 14V8L15 4Z" stroke="currentColor" strokeWidth="1.2" />
          <path d="M11 14L14 17L20 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square" />
        </svg>
      );
    case 'checked':
      return (
        <svg viewBox="0 0 30 30" aria-hidden="true">
          <path d="M4 15L11 22L26 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="square" />
        </svg>
      );
    case 'seed':
      return (
        <svg viewBox="0 0 30 30" aria-hidden="true">
          <circle cx="15" cy="15" r="9" stroke="currentColor" strokeWidth="1.2" opacity="0.45" />
          <circle cx="15" cy="15" r="3" fill="currentColor" opacity="0.6" />
        </svg>
      );
    case 'unknown':
    default:
      return (
        <svg viewBox="0 0 30 30" aria-hidden="true">
          <circle cx="15" cy="15" r="10" stroke="currentColor" strokeWidth="1.2" opacity="0.45" />
          <path d="M13.8 12.8a1.5 1.5 0 1 1 2.55 1.08c-.53.53-1.05.92-1.05 1.72" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          <circle cx="15" cy="19.8" r="1" fill="currentColor" />
        </svg>
      );
  }
}

function SignalIconBadge({
  kind,
  label,
  color,
  border,
  background,
}: {
  kind: SignalKind;
  label: string;
  color?: string;
  border?: string;
  background?: string;
}) {
  const theme = SIGNAL_THEME[kind] ?? SIGNAL_THEME.unknown;

  return (
    <span
      className="cb-icon-badge"
      title={label}
      aria-label={label}
      style={{
        color: color ?? theme.color,
        background: background ?? theme.background,
        borderColor: border ?? theme.border,
      }}
    >
      <SignalGlyph kind={kind} />
    </span>
  );
}

function SignalTextBadge({
  kind,
  label,
}: {
  kind: SignalKind;
  label: string;
}) {
  const theme = SIGNAL_THEME[kind] ?? SIGNAL_THEME.unknown;

  return (
    <span
      className="cb-signal-chip"
      title={label}
      aria-label={label}
      style={{
        color: theme.color,
        background: theme.background,
        borderColor: theme.border,
      }}
    >
      <SignalGlyph kind={kind} />
      <span>{label}</span>
    </span>
  );
}

function StatusPill({
  kind,
  label,
  title,
}: {
  kind: SignalKind;
  label: string;
  title?: string;
}) {
  const theme = SIGNAL_THEME[kind] ?? SIGNAL_THEME.unknown;

  return (
    <span
      className="cb-status-pill"
      title={title ?? label}
      aria-label={label}
      style={{
        color: theme.color,
        background: theme.background,
        borderColor: theme.border,
      }}
    >
      <SignalGlyph kind={kind} />
      <span>{label}</span>
    </span>
  );
}

function ProviderExpandedRow({
  provider,
  statusSignal,
  expanded,
}: {
  provider: ProviderRow;
  statusSignal: { kind: SignalKind; label: string; title: string };
  expanded: boolean;
}) {
  const [detail, setDetail] = useState<ProviderDetailResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loadedSlugRef = useRef<string | null>(null);

  useEffect(() => {
    if (!expanded || loadedSlugRef.current === provider.slug) {
      return;
    }

    const controller = new AbortController();
    let active = true;
    setLoading(true);
    setError(null);

    fetch(`/api/providers/${encodeURIComponent(provider.slug)}`, {
      signal: controller.signal,
      cache: 'no-store',
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`Failed to load provider detail (${response.status})`);
        }

        return (await response.json()) as ProviderDetailResponse;
      })
      .then((payload) => {
        if (!active) {
          return;
        }

        loadedSlugRef.current = provider.slug;
        setDetail(payload);
      })
      .catch((fetchError: unknown) => {
        if (fetchError instanceof DOMException && fetchError.name === 'AbortError') {
          return;
        }

        if (active) {
          setError('Plan rows could not be loaded right now.');
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [expanded, provider.slug]);

  const plans = detail?.plans ?? [];
  const bestStartingPlan = detail?.bestStartingPlan ?? null;
  const planRows = plans.slice(0, 5);
  const extraPlanCount = Math.max(0, plans.length - planRows.length);
  const providerActionUrl = getProviderActionUrl(provider);
  const providerEntryKind: SignalKind = isYes(provider.free_tier)
    ? 'free-tier'
    : isYes(provider.free_trial)
      ? 'free-trial'
      : 'unknown';
  const providerEntryLabel = getFreeEntryLabel(provider);
  const providerEntryNote = getFreeEntrySummary(provider, bestStartingPlan ?? undefined);
  const providerHasMatchingFreePlan = plans.some((plan) => plan.plan_type === 'free' || plan.trial_available);
  const showProviderEntryRow = providerEntryLabel !== 'No free entry' && !providerHasMatchingFreePlan;

  return (
    <tr className="cb-expanded-row">
      <td colSpan={6}>
        <div className="cb-expanded">
          {showProviderEntryRow || plans.length > 0 ? (
            <div className="cb-expanded__benefit-stack">
              <div className="cb-expanded__benefit-title cb-expanded__benefit-title--provider">
                <strong>{plans.length > 1 || showProviderEntryRow ? 'Free-entry path' : 'Free-entry path'}</strong>
                {bestStartingPlan ? (
                  <span title={`Best start: ${bestStartingPlan.name} · ${getPlanPriceText(bestStartingPlan)}`}>
                    Best start: {bestStartingPlan.name} · {getPlanPriceText(bestStartingPlan)}
                  </span>
                ) : null}
              </div>
              <table className="cb-benefit-subtable cb-benefit-subtable--provider">
                <thead>
                  <tr>
                    <th>Benefit</th>
                    <th>Plan</th>
                    <th>What it means</th>
                    <th>Window</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {showProviderEntryRow ? (
                    <tr className="cb-benefit-subtable__best">
                      <td>
                        <SignalTextBadge kind={providerEntryKind} label={providerEntryLabel} />
                      </td>
                      <td>{bestStartingPlan?.name || 'Provider entry'}</td>
                      <td>{providerEntryNote}</td>
                      <td>{isYes(provider.free_tier) ? 'Free forever' : isYes(provider.free_trial) ? 'Trial' : 'Unknown'}</td>
                      <td>
                        {providerActionUrl ? (
                          <a href={providerActionUrl} target="_blank" rel="nofollow noopener noreferrer">
                            {providerEntryLabel === 'Free tier' ? 'Open free tier' : 'Open trial'}
                          </a>
                        ) : (
                          <span className="cb-muted">No link</span>
                        )}
                      </td>
                    </tr>
                  ) : null}
                  {planRows.map((plan) => {
                    const actionUrl = getPlanActionUrl(provider, plan);
                    const isBestPlan = Boolean(bestStartingPlan && bestStartingPlan.id === plan.id);

                    return (
                      <tr key={`${provider.slug}-${plan.slug}`} className={isBestPlan ? 'cb-benefit-subtable__best' : undefined}>
                        <td>
                          <SignalTextBadge kind={getPlanBenefitKind(plan)} label={getPlanBenefitLabel(plan)} />
                        </td>
                        <td>{plan.name}</td>
                        <td>{getFreeEntrySummary(provider, plan)}</td>
                        <td>{getPlanWindowLabel(plan)}</td>
                        <td>
                          {actionUrl ? (
                            <a href={actionUrl} target="_blank" rel="nofollow noopener noreferrer">
                              {getPlanActionLabel(plan)}
                            </a>
                          ) : (
                            <span className="cb-muted">No link</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {extraPlanCount > 0 ? (
                    <tr>
                      <td>
                        <SignalTextBadge kind="unknown" label={`+${extraPlanCount} more`} />
                      </td>
                      <td colSpan={4}>More free-entry plans were captured for this provider.</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          ) : null}

          {loading && plans.length === 0 ? <p className="cb-expanded__hint">Loading plan rows from the live API…</p> : null}
          {error ? <p className="cb-expanded__hint cb-expanded__hint--error">{error}</p> : null}

          <div className="cb-expanded__grid">
            <section>
              <p className="cb-kicker">Free start</p>
              <h4>{getFreeEntryLabel(provider)}</h4>
              <p className="cb-panel__text">{getFreeEntrySummary(provider, bestStartingPlan)}</p>
              <div className="cb-link-row">
                <a href={`/go/${provider.slug}`}>{getRouteLabel(provider)}</a>
                {provider.signup_url ? (
                  <a href={provider.signup_url} target="_blank" rel="nofollow noopener noreferrer">
                    Signup
                  </a>
                ) : null}
                {provider.website ? (
                  <a href={provider.website} target="_blank" rel="nofollow noopener noreferrer">
                    Official site
                  </a>
                ) : null}
                {provider.pricing_url ? (
                  <a href={provider.pricing_url} target="_blank" rel="nofollow noopener noreferrer">
                    Pricing
                  </a>
                ) : null}
                {provider.docs_url ? (
                  <a href={provider.docs_url} target="_blank" rel="nofollow noopener noreferrer">
                    Docs
                  </a>
                ) : null}
              </div>
            </section>

            <section>
              <p className="cb-kicker">Fit</p>
              <dl className="cb-expanded__list">
                <div>
                  <dt>Best for</dt>
                  <dd>{getProviderFitSummary(provider, bestStartingPlan)}</dd>
                </div>
                <div>
                  <dt>Deployment</dt>
                  <dd>{provider.deployment_model || 'Not captured'}</dd>
                </div>
                <div>
                  <dt>Getting started</dt>
                  <dd>{getStartPathSummary(provider)}</dd>
                </div>
              </dl>
            </section>

            <section>
              <p className="cb-kicker">Submitted by</p>
              <dl className="cb-expanded__list">
                <div>
                  <dt>Source</dt>
                  <dd>{statusSignal.label}</dd>
                </div>
                <div>
                  <dt>Catalog check</dt>
                  <dd>{getResearchLabel(provider.research_status)}</dd>
                </div>
                <div>
                  <dt>Community link</dt>
                  <dd>{hasProgram(provider) ? 'Available' : 'Not available yet'}</dd>
                </div>
              </dl>
            </section>
          </div>
        </div>
      </td>
    </tr>
  );
}

function SortButton({
  label,
  column,
  sortKey,
  direction,
  onSort,
}: {
  label: string;
  column: SortKey;
  sortKey: SortKey;
  direction: SortDirection;
  onSort: (column: SortKey) => void;
}) {
  const active = sortKey === column;

  return (
    <button type="button" className={active ? 'cb-sort cb-sort--active' : 'cb-sort'} onClick={() => onSort(column)}>
      <span>{label}</span>
      <span className="cb-sort__mark" aria-hidden="true">
        {active ? (direction === 'asc' ? '↑' : '↓') : '↕'}
      </span>
    </button>
  );
}

export function ProviderCatalog({ providers }: { providers: ProviderRow[] }) {
  const [query, setQuery] = useState('');
  const [surface, setSurface] = useState<SurfaceFilter>('all');
  const [activeFacet, setActiveFacet] = useState('all');
  const [sortKey, setSortKey] = useState<SortKey>('signals');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [expandedSlug, setExpandedSlug] = useState<string | null>(null);
  const [demoExpanded, setDemoExpanded] = useState(true);
  const [selectedSlugs, setSelectedSlugs] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const compareSectionRef = useRef<HTMLElement | null>(null);
  const deferredQuery = useDeferredValue(query.trim());

  const facetCounts = useMemo(() => {
    const counts = new Map<string, number>();

    for (const provider of providers) {
      const key = getFacetLabel(provider);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }

    return Array.from(counts.entries())
      .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
      .map(([label, count]) => ({ label, count }));
  }, [providers]);

  const maxFacetCount = facetCounts[0]?.count ?? 1;

  const filteredProviders = useMemo(() => {
    const base = providers.filter((provider) => {
      const matchesText = deferredQuery === '' || matchesQuery(provider, deferredQuery);
      const matchesFacet =
        activeFacet === 'all' ||
        lower(provider.category) === lower(activeFacet) ||
        lower(provider.subcategory) === lower(activeFacet) ||
        lower(getFacetLabel(provider)) === lower(activeFacet);

      const matchesSurface =
        surface === 'all' ||
        (surface === 'mcp' && isYes(provider.mcp_available)) ||
        (surface === 'api' && isYes(provider.api_available)) ||
        (surface === 'cli' && isYes(provider.cli_available)) ||
        (surface === 'program' && hasProgram(provider)) ||
        (surface === 'free' && (isYes(provider.free_tier) || isYes(provider.free_trial)));

      return matchesText && matchesFacet && matchesSurface;
    });

    return sortProviders(base, sortKey, sortDirection);
  }, [activeFacet, deferredQuery, providers, sortDirection, sortKey, surface]);

  const pageCount = Math.max(1, Math.ceil(filteredProviders.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const startIndex = (safePage - 1) * PAGE_SIZE;
  const visibleProviders = filteredProviders.slice(startIndex, startIndex + PAGE_SIZE);
  const showBenefitDemo = safePage === 1;

  const selectedProviders = useMemo(() => {
    const lookup = new Set(selectedSlugs);
    return providers.filter((provider) => lookup.has(provider.slug));
  }, [providers, selectedSlugs]);

  const surfaceCount = filteredProviders.filter((provider) => hasProgram(provider)).length;
  const latestSyncLabel = useMemo(() => getLatestSyncLabel(providers), [providers]);

  function updatePage(nextPage: number) {
    startTransition(() => {
      setPage(Math.max(1, Math.min(nextPage, pageCount)));
    });
  }

  function applyFacet(nextFacet: string) {
    startTransition(() => {
      setActiveFacet(nextFacet);
      setPage(1);
      setExpandedSlug(null);
    });
  }

  function applySurface(nextSurface: SurfaceFilter) {
    startTransition(() => {
      setSurface(nextSurface);
      setPage(1);
      setExpandedSlug(null);
    });
  }

  function handleSort(column: SortKey) {
    startTransition(() => {
      if (sortKey === column) {
        setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'));
      } else {
        setSortKey(column);
        setSortDirection(column === 'name' || column === 'category' ? 'asc' : 'desc');
      }
      setPage(1);
    });
  }

  function toggleCompare(slug: string) {
    startTransition(() => {
      setSelectedSlugs((current) => {
        if (current.includes(slug)) {
          return current.filter((value) => value !== slug);
        }

        if (current.length >= 3) {
          return [...current.slice(1), slug];
        }

        return [...current, slug];
      });
    });
  }

  function resetCatalogView() {
    startTransition(() => {
      setQuery('');
      setSurface('all');
      setActiveFacet('all');
      setSelectedSlugs([]);
      setSortKey('signals');
      setSortDirection('desc');
      setExpandedSlug(null);
      setPage(1);
    });
  }

  function focusSearch() {
    searchInputRef.current?.focus();
  }

  function showCommunityLinks() {
    applySurface('program');
  }

  function jumpToCompare() {
    compareSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    <div className="cb-shell">
      <aside className="cb-rail" aria-label="Dashboard rail">
        <Link href="/" className="cb-rail__brand" aria-label="Nullcost home">
          <span className="cb-rail__mark" aria-hidden="true" />
        </Link>

        <nav className="cb-rail__nav">
          <button
            type="button"
            className={surface === 'all' && activeFacet === 'all' && query === '' ? 'cb-rail__button cb-rail__button--active' : 'cb-rail__button'}
            aria-label="All tools"
            title="Reset to the full catalog"
            onClick={resetCatalogView}
          >
            <Glyph name="grid" />
          </button>
          <button
            type="button"
            className={query !== '' ? 'cb-rail__button cb-rail__button--active' : 'cb-rail__button'}
            aria-label="Search"
            title="Focus the search box"
            onClick={focusSearch}
          >
            <Glyph name="search" />
          </button>
          <button
            type="button"
            className={selectedProviders.length > 0 ? 'cb-rail__button cb-rail__button--active' : 'cb-rail__button'}
            aria-label="Compare"
            title={
              selectedProviders.length > 0
                ? `Jump to compare (${selectedProviders.length}/3 selected)`
                : 'Select rows first to compare providers'
            }
            onClick={jumpToCompare}
            disabled={selectedProviders.length === 0}
          >
            <Glyph name="compare" />
          </button>
          <button
            type="button"
            className={surface === 'program' ? 'cb-rail__button cb-rail__button--active' : 'cb-rail__button'}
            aria-label="Community links"
            title="Show only providers with community referral links"
            onClick={showCommunityLinks}
          >
            <Glyph name="route" />
          </button>
          <Link href="/install" className="cb-rail__button" aria-label="Install plugin" title="Install the Nullcost plugin">
            <Glyph name="terminal" />
          </Link>
        </nav>

        <div className="cb-rail__footer">
          <span className="cb-rail__avatar" aria-hidden="true">
            NC
          </span>
        </div>
      </aside>

      <aside className="cb-sidebar">
        <div className="cb-sidebar__header">
          <div>
            <p className="cb-kicker">Categories</p>
            <h2>Browse by category</h2>
          </div>
          <span className="cb-sidebar__meta">{facetCounts.length}</span>
        </div>

        <div className="cb-sidebar__list" role="list">
          <button
            type="button"
            className={activeFacet === 'all' ? 'cb-facet cb-facet--active' : 'cb-facet'}
            onClick={() => applyFacet('all')}
            title={`Show all categories · ${providers.length} tools`}
          >
            <span className="cb-facet__bar" style={{ width: '100%' }} />
            <span className="cb-facet__label">All categories</span>
            <span className="cb-facet__count">{providers.length}</span>
          </button>

          {facetCounts.map((facet) => {
            const width = `${Math.max(16, (facet.count / maxFacetCount) * 100)}%`;

            return (
              <button
                key={facet.label}
                type="button"
                className={activeFacet === facet.label ? 'cb-facet cb-facet--active' : 'cb-facet'}
                onClick={() => applyFacet(facet.label)}
                title={`${facet.label} · ${facet.count} tools`}
              >
                <span className="cb-facet__bar" style={{ width }} />
                <span className="cb-facet__label">{facet.label}</span>
                <span className="cb-facet__count">{facet.count}</span>
              </button>
            );
          })}
        </div>

        <div className="cb-sidebar__summary">
          <div title={`${providers.length} free-entry tools are currently visible in the public catalog`}>
            <span>Tools</span>
            <strong>{providers.length}</strong>
          </div>
          <div title={`${providers.filter((provider) => isYes(provider.mcp_available)).length} visible tools have an MCP signal`}>
            <span>MCP-ready</span>
            <strong>{providers.filter((provider) => isYes(provider.mcp_available)).length}</strong>
          </div>
          <div title={`${providers.filter((provider) => hasProgram(provider)).length} visible tools currently expose a community referral link`}>
            <span>Community links</span>
            <strong>{providers.filter((provider) => hasProgram(provider)).length}</strong>
          </div>
        </div>
      </aside>

      <section className="cb-main">
        <header className="cb-topbar">
          <div className="cb-topbar__telemetry">
            <div className="cb-status">
              <span className="cb-status__dot" aria-hidden="true" />
              <span className="cb-status__label" title="The public catalog is available and responding">Catalog live</span>
              <span className="cb-status__node" title="Only tools with a real free tier or free trial are shown here">
                FREE TIERS + TRIALS ONLY
              </span>
            </div>

            <div className="cb-topbar__utility">
              <div className="cb-telemetry-block" title="Latest date captured from provider verification, pricing, or normalization checks">
                <span>Last Sync</span>
                <strong>{latestSyncLabel}</strong>
              </div>
              <span className="cb-topbar__divider" aria-hidden="true" />
              <Link href="/install" className="cb-cli-access" title="Install the Nullcost plugin; MCP is the engine underneath">
                <Glyph name="terminal" />
                <span>INSTALL PLUGIN</span>
              </Link>
            </div>
          </div>

          <div className="cb-topbar__main">
            <div className="cb-topbar__copy">
              <p className="cb-kicker cb-kicker--brand">
                <span className="cb-kicker__mark" aria-hidden="true" />
                <span>Nullcost</span>
              </p>
              <div className="cb-headline">
                <h1>Free-entry developer tools</h1>
                <span className="cb-version">beta</span>
              </div>
              <p>
                Find tools with a real free tier or free trial. Some also have referral bonuses or signup credits, so
                Nullcost can rotate approved community codes while still keeping the provider site available.
                <span className="cb-copy-break"> Rankings stay fit-first, not affiliate-first.</span>
              </p>
            </div>

            <div className="cb-search-shell">
              <div className="cb-search">
                <Glyph name="search" />
                <input
                  ref={searchInputRef}
                  type="search"
                  value={query}
                  onChange={(event) => {
                    const nextQuery = event.target.value;
                    startTransition(() => {
                      setQuery(nextQuery);
                      setPage(1);
                      setExpandedSlug(null);
                    });
                  }}
                  placeholder="Search tool, category, benefit..."
                  aria-label="Search providers"
                />
                <span className="cb-search__hint">⌘K</span>
              </div>
            </div>
          </div>
        </header>

        <section className="cb-panel">
          <div className="cb-panel__header">
            <div className="cb-panel__title">
              <h2>Providers</h2>
              <span className="cb-panel__badge" title={`${filteredProviders.length} tools match the current search and filters`}>
                {filteredProviders.length} tools
              </span>
            </div>
            <span className="cb-panel__operator" title="This view is limited to tools with free entry">
              free tiers + trials
            </span>
          </div>

          <div className="cb-toolbar">
            <div className="cb-filter-group" role="tablist" aria-label="Surface filter">
              {surfaceFilters.map((option) => {
                const active = surface === option.value;

                return (
                  <button
                    key={option.value}
                    type="button"
                    className={active ? 'cb-filter cb-filter--active' : 'cb-filter'}
                    aria-pressed={active}
                    onClick={() => applySurface(option.value)}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>

            <div className="cb-toolbar__stats">
              <span title={`${surfaceCount} visible tools currently have a community referral route`}>
                {surfaceCount} referral-ready rows
              </span>
              {selectedProviders.length > 0 ? <span>{selectedProviders.length}/3 selected for compare</span> : null}
              <Link href="/install" className="cb-toolbar__link">
                Install plugin
              </Link>
              {selectedProviders.length > 0 ? (
                <button
                  type="button"
                  className="cb-toolbar__link"
                  onClick={() => startTransition(() => setSelectedSlugs([]))}
                >
                  Clear compare
                </button>
              ) : null}
            </div>
          </div>

          {selectedProviders.length > 0 ? (
            <section className="cb-compare" aria-label="Compare providers" ref={compareSectionRef}>
              <div className="cb-compare__header">
                <div>
                  <p className="cb-kicker">Compare</p>
                  <h3>{selectedProviders.length === 1 ? 'Select one more row to compare side by side' : 'Side-by-side snapshot'}</h3>
                </div>
                <span>{selectedProviders.length}/3</span>
              </div>

              <div className="cb-compare__grid">
                {selectedProviders.map((provider) => {
                  const compareSignals = getProviderSignals(provider);

                  return (
                    <article key={provider.slug} className="cb-compare__card">
                    <div className="cb-compare__title">
                      <div>
                        <strong>{provider.name}</strong>
                        <span>{getFacetLabel(provider)}</span>
                      </div>
                      <button type="button" onClick={() => toggleCompare(provider.slug)} aria-label={`Remove ${provider.name} from compare`}>
                        ×
                      </button>
                    </div>
                    <dl>
                      <div>
                        <dt>Price</dt>
                        <dd>{getDisplayPrice(provider)}</dd>
                      </div>
                      <div>
                        <dt>Entry</dt>
                        <dd>{getEntryLabel(provider)}</dd>
                      </div>
                      <div>
                        <dt>Setup</dt>
                        <dd>{provider.setup_friction || 'unknown'}</dd>
                      </div>
                      <div>
                        <dt>Signals</dt>
                        <dd className="cb-inline-list">
                          {compareSignals.length > 0 ? (
                            compareSignals.map((signal) => (
                              <SignalIconBadge key={`${provider.slug}-${signal.kind}`} kind={signal.kind} label={signal.label} />
                            ))
                          ) : (
                            <span className="cb-muted">No flags</span>
                          )}
                        </dd>
                      </div>
                    </dl>
                    </article>
                  );
                })}
              </div>
            </section>
          ) : null}

          <div className="cb-table-wrap">
            <table className="cb-table">
              <thead>
                <tr>
                  <th className="cb-cell cb-cell--checkbox">
                    <span className="cb-sr-only">Compare</span>
                  </th>
                  <th className="cb-cell cb-cell--provider">
                    <SortButton label="Provider" column="name" sortKey={sortKey} direction={sortDirection} onSort={handleSort} />
                  </th>
                  <th className="cb-cell cb-cell--details">Info</th>
                  <th className="cb-cell cb-cell--more">More</th>
                  <th className="cb-cell cb-cell--signals cb-hide-lg">
                    <SortButton label="Signals" column="signals" sortKey={sortKey} direction={sortDirection} onSort={handleSort} />
                  </th>
                  <th className="cb-cell cb-cell--status cb-hide-sm">
                    <SortButton label="Submitted by" column="status" sortKey={sortKey} direction={sortDirection} onSort={handleSort} />
                  </th>
                </tr>
              </thead>
              <tbody>
                {visibleProviders.length === 0 && !showBenefitDemo ? (
                  <tr>
                    <td colSpan={6} className="cb-empty">
                      <p>No rows match the current search and filter set.</p>
                    </td>
                  </tr>
                ) : (
                  <>
                    {showBenefitDemo ? (
                      <Fragment>
                        <tr className={demoExpanded ? 'cb-row cb-row--expanded cb-row--demo' : 'cb-row cb-row--demo'}>
                          <td className="cb-cell cb-cell--checkbox">
                            <input type="checkbox" disabled aria-label="Example row is not selectable for compare" />
                          </td>
                          <td className="cb-cell cb-cell--provider">
                            <div className="cb-provider">
                              <span className="cb-provider__name">{BENEFIT_DEMO.name}</span>
                              <span className="cb-provider__host">{BENEFIT_DEMO.host}</span>
                            </div>
                          </td>
                          <td className="cb-cell cb-cell--details">
                            <div className="cb-details">
                              <span className="cb-details__summary" title={BENEFIT_DEMO.summary}>
                                {BENEFIT_DEMO.summary}
                              </span>
                              <Link href="/dashboard" className="cb-details__submit" title={ROTATION_TOOLTIP}>
                                Submit code / referral / affiliate / deal link
                              </Link>
                              <div className="cb-benefit-chips" aria-label="Example benefits">
                                {BENEFIT_DEMO.benefits.map((benefit) => (
                                  <span key={`${BENEFIT_DEMO.slug}-${benefit.label}`} className="cb-benefit-chip">
                                    {benefit.label}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </td>
                          <td className="cb-cell cb-cell--more">
                            <button
                              type="button"
                              className={demoExpanded ? 'cb-more-button cb-more-button--open' : 'cb-more-button'}
                              onClick={() => setDemoExpanded((current) => !current)}
                              title={demoExpanded ? 'Hide benefit details' : 'Show benefit details'}
                              aria-label={demoExpanded ? `Collapse ${BENEFIT_DEMO.name}` : `Expand ${BENEFIT_DEMO.name}`}
                            >
                              ▸
                            </button>
                          </td>
                          <td className="cb-cell cb-cell--signals cb-hide-lg">
                            <div className="cb-icon-list">
                              <SignalTextBadge kind="free-tier" label="Free tier" />
                              <SignalTextBadge kind="free-trial" label="Trial" />
                              <SignalTextBadge kind="user-discount" label="Coupon" />
                            </div>
                          </td>
                          <td className="cb-cell cb-cell--status cb-hide-sm">
                            <StatusPill kind="seed" label="Example" title="Demo row for testing multi-benefit layout only" />
                          </td>
                        </tr>

                        {demoExpanded ? (
                          <tr className="cb-expanded-row cb-expanded-row--demo">
                            <td colSpan={6}>
                              <div className="cb-expanded cb-expanded--benefits">
                                <div className="cb-expanded__benefit-title">
                                  <strong>Multiple free-entry paths for one provider</strong>
                                </div>
                                <table className="cb-benefit-subtable">
                                  <thead>
                                    <tr>
                                      <th>Benefit</th>
                                      <th>Plan</th>
                                      <th>Offer</th>
                                      <th>Bonus</th>
                                      <th>Stack</th>
                                      <th>Action</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {BENEFIT_DEMO.benefits.map((benefit, index) => (
                                      <tr key={`${BENEFIT_DEMO.slug}-${index}`}>
                                        <td>
                                          <SignalTextBadge kind={benefit.kind} label={benefit.label} />
                                        </td>
                                        <td>{benefit.plan}</td>
                                        <td>
                                          <div className="cb-offer-cell" title={benefit.offerNote}>
                                            <SignalTextBadge kind={benefit.kind} label={benefit.offer} />
                                            <span>Claim: {benefit.claim}</span>
                                          </div>
                                        </td>
                                        <td>
                                          <div className="cb-bonus-cell" title={benefit.offerNote}>
                                            <span>U: {benefit.userGets}</span>
                                            <span>R: {benefit.referrerGets}</span>
                                          </div>
                                        </td>
                                        <td>
                                          <span className="cb-pill cb-pill--unknown" title={benefit.offerNote}>
                                            {benefit.stack}
                                          </span>
                                        </td>
                                        <td>{benefit.action}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </td>
                          </tr>
                        ) : null}
                      </Fragment>
                    ) : null}

                    {visibleProviders.map((provider) => {
                      const expanded = expandedSlug === provider.slug;
                      const signals = getProviderSignals(provider);
                      const selected = selectedSlugs.includes(provider.slug);
                      const statusSignal = getSubmissionSourceSignal();
                      const infoSummary = getProviderInfoSummary(provider);
                      const hostname = toHostname(provider.website || provider.docs_url || provider.pricing_url);

                      return (
                        <Fragment key={provider.slug}>
                          <tr className={expanded ? 'cb-row cb-row--expanded' : 'cb-row'}>
                            <td className="cb-cell cb-cell--checkbox">
                              <input
                                type="checkbox"
                                checked={selected}
                                onChange={() => toggleCompare(provider.slug)}
                                aria-label={`Select ${provider.name} for compare`}
                              />
                            </td>
                            <td className="cb-cell cb-cell--provider">
                              <div className="cb-provider">
                                <span className="cb-provider__name">{provider.name}</span>
                                {hostname ? <span className="cb-provider__host">{hostname}</span> : null}
                              </div>
                            </td>
                            <td className="cb-cell cb-cell--details">
                              <div className="cb-details">
                                <span className="cb-details__summary" title={infoSummary}>
                                  {infoSummary}
                                </span>
                                <Link href="/dashboard" className="cb-details__submit" title={ROTATION_TOOLTIP}>
                                  Submit code / referral / affiliate / deal link
                                </Link>
                              </div>
                            </td>
                            <td className="cb-cell cb-cell--more">
                              <button
                                type="button"
                                className={expanded ? 'cb-more-button cb-more-button--open' : 'cb-more-button'}
                                onClick={() => setExpandedSlug(expanded ? null : provider.slug)}
                                title={expanded ? 'Hide free-entry details and links' : 'Show free-entry details and links'}
                                aria-label={expanded ? `Collapse ${provider.name}` : `Expand ${provider.name}`}
                              >
                                ▸
                              </button>
                            </td>
                            <td className="cb-cell cb-cell--signals cb-hide-lg">
                              <div className="cb-icon-list">
                                {signals.length > 0 ? (
                                  signals.map((signal) => (
                                    <SignalTextBadge key={`${provider.slug}-${signal.kind}`} kind={signal.kind} label={signal.label} />
                                  ))
                                ) : (
                                  <span className="cb-muted">No flags</span>
                                )}
                              </div>
                            </td>
                            <td className="cb-cell cb-cell--status cb-hide-sm">
                              <StatusPill {...statusSignal} />
                            </td>
                          </tr>
                          {expanded ? <ProviderExpandedRow provider={provider} statusSignal={statusSignal} expanded={expanded} /> : null}
                        </Fragment>
                      );
                    })}

                    {visibleProviders.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="cb-empty">
                          <p>No real provider rows match the current search and filter set.</p>
                        </td>
                      </tr>
                    ) : null}
                  </>
                )}
              </tbody>
            </table>
          </div>

          <div className="cb-footer">
            <div className="cb-footer__meta">
              <span>Rows per page</span>
              <strong>{PAGE_SIZE}</strong>
            </div>
            <div className="cb-footer__meta">
              <span>
                {filteredProviders.length === 0 ? 0 : startIndex + 1}-{Math.min(startIndex + PAGE_SIZE, filteredProviders.length)}
              </span>
              <strong>of {filteredProviders.length}</strong>
            </div>
            <div className="cb-pagination">
              <button type="button" onClick={() => updatePage(safePage - 1)} disabled={safePage === 1}>
                ←
              </button>
              <span>
                {safePage}/{pageCount}
              </span>
              <button type="button" onClick={() => updatePage(safePage + 1)} disabled={safePage === pageCount}>
                →
              </button>
            </div>
          </div>
        </section>
      </section>
    </div>
  );
}

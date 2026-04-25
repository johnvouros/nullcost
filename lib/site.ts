export const SITE_NAME = 'Nullcost';
export const SITE_TAGLINE = 'Free-entry developer tool catalog with free-tier, free-trial, setup, and referral signals.';
export const SITE_DESCRIPTION =
  'Nullcost is a searchable catalog of free-entry developer tooling providers with free-tier, free-trial, setup friction, MCP, API, and referral signals.';

const LOCAL_SITE_URL = 'http://127.0.0.1:3000';

function compact(value: string | null | undefined): string {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeSiteUrl(value: string | null | undefined): string {
  const text = compact(value);

  if (!text) {
    return LOCAL_SITE_URL;
  }

  const withProtocol = /^https?:\/\//i.test(text) ? text : `https://${text}`;

  try {
    const url = new URL(withProtocol);
    return url.toString().replace(/\/$/, '');
  } catch {
    return LOCAL_SITE_URL;
  }
}

export function getSiteUrl(): string {
  return normalizeSiteUrl(
    process.env.NEXT_PUBLIC_SITE_URL ||
      process.env.SITE_URL ||
      process.env.BASE_URL ||
      process.env.REFERIATE_BASE_URL ||
      process.env.REFERIATE_API_BASE_URL ||
      process.env.VERCEL_PROJECT_PRODUCTION_URL ||
      process.env.VERCEL_URL ||
      LOCAL_SITE_URL,
  );
}

export function absoluteUrl(path = '/'): string {
  const base = `${getSiteUrl()}/`;
  const cleanPath = path.startsWith('/') ? path.slice(1) : path;
  return new URL(cleanPath, base).toString();
}

export function buildTitle(title: string): string {
  return title ? `${title} · ${SITE_NAME}` : SITE_NAME;
}

export function buildProviderDescription(input: {
  name: string;
  category?: string | null;
  subcategory?: string | null;
  useCase?: string | null;
}): string {
  const details = [input.useCase, input.category, input.subcategory]
    .map((value) => compact(value))
    .filter(Boolean);

  if (details.length === 0) {
    return `${input.name} provider profile on ${SITE_NAME}.`;
  }

  return `${input.name} on ${SITE_NAME}: ${details.join(' · ')}.`;
}

export function buildProfileDescription(input: {
  displayName: string;
  bio?: string | null;
  activeEntries?: number;
  providers?: number;
}): string {
  const bio = compact(input.bio);
  if (bio) {
    return bio;
  }

  const stats = [
    typeof input.activeEntries === 'number' ? `${input.activeEntries} live codes` : '',
    typeof input.providers === 'number' ? `${input.providers} providers` : '',
  ]
    .filter(Boolean)
    .join(' · ');

  return stats
    ? `${input.displayName} referral profile on ${SITE_NAME} with ${stats}.`
    : `${input.displayName} referral profile on ${SITE_NAME}.`;
}

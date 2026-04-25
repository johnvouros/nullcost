import { getProviderRows } from '@/lib/providers';
import { listPublicReferralProfiles } from '@/lib/referrals/service';
import { absoluteUrl, SITE_DESCRIPTION, SITE_NAME } from '@/lib/site';

export const dynamic = 'force-dynamic';

const FEATURED_PROVIDER_SLUGS = [
  'vercel',
  'netlify',
  'railway',
  'render',
  'supabase',
  'neon',
  'clerk',
  'kinde',
  'workos',
  'resend',
  'mailersend',
  'mailgun',
];

export async function GET() {
  const [providers, profiles] = await Promise.all([
    getProviderRows({ limit: 5000 }),
    listPublicReferralProfiles(12).catch(() => []),
  ]);
  const featuredProviders = FEATURED_PROVIDER_SLUGS.flatMap((slug) => {
    const provider = providers.find((candidate) => candidate.slug === slug);
    return provider ? [provider] : [];
  });
  const fallbackProviders = providers.filter(
    (provider) =>
      !FEATURED_PROVIDER_SLUGS.includes(provider.slug) &&
      ['cloud', 'data', 'auth', 'email'].includes(String(provider.category ?? '')) &&
      (provider.free_tier === 'yes' || provider.free_trial === 'yes' || provider.mcp_available === 'yes'),
  );
  const llmsProviders = [...featuredProviders, ...fallbackProviders].slice(0, 12);

  const lines = [
    `# ${SITE_NAME}`,
    '',
    `> ${SITE_DESCRIPTION}`,
    '',
    'Nullcost is a public catalog of free-entry developer tooling providers.',
    'The plugin is the recommended path where local/repo plugins are supported. MCP is the tool engine underneath and can also be configured manually.',
    'MCP-compatible clients can include Codex, Claude Code, Cursor, Windsurf, VS Code/GitHub Copilot, Cline, Roo Code, Gemini CLI, Zed, OpenCode, Amp, and other stdio MCP clients.',
    'The catalog is database-backed and includes provider, setup, free-tier, free-trial, plugin, MCP, API, and referral signals.',
    'Pricing and free-entry signals come from the local Nullcost catalog database and may lag official vendor pages.',
    '',
    '## Public pages',
    `- [Catalog home](${absoluteUrl('/')})`,
    `- [Plugin install guide](${absoluteUrl('/install')})`,
    '',
    '## Provider pages',
    ...llmsProviders.map((provider) => `- [${provider.name}](${absoluteUrl(`/providers/${provider.slug}`)})`),
    '',
    '## Public referral profiles',
    ...(profiles.length > 0
      ? profiles.map((profile) => `- [${profile.slug}](${absoluteUrl(`/profiles/${profile.slug}`)})`)
      : ['- No public referral profiles listed right now.']),
    '',
    '## Structured JSON endpoints',
    `- [Provider list](${absoluteUrl('/api/providers/list?limit=100')})`,
    `- [Provider search](${absoluteUrl('/api/providers/search?q=hosting&limit=20')})`,
    '',
    '## Notes',
    '- Private account and dashboard routes are not intended for indexing.',
    '- Referral redirect routes are operational paths, not canonical content pages.',
  ];

  return new Response(lines.join('\n'), {
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'public, max-age=3600',
    },
  });
}

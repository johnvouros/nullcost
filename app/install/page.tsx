import type { Metadata } from 'next';
import Link from 'next/link';
import { CopyButton } from '@/components/copy-button';
import { SITE_NAME, absoluteUrl } from '@/lib/site';
import styles from './page.module.css';

const quickSteps = [
  {
    number: '01',
    title: 'Ask your coding agent',
    subtitle: 'Copy this prompt into Codex, Claude Code, Cursor, or another agent with terminal access.',
    commands: ['Install the Nullcost catalog, seed the database, and start the MCP server.'],
    caveats:
      'Your agent needs terminal access. It will run npm commands and local Supabase setup, so use this only in a repo and machine you trust.',
    highlight: true,
  },
  {
    number: '02',
    title: 'Start the local data',
    subtitle: 'Gives Nullcost a real catalog to query.',
    commands: ['npm run supabase:start', 'npm run db:seed'],
  },
  {
    number: '03',
    title: 'Start website and API',
    subtitle: 'The site and MCP both read the same local API.',
    commands: ['npm run dev'],
  },
  {
    number: '04',
    title: 'Start the MCP server',
    subtitle: 'This is the part your coding app talks to.',
    commands: ['npm run mcp:catalog'],
  },
] as const;

const appPaths = [
  {
    name: 'Codex',
    label: 'Start the commands above, then reload this repo.',
    tag: 'Fastest',
    kind: 'cpu',
  },
  {
    name: 'Claude',
    label: 'Uses the project plugin through the same local catalog.',
    tag: 'Ready',
    kind: 'grid',
  },
  {
    name: 'Any MCP client',
    label: 'Point it at the server if it supports raw MCP config.',
    tag: null,
    kind: 'terminal',
  },
] as const;

const promptIdeas = [
  'cheap auth service with a real free tier',
  'free tier postgres for a small Next.js SaaS',
  'best transactional email with a free trial',
  'good hosting for a solo project with low setup friction',
] as const;

const genericConfig = `{
  "nullcost-provider-catalog": {
    "command": "node",
    "args": ["/path/to/nullcost/mcp/referiate-provider-server.mjs"],
    "env": {
      "REFERIATE_API_BASE_URL": "https://nullcost.xyz"
    }
  }
}`;

export const metadata: Metadata = {
  title: 'Install',
  description:
    'Install Nullcost fast: start the local catalog, run the MCP server, and connect Codex, Claude, or another MCP client.',
  alternates: {
    canonical: '/install',
  },
  openGraph: {
    title: `Install ${SITE_NAME}`,
    description: 'Start Nullcost fast with the local MCP path and simple client setup.',
    url: absoluteUrl('/install'),
    type: 'article',
  },
};

function Glyph({ kind }: { kind: 'zap' | 'info' | 'terminal' | 'cpu' | 'grid' | 'arrow' | 'alert' }) {
  const common = {
    className: styles.glyph,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: '1.8',
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  };

  switch (kind) {
    case 'zap':
      return (
        <svg {...common}>
          <path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z" />
        </svg>
      );
    case 'info':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 10v6" />
          <path d="M12 7h.01" />
        </svg>
      );
    case 'terminal':
      return (
        <svg {...common}>
          <path d="M4 6h16v12H4z" />
          <path d="m8 10 2 2-2 2" />
          <path d="M13 16h3" />
        </svg>
      );
    case 'cpu':
      return (
        <svg {...common}>
          <rect x="7" y="7" width="10" height="10" rx="2" />
          <path d="M9 1v3M15 1v3M9 20v3M15 20v3M20 9h3M20 15h3M1 9h3M1 15h3" />
        </svg>
      );
    case 'grid':
      return (
        <svg {...common}>
          <rect x="4" y="4" width="6" height="6" rx="1" />
          <rect x="14" y="4" width="6" height="6" rx="1" />
          <rect x="4" y="14" width="6" height="6" rx="1" />
          <rect x="14" y="14" width="6" height="6" rx="1" />
        </svg>
      );
    case 'arrow':
      return (
        <svg {...common}>
          <path d="M5 12h14" />
          <path d="m13 6 6 6-6 6" />
        </svg>
      );
    case 'alert':
      return (
        <svg {...common}>
          <path d="M12 3 2.7 19h18.6L12 3Z" />
          <path d="M12 9v4" />
          <path d="M12 17h.01" />
        </svg>
      );
  }
}

function StepCard({
  number,
  title,
  subtitle,
  commands,
  caveats,
  highlight = false,
}: {
  number: string;
  title: string;
  subtitle: string;
  commands: readonly string[];
  caveats?: string;
  highlight?: boolean;
}) {
  return (
    <article className={`${styles.stepCard} ${highlight ? styles.stepCardHighlight : ''}`}>
      <div className={styles.stepShell}>
        <div className={`${styles.stepBadge} ${highlight ? styles.stepBadgeHighlight : ''}`}>{number}</div>

        <div className={styles.stepContent}>
          <div className={styles.stepHeader}>
            <h3>{title}</h3>
            {highlight ? <span className={styles.stepFlag}>Easiest</span> : null}
          </div>

          <p className={styles.stepSubtitle}>{subtitle}</p>

          <div className={styles.commandStack}>
            {commands.map((command, index) => (
              <div key={`${number}-${index}`} className={styles.commandWrap}>
                <code>{command}</code>
                <CopyButton value={command} className={styles.iconCopyButton} iconOnly />
              </div>
            ))}
          </div>

          {caveats ? (
            <div className={styles.caveat}>
              <div className={styles.caveatIcon}>
                <Glyph kind="alert" />
              </div>
              <div>
                <strong>Caveats:</strong> {caveats}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function ClientButton({
  kind,
  name,
  label,
  tag,
}: {
  kind: 'cpu' | 'grid' | 'terminal';
  name: string;
  label: string;
  tag: string | null;
}) {
  return (
    <div className={styles.clientButton}>
      <div className={styles.clientMeta}>
        <div className={styles.clientIcon}>
          <Glyph kind={kind} />
        </div>
        <div>
          <div className={styles.clientNameRow}>
            <strong>{name}</strong>
            {tag ? <span className={styles.clientTag}>{tag}</span> : null}
          </div>
          <span>{label}</span>
        </div>
      </div>
      <div className={styles.clientArrow}>
        <Glyph kind="arrow" />
      </div>
    </div>
  );
}

export default function InstallPage() {
  return (
    <div className={styles.page}>
      <div className={styles.contentGrid}>
        <div className={styles.primary}>
          <section className={styles.hero}>
            <div className={styles.heroKicker}>
              <div className={styles.heroKickerIcon}>
                <Glyph kind="zap" />
              </div>
              <span>Setup guide</span>
            </div>

            <h1>
              Install <span>Nullcost</span> fast.
            </h1>
            <p>
              The easiest path is to let your coding agent do the setup, or run the local commands below if you want
              the manual route.
            </p>
          </section>

          <section className={styles.panel}>
            <div className={styles.panelHeader}>
              <h2>Installation steps</h2>
              <span>Recommended for most users</span>
            </div>

            <div className={styles.stepList}>
              {quickSteps.slice(0, 1).map((step) => (
                <StepCard key={step.number} {...step} />
              ))}

              <div className={styles.divider}>
                <span>Or do it manually</span>
              </div>

              {quickSteps.slice(1).map((step) => (
                <StepCard key={step.number} {...step} />
              ))}
            </div>
          </section>

          <section className={styles.panel}>
            <div className={styles.panelHeader}>
              <h2>Manual config</h2>
              <span>Only for other MCP clients</span>
            </div>

            <div className={styles.manualCard}>
              <pre>
                <code>{genericConfig}</code>
              </pre>
              <CopyButton value={genericConfig} className={styles.overlayCopyButton} iconOnly />
            </div>
          </section>
        </div>

        <aside className={styles.sidebar}>
          <section className={`${styles.panel} ${styles.infoPanel}`}>
            <div className={styles.infoHeader}>
              <Glyph kind="info" />
              <span>Read this first</span>
            </div>

            <div className={styles.infoBlocks}>
              <div>
                <h3>Use MCP before plugins.</h3>
                <p>Nullcost already works as a local MCP server. The plugin layer is just a thin wrapper.</p>
              </div>
              <div>
                <h3>Need to know</h3>
                <p>MCP lets your coding app query Nullcost directly.</p>
              </div>
              <div>
                <h3>What you get</h3>
                <p>Free-tier and free-trial tool discovery from the same DB as this site.</p>
              </div>
            </div>
          </section>

          <section className={styles.clientPanel}>
            <div className={styles.sidebarHeader}>Then use your client</div>
            <div className={styles.clientList}>
              {appPaths.map((path) => (
                <ClientButton key={path.name} {...path} />
              ))}
            </div>
          </section>

          <section className={styles.panel}>
            <div className={styles.panelHeader}>
              <h2>What to ask</h2>
              <span>No slash commands needed</span>
            </div>

            <div className={styles.promptList}>
              {promptIdeas.map((prompt) => (
                <div key={prompt} className={styles.promptItem}>
                  <p>&quot;{prompt}&quot;</p>
                  <CopyButton value={prompt} className={styles.promptCopyButton} iconOnly />
                </div>
              ))}
            </div>
          </section>

          <details className={styles.technicalDetails}>
            <summary>Need the technical version?</summary>
            <div className={styles.detailsBody}>
              <ul>
                <li>The site, provider pages, and MCP all read the same local Nullcost catalog.</li>
                <li>Codex uses local MCP plus repo-local plugin metadata for this workspace.</li>
                <li>Claude uses the same server through the local plugin wrapper.</li>
                <li>Plugins stay thin. Ranking and catalog logic live in one shared backend.</li>
              </ul>
              <Link href="/" className={styles.detailsLink}>
                Back to catalog
              </Link>
            </div>
          </details>
        </aside>
      </div>
    </div>
  );
}

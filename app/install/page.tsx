import type { Metadata } from 'next';
import Link from 'next/link';
import { CopyButton } from '@/components/copy-button';
import { SITE_NAME, absoluteUrl } from '@/lib/site';
import styles from './page.module.css';

const quickSteps = [
  {
    number: '01',
    title: 'Copy this into Codex',
    subtitle: 'This is the plugin-first install path. Codex should install the plugin before falling back to raw MCP.',
    commands: [
      'Install the Nullcost Catalog plugin from https://github.com/johnvouros/nullcost/tree/main/plugins/nullcost-catalog. Use it when I ask about cheap or free-tier developer tools. If this app cannot install repo plugins, tell me and use the manual MCP fallback instead.',
    ],
    caveats:
      'Paste this into the AI coding app you already use. Do not paste it into Google, ChatGPT web search, or a normal terminal.',
    highlight: true,
  },
  {
    number: '02',
    title: 'Ask normal questions',
    subtitle: 'No slash command needed when the plugin routing skill is active.',
    commands: ['What is a cheap auth service with a real free tier?'],
  },
  {
    number: '03',
    title: 'If plugin install fails',
    subtitle: 'Copy this fallback prompt. It tells your agent exactly what to do.',
    commands: [
      'Clone https://github.com/johnvouros/nullcost, run npm install, then add the Manual MCP config from this install page to my coding app.',
    ],
  },
  {
    number: '04',
    title: 'Local development only',
    subtitle: 'Only run these if you cloned the repo and want to develop Nullcost itself.',
    commands: ['npm run supabase:start', 'npm run db:seed', 'npm run dev'],
  },
] as const;

const promptIdeas = [
  'cheap auth service with a real free tier',
  'free tier postgres for a small Next.js SaaS',
  'best transactional email with a free trial',
  'good hosting for a solo project with low setup friction',
] as const;

const mcpServersConfig = `{
  "mcpServers": {
    "nullcost": {
      "command": "node",
      "args": ["/path/to/nullcost/plugins/nullcost-catalog/scripts/run-provider-server.mjs"],
      "env": {
        "REFERIATE_API_BASE_URL": "https://nullcost.xyz"
      }
    }
  }
}`;

const vsCodeConfig = `{
  "servers": {
    "nullcost": {
      "type": "stdio",
      "command": "node",
      "args": ["/path/to/nullcost/plugins/nullcost-catalog/scripts/run-provider-server.mjs"],
      "env": {
        "REFERIATE_API_BASE_URL": "https://nullcost.xyz"
      }
    }
  }
}`;

const zedConfig = `{
  "context_servers": {
    "nullcost": {
      "command": "node",
      "args": ["/path/to/nullcost/plugins/nullcost-catalog/scripts/run-provider-server.mjs"],
      "env": {
        "REFERIATE_API_BASE_URL": "https://nullcost.xyz"
      }
    }
  }
}`;

const openCodeConfig = `{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "nullcost": {
      "type": "local",
      "command": ["node", "/path/to/nullcost/plugins/nullcost-catalog/scripts/run-provider-server.mjs"],
      "enabled": true,
      "environment": {
        "REFERIATE_API_BASE_URL": "https://nullcost.xyz"
      }
    }
  }
}`;

const noobChecklist = [
  'Use the Codex plugin card first if you are in Codex.',
  'Use MCP only if your app cannot install plugins.',
  'Clone Nullcost once if your app needs raw MCP.',
  'Copy the config for your fallback app.',
  'Paste it into that app\'s MCP settings.',
  'Restart or reload the app so it starts a fresh server.',
  'Ask one of the test prompts below.',
] as const;

const manualFallbackSteps = [
  {
    title: 'Clone Nullcost',
    text: 'This puts the MCP server files on your machine.',
    command: 'git clone https://github.com/johnvouros/nullcost',
  },
  {
    title: 'Install dependencies',
    text: 'Run this once inside the cloned folder.',
    command: 'cd nullcost && npm install',
  },
  {
    title: 'Paste the MCP config',
    text: 'Open your coding app MCP settings, paste the JSON below, then restart the app.',
    command: null,
  },
] as const;

const installTargets = [
  {
    name: 'Codex',
    tag: 'Plugin first',
    file: 'Ask Codex inside your project',
    config:
      'Install the Nullcost Catalog plugin from https://github.com/johnvouros/nullcost/tree/main/plugins/nullcost-catalog. Use it when I ask about cheap or free-tier developer tools. If plugin install is not supported here, configure the Nullcost MCP server instead.',
    note: 'Best noob path when repo plugins are available.',
  },
  {
    name: 'Claude Code',
    tag: 'MCP',
    file: 'Claude MCP config',
    config: mcpServersConfig,
    note: 'Use the same raw MCP server if a plugin wrapper is not available in your Claude setup.',
  },
  {
    name: 'Cursor',
    tag: 'MCP',
    file: '~/.cursor/mcp.json or project MCP settings',
    config: mcpServersConfig,
    note: 'Cursor uses MCP servers for external tools. Add Nullcost, then restart/reload Cursor.',
  },
  {
    name: 'Windsurf',
    tag: 'MCP',
    file: 'Windsurf/Cascade MCP settings',
    config: mcpServersConfig,
    note: 'Use the manual MCP settings path in Cascade.',
  },
  {
    name: 'VS Code / GitHub Copilot',
    tag: 'MCP',
    file: '.vscode/mcp.json or MCP: Open User Configuration',
    config: vsCodeConfig,
    note: 'VS Code uses a `servers` object, not `mcpServers`.',
  },
  {
    name: 'Cline / Roo Code',
    tag: 'MCP',
    file: 'Extension MCP settings',
    config: mcpServersConfig,
    note: 'Open the extension MCP settings and add Nullcost as a stdio server.',
  },
  {
    name: 'Gemini CLI',
    tag: 'CLI MCP',
    file: 'Gemini CLI MCP settings',
    config: mcpServersConfig,
    note: 'Use the same MCP server config shape unless your installed Gemini CLI version asks for a different wrapper.',
  },
  {
    name: 'Zed',
    tag: 'MCP',
    file: 'Zed settings.json',
    config: zedConfig,
    note: 'Zed calls MCP servers `context_servers`.',
  },
  {
    name: 'OpenCode',
    tag: 'CLI / TUI',
    file: 'opencode.json',
    config: openCodeConfig,
    note: 'OpenCode uses a top-level `mcp` object and local server command arrays.',
  },
  {
    name: 'Amp / Any MCP client',
    tag: 'Generic',
    file: 'Generic MCP JSON',
    config: mcpServersConfig,
    note: 'If your app supports stdio MCP, this is the fallback shape to start from.',
  },
] as const;

export const metadata: Metadata = {
  title: 'Install',
  description:
    'Install Nullcost for Codex, Claude Code, Cursor, Windsurf, VS Code, Cline, Roo Code, Gemini CLI, Zed, OpenCode, Amp, or any MCP client.',
  alternates: {
    canonical: '/install',
  },
  openGraph: {
    title: `Install ${SITE_NAME}`,
    description: 'Pick your coding app and copy the matching Nullcost plugin or MCP setup.',
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

function ClientSetupCard({
  name,
  tag,
  file,
  config,
  note,
}: {
  name: string;
  tag: string;
  file: string;
  config: string;
  note: string;
}) {
  return (
    <details className={styles.clientSetupCard}>
      <summary>
        <div className={styles.clientSetupHeader}>
          <div>
            <h3>{name}</h3>
            <span>{file}</span>
          </div>
          <strong>{tag}</strong>
        </div>
        <p>{note}</p>
      </summary>
      <div className={styles.clientSetupCommand}>
        <pre>
          <code>{config}</code>
        </pre>
        <CopyButton value={config} className={styles.overlayCopyButton} iconOnly />
      </div>
    </details>
  );
}

function ClientSetupPreviewCard({
  name,
  tag,
  file,
  config,
}: {
  name: string;
  tag: string;
  file: string;
  config: string;
}) {
  return (
    <article className={styles.clientSetupPreviewCard}>
      <div className={styles.clientSetupHeader}>
        <div>
          <h3>{name}</h3>
          <span>{file}</span>
        </div>
        <strong>{tag}</strong>
      </div>
      <CopyButton value={config} className={styles.copyConfigButton} idleLabel="Copy setup" copiedLabel="Copied" />
    </article>
  );
}

export default function InstallPage() {
  const codexPluginTarget = installTargets[0];
  const mcpFallbackTargets = installTargets.slice(1);

  return (
    <div className={styles.page}>
      <div className={styles.contentGrid}>
        <div className={styles.primary}>
          <section className={styles.hero}>
            <div className={styles.heroKicker}>
              <div className={styles.heroKickerIcon}>
                <Glyph kind="zap" />
              </div>
              <span>Plugin setup</span>
            </div>

            <h1>
              Install the <span>Nullcost plugin</span> first.
            </h1>
            <p>
              Codex users should start with the plugin. Raw MCP is the fallback for clients that cannot install repo
              plugins.
            </p>
          </section>

          <section className={`${styles.panel} ${styles.fastPanel}`}>
            <div className={styles.panelHeader}>
              <h2>Codex plugin path</h2>
              <span>Start here</span>
            </div>

            <p className={styles.panelIntro}>
              This is the primary install path for Codex. It installs the plugin wrapper, skills, icon, and bundled MCP
              server together.
            </p>

            <div className={styles.pluginFirstGrid}>
              <ClientSetupPreviewCard {...codexPluginTarget} />
            </div>
          </section>

          <section className={styles.panel}>
            <div className={styles.panelHeader}>
              <h2>MCP fallback and other clients</h2>
              <span>Use only if needed</span>
            </div>

            <p className={styles.panelIntro}>
              Use these when your coding app cannot install the Nullcost plugin. Replace <code>/path/to/nullcost</code>{' '}
              with the folder where you cloned the repo.
            </p>

            <div className={styles.clientSetupGrid}>
              {mcpFallbackTargets.map((target) => (
                <ClientSetupCard key={target.name} {...target} />
              ))}
            </div>
          </section>

          <details className={styles.panel}>
            <summary className={styles.panelSummary}>
              <span>Step-by-step fallback</span>
              <small>If the copied setup fails</small>
            </summary>
            <ol className={styles.checklist}>
              {noobChecklist.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ol>
          </details>

          <details className={styles.panel}>
            <summary className={styles.panelSummary}>
              <span>Simple prompt fallback</span>
              <small>If unsure</small>
            </summary>
            <div className={styles.panelHeader}>
              <h2>Simple fallback</h2>
              <span>If unsure</span>
            </div>

            <div className={styles.stepList}>
              {quickSteps.slice(0, 1).map((step) => (
                <StepCard key={step.number} {...step} />
              ))}

              <div className={styles.divider}>
                <span>Then test</span>
              </div>

              {quickSteps.slice(1, 2).map((step) => (
                <StepCard key={step.number} {...step} />
              ))}
            </div>
          </details>

          <details className={styles.panel}>
            <summary className={styles.panelSummary}>
              <span>Manual MCP config</span>
              <small>Power-user fallback</small>
            </summary>
            <p className={styles.panelIntro}>
              Use this only when your coding app says it cannot install plugins. It is more manual, but it connects to
              the same hosted Nullcost catalog.
            </p>

            <ol className={styles.fallbackList}>
              {manualFallbackSteps.map((step) => (
                <li key={step.title}>
                  <div>
                    <strong>{step.title}</strong>
                    <span>{step.text}</span>
                  </div>
                  {step.command ? (
                    <div className={styles.fallbackCommand}>
                      <code>{step.command}</code>
                      <CopyButton value={step.command} className={styles.fallbackCopyButton} iconOnly />
                    </div>
                  ) : null}
                </li>
              ))}
            </ol>

            <p className={styles.panelIntro}>
              In the JSON below, replace <code>/path/to/nullcost</code> with the full folder path where you cloned the
              repo.
            </p>

            <div className={styles.manualCard}>
              <pre>
                <code>{mcpServersConfig}</code>
              </pre>
              <CopyButton value={mcpServersConfig} className={styles.overlayCopyButton} iconOnly />
            </div>
          </details>
        </div>

        <aside className={styles.sidebar}>
          <section className={`${styles.panel} ${styles.infoPanel}`}>
            <div className={styles.infoHeader}>
              <Glyph kind="info" />
              <span>Read this first</span>
            </div>

            <div className={styles.infoBlocks}>
              <div>
                <h3>Use the plugin first.</h3>
                <p>In Codex, install the Nullcost plugin. It carries the routing skill and starts the catalog tools.</p>
              </div>
              <div>
                <h3>What if my app says no?</h3>
                <p>Then use the Manual MCP config. It is the same catalog tool, just without the plugin wrapper.</p>
              </div>
              <div>
                <h3>What you get</h3>
                <p>Free-tier and free-trial tool discovery from the same hosted catalog as this site.</p>
              </div>
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
                <li>The plugin gives branding, prompt routing, and a simpler install surface.</li>
                <li>MCP gives the actual searchable/recommendation tools.</li>
                <li>You can use MCP without the plugin, but the plugin is not useful without the MCP engine.</li>
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

#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import YAML from 'yaml';

const ROOT = path.resolve(new URL('..', import.meta.url).pathname);
const CSV_PATH = path.join(ROOT, 'data', 'providers_seed.csv');

const CNCF_SOURCE =
  'https://raw.githubusercontent.com/cncf/landscape/master/landscape.yml';
const LFAI_SOURCE =
  'https://raw.githubusercontent.com/lfai/landscape/main/landscape.yml';
const ICANN_REGISTRAR_SOURCE =
  'https://www.icann.org/en/contracted-parties/accredited-registrars/list-of-accredited-registrars/csvdownload';
const LOWENDBOX_API = 'https://lowendbox.com/wp-json/wp/v2/posts';
const SUPABASE_INTEGRATIONS_SOURCE = 'https://supabase.com/partners/integrations';
const VERCEL_INTEGRATIONS_SOURCE = 'https://vercel.com/docs/integrations';

const GENERIC_HOSTS = new Set([
  'github.com',
  'gitlab.com',
  'bitbucket.org',
  'readthedocs.io',
  'medium.com',
  'docs.google.com',
]);

const LOWENDBOX_EXCLUDED_HOSTS = new Set([
  'lowendbox.com',
  'lowendtalk.com',
  'amazon.com',
  'amazonaws.com',
  'apple.com',
  'backblaze.com',
  'gleam.io',
  'news.ycombinator.com',
  'web.archive.org',
  'wix.com',
  'squareup.com',
  'godaddy.com',
  'rclone.org',
  'serververify.com',
  'chatgpt.com',
  'claude.ai',
]);

const LOWENDBOX_SEARCH_TERMS = [
  'cheap vps',
  'shared hosting',
  'reseller hosting',
  'dedicated server',
  'wordpress hosting',
  'vps hosting',
  'cloud vps',
  'kvm vps',
];

const MANUAL_GAPS = [
  { name: 'SST', website: 'https://sst.dev', category: 'cloud', subcategory: 'app_platform', use_case: 'deploy full-stack apps and serverless workloads with IaC' },
  { name: 'Firebase', website: 'https://firebase.google.com', category: 'data', subcategory: 'backend_platform', use_case: 'managed backend, hosting, auth, and realtime app stack' },
  { name: 'Coolify', website: 'https://coolify.io', category: 'cloud', subcategory: 'app_platform', use_case: 'self-hosted app deployment and PaaS management' },
  { name: 'Dokku', website: 'https://dokku.com', category: 'cloud', subcategory: 'app_platform', use_case: 'self-hosted Heroku-style app deployment on your own servers' },
  { name: 'Hostinger', website: 'https://www.hostinger.com', category: 'cloud', subcategory: 'vps_hosting', use_case: 'budget VPS, hosting, and managed cloud services' },
  { name: 'Contabo', website: 'https://contabo.com', category: 'cloud', subcategory: 'vps_hosting', use_case: 'budget VPS and dedicated server hosting' },
  { name: 'ORY', website: 'https://www.ory.sh', category: 'auth', subcategory: 'identity', use_case: 'open-source identity, auth, and access control platform' },
  { name: 'Better Auth', website: 'https://better-auth.com', category: 'auth', subcategory: 'identity', use_case: 'TypeScript-first auth framework for modern apps' },
  { name: 'LiveKit', website: 'https://livekit.io', category: 'messaging', subcategory: 'realtime_voice', use_case: 'realtime audio, video, and AI voice app infrastructure' },
  { name: 'Vapi', website: 'https://vapi.ai', category: 'ai', subcategory: 'voice_agents', use_case: 'voice agent platform for phone and realtime AI calls' },
  { name: 'Retell AI', website: 'https://www.retellai.com', category: 'ai', subcategory: 'voice_agents', use_case: 'AI voice agents and call automation platform' },
  { name: 'Hume AI', website: 'https://www.hume.ai', category: 'ai', subcategory: 'voice_agents', use_case: 'speech, emotion, and multimodal AI APIs' },
  { name: 'Opik', website: 'https://www.comet.com/site/products/opik/', category: 'observability', subcategory: 'ai_observability', use_case: 'LLM tracing, evaluation, and agent observability' },
  { name: 'Lunary', website: 'https://lunary.ai', category: 'observability', subcategory: 'ai_observability', use_case: 'LLM analytics, prompt logs, and AI product monitoring' },
  { name: 'Weights & Biases Weave', website: 'https://wandb.ai/site/weave/', category: 'observability', subcategory: 'ai_observability', use_case: 'LLM tracing, evals, and application observability' },
  { name: 'Promptfoo', website: 'https://www.promptfoo.dev', category: 'observability', subcategory: 'ai_observability', use_case: 'prompt testing, evals, and red-teaming for LLM apps' },
  { name: 'Traceloop', website: 'https://traceloop.com', category: 'observability', subcategory: 'ai_observability', use_case: 'OpenTelemetry-based LLM observability and tracing' },
  { name: 'OpenLIT', website: 'https://openlit.io', category: 'observability', subcategory: 'ai_observability', use_case: 'open-source AI telemetry and LLM observability' },
  { name: 'Trigger.dev', website: 'https://trigger.dev', category: 'workflow', subcategory: 'automation', use_case: 'durable background jobs and workflow orchestration for TypeScript apps' },
  { name: 'n8n', website: 'https://n8n.io', category: 'workflow', subcategory: 'automation', use_case: 'workflow automation and AI agent orchestration platform' },
  { name: 'Hugging Face Inference Endpoints', website: 'https://huggingface.co/inference-endpoints', category: 'ai', subcategory: 'inference_api', use_case: 'dedicated model inference endpoints for open-weight models' },
  { name: 'StackBlitz', website: 'https://stackblitz.com', category: 'devtools', subcategory: 'sandbox_runtime', use_case: 'browser-based dev environments and instant web app sandboxes' },
  { name: 'Replit', website: 'https://replit.com', category: 'devtools', subcategory: 'sandbox_runtime', use_case: 'browser-based coding, AI app generation, and deployment platform' },
  { name: 'DreamHost', website: 'https://www.dreamhost.com', category: 'cloud', subcategory: 'shared_hosting', use_case: 'shared hosting, WordPress hosting, and managed cloud services' },
  { name: 'Bluehost', website: 'https://www.bluehost.com', category: 'cloud', subcategory: 'shared_hosting', use_case: 'shared hosting, WordPress hosting, and VPS plans for websites' },
  { name: 'SiteGround', website: 'https://www.siteground.com', category: 'cloud', subcategory: 'shared_hosting', use_case: 'managed WordPress, shared hosting, and cloud hosting for sites' },
  { name: 'WP Engine', website: 'https://wpengine.com', category: 'cloud', subcategory: 'wordpress_hosting', use_case: 'managed WordPress hosting and performance tooling' },
  { name: 'GreenGeeks', website: 'https://www.greengeeks.com', category: 'cloud', subcategory: 'shared_hosting', use_case: 'shared, WordPress, and reseller hosting' },
  { name: 'ScalaHosting', website: 'https://www.scalahosting.com', category: 'cloud', subcategory: 'vps_hosting', use_case: 'managed VPS, shared hosting, and WordPress hosting' },
  { name: 'Liquid Web', website: 'https://www.liquidweb.com', category: 'cloud', subcategory: 'managed_hosting', use_case: 'managed VPS, dedicated servers, cloud hosting, and WordPress hosting' },
  { name: 'FastComet', website: 'https://www.fastcomet.com', category: 'cloud', subcategory: 'shared_hosting', use_case: 'shared hosting, cloud VPS, and application hosting' },
  { name: 'KnownHost', website: 'https://www.knownhost.com', category: 'cloud', subcategory: 'managed_hosting', use_case: 'managed VPS, shared hosting, and dedicated server hosting' },
  { name: 'CloudCone', website: 'https://cloudcone.com', category: 'cloud', subcategory: 'vps_hosting', use_case: 'budget cloud VPS, bare metal, and object storage services' },
  { name: 'BuyVM', website: 'https://buyvm.net', category: 'cloud', subcategory: 'vps_hosting', use_case: 'budget VPS, storage slabs, and dedicated server hosting' },
  { name: 'HostHatch', website: 'https://hosthatch.com', category: 'cloud', subcategory: 'vps_hosting', use_case: 'cloud VPS and storage hosting in global regions' },
  { name: 'Authgear', website: 'https://www.authgear.com', category: 'auth', subcategory: 'identity', use_case: 'developer auth, SSO, and customer identity management' },
  { name: 'BoxyHQ', website: 'https://boxyhq.com', category: 'auth', subcategory: 'authorization', use_case: 'enterprise SSO, directory sync, and identity tooling for SaaS apps' },
  { name: 'MailPace', website: 'https://mailpace.com', category: 'email', subcategory: 'email_api', use_case: 'transactional email API and inbound email processing' },
  { name: 'ZeptoMail', website: 'https://www.zoho.com/zeptomail/', category: 'email', subcategory: 'email_api', use_case: 'transactional email delivery for apps and products' },
  { name: 'AhaSend', website: 'https://ahasend.com', category: 'email', subcategory: 'email_api', use_case: 'transactional email delivery and email API infrastructure' },
  { name: 'MailChannels', website: 'https://www.mailchannels.com', category: 'email', subcategory: 'email_api', use_case: 'SMTP relay, email delivery, and outbound email infrastructure' },
  { name: 'Postal', website: 'https://postalserver.io', category: 'email', subcategory: 'notification_infra', use_case: 'self-hosted mail server platform for transactional email delivery' },
  { name: 'EmailJS', website: 'https://www.emailjs.com', category: 'email', subcategory: 'email_api', use_case: 'send email from client apps and browser-based workflows' },
  { name: 'SendLayer', website: 'https://sendlayer.com', category: 'email', subcategory: 'email_api', use_case: 'transactional email delivery and SMTP relay for websites and apps' },
  { name: 'MailerLite', website: 'https://www.mailerlite.com', category: 'email', subcategory: 'email_marketing', use_case: 'email marketing, automation, and transactional messaging for products' },
  { name: 'Telnyx', website: 'https://telnyx.com', category: 'messaging', subcategory: 'communications_api', use_case: 'voice, messaging, SIP, and connectivity APIs for applications' },
];

const SOURCE_FIELDNAMES = [
  'slug',
  'name',
  'category',
  'subcategory',
  'website',
  'use_case',
  'self_serve',
  'affiliate_status',
  'referral_status',
  'other_programs',
  'program_notes',
  'source_url',
  'research_status',
  'last_verified',
  'pricing_url',
  'docs_url',
  'signup_url',
  'pricing_model',
  'starting_price',
  'free_tier',
  'free_trial',
  'contact_sales_only',
  'deployment_model',
  'open_source',
  'api_available',
  'cli_available',
  'mcp_available',
  'setup_friction',
  'target_customer',
  'program_url',
  'program_type',
  'commission_model',
  'user_discount_available',
  'last_pricing_checked',
  'last_program_checked',
  'starting_price_amount',
  'starting_price_currency',
  'starting_price_currency_symbol',
  'starting_price_unit',
  'starting_price_source',
  'pricing_confidence',
  'pricing_notes',
  'pricing_normalized_at',
];

function normalize(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function lower(value) {
  return normalize(value).toLowerCase();
}

function slugify(value) {
  return normalize(value)
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function hostnameOf(url) {
  const value = normalize(url);
  if (!value) return '';
  try {
    return new URL(value).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return value.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0].toLowerCase();
  }
}

function dedupeHost(url) {
  const host = hostnameOf(url).replace(/\u00a0/g, '').trim();
  return GENERIC_HOSTS.has(host) ? '' : host;
}

function originFromUrl(url) {
  const value = normalize(url);
  if (!value) return '';
  try {
    const parsed = new URL(value);
    return `${parsed.protocol}//${parsed.hostname}${parsed.port ? `:${parsed.port}` : ''}`;
  } catch {
    return value;
  }
}

function hostLabel(host) {
  const clean = host.replace(/\u00a0/g, '').trim().replace(/^www\./, '');
  const first = clean.split('.')[0] || clean;
  const normalized = first.replace(/[-_]+/g, ' ');
  return normalized
    .split(' ')
    .filter(Boolean)
    .map((part) => (/\d/.test(part) ? part.toUpperCase() : part.charAt(0).toUpperCase() + part.slice(1)))
    .join(' ');
}

function csvEscape(value) {
  const text = String(value ?? '');
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function parseCsv(text) {
  const rows = [];
  let current = '';
  let row = [];
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          current += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        current += ch;
      }
      continue;
    }

    if (ch === '"') {
      quoted = true;
    } else if (ch === ',') {
      row.push(current);
      current = '';
    } else if (ch === '\n') {
      row.push(current);
      rows.push(row);
      row = [];
      current = '';
    } else if (ch !== '\r') {
      current += ch;
    }
  }

  if (current.length > 0 || row.length > 0) {
    row.push(current);
    rows.push(row);
  }

  const [header, ...body] = rows;
  return body.map((cols) => Object.fromEntries(header.map((key, index) => [key, cols[index] ?? ''])));
}

function parseExternalCsv(text) {
  return parseCsv(text).map((row) =>
    Object.fromEntries(
      Object.entries(row).map(([key, value]) => [key.replace(/^\uFEFF/, '').replace(/^"+|"+$/g, ''), value]),
    ),
  );
}

function serializeCsv(rows) {
  const lines = [SOURCE_FIELDNAMES.join(',')];
  for (const row of rows) {
    lines.push(SOURCE_FIELDNAMES.map((field) => csvEscape(row[field] ?? '')).join(','));
  }
  return `${lines.join('\n')}\n`;
}

async function fetchYaml(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`failed to fetch ${url}: ${response.status}`);
  }
  return YAML.parse(await response.text());
}

async function fetchText(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`failed to fetch ${url}: ${response.status}`);
  }
  return response.text();
}

function inferCategory(categoryName, subcategoryName) {
  const key = `${lower(categoryName)} ${lower(subcategoryName)}`;
  if (/ai|machine learning|llm|model|vector|mlops|inference|rag|speech|agent/.test(key)) return 'ai';
  if (/storage|database|cache|streaming|messaging|data/.test(key)) return 'data';
  if (/observability|monitoring|logging|tracing|profiling|analysis/.test(key)) return 'observability';
  if (/security|compliance|policy|governance|identity|access/.test(key)) return 'security';
  if (/network|service mesh|dns|edge|gateway|proxy|platform|runtime|serverless|cloud native network/.test(key)) return 'cloud';
  if (/continuous integration|continuous delivery|build|testing|developer|devfile|app definition|app development|packaging|artifact|developer tools/.test(key)) return 'devtools';
  if (/orchestration|provisioning|scheduling|workflow/.test(key)) return 'workflow';
  if (/communication|messaging/.test(key)) return 'messaging';
  return 'devtools';
}

function deriveUseCase(categoryName, subcategoryName) {
  const sub = normalize(subcategoryName);
  const cat = normalize(categoryName);
  if (sub && cat) return `${sub.toLowerCase()} tooling from the ${cat.toLowerCase()} ecosystem`;
  if (sub) return `${sub.toLowerCase()} tooling`;
  return `${cat.toLowerCase()} tooling`;
}

function stripHtml(html) {
  return normalize(
    String(html ?? '')
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&#8217;/g, "'")
      .replace(/&#038;/g, '&')
      .replace(/&#8220;|&#8221;/g, '"')
      .replace(/&#8211;/g, '-')
      .replace(/&nbsp;/g, ' '),
  );
}

function inferCategoryFromText(text, fallback = 'devtools') {
  const key = lower(text);
  if (!key) return fallback;
  if (/(hosting|deploy|deployment|edge|serverless|platform|infrastructure|runtime|compute|cdn|dns|cloud)/.test(key)) return 'cloud';
  if (/(auth|authentication|identity|authorization|sso|login|passkey|oauth)/.test(key)) return 'auth';
  if (/(database|postgres|mysql|redis|cache|storage|vector|search|warehouse|stream|queue)/.test(key)) return 'data';
  if (/(email|smtp|mail|notification|messaging|sms|voice|chat|communication)/.test(key)) return 'email';
  if (/(observability|monitoring|logging|tracing|analytics|feature flag|experimentation)/.test(key)) return 'observability';
  if (/(payments|billing|checkout|subscription|tax|invoice)/.test(key)) return 'payments';
  if (/(workflow|automation|background jobs|cron|orchestration)/.test(key)) return 'workflow';
  if (/(ai|llm|model|inference|agent|speech|embedding|rerank)/.test(key)) return 'ai';
  if (/(cms|content|headless cms)/.test(key)) return 'cms';
  if (/(security|compliance|fraud|secrets|vault|firewall|waf)/.test(key)) return 'security';
  if (/(support|crm|ticket|feedback|helpdesk)/.test(key)) return 'support';
  if (/(test|testing|browser automation|e2e|qa)/.test(key)) return 'testing';
  return fallback;
}

function baseRow() {
  return Object.fromEntries(SOURCE_FIELDNAMES.map((field) => [field, '']));
}

function normalizeLandscapeItem(item, categoryName, subcategoryName, sourceUrl) {
  const name = normalize(item.name || item.project || item.organization);
  const website =
    normalize(item.homepage_url) ||
    normalize(item.website) ||
    normalize(item.project) ||
    normalize(item.repo_url);

  if (!name || !website) return null;

  const row = baseRow();
  row.slug = slugify(name);
  row.name = name;
  row.category = inferCategory(categoryName, subcategoryName);
  row.subcategory = slugify(subcategoryName || categoryName);
  row.website = website;
  row.use_case = deriveUseCase(categoryName, subcategoryName);
  row.self_serve = 'unknown';
  row.affiliate_status = 'unknown';
  row.referral_status = 'unknown';
  row.other_programs = 'unknown';
  row.program_notes = '';
  row.source_url = sourceUrl;
  row.research_status = 'seed_only';
  row.last_verified = '';
  row.pricing_url = '';
  row.docs_url = '';
  row.signup_url = '';
  row.pricing_model = '';
  row.starting_price = '';
  row.free_tier = 'unknown';
  row.free_trial = 'unknown';
  row.contact_sales_only = 'unknown';
  row.deployment_model = 'unknown';
  row.open_source = lower(item.open_source) === 'yes' ? 'yes' : 'unknown';
  row.api_available = 'unknown';
  row.cli_available = 'unknown';
  row.mcp_available = 'unknown';
  row.setup_friction = 'unknown';
  row.target_customer = 'mixed';
  row.program_url = '';
  row.program_type = '';
  row.commission_model = '';
  row.user_discount_available = 'unknown';
  row.last_pricing_checked = '';
  row.last_program_checked = '';
  row.starting_price_amount = '';
  row.starting_price_currency = '';
  row.starting_price_currency_symbol = '';
  row.starting_price_unit = '';
  row.starting_price_source = '';
  row.pricing_confidence = '';
  row.pricing_notes = '';
  row.pricing_normalized_at = '';
  return row;
}

function flattenLandscape(document, sourceUrl) {
  const rows = [];
  for (const categoryEntry of document.landscape ?? []) {
    const categoryName = normalize(categoryEntry.name || categoryEntry.category?.name);
    const subcategories = categoryEntry.subcategories || categoryEntry.category?.subcategories || [];
    for (const subEntry of subcategories) {
      const subcategoryName = normalize(subEntry.name || subEntry.subcategory?.name);
      const items = subEntry.items || subEntry.subcategory?.items || [];
      for (const item of items) {
        const row = normalizeLandscapeItem(item, categoryName, subcategoryName, sourceUrl);
        if (row) rows.push(row);
      }
    }
  }
  return rows;
}

function normalizeManualGap(item) {
  const row = baseRow();
  row.slug = slugify(item.name);
  row.name = item.name;
  row.category = item.category;
  row.subcategory = item.subcategory;
  row.website = item.website;
  row.use_case = item.use_case;
  row.self_serve = 'unknown';
  row.affiliate_status = 'unknown';
  row.referral_status = 'unknown';
  row.other_programs = 'unknown';
  row.program_notes = '';
  row.source_url = item.website;
  row.research_status = 'seed_only';
  row.free_tier = 'unknown';
  row.free_trial = 'unknown';
  row.contact_sales_only = 'unknown';
  row.deployment_model = 'unknown';
  row.open_source = 'unknown';
  row.api_available = 'unknown';
  row.cli_available = 'unknown';
  row.mcp_available = 'unknown';
  row.setup_friction = 'unknown';
  row.target_customer = 'mixed';
  row.user_discount_available = 'unknown';
  row._skipHostDedupe = true;
  return row;
}

function normalizeMarketplaceRow({ name, website, description, categoryText, sourceUrl, subcategoryHint, docsUrl = '' }) {
  const cleanName = normalize(name);
  const cleanWebsite = normalize(website);
  if (!cleanName || !cleanWebsite) return null;

  const row = baseRow();
  row.slug = slugify(cleanName);
  row.name = cleanName;
  row.category = inferCategoryFromText(`${categoryText} ${description}`, 'devtools');
  row.subcategory = slugify(subcategoryHint || categoryText || row.category || 'integration');
  row.website = cleanWebsite;
  row.use_case = normalize(description) || deriveUseCase(row.category, row.subcategory);
  row.self_serve = 'unknown';
  row.affiliate_status = 'unknown';
  row.referral_status = 'unknown';
  row.other_programs = 'unknown';
  row.program_notes = '';
  row.source_url = sourceUrl;
  row.research_status = 'seed_only';
  row.pricing_url = '';
  row.docs_url = docsUrl || '';
  row.signup_url = '';
  row.pricing_model = '';
  row.starting_price = '';
  row.free_tier = 'unknown';
  row.free_trial = 'unknown';
  row.contact_sales_only = 'unknown';
  row.deployment_model = 'unknown';
  row.open_source = 'unknown';
  row.api_available = 'unknown';
  row.cli_available = 'unknown';
  row.mcp_available = 'unknown';
  row.setup_friction = 'unknown';
  row.target_customer = 'mixed';
  row.program_url = '';
  row.program_type = '';
  row.commission_model = '';
  row.user_discount_available = 'unknown';
  row._skipHostDedupe = false;
  return row;
}

function extractSupabaseCards(html) {
  const cards = [];
  const pattern =
    /<a href="(\/partners\/[^"]+)"><div[\s\S]*?<h3[^>]*>([^<]+)<\/h3><p[^>]*title="([^"]+)"/g;
  for (const match of html.matchAll(pattern)) {
    cards.push({
      detailPath: match[1],
      name: stripHtml(match[2]),
      description: stripHtml(match[3]),
    });
  }
  return cards;
}

function extractSupabaseCategory(html) {
  const match = html.match(/href="\/partners\/integrations#([^"]+)">([^<]+)<\/a>/i);
  return stripHtml(match?.[2] || '');
}

function extractWebsiteFromLabeledRow(html, label) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = html.match(new RegExp(`<span[^>]*>${escaped}<\\/span><a href="([^"]+)"`, 'i'));
  return normalize(match?.[1] || '');
}

async function fetchSupabaseIntegrationCandidates() {
  const html = await fetchText(SUPABASE_INTEGRATIONS_SOURCE);
  const cards = extractSupabaseCards(html);
  const rows = [];

  for (const card of cards) {
    const detailUrl = new URL(card.detailPath, SUPABASE_INTEGRATIONS_SOURCE).toString();
    const detailHtml = await fetchText(detailUrl);
    const website =
      extractWebsiteFromLabeledRow(detailHtml, 'Website') ||
      extractWebsiteFromLabeledRow(detailHtml, 'Documentation');
    const categoryText = extractSupabaseCategory(detailHtml) || 'Supabase integration';
    const row = normalizeMarketplaceRow({
      name: card.name,
      website,
      description: card.description,
      categoryText,
      subcategoryHint: categoryText,
      sourceUrl: detailUrl,
      docsUrl: extractWebsiteFromLabeledRow(detailHtml, 'Documentation'),
    });
    if (row) rows.push(row);
  }

  return rows;
}

function extractVercelTags(tagsHtml) {
  return Array.from(tagsHtml.matchAll(/>([^<>]+)<\/div>/g), (match) => stripHtml(match[1])).filter(Boolean);
}

function extractVercelRows(html) {
  const rows = [];
  const pattern =
    /<tr aria-roledescription="row" class="row"><td><a href="(https:\/\/vercel\.com\/marketplace\/[^"]+)"[\s\S]*?>([^<]+)<\/a><\/td><td><p[^>]*>([^<]+)<\/p><\/td><td>([\s\S]*?)<\/td><\/tr>/g;
  for (const match of html.matchAll(pattern)) {
    rows.push({
      detailUrl: normalize(match[1]),
      name: stripHtml(match[2]),
      description: stripHtml(match[3]),
      tags: extractVercelTags(match[4]),
    });
  }
  return rows;
}

async function fetchVercelIntegrationCandidates() {
  const html = await fetchText(VERCEL_INTEGRATIONS_SOURCE);
  const integrations = extractVercelRows(html);
  const rows = [];

  for (const integration of integrations) {
    const detailHtml = await fetchText(integration.detailUrl);
    const website = extractWebsiteFromLabeledRow(detailHtml, 'Website');
    const row = normalizeMarketplaceRow({
      name: integration.name,
      website,
      description: integration.description,
      categoryText: integration.tags.join(' '),
      subcategoryHint: integration.tags[0] || 'vercel_marketplace',
      sourceUrl: integration.detailUrl,
    });
    if (row) rows.push(row);
  }

  return rows;
}

function normalizeIcannRegistrar(item) {
  const name = normalize(item['Registrar Name']);
  const website = normalize(item.Link);
  if (!name || !website) return null;

  const row = baseRow();
  row.slug = slugify(name);
  row.name = name;
  row.category = 'domains';
  row.subcategory = 'registrar';
  row.website = website;
  row.use_case = 'domain registration and DNS management';
  row.self_serve = 'unknown';
  row.affiliate_status = 'unknown';
  row.referral_status = 'unknown';
  row.other_programs = 'unknown';
  row.program_notes = '';
  row.source_url = ICANN_REGISTRAR_SOURCE;
  row.research_status = 'seed_only';
  row.free_tier = 'unknown';
  row.free_trial = 'unknown';
  row.contact_sales_only = 'unknown';
  row.deployment_model = 'hosted';
  row.open_source = 'unknown';
  row.api_available = 'unknown';
  row.cli_available = 'unknown';
  row.mcp_available = 'unknown';
  row.setup_friction = 'unknown';
  row.target_customer = 'mixed';
  row.user_discount_available = 'unknown';
  return row;
}

function providerNameFromTitle(title, fallbackHost) {
  const clean = normalize(
    title
      .replace(/&#8217;/g, "'")
      .replace(/&#038;/g, '&')
      .replace(/&#8220;|&#8221;/g, '"')
      .replace(/&#8211;/g, '-')
      .replace(/<[^>]+>/g, ''),
  );

  const patterns = [
    /^NEWS:\s+([^!:.]+?)\s+Expands/i,
    /\bfrom\s+([^!,.]+?)(?:!|\.|,| on | has | is | starting|\s{2,}|$)/i,
    /^([^!:.]+?)\s+has\b/i,
    /^([^!:.]+?)\s+Completes Acquisition\b/i,
    /^([^!:.]+?)\s+Ranks\b/i,
    /^([^!:.]+?)\s+Lives Again\b/i,
    /^Check Out\s+([^!,.]+?)(?:!|\.|,|\s{2,}|$)/i,
    /^Get VPS Resource Pools from\s+([^!,.]+?)(?:!|\.|,|\s{2,}|$)/i,
    /^Launch Your Personal AI Agent Today!.*from\s+([^!,.]+?)(?:!|\.|,|\s{2,}|$)/i,
    /^([^!:.]+?):/i,
  ];

  for (const pattern of patterns) {
    const match = clean.match(pattern);
    if (match?.[1]) {
      return normalize(match[1].replace(/'s\b/i, '').replace(/\bDeals?\b/i, '').replace(/\bOffers?\b/i, ''));
    }
  }
  return hostLabel(fallbackHost);
}

function shouldSkipLowEndBoxTitle(title) {
  const key = lower(title);
  return [
    'lowendboxtv',
    'inside the',
    'looking back at',
    'did you miss any of these',
    'deep lore on the',
    'the top free website builders',
    'are you using all the cloud storage',
    'happy 15th birthday',
    'lowendbox hits',
    'the search for a good web hosting joke',
    'what exactly is a looking glass',
  ].some((prefix) => key.startsWith(prefix));
}

function classifyLowEndBoxSubcategory(title) {
  const key = lower(title);
  if (key.includes('wordpress')) return 'wordpress_hosting';
  if (key.includes('shared') || key.includes('reseller')) return 'shared_hosting';
  if (key.includes('dedicated')) return 'dedicated_hosting';
  if (key.includes('vps') || key.includes('vm')) return 'vps_hosting';
  return 'web_hosting';
}

function classifyLowEndBoxUseCase(subcategory) {
  if (subcategory === 'wordpress_hosting') return 'managed WordPress hosting and website deployment';
  if (subcategory === 'shared_hosting') return 'budget shared, reseller, and website hosting';
  if (subcategory === 'dedicated_hosting') return 'dedicated servers and bare metal hosting';
  if (subcategory === 'vps_hosting') return 'budget VPS and cloud server hosting';
  return 'budget web hosting and cloud infrastructure';
}

function scoreLowEndBoxUrl(url) {
  const host = hostnameOf(url);
  let score = 0;
  if (host.startsWith('www.')) score += 2;
  if (!/(panel|client|billing|portal|cloud|my|order|lg|status)\./.test(host)) score += 3;
  try {
    const parsed = new URL(url);
    if (parsed.pathname === '/' || parsed.pathname === '') score += 3;
  } catch {}
  return score;
}

function pickLowEndBoxWebsite(urls) {
  const candidates = urls
    .map((value) => normalize(value))
    .filter(Boolean)
    .filter((value) => {
      const host = hostnameOf(value);
      return host && !LOWENDBOX_EXCLUDED_HOSTS.has(host);
    });

  if (!candidates.length) return '';
  candidates.sort((left, right) => scoreLowEndBoxUrl(right) - scoreLowEndBoxUrl(left));
  return originFromUrl(candidates[0]);
}

function normalizeLowEndBoxPost(post) {
  const title = normalize(post?.title?.rendered);
  if (!title || shouldSkipLowEndBoxTitle(title)) return null;
  const content = normalize(post?.content?.rendered);
  const urls = Array.from(content.matchAll(/href="(https?:\/\/[^"]+)"/g), (match) => match[1]);
  const website = pickLowEndBoxWebsite(urls);
  if (!website) return null;

  const host = hostnameOf(website);
  const row = baseRow();
  row.slug = slugify(providerNameFromTitle(title, host));
  row.name = providerNameFromTitle(title, host);
  row.category = 'cloud';
  row.subcategory = classifyLowEndBoxSubcategory(title);
  row.website = website;
  row.use_case = classifyLowEndBoxUseCase(row.subcategory);
  row.self_serve = 'unknown';
  row.affiliate_status = 'unknown';
  row.referral_status = 'unknown';
  row.other_programs = 'unknown';
  row.program_notes = '';
  row.source_url = normalize(post?.link) || LOWENDBOX_API;
  row.research_status = 'seed_only';
  row.free_tier = 'unknown';
  row.free_trial = 'unknown';
  row.contact_sales_only = 'unknown';
  row.deployment_model = 'hosted';
  row.open_source = 'unknown';
  row.api_available = 'unknown';
  row.cli_available = 'unknown';
  row.mcp_available = 'unknown';
  row.setup_friction = 'unknown';
  row.target_customer = 'mixed';
  row.user_discount_available = 'unknown';
  return row;
}

async function fetchLowEndBoxCandidates() {
  const rows = [];
  const seenPosts = new Set();

  for (const term of LOWENDBOX_SEARCH_TERMS) {
    const query = new URLSearchParams({ search: term, per_page: '12' });
    const response = await fetch(`${LOWENDBOX_API}?${query.toString()}`);
    if (!response.ok) {
      throw new Error(`failed to fetch LowEndBox posts for ${term}: ${response.status}`);
    }
    const posts = await response.json();
    for (const post of posts) {
      if (seenPosts.has(post.id)) continue;
      seenPosts.add(post.id);
      const row = normalizeLowEndBoxPost(post);
      if (row) rows.push(row);
    }
  }

  return rows;
}

function buildIndex(rows) {
  const bySlug = new Map();
  const byName = new Set();
  const byHost = new Set();

  for (const row of rows) {
    bySlug.set(row.slug, row);
    byName.add(lower(row.name));
    const host = dedupeHost(row.website);
    if (host) byHost.add(host);
  }

  return { bySlug, byName, byHost };
}

function uniqueSlug(base, bySlug, website) {
  if (!bySlug.has(base)) return base;
  const host = hostnameOf(website).split('.')[0];
  if (host) {
    const alt = slugify(`${base}-${host}`);
    if (!bySlug.has(alt)) return alt;
  }
  let i = 2;
  while (bySlug.has(`${base}-${i}`)) i += 1;
  return `${base}-${i}`;
}

function shouldSkip(row, index) {
  const nameKey = lower(row.name);
  const hostKey = dedupeHost(row.website);
  return index.byName.has(nameKey) || (!row._skipHostDedupe && hostKey && index.byHost.has(hostKey));
}

function mergeRows(existingRows, candidateRows) {
  const merged = [...existingRows];
  const index = buildIndex(existingRows);
  let added = 0;

  for (const candidate of candidateRows) {
    if (shouldSkip(candidate, index)) continue;
    const next = { ...candidate };
    next.slug = uniqueSlug(next.slug, index.bySlug, next.website);
    merged.push(next);
    index.bySlug.set(next.slug, next);
    index.byName.add(lower(next.name));
    const host = dedupeHost(next.website);
    if (host) index.byHost.add(host);
    added += 1;
  }

  return { merged, added };
}

async function main() {
  const existingCsv = await fs.readFile(CSV_PATH, 'utf8');
  const existingRows = parseCsv(existingCsv);

  const [cncf, lfai, icannCsv, lowEndBoxRows] = await Promise.all([
    fetchYaml(CNCF_SOURCE),
    fetchYaml(LFAI_SOURCE),
    fetchText(ICANN_REGISTRAR_SOURCE),
    fetchLowEndBoxCandidates(),
  ]);

  const [supabaseIntegrationRows, vercelIntegrationRows] = await Promise.all([
    fetchSupabaseIntegrationCandidates(),
    fetchVercelIntegrationCandidates(),
  ]);

  const candidates = [
    ...flattenLandscape(cncf, CNCF_SOURCE),
    ...flattenLandscape(lfai, LFAI_SOURCE),
    ...parseExternalCsv(icannCsv).map(normalizeIcannRegistrar).filter(Boolean),
    ...lowEndBoxRows,
    ...supabaseIntegrationRows,
    ...vercelIntegrationRows,
    ...MANUAL_GAPS.map(normalizeManualGap),
  ];

  const { merged, added } = mergeRows(existingRows, candidates);
  const sorted = merged.sort((left, right) => left.name.localeCompare(right.name) || left.slug.localeCompare(right.slug));
  await fs.writeFile(CSV_PATH, serializeCsv(sorted), 'utf8');

  const byCategory = new Map();
  for (const row of sorted) {
    const key = row.category || 'unknown';
    byCategory.set(key, (byCategory.get(key) ?? 0) + 1);
  }

  console.log(`Added ${added} new provider rows`);
  console.log(`New total: ${sorted.length}`);
  console.log(
    Array.from(byCategory.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .map(([key, value]) => `${key}:${value}`)
      .join(', '),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

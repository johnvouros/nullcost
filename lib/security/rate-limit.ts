import { createHash } from 'node:crypto';
import { headers } from 'next/headers';
import type { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getSupabaseServiceRoleKey, getSupabaseUrl } from '@/lib/supabase/config';

interface RateLimitRule {
  scope: string;
  identifier: string;
  windowSeconds: number;
  maxHits: number;
}

type RateLimitResult = {
  allowed: boolean;
  hit_count: number;
  retry_after_seconds: number;
  window_started_at: string;
};

export class RateLimitError extends Error {
  retryAfterSeconds: number;

  constructor(message: string, retryAfterSeconds: number) {
    super(message);
    this.name = 'RateLimitError';
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

function getServiceSupabaseClient() {
  return createClient(getSupabaseUrl(), getSupabaseServiceRoleKey(), {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function compact(value: string | null | undefined) {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim();
}

function hashIdentifier(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

function normalizeIpCandidate(value: string | null | undefined) {
  const first = compact(value).split(',')[0]?.trim() || '';
  return first || null;
}

export function getRequestIp(source: Headers | Pick<NextRequest, 'headers'>['headers']) {
  return (
    normalizeIpCandidate(source.get('x-forwarded-for')) ||
    normalizeIpCandidate(source.get('x-real-ip')) ||
    normalizeIpCandidate(source.get('cf-connecting-ip')) ||
    normalizeIpCandidate(source.get('x-vercel-forwarded-for')) ||
    'unknown-ip'
  );
}

async function consumeRateLimit(rule: RateLimitRule) {
  const supabase = getServiceSupabaseClient();
  const { data, error } = await supabase.rpc('apply_rate_limit', {
    scope_input: compact(rule.scope),
    bucket_key_input: hashIdentifier(compact(rule.identifier)),
    window_seconds_input: Math.max(1, Math.floor(rule.windowSeconds)),
    max_hits_input: Math.max(1, Math.floor(rule.maxHits)),
  });

  if (error) {
    throw new Error(`Rate limit check failed: ${error.message}`);
  }

  const row = ((data ?? []) as RateLimitResult[])[0];

  if (!row) {
    throw new Error('Rate limit check returned no result');
  }

  if (!row.allowed) {
    throw new RateLimitError('Too many requests. Please slow down and try again shortly.', row.retry_after_seconds);
  }

  return row;
}

export async function enforceRateLimit(rules: RateLimitRule[]) {
  for (const rule of rules) {
    await consumeRateLimit(rule);
  }
}

export async function getCurrentRequestHeaders() {
  return headers();
}

export async function enforceAuthRateLimit(
  action: 'sign-in' | 'sign-up',
  email: string,
  source: Headers | Pick<NextRequest, 'headers'>['headers'],
) {
  const normalizedEmail = compact(email).toLowerCase();
  const ip = getRequestIp(source);

  await enforceRateLimit([
    {
      scope: `auth:${action}:ip`,
      identifier: `ip:${ip}`,
      windowSeconds: 600,
      maxHits: action === 'sign-up' ? 8 : 15,
    },
    {
      scope: `auth:${action}:email`,
      identifier: `email:${normalizedEmail}`,
      windowSeconds: 600,
      maxHits: action === 'sign-up' ? 4 : 8,
    },
  ]);
}

export async function enforceContributorWriteRateLimit(
  scope: string,
  accountId: string,
  source?: Headers | Pick<NextRequest, 'headers'>['headers'],
) {
  const requestHeaders = source ?? (await getCurrentRequestHeaders());
  const ip = getRequestIp(requestHeaders);

  await enforceRateLimit([
    {
      scope: `${scope}:account`,
      identifier: `account:${accountId}`,
      windowSeconds: 600,
      maxHits: 20,
    },
    {
      scope: `${scope}:ip`,
      identifier: `ip:${ip}`,
      windowSeconds: 600,
      maxHits: 40,
    },
  ]);
}

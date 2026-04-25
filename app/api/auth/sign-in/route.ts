import { NextResponse, type NextRequest } from 'next/server';
import { enforceAuthRateLimit, RateLimitError } from '@/lib/security/rate-limit';
import { sanitizeInternalPath } from '@/lib/security/redirects';
import { createRouteSupabaseClient } from '@/lib/supabase/route';

function compact(value: unknown) {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim();
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const email = compact(body?.email).toLowerCase();
    const password = compact(body?.password);
    const nextPath = sanitizeInternalPath(body?.nextPath);

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required.' }, { status: 400 });
    }

    await enforceAuthRateLimit('sign-in', email, request.headers);

    const response = NextResponse.json({ ok: true, nextPath });
    const supabase = createRouteSupabaseClient(request, response);
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return response;
  } catch (error) {
    if (error instanceof RateLimitError) {
      return NextResponse.json(
        {
          error: error.message,
          code: 'rate_limited',
          retryAfterSeconds: error.retryAfterSeconds,
        },
        {
          status: 429,
          headers: {
            'retry-after': String(error.retryAfterSeconds),
          },
        },
      );
    }

    const message = error instanceof Error ? error.message : 'Sign-in failed';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

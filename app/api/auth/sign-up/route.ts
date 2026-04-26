import { NextResponse, type NextRequest } from 'next/server';
import { enforceAuthRateLimit, RateLimitError } from '@/lib/security/rate-limit';
import { sanitizeInternalPath } from '@/lib/security/redirects';
import { absoluteUrl } from '@/lib/site';
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
    const displayName = compact(body?.displayName);
    const nextPath = sanitizeInternalPath(body?.nextPath);

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required.' }, { status: 400 });
    }

    await enforceAuthRateLimit('sign-up', email, request.headers);

    const cookieResponse = NextResponse.next();
    const supabase = createRouteSupabaseClient(request, cookieResponse);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          display_name: displayName || undefined,
        },
        emailRedirectTo: absoluteUrl('/auth'),
      },
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (!data.session) {
      return NextResponse.json({
        ok: true,
        nextPath,
        sessionCreated: false,
        message: 'Check your email to confirm your account, then sign in.',
      });
    }

    const response = NextResponse.json({ ok: true, nextPath, sessionCreated: true });
    cookieResponse.cookies.getAll().forEach(({ name, value, ...rest }) => {
      response.cookies.set(name, value, rest);
    });
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

    const message = error instanceof Error ? error.message : 'Sign-up failed';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

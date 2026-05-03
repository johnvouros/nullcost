import { NextResponse } from 'next/server';
import { getProviderBySlug } from '@/lib/providers';
import { recordReferralClick, resolveProviderReferral } from '@/lib/referrals/service';
import { getProviderFallbackTarget, getProviderRouterControlBySlug } from '@/lib/referrals/router';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> | { slug: string } },
) {
  const { slug } = await params;
  const provider = await getProviderBySlug(slug);

  if (!provider) {
    return NextResponse.redirect(new URL('/', request.url), { status: 307 });
  }

  try {
    const resolution = await resolveProviderReferral(provider.slug, {
      source: 'site',
      metadata: {
        route: 'go',
        requestedAt: new Date().toISOString(),
      },
    });

    if (resolution?.entry.resolvedUrl) {
      await recordReferralClick(resolution.rotationId, {
        metadata: {
          route: 'go',
        },
      }).catch(() => null);

      return NextResponse.redirect(resolution.entry.resolvedUrl, { status: 307 });
    }
  } catch {
    // Fall through to the official provider links when the referral pool is empty or unavailable.
  }

  let fallback =
    provider.website ||
    provider.docs_url ||
    provider.pricing_url ||
    provider.signup_url ||
    new URL('/', request.url).toString();

  try {
    const control = await getProviderRouterControlBySlug(provider.slug);
    fallback = getProviderFallbackTarget(provider, control.fallbackPreference, request.url).url;
  } catch {
    fallback =
      provider.website ||
      provider.docs_url ||
      provider.pricing_url ||
      provider.signup_url ||
      new URL('/', request.url).toString();
  }

  return NextResponse.redirect(fallback, { status: 307 });
}

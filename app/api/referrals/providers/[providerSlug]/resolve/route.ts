import { type NextRequest, NextResponse } from 'next/server';
import { resolveProviderReferral } from '@/lib/referrals/service';

export const dynamic = 'force-dynamic';

function sanitizeResolution(resolution: Awaited<ReturnType<typeof resolveProviderReferral>>) {
  if (!resolution) {
    return null;
  }

  return {
    rotationId: resolution.rotationId,
    selectedAt: resolution.selectedAt,
    provider: {
      slug: resolution.provider.slug,
      name: resolution.provider.name,
    },
    entry: {
      kind: resolution.entry.kind,
      title: resolution.entry.title,
      resolvedUrl: resolution.entry.resolvedUrl,
      destinationUrl: resolution.entry.destinationUrl,
      referralCode: resolution.entry.referralCode,
      disclosure: resolution.entry.disclosure,
      cloudbrokerSelectionCount: resolution.entry.cloudbrokerSelectionCount,
      cloudbrokerRedirectCount: resolution.entry.cloudbrokerRedirectCount,
      profile: {
        slug: resolution.entry.profile.slug,
        displayName: resolution.entry.profile.displayName,
      },
    },
  };
}

function parseMetadata(value: string | null): Record<string, unknown> {
  if (!value) {
    return {};
  }

  try {
    const parsed = JSON.parse(value);
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ providerSlug: string }> | { providerSlug: string } },
) {
  try {
    const { providerSlug } = await params;
    const searchParams = request.nextUrl.searchParams;
    const resolution = await resolveProviderReferral(providerSlug, {
      kind: searchParams.get('kind'),
      source: searchParams.get('source') ?? 'site',
      sessionId: searchParams.get('sessionId'),
      metadata: parseMetadata(searchParams.get('metadata')),
    });

    if (!resolution) {
      return NextResponse.json({ error: 'No active referral entries for provider' }, { status: 404 });
    }

    if (searchParams.get('redirect') === '1' && resolution.entry.resolvedUrl) {
      return NextResponse.redirect(resolution.entry.resolvedUrl, { status: 307 });
    }

    return NextResponse.json({ resolution: sanitizeResolution(resolution) });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Referral resolution failed';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ providerSlug: string }> | { providerSlug: string } },
) {
  try {
    const { providerSlug } = await params;
    const body = await request.json();
    const resolution = await resolveProviderReferral(providerSlug, {
      kind: body?.kind,
      source: body?.source ?? 'site',
      sessionId: body?.sessionId,
      metadata: body?.metadata,
    });

    if (!resolution) {
      return NextResponse.json({ error: 'No active referral entries for provider' }, { status: 404 });
    }

    return NextResponse.json({ resolution: sanitizeResolution(resolution) });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Referral resolution failed';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

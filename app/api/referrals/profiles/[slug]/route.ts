import { type NextRequest, NextResponse } from 'next/server';
import { getReferralProfileDirectory, parseLimit } from '@/lib/referrals/service';

export const dynamic = 'force-dynamic';

function sanitizePublicProfileDirectory(directory: Awaited<ReturnType<typeof getReferralProfileDirectory>>) {
  return {
    profile: {
      slug: directory.profile.slug,
      displayName: directory.profile.displayName,
      bio: directory.profile.bio,
      website: directory.profile.website,
      status: directory.profile.status,
      createdAt: directory.profile.createdAt,
    },
    stats: directory.stats,
    entries: directory.entries.map((entry) => ({
      kind: entry.kind,
      title: entry.title,
      destinationUrl: entry.destinationUrl,
      referralCode: entry.referralCode,
      disclosure: entry.disclosure,
      cloudbrokerSelectionCount: entry.cloudbrokerSelectionCount,
      cloudbrokerRedirectCount: entry.cloudbrokerRedirectCount,
      createdAt: entry.createdAt,
      provider: entry.provider,
    })),
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> | { slug: string } },
) {
  try {
    const { slug } = await params;
    const limit = parseLimit(request.nextUrl.searchParams.get('limit'), 50);
    const directory = await getReferralProfileDirectory(slug, limit);

    if (directory.profile.status !== 'active') {
      return NextResponse.json({ error: 'Profile lookup failed' }, { status: 404 });
    }

    return NextResponse.json(sanitizePublicProfileDirectory(directory));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Profile lookup failed';
    const status = /lookup failed/i.test(message) ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}

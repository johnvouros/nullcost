import { type NextRequest, NextResponse } from 'next/server';
import { listProviderReferralDirectory, parseLimit } from '@/lib/referrals/service';

export const dynamic = 'force-dynamic';

function sanitizePublicProviderDirectory(directory: Awaited<ReturnType<typeof listProviderReferralDirectory>>) {
  return {
    provider: {
      slug: directory.provider.slug,
      name: directory.provider.name,
      category: directory.provider.category,
      subcategory: directory.provider.subcategory,
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
      profile: entry.profile,
    })),
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ providerSlug: string }> | { providerSlug: string } },
) {
  try {
    const { providerSlug } = await params;
    const limit = parseLimit(request.nextUrl.searchParams.get('limit'), 50);
    const directory = await listProviderReferralDirectory(providerSlug, limit);
    return NextResponse.json(sanitizePublicProviderDirectory(directory));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Provider referral lookup failed';
    const status = /lookup failed/i.test(message) ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}

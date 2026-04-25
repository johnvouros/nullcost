import { NextResponse } from 'next/server';
import { recordReferralClick } from '@/lib/referrals/service';

export const dynamic = 'force-dynamic';

function sanitizePublicRedirectEvent(event: NonNullable<Awaited<ReturnType<typeof recordReferralClick>>>) {
  return {
    rotationId: event.rotationId,
    recorded: event.recorded,
    cloudbrokerRedirectCount: event.cloudbrokerRedirectCount,
    cloudbrokerRedirectRecordedAt: event.cloudbrokerRedirectRecordedAt,
  };
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ rotationId: string }> | { rotationId: string } },
) {
  try {
    const { rotationId } = await params;
    const body = await request.json();
    const redirectEvent = await recordReferralClick(rotationId, {
      metadata: body?.metadata,
    });

    if (!redirectEvent) {
      return NextResponse.json({ error: 'Rotation not found' }, { status: 404 });
    }

    return NextResponse.json({ redirectEvent: sanitizePublicRedirectEvent(redirectEvent) });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Referral redirect recording failed';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

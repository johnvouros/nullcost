import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST() {
  return NextResponse.json(
    {
      error:
        'Direct referral entry creation is disabled until profile ownership and moderation are in place. Use the provider submission flow for now.',
    },
    { status: 403 },
  );
}

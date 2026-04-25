import { NextResponse } from 'next/server';
import { chooseBestStartingPlan, getDefaultPlanSelectionIntent, getProviderBySlug, getProviderPlansByProviderId } from '@/lib/providers';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> | { slug: string } },
) {
  const { slug } = await params;
  const provider = await getProviderBySlug(slug);

  if (!provider) {
    return NextResponse.json({ error: 'Provider not found' }, { status: 404 });
  }

  const plans = await getProviderPlansByProviderId(provider.id);
  const bestStartingPlan = chooseBestStartingPlan(plans, getDefaultPlanSelectionIntent(provider));

  return NextResponse.json({ provider, plans, bestStartingPlan: bestStartingPlan ?? null });
}

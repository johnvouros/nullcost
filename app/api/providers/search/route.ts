import { type NextRequest, NextResponse } from 'next/server';
import { getProviderRows, type ProviderSurfaceFilter } from '@/lib/providers';

export const dynamic = 'force-dynamic';

function readSurfaceFilter(searchParams: URLSearchParams): ProviderSurfaceFilter {
  const value = searchParams.get('surface');

  switch (value) {
    case 'mcp':
    case 'api':
    case 'cli':
    case 'open_source':
    case 'program':
      return value;
    default:
      return 'all';
  }
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const q = searchParams.get('q') || searchParams.get('query') || '';
  const category = searchParams.get('category') || undefined;
  const subcategory = searchParams.get('subcategory') || undefined;
  const limit = Number(searchParams.get('limit') || '0') || undefined;
  const surface = readSurfaceFilter(searchParams);
  const providers = await getProviderRows({ query: q, category, subcategory, limit, surface });

  return NextResponse.json({
    providers,
    count: providers.length,
    filters: {
      query: q,
      category: category ?? null,
      subcategory: subcategory ?? null,
      surface,
      limit: limit ?? null,
    },
  });
}

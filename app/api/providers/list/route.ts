import type { NextRequest } from 'next/server';
import { GET as providersGet } from '../route';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  return providersGet(request);
}

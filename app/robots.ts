import type { MetadataRoute } from 'next';
import { absoluteUrl, getSiteUrl } from '@/lib/site';

export default function robots(): MetadataRoute.Robots {
  const host = new URL(getSiteUrl()).host;

  return {
    rules: [
      {
        userAgent: '*',
        allow: [
          '/',
          '/install',
          '/providers/',
          '/profiles/',
          '/sitemap.xml',
          '/llms.txt',
          '/api/providers',
          '/api/providers/list',
          '/api/providers/search',
          '/api/referrals/providers/',
          '/api/referrals/profiles/',
        ],
        disallow: ['/auth', '/account', '/dashboard', '/go/', '/api/'],
      },
    ],
    sitemap: absoluteUrl('/sitemap.xml'),
    host,
  };
}

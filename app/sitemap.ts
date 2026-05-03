import type { MetadataRoute } from 'next';
import { listPublicReferralProfiles } from '@/lib/referrals/service';
import { absoluteUrl } from '@/lib/site';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const profiles = await listPublicReferralProfiles(2000).catch(() => []);

  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: absoluteUrl('/'),
      changeFrequency: 'daily',
      priority: 1,
    },
    {
      url: absoluteUrl('/install'),
      changeFrequency: 'weekly',
      priority: 0.7,
    },
    {
      url: absoluteUrl('/privacy'),
      changeFrequency: 'monthly',
      priority: 0.3,
    },
    {
      url: absoluteUrl('/terms'),
      changeFrequency: 'monthly',
      priority: 0.3,
    },
  ];

  const profileRoutes: MetadataRoute.Sitemap = profiles.map((profile) => ({
    url: absoluteUrl(`/profiles/${profile.slug}`),
    lastModified: profile.updatedAt || profile.createdAt,
    changeFrequency: 'weekly',
    priority: 0.6,
  }));

  return [...staticRoutes, ...profileRoutes];
}

import type { MetadataRoute } from 'next';
import { getProviderRows } from '@/lib/providers';
import { listPublicReferralProfiles } from '@/lib/referrals/service';
import { absoluteUrl } from '@/lib/site';

function pickProviderLastModified(provider: {
  last_verified?: string | null;
  last_program_checked?: string | null;
  last_pricing_checked?: string | null;
}) {
  return provider.last_pricing_checked || provider.last_program_checked || provider.last_verified || undefined;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [providers, profiles] = await Promise.all([
    getProviderRows({ limit: 5000 }),
    listPublicReferralProfiles(2000).catch(() => []),
  ]);

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

  const providerRoutes: MetadataRoute.Sitemap = providers.map((provider) => ({
    url: absoluteUrl(`/providers/${provider.slug}`),
    lastModified: pickProviderLastModified(provider),
    changeFrequency: 'weekly',
    priority: 0.8,
  }));

  const profileRoutes: MetadataRoute.Sitemap = profiles.map((profile) => ({
    url: absoluteUrl(`/profiles/${profile.slug}`),
    lastModified: profile.updatedAt || profile.createdAt,
    changeFrequency: 'weekly',
    priority: 0.6,
  }));

  return [...staticRoutes, ...providerRoutes, ...profileRoutes];
}

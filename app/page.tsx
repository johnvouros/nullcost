import type { Metadata } from 'next';
import Link from 'next/link';
import { ProviderCatalog } from '@/components/provider-catalog';
import { getProviderRows } from '@/lib/providers';
import { SITE_DESCRIPTION, SITE_NAME, SITE_TAGLINE, absoluteUrl } from '@/lib/site';

export const dynamic = 'force-dynamic';
const HOME_PROVIDER_LIMIT = 500;

export const metadata: Metadata = {
  title: 'Provider catalog',
  description: SITE_DESCRIPTION,
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: `${SITE_NAME} provider catalog`,
    description: SITE_DESCRIPTION,
    url: absoluteUrl('/'),
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: `${SITE_NAME} provider catalog`,
    description: SITE_TAGLINE,
  },
};

export default async function HomePage() {
  const providers = await getProviderRows({ limit: HOME_PROVIDER_LIMIT });
  const itemListJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `${SITE_NAME} provider catalog`,
    itemListOrder: 'https://schema.org/ItemListOrderAscending',
    numberOfItems: providers.length,
    itemListElement: providers.slice(0, 12).map((provider, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      url: absoluteUrl(`/providers/${provider.slug}`),
      name: provider.name,
    })),
  };
  const websiteJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE_NAME,
    description: SITE_DESCRIPTION,
    url: absoluteUrl('/'),
  };

  return (
    <div className="cb-page">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify([websiteJsonLd, itemListJsonLd]),
        }}
      />
      <ProviderCatalog providers={providers} />

      <div className="cb-page__support">
        <p>Same free-entry catalog across the website, provider pages, and the Nullcost plugin.</p>
        <Link href="/install">Install plugin</Link>
      </div>
    </div>
  );
}

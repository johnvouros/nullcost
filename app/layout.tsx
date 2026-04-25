import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { IBM_Plex_Mono, Inter } from 'next/font/google';
import { SiteSessionControl } from '@/components/site-session-control';
import { GITHUB_REPOSITORY_URL, SITE_DESCRIPTION, SITE_NAME, SITE_TAGLINE, absoluteUrl, getSiteUrl } from '@/lib/site';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
});

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-mono',
});

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  applicationName: SITE_NAME,
  title: {
    default: SITE_NAME,
    template: `%s · ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  keywords: [
    'developer tools',
    'provider catalog',
    'free tier tools',
    'mcp catalog',
    'auth providers',
    'postgres providers',
    'hosting providers',
    'email api providers',
  ],
  alternates: {
    canonical: '/',
  },
  openGraph: {
    type: 'website',
    url: absoluteUrl('/'),
    siteName: SITE_NAME,
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
  },
  twitter: {
    card: 'summary',
    title: SITE_NAME,
    description: SITE_TAGLINE,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1,
    },
  },
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    shortcut: '/favicon.svg',
    apple: '/apple-touch-icon.png',
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${ibmPlexMono.variable}`}>
        <div className="app-frame" />
        <header className="nc-topbar">
          <Link href="/" className="nc-topbar__brand" aria-label="Nullcost home">
            <span className="nc-topbar__logo" aria-hidden="true" />
            <span>
              <strong>{SITE_NAME}</strong>
              <small>free-tier tool catalog</small>
            </span>
          </Link>
          <nav className="nc-topbar__nav" aria-label="Primary navigation">
            <Link href="/">Catalog</Link>
            <Link href="/install">Install</Link>
            <a href={GITHUB_REPOSITORY_URL} target="_blank" rel="noopener noreferrer">
              GitHub
            </a>
          </nav>
          <SiteSessionControl />
        </header>
        <main className="app-root">{children}</main>
        <footer className="nc-footer">
          <div>
            <strong>{SITE_NAME}</strong>
            <span>Find free-entry developer tools without vendor-tab chaos.</span>
          </div>
          <nav aria-label="Footer navigation">
            <Link href="/install">Install</Link>
            <Link href="/privacy">Privacy</Link>
            <Link href="/terms">Terms</Link>
            <a href={GITHUB_REPOSITORY_URL} target="_blank" rel="noopener noreferrer">
              GitHub
            </a>
          </nav>
        </footer>
      </body>
    </html>
  );
}

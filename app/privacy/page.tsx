import type { Metadata } from 'next';
import { GITHUB_REPOSITORY_URL, SITE_NAME, absoluteUrl } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Privacy',
  description: `Privacy policy for ${SITE_NAME}.`,
  alternates: {
    canonical: '/privacy',
  },
  openGraph: {
    title: `${SITE_NAME} privacy policy`,
    description: `Privacy policy for ${SITE_NAME}.`,
    url: absoluteUrl('/privacy'),
    type: 'article',
  },
};

export default function PrivacyPage() {
  return (
    <article className="nc-legal">
      <p className="nc-legal__kicker">Legal</p>
      <h1>Privacy Policy</h1>
      <p className="nc-legal__lede">
        Nullcost is a small catalog site and plugin for finding developer tools with free tiers and free trials. This
        page explains the practical version of what we collect and why.
      </p>

      <section>
        <h2>What We Collect</h2>
        <ul>
          <li>Account details you provide when signing in, such as email and display name.</li>
          <li>Referral profile details you submit, such as profile name, website, referral codes, and destination URLs.</li>
          <li>Basic usage records for referral routing, such as which Nullcost route was selected or clicked.</li>
          <li>Standard hosting logs from services that run the site, such as request time, path, browser, and IP metadata.</li>
        </ul>
      </section>

      <section>
        <h2>What We Do Not Want</h2>
        <p>
          Do not submit passwords, secret API keys, private tokens, or confidential business data into public profile or
          referral fields.
        </p>
      </section>

      <section>
        <h2>How We Use Data</h2>
        <ul>
          <li>To show the public catalog and provider pages.</li>
          <li>To moderate referral submissions and profile claims.</li>
          <li>To route users to official provider pages or approved community referral links.</li>
          <li>To detect abuse, debug errors, and keep the service working.</li>
        </ul>
      </section>

      <section>
        <h2>Public Content</h2>
        <p>
          Public referral profiles and approved referral entries may be visible to anyone. Only submit information you
          are comfortable making public.
        </p>
      </section>

      <section>
        <h2>Third Parties</h2>
        <p>
          Nullcost uses third-party infrastructure such as hosting, database, auth, and email providers. When you click
          an external provider link, you leave Nullcost and the destination site controls its own privacy practices.
        </p>
      </section>

      <section>
        <h2>Open Source</h2>
        <p>
          The public code is available on{' '}
          <a href={GITHUB_REPOSITORY_URL} target="_blank" rel="noopener noreferrer">
            GitHub
          </a>
          . The hosted database, production credentials, referral routing data, and user data are not part of the
          open-source release.
        </p>
      </section>

      <section>
        <h2>Contact</h2>
        <p>For now, use the GitHub repository to open privacy or security-related issues that do not contain secrets.</p>
      </section>
    </article>
  );
}

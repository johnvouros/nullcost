import type { Metadata } from 'next';
import { GITHUB_REPOSITORY_URL, SITE_NAME, absoluteUrl } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Terms',
  description: `Terms of use for ${SITE_NAME}.`,
  alternates: {
    canonical: '/terms',
  },
  openGraph: {
    title: `${SITE_NAME} terms of use`,
    description: `Terms of use for ${SITE_NAME}.`,
    url: absoluteUrl('/terms'),
    type: 'article',
  },
};

export default function TermsPage() {
  return (
    <article className="nc-legal">
      <p className="nc-legal__kicker">Legal</p>
      <h1>Terms of Use</h1>
      <p className="nc-legal__lede">
        Nullcost helps builders discover developer tools with free tiers and trials. Use it as a shortcut for
        shortlisting, not as a replacement for checking official provider terms before you spend money or ship.
      </p>

      <section>
        <h2>Catalog Accuracy</h2>
        <p>
          Provider plans, free tiers, trials, and pricing can change. Nullcost stores catalog signals in a database and
          may be incomplete or stale. Always verify important details on the official provider site.
        </p>
      </section>

      <section>
        <h2>Referral Links</h2>
        <ul>
          <li>Approved referral links may be shown or rotated on provider pages.</li>
          <li>Commercial links must not change catalog ranking or provider fit recommendations.</li>
          <li>We may reject, edit, pause, or remove referral submissions that look unsafe, misleading, spammy, or stale.</li>
        </ul>
      </section>

      <section>
        <h2>User Submissions</h2>
        <p>
          If you submit profile details, referral codes, links, or provider information, you are responsible for having
          the right to submit it and for keeping it accurate.
        </p>
      </section>

      <section>
        <h2>No Warranty</h2>
        <p>
          Nullcost is provided as-is. We do not guarantee uninterrupted access, perfect recommendations, provider
          availability, or that a free tier will remain free.
        </p>
      </section>

      <section>
        <h2>Open Source License</h2>
        <p>
          The repository code is licensed under Apache-2.0. See the{' '}
          <a href={GITHUB_REPOSITORY_URL} target="_blank" rel="noopener noreferrer">
            GitHub repository
          </a>{' '}
          for source, license, and contribution context. Hosted data and production systems are separate from the
          open-source grant.
        </p>
      </section>

      <section>
        <h2>Abuse</h2>
        <p>
          Do not use Nullcost to submit malicious URLs, impersonate other profiles, spam referral links, scrape private
          data, or interfere with the service.
        </p>
      </section>
    </article>
  );
}

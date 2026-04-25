import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="page-stack">
      <section className="panel panel--center">
        <p className="eyebrow">404</p>
        <h2>That provider row does not exist.</h2>
        <p className="panel__text">Use the catalog to find a valid provider slug or return to the install guide.</p>
        <div className="button-row">
          <Link href="/" className="button">
            Back to catalog
          </Link>
          <Link href="/install" className="button button--ghost">
            Install guide
          </Link>
        </div>
      </section>
    </div>
  );
}

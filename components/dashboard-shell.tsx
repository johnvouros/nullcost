import Link from 'next/link';
import type { ReactNode } from 'react';
import styles from './dashboard-shell.module.css';

interface DashboardShellProps {
  accountName: string;
  title: string;
  subtitle: string;
  section: 'overview' | 'claim' | 'profile' | 'review' | 'router';
  children: ReactNode;
  backHref?: string;
  backLabel?: string;
  kicker?: string;
  metaLabel?: string;
  metaValue?: string;
  claimHref?: string;
  profileHref?: string;
}

export function DashboardShell({
  accountName,
  title,
  subtitle,
  section,
  children,
  backHref = '/',
  backLabel = 'Back to catalog',
  kicker = 'Nullcost account view',
  metaLabel = 'Session',
  metaValue,
  profileHref = '/dashboard',
}: DashboardShellProps) {
  const navItems = [
    { key: 'overview', href: '/dashboard', label: 'ME', title: 'My account' },
    { key: 'profile', href: profileHref, label: 'CD', title: 'My codes' },
    { key: 'site', href: '/', label: 'NC', title: 'Catalog' },
  ] as const;

  return (
    <div className={styles.shell}>
      <aside className={styles.rail}>
        <Link href="/" className={styles.brand} title="Catalog">
          NC
        </Link>

        <nav className={styles.nav} aria-label="Dashboard navigation">
          {navItems.map((item) => {
            const isActive =
              (item.key === 'overview' && section === 'overview') ||
              (item.key === 'profile' && section === 'profile');

            return (
              <Link
                key={`${item.key}-${item.href}`}
                href={item.href}
                className={`${styles.navLink} ${isActive ? styles.navLinkActive : ''}`}
                title={item.title}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className={styles.railFooter}>
          <div className={styles.footerButton}>{accountName.slice(0, 2).toUpperCase()}</div>
          <Link href="/" className={styles.footerButton}>
            Site
          </Link>
        </div>
      </aside>

      <div className={styles.main}>
        <header className={styles.topbar}>
          <div className={styles.titleStack}>
            <Link href={backHref} className={styles.backLink}>
              ← {backLabel}
            </Link>
            <p className={styles.kicker}>{kicker}</p>
            <h1 className={styles.title}>{title}</h1>
            <p className={styles.subtitle}>{subtitle}</p>
          </div>

          <div className={styles.topbarMeta}>
            <span className={styles.metaLabel}>{metaLabel}</span>
            <span className={styles.metaValue}>{metaValue || accountName}</span>
          </div>
        </header>

        {children}
      </div>
    </div>
  );
}

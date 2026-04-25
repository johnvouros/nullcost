import Link from 'next/link';
import { getCurrentAccount } from '@/lib/auth/account';
import { AuthSignOutButton } from '@/components/auth-sign-out-button';

export async function SiteSessionControl() {
  const account = await getCurrentAccount();

  return (
    <div className="session-dock">
      {account ? (
        <div className="session-dock__group">
          <div className="session-chip session-chip--status">
            <span className="session-chip__label">Signed in</span>
            <strong>{account.profile.displayName}</strong>
          </div>
          <Link href="/dashboard" className="session-chip">
            Dashboard
          </Link>
          <AuthSignOutButton />
        </div>
      ) : (
        <div className="session-dock__group">
          <Link href="/auth?mode=sign-up" className="session-chip session-chip--accent">
            Register
          </Link>
          <Link href="/auth" className="session-chip">
            Sign in
          </Link>
        </div>
      )}
    </div>
  );
}

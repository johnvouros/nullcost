'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from './auth-panel.module.css';

interface AuthPanelProps {
  defaultMode?: 'sign-in' | 'sign-up';
  nextPath?: string;
}

export function AuthPanel({ defaultMode = 'sign-in', nextPath = '/dashboard' }: AuthPanelProps) {
  const router = useRouter();
  const [mode, setMode] = useState<'sign-in' | 'sign-up'>(defaultMode);
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage('');
    setError('');

    try {
      if (mode === 'sign-up') {
        const response = await fetch('/api/auth/sign-up', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            displayName,
            email,
            password,
            nextPath,
            emailRedirectTo: typeof window !== 'undefined' ? `${window.location.origin}/auth` : undefined,
          }),
        });
        const payload = await response.json();

        if (!response.ok) {
          throw new Error(
            payload?.code === 'rate_limited' && payload?.retryAfterSeconds
              ? `Too many attempts. Try again in about ${payload.retryAfterSeconds} seconds.`
              : payload?.error || 'Registration failed',
          );
        }

        if (payload?.sessionCreated) {
          router.push(nextPath);
          router.refresh();
          return;
        }

        setMessage(payload?.message || 'Account created. If email confirmation is enabled locally, use Mailpit before signing in.');
        setMode('sign-in');
      } else {
        const response = await fetch('/api/auth/sign-in', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            email,
            password,
            nextPath,
          }),
        });
        const payload = await response.json();

        if (!response.ok) {
          throw new Error(
            payload?.code === 'rate_limited' && payload?.retryAfterSeconds
              ? `Too many attempts. Try again in about ${payload.retryAfterSeconds} seconds.`
              : payload?.error || 'Authentication failed',
          );
        }

        router.push(nextPath);
        router.refresh();
      }
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : 'Authentication failed');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className={styles.shell}>
      <section className={styles.panel}>
        <p className={styles.kicker}>Auth gateway</p>
        <h1>Register a real account.</h1>
        <p className={styles.summary}>
          This is the first step toward claiming referral profiles, editing inventory, and managing routing as an
          authenticated operator.
        </p>

        <ul className={styles.featureList}>
          <li>
            <strong>Real Supabase session</strong>
            <span>Cookie-backed auth with protected dashboard routes.</span>
          </li>
          <li>
            <strong>Account record</strong>
            <span>Registration creates a durable app-side account profile for later ownership flows.</span>
          </li>
          <li>
            <strong>Owner tooling next</strong>
            <span>Profile claim, edit rights, and moderation can now sit on top of a real identity layer.</span>
          </li>
        </ul>

        <p className={styles.meta}>Local auth uses your Supabase stack on 127.0.0.1.</p>
      </section>

      <section className={styles.formCard}>
        <div>
          <p className={styles.kicker}>Access</p>
          <h2>{mode === 'sign-up' ? 'Create account' : 'Sign in'}</h2>
        </div>

        <div className={styles.toggleRow}>
          <button
            type="button"
            className={`${styles.toggle} ${mode === 'sign-in' ? styles.toggleActive : ''}`}
            onClick={() => setMode('sign-in')}
          >
            Sign in
          </button>
          <button
            type="button"
            className={`${styles.toggle} ${mode === 'sign-up' ? styles.toggleActive : ''}`}
            onClick={() => setMode('sign-up')}
          >
            Register
          </button>
        </div>

        <form className={styles.form} onSubmit={handleSubmit}>
          {mode === 'sign-up' ? (
            <label className={styles.field}>
              <span className={styles.fieldLabel}>Display name</span>
              <input
                className={styles.input}
                type="text"
                name="displayName"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                placeholder="Sample Operator"
                autoComplete="name"
              />
            </label>
          ) : null}

          <label className={styles.field}>
            <span className={styles.fieldLabel}>Email</span>
            <input
              className={styles.input}
              type="email"
              name="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="operator@example.com"
              autoComplete="email"
              required
            />
          </label>

          <label className={styles.field}>
            <span className={styles.fieldLabel}>Password</span>
            <input
              className={styles.input}
              type="password"
              name="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="At least 6 characters"
              autoComplete={mode === 'sign-up' ? 'new-password' : 'current-password'}
              minLength={6}
              required
            />
          </label>

          <div className={styles.actions}>
            <button className={styles.submit} type="submit" disabled={pending}>
              {pending ? 'Working…' : mode === 'sign-up' ? 'Create account' : 'Sign in'}
            </button>
            <span className={styles.hint}>Next stop: {nextPath}</span>
          </div>

          {message ? <p className={styles.message}>{message}</p> : null}
          {error ? <p className={styles.error}>{error}</p> : null}
        </form>
      </section>
    </div>
  );
}

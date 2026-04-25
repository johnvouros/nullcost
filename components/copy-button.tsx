'use client';

import { useEffect, useState } from 'react';

type CopyButtonProps = {
  value: string;
  className?: string;
  iconOnly?: boolean;
  idleLabel?: string;
  copiedLabel?: string;
  failedLabel?: string;
};

export function CopyButton({
  value,
  className,
  iconOnly = false,
  idleLabel = 'Copy',
  copiedLabel = 'Copied',
  failedLabel = 'Failed',
}: CopyButtonProps) {
  const [label, setLabel] = useState(idleLabel);

  useEffect(() => {
    if (label === idleLabel) {
      return undefined;
    }

    const timer = window.setTimeout(() => setLabel(idleLabel), 1800);
    return () => window.clearTimeout(timer);
  }, [idleLabel, label]);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setLabel(copiedLabel);
    } catch {
      setLabel(failedLabel);
    }
  }

  const icon = label === copiedLabel ? '✓' : label === failedLabel ? '!' : '⧉';

  return (
    <button type="button" className={className} onClick={handleCopy} aria-label={iconOnly ? label : 'Copy text'}>
      {iconOnly ? <span aria-hidden="true">{icon}</span> : label}
    </button>
  );
}

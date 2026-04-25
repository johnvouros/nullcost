const DEFAULT_AUTH_REDIRECT = '/dashboard';

function compact(value: unknown) {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function sanitizeInternalPath(value: unknown, fallback = DEFAULT_AUTH_REDIRECT) {
  const path = compact(value);

  if (
    !path.startsWith('/') ||
    path.startsWith('//') ||
    path.includes('\\') ||
    /[\u0000-\u001f\u007f]/.test(path)
  ) {
    return fallback;
  }

  return path;
}

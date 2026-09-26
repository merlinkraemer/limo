import { randomUUID } from 'node:crypto';
import { cookies } from 'next/headers';

/**
 * Anonymous browser identity used to make ratings/votes unique per browser.
 *
 * The cookie stores an opaque random UUID; the database only ever stores this
 * same opaque id (no other browser's ids are exposed, and read models never
 * return them). Clearing cookies resets the identity - a documented dedup
 * limitation, not an authentication mechanism.
 */
export const BROWSER_ID_COOKIE = 'limo_browser_id';
export const BROWSER_ID_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidBrowserId(value: string | null | undefined): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value);
}

export function createBrowserId(): string {
  return randomUUID();
}

/** Read the current browser id without creating one (safe in server components). */
export async function getBrowserId(): Promise<string | null> {
  const store = await cookies();
  const value = store.get(BROWSER_ID_COOKIE)?.value;
  return isValidBrowserId(value) ? value : null;
}

/**
 * Read the browser id or issue a new HttpOnly cookie. Only callable from a
 * Server Action or Route Handler (Next.js restriction on setting cookies).
 */
export async function getOrCreateBrowserId(): Promise<string> {
  const store = await cookies();
  const existing = store.get(BROWSER_ID_COOKIE)?.value;
  if (isValidBrowserId(existing)) {
    return existing;
  }

  const id = createBrowserId();
  store.set(BROWSER_ID_COOKIE, id, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: BROWSER_ID_MAX_AGE_SECONDS,
  });
  return id;
}

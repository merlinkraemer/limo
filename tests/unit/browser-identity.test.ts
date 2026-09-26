import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('next/headers', () => ({
  cookies: vi.fn(),
}));

import { cookies } from 'next/headers';
import {
  BROWSER_ID_COOKIE,
  createBrowserId,
  getBrowserId,
  getOrCreateBrowserId,
  isValidBrowserId,
} from '@/lib/browser-identity';

const VALID = '11111111-2222-4333-8444-555555555555';

function cookieStore(initial?: string) {
  const set = vi.fn();
  const get = vi.fn((name: string) =>
    name === BROWSER_ID_COOKIE && initial !== undefined ? { name, value: initial } : undefined
  );
  return { get, set };
}

describe('isValidBrowserId', () => {
  it('accepts opaque UUIDs and rejects anything else', () => {
    expect(isValidBrowserId(VALID)).toBe(true);
    expect(isValidBrowserId(VALID.toUpperCase())).toBe(true);
    expect(isValidBrowserId('not-a-uuid')).toBe(false);
    expect(isValidBrowserId('')).toBe(false);
    expect(isValidBrowserId(undefined)).toBe(false);
    expect(isValidBrowserId(null)).toBe(false);
  });
});

describe('createBrowserId', () => {
  it('generates a fresh valid identity each time', () => {
    const first = createBrowserId();
    const second = createBrowserId();
    expect(isValidBrowserId(first)).toBe(true);
    expect(first).not.toBe(second);
  });
});

describe('getBrowserId', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns the cookie value when valid', async () => {
    vi.mocked(cookies).mockResolvedValue(cookieStore(VALID) as never);
    await expect(getBrowserId()).resolves.toBe(VALID);
  });

  it('returns null for a missing or invalid cookie', async () => {
    vi.mocked(cookies).mockResolvedValue(cookieStore(undefined) as never);
    await expect(getBrowserId()).resolves.toBeNull();

    vi.mocked(cookies).mockResolvedValue(cookieStore('tampered') as never);
    await expect(getBrowserId()).resolves.toBeNull();
  });
});

describe('getOrCreateBrowserId', () => {
  beforeEach(() => vi.clearAllMocks());

  it('reuses a valid cookie without setting a new one', async () => {
    const store = cookieStore(VALID);
    vi.mocked(cookies).mockResolvedValue(store as never);

    await expect(getOrCreateBrowserId()).resolves.toBe(VALID);
    expect(store.set).not.toHaveBeenCalled();
  });

  it('issues an HttpOnly SameSite=Lax cookie when missing', async () => {
    const store = cookieStore(undefined);
    vi.mocked(cookies).mockResolvedValue(store as never);

    const id = await getOrCreateBrowserId();
    expect(isValidBrowserId(id)).toBe(true);
    expect(store.set).toHaveBeenCalledWith(
      BROWSER_ID_COOKIE,
      id,
      expect.objectContaining({ httpOnly: true, sameSite: 'lax', path: '/' })
    );
  });

  it('replaces an invalid cookie value', async () => {
    const store = cookieStore('tampered');
    vi.mocked(cookies).mockResolvedValue(store as never);

    const id = await getOrCreateBrowserId();
    expect(id).not.toBe('tampered');
    expect(store.set).toHaveBeenCalledTimes(1);
  });
});

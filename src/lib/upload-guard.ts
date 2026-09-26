import { isValidBrowserId, BROWSER_ID_COOKIE } from '@/lib/browser-identity';

/**
 * Server-side anti-abuse helpers for `POST /api/uploads`.
 *
 * 1. A tiny in-memory token bucket, keyed by client IP and (when present) the
 *    anonymous browser-id cookie. This is best-effort: it protects a single
 *    Node process, which is enough to stop casual scripted abuse of the
 *    Cloudinary quota. A multi-instance deployment should move the bucket to a
 *    shared store (see docs/planning/ROADMAP.md, phase 1).
 * 2. Magic-byte sniffing so a spoofed `file.type` cannot smuggle non-image
 *    payloads to Cloudinary.
 */

export type SniffedImageType = 'image/jpeg' | 'image/png' | 'image/webp' | 'image/avif';

export const UPLOAD_RATE_LIMIT = {
  capacity: 5,
  refillIntervalMs: 60_000,
} as const;

const PRUNE_AFTER_MS = 10 * 60 * 1000;
const PRUNE_MIN_ENTRIES = 500;
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

interface TokenBucket {
  tokens: number;
  updatedAt: number;
}

const buckets = new Map<string, TokenBucket>();

export interface RateLimitDecision {
  allowed: boolean;
  retryAfterMs: number;
}

/** Test hook: clear accumulated buckets so cases are independent. */
export function resetUploadRateLimits(): void {
  buckets.clear();
}

function refill(bucket: TokenBucket, now: number): void {
  const intervals = Math.floor((now - bucket.updatedAt) / UPLOAD_RATE_LIMIT.refillIntervalMs);
  if (intervals <= 0) return;
  bucket.tokens = Math.min(UPLOAD_RATE_LIMIT.capacity, bucket.tokens + intervals);
  bucket.updatedAt += intervals * UPLOAD_RATE_LIMIT.refillIntervalMs;
}

function peek(key: string, now: number): TokenBucket {
  let bucket = buckets.get(key);
  if (!bucket) {
    bucket = { tokens: UPLOAD_RATE_LIMIT.capacity, updatedAt: now };
    buckets.set(key, bucket);
    pruneBuckets(now);
  } else {
    refill(bucket, now);
  }
  return bucket;
}

function pruneBuckets(now: number): void {
  if (buckets.size < PRUNE_MIN_ENTRIES) return;
  for (const [key, bucket] of buckets) {
    if (now - bucket.updatedAt > PRUNE_AFTER_MS) buckets.delete(key);
  }
}

/**
 * Consume one token from every key. All keys are checked before any token is
 * spent, so a rejected request never partially consumes a bucket.
 */
export function checkUploadRateLimit(
  keys: string[],
  now: number = Date.now()
): RateLimitDecision {
  let retryAfterMs = 0;
  for (const key of keys) {
    const bucket = peek(key, now);
    if (bucket.tokens <= 0) {
      const sinceRefill = (now - bucket.updatedAt) % UPLOAD_RATE_LIMIT.refillIntervalMs;
      retryAfterMs = Math.max(retryAfterMs, UPLOAD_RATE_LIMIT.refillIntervalMs - sinceRefill);
    }
  }

  if (retryAfterMs > 0) {
    return { allowed: false, retryAfterMs };
  }

  for (const key of keys) {
    buckets.get(key)!.tokens -= 1;
  }

  return { allowed: true, retryAfterMs: 0 };
}

/** Best-effort client IP: first `x-forwarded-for` hop, then `x-real-ip`. */
export function clientIpFromRequest(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const firstHop = forwarded?.split(',')[0]?.trim();
  return firstHop || request.headers.get('x-real-ip')?.trim() || 'unknown';
}

/** Read a valid anonymous browser id from a raw Cookie header. */
export function readBrowserIdCookie(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(';')) {
    const [name, ...rest] = part.trim().split('=');
    if (name !== BROWSER_ID_COOKIE) continue;
    let value = rest.join('=');
    try {
      value = decodeURIComponent(value);
    } catch {
      return null;
    }
    return isValidBrowserId(value) ? value : null;
  }
  return null;
}

/** Rate-limit keys: always the IP, plus the browser id when one is present. */
export function clientRateLimitKeys(request: Request): string[] {
  const keys = [`ip:${clientIpFromRequest(request)}`];
  const browserId = readBrowserIdCookie(request.headers.get('cookie'));
  if (browserId) keys.push(`browser:${browserId}`);
  return keys;
}

/**
 * Detect an allowed image type from the file's leading bytes. Returns null for
 * anything that is not a JPEG, PNG, WebP, or AVIF regardless of the declared
 * MIME type.
 */
export function sniffImageType(input: Buffer | Uint8Array): SniffedImageType | null {
  const bytes = Buffer.isBuffer(input) ? input : Buffer.from(input);

  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg';
  }

  if (bytes.length >= PNG_SIGNATURE.length && bytes.subarray(0, 8).equals(PNG_SIGNATURE)) {
    return 'image/png';
  }

  if (
    bytes.length >= 12 &&
    bytes.toString('latin1', 0, 4) === 'RIFF' &&
    bytes.toString('latin1', 8, 12) === 'WEBP'
  ) {
    return 'image/webp';
  }

  if (isAvif(bytes)) {
    return 'image/avif';
  }

  return null;
}

function isAvif(bytes: Buffer): boolean {
  if (bytes.length < 16 || bytes.toString('latin1', 4, 8) !== 'ftyp') return false;
  const brands = bytes.subarray(8, Math.min(bytes.length, 64)).toString('latin1');
  return brands.includes('avif') || brands.includes('avis');
}

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/headers', () => ({ cookies: vi.fn() }));

import {
  UPLOAD_RATE_LIMIT,
  checkUploadRateLimit,
  clientIpFromRequest,
  clientRateLimitKeys,
  readBrowserIdCookie,
  resetUploadRateLimits,
  sniffImageType,
} from '@/lib/upload-guard';

const BROWSER_ID = '11111111-2222-4333-8444-555555555555';

function jpegBytes(): Buffer {
  return Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
}

function pngBytes(): Buffer {
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    Buffer.alloc(8),
  ]);
}

function webpBytes(): Buffer {
  return Buffer.concat([
    Buffer.from('RIFF', 'latin1'),
    Buffer.from([0x20, 0x00, 0x00, 0x00]),
    Buffer.from('WEBP', 'latin1'),
    Buffer.alloc(8),
  ]);
}

function avifBytes(majorBrand = 'avif'): Buffer {
  return Buffer.concat([
    Buffer.from([0x00, 0x00, 0x00, 0x20]),
    Buffer.from('ftyp', 'latin1'),
    Buffer.from(majorBrand, 'latin1'),
    Buffer.alloc(20),
  ]);
}

describe('sniffImageType', () => {
  it('recognizes the four supported image formats by magic bytes', () => {
    expect(sniffImageType(jpegBytes())).toBe('image/jpeg');
    expect(sniffImageType(pngBytes())).toBe('image/png');
    expect(sniffImageType(webpBytes())).toBe('image/webp');
    expect(sniffImageType(avifBytes())).toBe('image/avif');
    expect(sniffImageType(avifBytes('avis'))).toBe('image/avif');
  });

  it('rejects non-image payloads and truncated signatures', () => {
    expect(sniffImageType(Buffer.from('just some text pretending to be a png'))).toBeNull();
    expect(sniffImageType(Buffer.from('%PDF-1.7'))).toBeNull();
    expect(sniffImageType(Buffer.from([0xff, 0xd8]))).toBeNull();
    expect(sniffImageType(Buffer.alloc(0))).toBeNull();
  });

  it('rejects a payload whose declared type lies about its bytes', () => {
    // A PNG signature is not a JPEG even if the browser says image/jpeg.
    expect(sniffImageType(pngBytes())).not.toBe('image/jpeg');
    expect(sniffImageType(Buffer.from('<html></html>'))).toBeNull();
  });
});

describe('checkUploadRateLimit', () => {
  beforeEach(() => resetUploadRateLimits());

  it('allows a burst up to capacity, then rejects with a retry hint', () => {
    const now = 1_000_000;
    for (let i = 0; i < UPLOAD_RATE_LIMIT.capacity; i += 1) {
      expect(checkUploadRateLimit(['ip:203.0.113.9'], now).allowed).toBe(true);
    }

    const denied = checkUploadRateLimit(['ip:203.0.113.9'], now);
    expect(denied.allowed).toBe(false);
    expect(denied.retryAfterMs).toBe(UPLOAD_RATE_LIMIT.refillIntervalMs);

    const refilled = checkUploadRateLimit(
      ['ip:203.0.113.9'],
      now + UPLOAD_RATE_LIMIT.refillIntervalMs
    );
    expect(refilled.allowed).toBe(true);
  });

  it('keys buckets independently', () => {
    const now = 1_000_000;
    for (let i = 0; i < UPLOAD_RATE_LIMIT.capacity; i += 1) {
      checkUploadRateLimit(['ip:a'], now);
    }
    expect(checkUploadRateLimit(['ip:a'], now).allowed).toBe(false);
    expect(checkUploadRateLimit(['ip:b'], now).allowed).toBe(true);
  });

  it('does not spend tokens on other keys when one key is exhausted', () => {
    const now = 1_000_000;
    for (let i = 0; i < UPLOAD_RATE_LIMIT.capacity; i += 1) {
      checkUploadRateLimit(['ip:a'], now);
    }

    // ip:a is exhausted, so the combined check is denied - but browser:b was
    // only observed, not charged, and must still hold its full allowance.
    expect(checkUploadRateLimit(['ip:a', 'browser:b'], now).allowed).toBe(false);
    for (let i = 0; i < UPLOAD_RATE_LIMIT.capacity; i += 1) {
      expect(checkUploadRateLimit(['browser:b'], now).allowed).toBe(true);
    }
    expect(checkUploadRateLimit(['browser:b'], now).allowed).toBe(false);
  });
});

describe('client rate-limit keys', () => {
  it('uses the first forwarded hop and a valid browser cookie', () => {
    const request = new Request('http://localhost/api/uploads', {
      headers: {
        'x-forwarded-for': '203.0.113.9, 10.0.0.1',
        cookie: `other=1; limo_browser_id=${BROWSER_ID}`,
      },
    });

    expect(clientIpFromRequest(request)).toBe('203.0.113.9');
    expect(clientRateLimitKeys(request)).toEqual(['ip:203.0.113.9', `browser:${BROWSER_ID}`]);
  });

  it('falls back to x-real-ip and ignores tampered cookies', () => {
    const request = new Request('http://localhost/api/uploads', {
      headers: {
        'x-real-ip': '198.51.100.7',
        cookie: 'limo_browser_id=tampered',
      },
    });

    expect(clientIpFromRequest(request)).toBe('198.51.100.7');
    expect(clientRateLimitKeys(request)).toEqual(['ip:198.51.100.7']);
    expect(readBrowserIdCookie('limo_browser_id=tampered')).toBeNull();
    expect(readBrowserIdCookie(null)).toBeNull();
  });
});

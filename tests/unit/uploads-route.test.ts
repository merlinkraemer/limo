import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/headers', () => ({ cookies: vi.fn() }));

const cloudinaryState = vi.hoisted(() => ({
  failWith: null as Error | null,
  uploaded: [] as Buffer[],
}));

vi.mock('@/lib/cloudinary', () => ({
  getUploadFolder: () => 'limo/uploads',
  getCloudinary: () => ({
    uploader: {
      upload_stream: (
        _options: unknown,
        callback: (error: Error | null, result?: { secure_url: string }) => void
      ) => ({
        end: (buffer: Buffer) => {
          cloudinaryState.uploaded.push(buffer);
          if (cloudinaryState.failWith) {
            callback(cloudinaryState.failWith);
            return;
          }
          callback(null, {
            secure_url: 'https://res.cloudinary.com/demo/image/upload/v1/limo/photo.jpg',
          });
        },
      }),
    },
  }),
}));

import { POST } from '@/app/api/uploads/route';
import { resetUploadRateLimits, UPLOAD_RATE_LIMIT } from '@/lib/upload-guard';
import {
  MAX_UPLOAD_BYTES,
  UPLOAD_FAILED_MESSAGE,
  UPLOAD_RATE_LIMITED_MESSAGE,
  UPLOAD_TOO_LARGE_MESSAGE,
  UPLOAD_UNSUPPORTED_MESSAGE,
} from '@/lib/upload-limits';

const BROWSER_ID = '11111111-2222-4333-8444-555555555555';
const UPLOAD_URL = 'https://res.cloudinary.com/demo/image/upload/v1/limo/photo.jpg';

function jpegBytes(): Buffer {
  return Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00]);
}

function uploadRequest(
  bytes: Buffer,
  options: { type?: string; headers?: Record<string, string> } = {}
): Request {
  const form = new FormData();
  form.append('file', new File([new Uint8Array(bytes)], 'photo.jpg', { type: options.type ?? 'image/jpeg' }));
  return new Request('http://localhost/api/uploads', {
    method: 'POST',
    body: form,
    headers: options.headers,
  });
}

describe('POST /api/uploads', () => {
  beforeEach(() => {
    resetUploadRateLimits();
    cloudinaryState.failWith = null;
    cloudinaryState.uploaded = [];
  });

  it('accepts a real first-photo upload and returns the Cloudinary URL', async () => {
    const response = await POST(uploadRequest(jpegBytes()));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ publicUrl: UPLOAD_URL });
    expect(cloudinaryState.uploaded).toHaveLength(1);
    expect(cloudinaryState.uploaded[0].subarray(0, 3)).toEqual(Buffer.from([0xff, 0xd8, 0xff]));
  });

  it('rejects non-image bytes even when the declared MIME type is allowed', async () => {
    const response = await POST(
      uploadRequest(Buffer.from('<script>alert(1)</script>'), { type: 'image/png' })
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: UPLOAD_UNSUPPORTED_MESSAGE });
    expect(cloudinaryState.uploaded).toHaveLength(0);
  });

  it('rejects a payload larger than the shared 10MB cap', async () => {
    const response = await POST(uploadRequest(Buffer.alloc(MAX_UPLOAD_BYTES + 1)));

    expect(response.status).toBe(413);
    await expect(response.json()).resolves.toEqual({ error: UPLOAD_TOO_LARGE_MESSAGE });
    expect(cloudinaryState.uploaded).toHaveLength(0);
  });

  it('rate limits repeated uploads from the same IP', async () => {
    const headers = { 'x-forwarded-for': '203.0.113.9' };

    for (let i = 0; i < UPLOAD_RATE_LIMIT.capacity; i += 1) {
      const response = await POST(uploadRequest(jpegBytes(), { headers }));
      expect(response.status).toBe(200);
    }

    const limited = await POST(uploadRequest(jpegBytes(), { headers }));
    expect(limited.status).toBe(429);
    await expect(limited.json()).resolves.toEqual({ error: UPLOAD_RATE_LIMITED_MESSAGE });
    expect(Number(limited.headers.get('retry-after'))).toBeGreaterThan(0);
    expect(cloudinaryState.uploaded).toHaveLength(UPLOAD_RATE_LIMIT.capacity);
  });

  it('keys the rate limit per browser identity as well as per IP', async () => {
    const browserA = `limo_browser_id=${BROWSER_ID}`;
    const browserB = 'limo_browser_id=22222222-3333-4444-8555-666666666666';
    const ipOne = '203.0.113.9';
    const ipTwo = '198.51.100.7';

    const upload = (ip: string, cookie: string) =>
      POST(uploadRequest(jpegBytes(), { headers: { 'x-forwarded-for': ip, cookie } }));

    for (let i = 0; i < UPLOAD_RATE_LIMIT.capacity; i += 1) {
      expect((await upload(ipOne, browserA)).status).toBe(200);
    }

    expect((await upload(ipOne, browserA)).status).toBe(429);
    // Same browser from a fresh IP is still limited by its browser bucket.
    expect((await upload(ipTwo, browserA)).status).toBe(429);
    // A fresh browser from the exhausted IP is still limited by the IP bucket.
    expect((await upload(ipOne, browserB)).status).toBe(429);
    // A fresh IP + fresh browser is allowed.
    expect((await upload(ipTwo, browserB)).status).toBe(200);
  });

  it('returns a generic 500 without leaking the upstream error', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    cloudinaryState.failWith = new Error('cloudinary secret detail');

    const response = await POST(uploadRequest(jpegBytes()));

    expect(response.status).toBe(500);
    const payload = (await response.json()) as { error: string };
    expect(payload).toEqual({ error: UPLOAD_FAILED_MESSAGE });
    expect(JSON.stringify(payload)).not.toContain('cloudinary secret detail');
    expect(consoleError).toHaveBeenCalledWith('Upload route error:', cloudinaryState.failWith);
  });

  it('rejects an absurdly large Content-Length before reading the body', async () => {
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(0));
        controller.close();
      },
    });
    const request = new Request('http://localhost/api/uploads', {
      method: 'POST',
      body,
      duplex: 'half',
      headers: { 'content-length': String(MAX_UPLOAD_BYTES + 1024 * 1024) },
    } as RequestInit);

    const response = await POST(request);
    expect(response.status).toBe(413);
    await expect(response.json()).resolves.toEqual({ error: UPLOAD_TOO_LARGE_MESSAGE });
    expect(cloudinaryState.uploaded).toHaveLength(0);
  });
});

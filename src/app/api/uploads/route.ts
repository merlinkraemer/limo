import { NextResponse } from 'next/server';
import { getCloudinary, getUploadFolder } from '@/lib/cloudinary';
import {
  clientRateLimitKeys,
  checkUploadRateLimit,
  sniffImageType,
} from '@/lib/upload-guard';
import {
  MAX_UPLOAD_BYTES,
  UPLOAD_FAILED_MESSAGE,
  UPLOAD_RATE_LIMITED_MESSAGE,
  UPLOAD_TOO_LARGE_MESSAGE,
  UPLOAD_UNSUPPORTED_MESSAGE,
} from '@/lib/upload-limits';

export const runtime = 'nodejs';

const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif']);

// Allow a little multipart framing overhead on top of the file cap so a file
// exactly at the limit is not rejected by the cheap header pre-check.
const MAX_REQUEST_BYTES = MAX_UPLOAD_BYTES + 64 * 1024;

export async function POST(request: Request) {
  const rateLimit = checkUploadRateLimit(clientRateLimitKeys(request));
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: UPLOAD_RATE_LIMITED_MESSAGE },
      {
        status: 429,
        headers: { 'Retry-After': String(Math.max(1, Math.ceil(rateLimit.retryAfterMs / 1000))) },
      }
    );
  }

  const contentLength = Number(request.headers.get('content-length') ?? 0);
  if (Number.isFinite(contentLength) && contentLength > MAX_REQUEST_BYTES) {
    return NextResponse.json({ error: UPLOAD_TOO_LARGE_MESSAGE }, { status: 413 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file');

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Missing upload file.' }, { status: 400 });
    }

    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json({ error: UPLOAD_UNSUPPORTED_MESSAGE }, { status: 400 });
    }

    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json({ error: UPLOAD_TOO_LARGE_MESSAGE }, { status: 413 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    if (!sniffImageType(buffer)) {
      return NextResponse.json({ error: UPLOAD_UNSUPPORTED_MESSAGE }, { status: 400 });
    }

    const cloudinary = getCloudinary();
    const folder = getUploadFolder();

    const result = await new Promise<{ secure_url: string }>((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder, resource_type: 'image' },
        (error, uploaded) => {
          if (error || !uploaded) {
            reject(error ?? new Error('Cloudinary upload returned no result.'));
            return;
          }
          resolve(uploaded as { secure_url: string });
        }
      );
      stream.end(buffer);
    });

    return NextResponse.json({ publicUrl: result.secure_url });
  } catch (error) {
    console.error('Upload route error:', error);

    return NextResponse.json({ error: UPLOAD_FAILED_MESSAGE }, { status: 500 });
  }
}

/**
 * Single source of truth for photo upload limits and user-facing upload errors.
 *
 * Shared by the server route (`src/app/api/uploads/route.ts`), the client
 * upload helper (`src/lib/supabase/storage.ts`), and tests, so the UI and the
 * server enforce exactly the same cap. Keep this module free of Node-only
 * imports: it is bundled into the browser.
 */

export const MAX_UPLOAD_MB = 10;
export const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024;

export const UPLOAD_TOO_LARGE_MESSAGE = `image is too large - max ${MAX_UPLOAD_MB}MB`;
export const UPLOAD_UNSUPPORTED_MESSAGE =
  'Unsupported image. Use a JPEG, PNG, WebP, or AVIF file.';
export const UPLOAD_RATE_LIMITED_MESSAGE = 'Too many uploads. Please try again later.';
export const UPLOAD_FAILED_MESSAGE = 'Upload failed. Please try again.';

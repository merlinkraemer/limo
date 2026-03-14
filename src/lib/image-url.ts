const STORAGE_PUBLIC_PREFIX = '/storage/v1/object/public/';

/**
 * Checks if an image URL is from the allowed Supabase storage bucket.
 * Prevents arbitrary URL injection when users submit image URLs.
 */
export function isAllowedImageUrl(url: string): boolean {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (!base) return false;
  const allowedPrefix = `${base.replace(/\/$/, '')}${STORAGE_PUBLIC_PREFIX}`;
  return url.startsWith(allowedPrefix);
}

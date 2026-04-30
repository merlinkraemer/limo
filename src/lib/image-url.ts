const STORAGE_PUBLIC_PREFIX = '/storage/v1/object/public/';

function isAllowedSupabaseUrl(url: string): boolean {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (!base) return false;
  const allowedPrefix = `${base.replace(/\/$/, '')}${STORAGE_PUBLIC_PREFIX}`;
  return url.startsWith(allowedPrefix);
}

function isAllowedCloudinaryUrl(url: string): boolean {
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME?.trim();
  if (!cloudName) return false;
  return url.startsWith(`https://res.cloudinary.com/${cloudName}/`);
}

/**
 * Checks if an image URL is from an allowed host (Supabase storage or Cloudinary).
 * Prevents arbitrary URL injection when users submit image URLs.
 */
export function isAllowedImageUrl(url: string): boolean {
  return isAllowedCloudinaryUrl(url) || isAllowedSupabaseUrl(url);
}

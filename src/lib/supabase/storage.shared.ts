export const DEFAULT_STORAGE_BUCKET = 'limo-images';
export const LEGACY_STORAGE_BUCKET = 'lemonade-images';

export function getFileExtension(file: File) {
  const extensionByType: Record<string, string> = {
    'image/avif': 'avif',
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
  };

  const typeExtension = extensionByType[file.type];
  if (typeExtension) {
    return typeExtension;
  }

  return file.name.split('.').pop() || 'jpg';
}

export function isBucketNotFoundError(error: { message?: string } | null) {
  return error?.message?.toLowerCase().includes('bucket not found') ?? false;
}

export function getStorageBucketCandidates(configuredBucket?: string) {
  return [
    ...new Set(
      [configuredBucket, DEFAULT_STORAGE_BUCKET, LEGACY_STORAGE_BUCKET].filter(
        (bucket): bucket is string => Boolean(bucket)
      )
    ),
  ];
}

const PUBLIC_PREFIX = '/storage/v1/object/public/';

/**
 * Parse bucket id and object path from a Supabase storage public URL.
 * Returns null if the URL is not a valid storage public URL.
 */
export function parseStoragePublicUrl(
  url: string,
  baseUrl?: string
): { bucket: string; path: string } | null {
  const base = (baseUrl ?? process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? '').replace(/\/$/, '');
  const prefix = `${base}${PUBLIC_PREFIX}`;
  if (!url.startsWith(prefix)) return null;
  const after = url.slice(prefix.length);
  const firstSlash = after.indexOf('/');
  if (firstSlash === -1) return null;
  return { bucket: after.slice(0, firstSlash), path: after.slice(firstSlash + 1) };
}

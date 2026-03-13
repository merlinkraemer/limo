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

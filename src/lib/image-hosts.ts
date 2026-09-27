/**
 * Host allow-list for the Next.js image optimizer and the `<Image>` component.
 *
 * Every stored `image_url` is validated at write time by `isAllowedImageUrl`
 * (Supabase Storage public objects or the configured Cloudinary cloud), so the
 * optimizer must accept exactly those hosts and nothing else:
 * - production + staging Supabase projects (known deployment hosts),
 * - the Supabase URL configured for the current build (local dev included),
 * - the Cloudinary cloud configured for the current build.
 */

export const STORAGE_PUBLIC_PATH = '/storage/v1/object/public/**';

/** Deployed Supabase projects; URLs already in the database must keep working. */
export const TRUSTED_SUPABASE_HOSTS = [
  'mpbpzxkttsqmsaazxbkk.supabase.co', // production
  'xduxzpriixkxrygulgon.supabase.co', // staging
] as const;

export const DEFAULT_CLOUDINARY_CLOUD = 'ds4faksds';

export interface ImageHostEnv {
  NEXT_PUBLIC_SUPABASE_URL?: string;
  NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME?: string;
}

export interface RemotePattern {
  protocol: 'http' | 'https';
  hostname: string;
  port?: string;
  pathname: string;
}

function patternKey(pattern: RemotePattern): string {
  return `${pattern.protocol}://${pattern.hostname}:${pattern.port ?? ''}${pattern.pathname}`;
}

export function buildRemotePatterns(env: ImageHostEnv): RemotePattern[] {
  const patterns: RemotePattern[] = [];

  for (const hostname of TRUSTED_SUPABASE_HOSTS) {
    patterns.push({ protocol: 'https', hostname, pathname: STORAGE_PUBLIC_PATH });
  }

  const configured = env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (configured) {
    try {
      const url = new URL(configured);
      if (url.protocol === 'http:' || url.protocol === 'https:') {
        patterns.push({
          protocol: url.protocol === 'http:' ? 'http' : 'https',
          hostname: url.hostname,
          port: url.port || undefined,
          pathname: STORAGE_PUBLIC_PATH,
        });
      }
    } catch {
      // A malformed env URL must not break the build; the deployed hosts above remain.
    }
  }

  // `supabase start` serves Storage from 127.0.0.1:54321 in local dev.
  patterns.push(
    { protocol: 'http', hostname: '127.0.0.1', port: '54321', pathname: STORAGE_PUBLIC_PATH },
    { protocol: 'http', hostname: 'localhost', port: '54321', pathname: STORAGE_PUBLIC_PATH }
  );

  const cloudName = env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME?.trim() || DEFAULT_CLOUDINARY_CLOUD;
  patterns.push({ protocol: 'https', hostname: 'res.cloudinary.com', pathname: `/${cloudName}/**` });

  const seen = new Set<string>();
  return patterns.filter(pattern => {
    const key = patternKey(pattern);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

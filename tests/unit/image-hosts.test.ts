import { describe, expect, it } from 'vitest';
import {
  DEFAULT_CLOUDINARY_CLOUD,
  STORAGE_PUBLIC_PATH,
  buildRemotePatterns,
} from '@/lib/image-hosts';

describe('buildRemotePatterns', () => {
  it('allows both deployed Supabase projects and the configured Cloudinary cloud', () => {
    const patterns = buildRemotePatterns({
      NEXT_PUBLIC_SUPABASE_URL: 'https://mpbpzxkttsqmsaazxbkk.supabase.co',
      NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME: 'limo-test-cloud',
    });

    expect(patterns).toContainEqual({
      protocol: 'https',
      hostname: 'xduxzpriixkxrygulgon.supabase.co',
      pathname: STORAGE_PUBLIC_PATH,
    });
    expect(patterns).toContainEqual({
      protocol: 'https',
      hostname: 'res.cloudinary.com',
      pathname: '/limo-test-cloud/**',
    });
  });

  it('adds the build-configured Supabase host, including the local dev port', () => {
    const patterns = buildRemotePatterns({
      NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321',
    });

    expect(patterns).toContainEqual({
      protocol: 'http',
      hostname: '127.0.0.1',
      port: '54321',
      pathname: STORAGE_PUBLIC_PATH,
    });
  });

  it('falls back to the production Cloudinary cloud and ignores malformed env URLs', () => {
    const patterns = buildRemotePatterns({ NEXT_PUBLIC_SUPABASE_URL: 'not a url' });

    expect(patterns).toContainEqual({
      protocol: 'https',
      hostname: 'res.cloudinary.com',
      pathname: `/${DEFAULT_CLOUDINARY_CLOUD}/**`,
    });
  });

  it('does not duplicate the configured Supabase host', () => {
    const patterns = buildRemotePatterns({
      NEXT_PUBLIC_SUPABASE_URL: 'https://mpbpzxkttsqmsaazxbkk.supabase.co',
    });

    expect(patterns.filter(pattern => pattern.hostname === 'mpbpzxkttsqmsaazxbkk.supabase.co')).toHaveLength(1);
  });

  it('scopes Cloudinary to the configured cloud name only', () => {
    const patterns = buildRemotePatterns({
      NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME: 'only-this-cloud',
    });
    const cloudinary = patterns.filter(pattern => pattern.hostname === 'res.cloudinary.com');

    expect(cloudinary).toEqual([
      { protocol: 'https', hostname: 'res.cloudinary.com', pathname: '/only-this-cloud/**' },
    ]);
  });
});

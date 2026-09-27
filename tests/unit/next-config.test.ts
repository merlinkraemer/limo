import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * The image allow-list is environment-gated: production may only optimize the
 * deployed Storage/Cloudinary hosts, while local development also accepts the
 * seeded sample photos and loopback Storage.
 */
describe('next.config image hosts', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  async function configFor(nodeEnv: string) {
    vi.stubEnv('NODE_ENV', nodeEnv);
    vi.resetModules();
    const mod = await import('../../next.config');
    return mod.default;
  }

  it('keeps production closed to seed photos and local IPs', async () => {
    const config = await configFor('production');
    const patterns = config.images?.remotePatterns ?? [];

    expect(patterns.some(pattern => pattern.hostname === 'images.pexels.com')).toBe(false);
    expect(config.images?.dangerouslyAllowLocalIP).toBe(false);
    expect(patterns).toContainEqual({
      protocol: 'https',
      hostname: 'mpbpzxkttsqmsaazxbkk.supabase.co',
      pathname: '/storage/v1/object/public/**',
    });
  });

  it('allows seed photos and local Storage optimization outside production', async () => {
    const config = await configFor('development');
    const patterns = config.images?.remotePatterns ?? [];

    expect(patterns).toContainEqual({
      protocol: 'https',
      hostname: 'images.pexels.com',
      pathname: '/photos/**',
    });
    expect(config.images?.dangerouslyAllowLocalIP).toBe(true);
    expect(patterns).toContainEqual({
      protocol: 'http',
      hostname: '127.0.0.1',
      port: '54321',
      pathname: '/storage/v1/object/public/**',
    });
  });
});

import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { isAllowedImageUrl } from '@/lib/image-url';

const SUPABASE_URL = 'https://abc123.supabase.co';
const STORAGE_PREFIX = `${SUPABASE_URL}/storage/v1/object/public/`;
const CLOUDINARY_CLOUD = 'ds4faksds';
const CLOUDINARY_PREFIX = `https://res.cloudinary.com/${CLOUDINARY_CLOUD}/`;

describe('isAllowedImageUrl', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      NEXT_PUBLIC_SUPABASE_URL: SUPABASE_URL,
      NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME: CLOUDINARY_CLOUD,
    };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('returns true for URLs from the configured Supabase storage bucket', () => {
    expect(isAllowedImageUrl(`${STORAGE_PREFIX}bucket/image.png`)).toBe(true);
    expect(isAllowedImageUrl(`${STORAGE_PREFIX}lemonades/abc-123.jpg`)).toBe(true);
  });

  it('returns true for URLs from the configured Cloudinary cloud', () => {
    expect(isAllowedImageUrl(`${CLOUDINARY_PREFIX}image/upload/v123/limo/uploads/abc.jpg`)).toBe(true);
    expect(
      isAllowedImageUrl(`${CLOUDINARY_PREFIX}image/upload/q_auto,f_auto/limo/uploads/abc.png`)
    ).toBe(true);
  });

  it('returns false when neither host is configured', () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
    expect(isAllowedImageUrl(`${STORAGE_PREFIX}image.png`)).toBe(false);
    expect(isAllowedImageUrl(`${CLOUDINARY_PREFIX}image/upload/v1/x.jpg`)).toBe(false);
  });

  it('returns false for URLs from other domains', () => {
    expect(isAllowedImageUrl('https://evil.com/storage/v1/object/public/fake.png')).toBe(false);
    expect(isAllowedImageUrl('https://other-supabase.supabase.co/storage/v1/object/public/image.png')).toBe(false);
    expect(isAllowedImageUrl('https://res.cloudinary.com/other-cloud/image/upload/v1/x.jpg')).toBe(false);
  });

  it('returns false for URLs that do not start with the storage prefix', () => {
    expect(isAllowedImageUrl(`${SUPABASE_URL}/rest/v1/lemonades`)).toBe(false);
    expect(isAllowedImageUrl(`${SUPABASE_URL}/auth/v1/something`)).toBe(false);
  });

  it('handles Supabase base URL with trailing slash', () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = `${SUPABASE_URL}/`;
    expect(isAllowedImageUrl(`${STORAGE_PREFIX}image.png`)).toBe(true);
  });
});

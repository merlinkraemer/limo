import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { addLemonade } from '@/app/actions';

vi.mock('@/services/listing-service', () => ({
  createListingWithFirstRating: vi.fn(),
}));

vi.mock('@/lib/browser-identity', () => ({
  getOrCreateBrowserId: vi.fn(),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

import { createListingWithFirstRating } from '@/services/listing-service';
import { getOrCreateBrowserId } from '@/lib/browser-identity';

const BROWSER_ID = '11111111-2222-4333-8444-555555555555';

const validData = {
  name: 'Classic Limo',
  description: 'Sharp lemon kick with a clean finish.',
  flavorRating: 8,
  sournessRating: 7,
  imageUrl: '',
  locationCity: 'Seattle',
};

const SUPABASE_URL = 'https://abc123.supabase.co';
const ALLOWED_IMAGE_URL = `${SUPABASE_URL}/storage/v1/object/public/lemonades/abc.png`;

describe('addLemonade (legacy bridge)', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.mocked(createListingWithFirstRating).mockResolvedValue({
      listingId: '22222222-2222-4333-8444-555555555555',
      duplicateOf: null,
    });
    vi.mocked(getOrCreateBrowserId).mockResolvedValue(BROWSER_ID);
    process.env = { ...originalEnv, NEXT_PUBLIC_SUPABASE_URL: SUPABASE_URL };
  });

  afterEach(() => {
    vi.clearAllMocks();
    process.env = originalEnv;
  });

  it('maps the legacy two-axis form to a real first visitor rating', async () => {
    const result = await addLemonade(validData);

    expect(result).toEqual({ success: true });
    expect(createListingWithFirstRating).toHaveBeenCalledWith({
      name: validData.name,
      description: validData.description,
      score: 7.65,
      comment: undefined,
      imageUrl: undefined,
      locationCity: validData.locationCity,
      addedBy: undefined,
      browserId: BROWSER_ID,
    });
  });

  it('keeps allowed image URLs', async () => {
    const result = await addLemonade({ ...validData, imageUrl: ALLOWED_IMAGE_URL });
    expect(result).toEqual({ success: true });
    expect(createListingWithFirstRating).toHaveBeenCalledWith(
      expect.objectContaining({ imageUrl: ALLOWED_IMAGE_URL })
    );
  });

  it('rejects invalid schema input', async () => {
    const result = await addLemonade({
      name: 'A',
      description: 'bad',
      flavorRating: 0,
      sournessRating: 11,
      imageUrl: 'not-a-url',
      locationCity: '',
    });
    expect(result).toHaveProperty('error');
    expect(createListingWithFirstRating).not.toHaveBeenCalled();
  });

  it('rejects unsupported image hosts', async () => {
    const result = await addLemonade({
      ...validData,
      imageUrl: 'https://evil.com/malicious.png',
    });
    expect(result).toEqual({
      error: 'Image URL must be from your storage bucket',
    });
    expect(createListingWithFirstRating).not.toHaveBeenCalled();
  });

  it('is actionable when the listing already exists', async () => {
    vi.mocked(createListingWithFirstRating).mockResolvedValue({
      listingId: null,
      duplicateOf: '33333333-2222-4333-8444-555555555555',
    });

    const result = await addLemonade(validData);
    expect(result).toEqual({
      error:
        '"Classic Limo" is already on the list - rate the existing listing instead of adding a duplicate',
    });
  });

  it('surfaces service errors', async () => {
    vi.mocked(createListingWithFirstRating).mockRejectedValue(new Error('Database connection failed'));
    const result = await addLemonade(validData);
    expect(result).toEqual({ error: 'Database connection failed' });
  });
});

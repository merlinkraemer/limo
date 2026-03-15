import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { addLemonade } from '@/app/actions';

vi.mock('@/services/lemonade-service', () => ({
  createLemonade: vi.fn(),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

import { createLemonade } from '@/services/lemonade-service';

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

describe('addLemonade', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.mocked(createLemonade).mockResolvedValue({} as never);
    process.env = { ...originalEnv, NEXT_PUBLIC_SUPABASE_URL: SUPABASE_URL };
  });

  afterEach(() => {
    vi.clearAllMocks();
    process.env = originalEnv;
  });

  it('returns success for valid input without image', async () => {
    const result = await addLemonade(validData);
    expect(result).toEqual({ success: true });
    expect(createLemonade).toHaveBeenCalledWith({
      name: validData.name,
      description: validData.description,
      flavorRating: validData.flavorRating,
      sournessRating: validData.sournessRating,
      imageUrl: undefined,
      locationCity: validData.locationCity,
      addedBy: undefined,
    });
  });

  it('returns success for valid input with allowed image URL', async () => {
    const result = await addLemonade({
      ...validData,
      imageUrl: ALLOWED_IMAGE_URL,
    });
    expect(result).toEqual({ success: true });
    expect(createLemonade).toHaveBeenCalledWith(
      expect.objectContaining({ imageUrl: ALLOWED_IMAGE_URL }),
    );
  });

  it('returns error for invalid schema (short name, out-of-range ratings)', async () => {
    const result = await addLemonade({
      name: 'A',
      description: 'bad',
      flavorRating: 0,
      sournessRating: 11,
      imageUrl: 'not-a-url',
      locationCity: '',
    });
    expect(result).toHaveProperty('error');
    expect((result as { error: string }).error).toBeTruthy();
    expect(createLemonade).not.toHaveBeenCalled();
  });

  it('returns error when image URL is not from storage bucket', async () => {
    const result = await addLemonade({
      ...validData,
      imageUrl: 'https://evil.com/malicious.png',
    });
    expect(result).toEqual({
      error: 'Image URL must be from your storage bucket',
    });
    expect(createLemonade).not.toHaveBeenCalled();
  });

  it('returns error when createLemonade throws', async () => {
    vi.mocked(createLemonade).mockRejectedValue(new Error('Database connection failed'));
    const result = await addLemonade(validData);
    expect(result).toHaveProperty('error');
    expect((result as { error: string }).error).toBe('Database connection failed');
  });

  it('returns generic error for non-Error throws', async () => {
    vi.mocked(createLemonade).mockRejectedValue('string error');
    const result = await addLemonade(validData);
    expect(result).toEqual({ error: 'Failed to create entry' });
  });
});

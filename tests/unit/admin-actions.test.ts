import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

const mockGetUser = vi.fn();
const mockSignOut = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() =>
    Promise.resolve({
      auth: {
        getUser: mockGetUser,
        signOut: mockSignOut,
      },
    })
  ),
}));

vi.mock('@/services/lemonade-service', () => ({
  deleteLemonade: vi.fn(),
  updateLemonade: vi.fn(),
  deleteStorageImage: vi.fn(),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

const redirectThrow = new Error('NEXT_REDIRECT');
vi.mock('next/navigation', () => ({
  redirect: vi.fn(() => {
    throw redirectThrow;
  }),
}));

vi.mock('@/lib/image-url', () => ({
  isAllowedImageUrl: vi.fn((url: string) =>
    url.startsWith('https://abc123.supabase.co/storage/')
  ),
}));

import { deleteLemonade, editLemonade, logoutAdmin } from '@/app/actions';
import * as lemonadeService from '@/services/lemonade-service';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

const SUPABASE_URL = 'https://abc123.supabase.co';
const ALLOWED_IMAGE_URL = `${SUPABASE_URL}/storage/v1/object/public/lemonades/abc.png`;

describe('deleteLemonade', () => {
  beforeEach(() => {
    vi.mocked(lemonadeService.deleteLemonade).mockResolvedValue(undefined);
    process.env.NEXT_PUBLIC_SUPABASE_URL = SUPABASE_URL;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns error when not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });

    const result = await deleteLemonade('id-1', null);

    expect(result).toEqual({ error: 'Not authenticated.' });
    expect(lemonadeService.deleteLemonade).not.toHaveBeenCalled();
  });

  it('calls service and returns success when authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null });

    const result = await deleteLemonade('id-1', null);

    expect(lemonadeService.deleteLemonade).toHaveBeenCalledWith('id-1', null);
    expect(revalidatePath).toHaveBeenCalledWith('/');
    expect(result).toEqual({ success: true });
  });

  it('passes imageUrl to service when provided', async () => {
    mockGetUser.mockResolvedValue({ data: { user: {} }, error: null });

    await deleteLemonade('id-2', ALLOWED_IMAGE_URL);

    expect(lemonadeService.deleteLemonade).toHaveBeenCalledWith('id-2', ALLOWED_IMAGE_URL);
  });

  it('returns error when service throws', async () => {
    mockGetUser.mockResolvedValue({ data: { user: {} }, error: null });
    vi.mocked(lemonadeService.deleteLemonade).mockRejectedValue(new Error('DB error'));

    const result = await deleteLemonade('id-1', null);

    expect(result).toEqual({ error: 'DB error' });
  });
});

describe('editLemonade', () => {
  const validEditData = {
    id: 'id-1',
    name: 'Updated Limo',
    description: 'New desc',
    flavorRating: 8,
    sournessRating: 6,
    locationCity: 'Berlin',
    addedBy: 'Tester',
  };

  beforeEach(() => {
    mockGetUser.mockResolvedValue({ data: { user: {} }, error: null });
    vi.mocked(lemonadeService.updateLemonade).mockResolvedValue({} as never);
    vi.mocked(lemonadeService.deleteStorageImage).mockResolvedValue(undefined);
    process.env.NEXT_PUBLIC_SUPABASE_URL = SUPABASE_URL;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns error when not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });

    const result = await editLemonade(validEditData);

    expect(result).toEqual({ error: 'Not authenticated.' });
    expect(lemonadeService.updateLemonade).not.toHaveBeenCalled();
  });

  it('returns validation error for invalid payload', async () => {
    const result = await editLemonade({
      ...validEditData,
      name: 'A',
      flavorRating: 0,
      sournessRating: 11,
    });

    expect(result).toHaveProperty('error');
    expect((result as { error: string }).error).toBeTruthy();
    expect(lemonadeService.updateLemonade).not.toHaveBeenCalled();
  });

  it('calls updateLemonade and returns success for valid data', async () => {
    const result = await editLemonade(validEditData);

    expect(lemonadeService.updateLemonade).toHaveBeenCalledWith('id-1', {
      name: validEditData.name,
      description: validEditData.description,
      flavorRating: validEditData.flavorRating,
      sournessRating: validEditData.sournessRating,
      imageUrl: null,
      locationCity: validEditData.locationCity,
      addedBy: validEditData.addedBy,
    });
    expect(revalidatePath).toHaveBeenCalledWith('/');
    expect(result).toEqual({ success: true });
  });

  it('calls deleteStorageImage when oldImageUrl and imageRemoved', async () => {
    await editLemonade({
      ...validEditData,
      oldImageUrl: ALLOWED_IMAGE_URL,
      imageRemoved: true,
    });

    expect(lemonadeService.deleteStorageImage).toHaveBeenCalledWith(ALLOWED_IMAGE_URL);
    expect(lemonadeService.updateLemonade).toHaveBeenCalledWith(
      'id-1',
      expect.objectContaining({ imageUrl: null })
    );
  });

  it('returns error when updateLemonade throws', async () => {
    vi.mocked(lemonadeService.updateLemonade).mockRejectedValue(new Error('Update failed'));

    const result = await editLemonade(validEditData);

    expect(result).toEqual({ error: 'Update failed' });
  });
});

describe('logoutAdmin', () => {
  beforeEach(() => {
    mockGetUser.mockResolvedValue({ data: { user: {} }, error: null });
    mockSignOut.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('calls signOut and revalidatePath then redirects', async () => {
    await expect(logoutAdmin()).rejects.toThrow('NEXT_REDIRECT');

    expect(mockSignOut).toHaveBeenCalled();
    expect(revalidatePath).toHaveBeenCalledWith('/');
    expect(redirect).toHaveBeenCalledWith('/');
  });
});

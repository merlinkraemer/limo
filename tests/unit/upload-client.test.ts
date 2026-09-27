import { afterEach, describe, expect, it, vi } from 'vitest';
import { uploadImage } from '@/lib/supabase/storage';
import { MAX_UPLOAD_BYTES, UPLOAD_TOO_LARGE_MESSAGE } from '@/lib/upload-limits';

const PUBLIC_URL = 'https://res.cloudinary.com/demo/image/upload/v1/limo/photo.jpg';

afterEach(() => vi.unstubAllGlobals());

describe('uploadImage (client helper)', () => {
  it('rejects oversized files before making a network request', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const tooLarge = { size: MAX_UPLOAD_BYTES + 1, name: 'huge.jpg' } as File;

    await expect(uploadImage(tooLarge)).rejects.toThrow(UPLOAD_TOO_LARGE_MESSAGE);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('uploads a valid file and returns the public URL', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ publicUrl: PUBLIC_URL }),
    });
    vi.stubGlobal('fetch', fetchMock);
    const file = new File([new Uint8Array([0xff, 0xd8, 0xff])], 'photo.jpg', { type: 'image/jpeg' });

    await expect(uploadImage(file)).resolves.toBe(PUBLIC_URL);
    expect(fetchMock).toHaveBeenCalledWith('/api/uploads', {
      method: 'POST',
      body: expect.any(FormData),
    });
  });

  it('surfaces the generic server error message', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: 'Upload failed. Please try again.' }),
    });
    vi.stubGlobal('fetch', fetchMock);
    const file = new File([new Uint8Array([0xff, 0xd8, 0xff])], 'photo.jpg', { type: 'image/jpeg' });

    await expect(uploadImage(file)).rejects.toThrow('Upload failed. Please try again.');
  });
});

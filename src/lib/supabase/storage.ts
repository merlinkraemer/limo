import { MAX_UPLOAD_BYTES, UPLOAD_TOO_LARGE_MESSAGE } from '@/lib/upload-limits';

/**
 * Upload an image to Cloudinary through the app's upload route.
 *
 * Despite the module name (kept for bundler/import stability), this is the
 * client helper for `POST /api/uploads`; Supabase Storage is legacy only.
 * The size cap is shared with the server so the UI and API agree.
 *
 * @param file - The file to upload
 * @returns The public URL of the uploaded image
 */
export async function uploadImage(file: File): Promise<string> {
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error(UPLOAD_TOO_LARGE_MESSAGE);
  }

  const formData = new FormData();
  formData.append('file', file, file.name);

  const response = await fetch('/api/uploads', {
    method: 'POST',
    body: formData,
  });

  const payload = (await response.json()) as { error?: string; publicUrl?: string };

  if (!response.ok || !payload.publicUrl) {
    throw new Error(payload.error || 'Image upload failed.');
  }

  return payload.publicUrl;
}

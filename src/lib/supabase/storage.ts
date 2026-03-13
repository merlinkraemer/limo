/**
 * Upload an image to Supabase storage
 * @param file - The file to upload
 * @returns The public URL of the uploaded image
 */
export async function uploadImage(file: File): Promise<string> {
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

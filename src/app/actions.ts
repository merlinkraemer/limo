'use server';

import { revalidatePath } from 'next/cache';
import { createLemonade } from '@/services/lemonade-service';
import { isAllowedImageUrl } from '@/lib/image-url';
import { lemonadeFormSchema } from '@/types/lemonade';

export async function addLemonade(data: {
  name: string;
  description: string;
  flavorRating: number;
  sournessRating: number;
  imageUrl?: string;
  locationCity?: string;
  addedBy?: string;
}): Promise<{ success: true } | { error: string }> {
  const parsed = lemonadeFormSchema.safeParse(data);
  if (!parsed.success) {
    const errors = parsed.error.flatten().fieldErrors;
    const firstError = Object.values(errors).flat()[0];
    return { error: firstError || 'Invalid input' };
  }

  if (parsed.data.imageUrl && !isAllowedImageUrl(parsed.data.imageUrl)) {
    return { error: 'Image URL must be from your storage bucket' };
  }

  try {
    await createLemonade({
      name: parsed.data.name,
      description: parsed.data.description,
      flavorRating: parsed.data.flavorRating,
      sournessRating: parsed.data.sournessRating,
      imageUrl: parsed.data.imageUrl || undefined,
      locationCity: parsed.data.locationCity || undefined,
      addedBy: parsed.data.addedBy || undefined,
    });
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to create entry' };
  }

  revalidatePath('/');
  return { success: true };
}

/** Stub until admin mode implements real edit. LemonadeFormModal calls this in edit mode. */
export async function editLemonade(_data: {
  id: string;
  name: string;
  description: string;
  flavorRating: number;
  sournessRating: number;
  imageUrl?: string;
  locationCity?: string;
  addedBy?: string;
}): Promise<{ success: true } | { error: string }> {
  return { error: 'Edit is not available yet.' };
}

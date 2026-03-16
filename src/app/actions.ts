'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import {
  createLemonade,
  deleteLemonade as deleteLemonadeService,
  updateLemonade,
  deleteStorageImage,
} from '@/services/lemonade-service';
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

export async function deleteLemonade(
  id: string,
  imageUrl?: string | null
): Promise<{ success: true } | { error: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated.' };

  try {
    await deleteLemonadeService(id, imageUrl ?? null);
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to delete.' };
  }
  revalidatePath('/');
  return { success: true };
}

export async function editLemonade(data: {
  id: string;
  name: string;
  description: string;
  flavorRating: number;
  sournessRating: number;
  imageUrl?: string;
  locationCity?: string;
  addedBy?: string;
  oldImageUrl?: string | null;
  imageRemoved?: boolean;
}): Promise<{ success: true } | { error: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated.' };

  const parsed = lemonadeFormSchema.safeParse({
    ...data,
    imageUrl: data.imageUrl ?? '',
    locationCity: data.locationCity ?? '',
    addedBy: data.addedBy ?? '',
  });
  if (!parsed.success) {
    const firstError = Object.values(parsed.error.flatten().fieldErrors).flat()[0];
    return { error: firstError || 'Invalid input' };
  }

  if (parsed.data.imageUrl && !isAllowedImageUrl(parsed.data.imageUrl)) {
    return { error: 'Image URL must be from your storage bucket' };
  }

  try {
    if (data.oldImageUrl && (data.imageRemoved || data.imageUrl)) {
      await deleteStorageImage(data.oldImageUrl);
    }
    await updateLemonade(data.id, {
      name: data.name,
      description: data.description,
      flavorRating: data.flavorRating,
      sournessRating: data.sournessRating,
      imageUrl: data.imageRemoved ? null : (data.imageUrl ?? data.oldImageUrl ?? null),
      locationCity: data.locationCity || null,
      addedBy: data.addedBy || null,
    });
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to update.' };
  }
  revalidatePath('/');
  return { success: true };
}

export async function logoutAdmin(): Promise<never> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath('/');
  redirect('/');
}

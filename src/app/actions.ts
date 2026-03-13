'use server';

import { revalidatePath } from 'next/cache';
import { createLemonade } from '@/services/lemonade-service';
import { lemonadeFormSchema } from '@/types/lemonade';

export async function addLemonade(data: {
  name: string;
  description: string;
  flavorRating: number;
  sournessRating: number;
  imageUrl?: string;
  locationCity?: string;
}): Promise<{ success: true } | { error: string }> {
  const parsed = lemonadeFormSchema.safeParse(data);
  if (!parsed.success) {
    const errors = parsed.error.flatten().fieldErrors;
    const firstError = Object.values(errors).flat()[0];
    return { error: firstError || 'Invalid input' };
  }

  try {
    await createLemonade({
      name: parsed.data.name,
      description: parsed.data.description,
      flavorRating: parsed.data.flavorRating,
      sournessRating: parsed.data.sournessRating,
      imageUrl: parsed.data.imageUrl || undefined,
      locationCity: parsed.data.locationCity || undefined,
    });
  } catch {
    return { error: 'Failed to create entry' };
  }

  revalidatePath('/');
  return { success: true };
}

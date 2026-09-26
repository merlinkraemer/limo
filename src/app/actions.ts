'use server';

import { revalidatePath } from 'next/cache';
import { getOrCreateBrowserId } from '@/lib/browser-identity';
import { isAllowedImageUrl } from '@/lib/image-url';
import { createListingWithFirstRating } from '@/services/listing-service';
import { firstFieldError, lemonadeFormSchema } from '@/types/lemonade';

/**
 * Transitional compatibility action for the pre-Phase-B add form.
 *
 * The form collects flavor + sourness; new listings no longer store those
 * legacy columns. The two real user inputs are folded into the single overall
 * score with the historical 65/35 weighting and stored as the creator's first
 * visitor rating (flavor/sourness stay NULL on the row).
 *
 * New UI code should call `createListing` from `listing-actions.ts`.
 */
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
    return { error: firstFieldError(parsed.error) || 'Invalid input' };
  }

  if (parsed.data.imageUrl && !isAllowedImageUrl(parsed.data.imageUrl)) {
    return { error: 'Image URL must be from your storage bucket' };
  }

  const score = (parsed.data.flavorRating * 65 + parsed.data.sournessRating * 35) / 100;

  try {
    const browserId = await getOrCreateBrowserId();
    const result = await createListingWithFirstRating({
      name: parsed.data.name,
      description: parsed.data.description,
      score,
      comment: undefined,
      imageUrl: parsed.data.imageUrl || undefined,
      locationCity: parsed.data.locationCity || undefined,
      addedBy: parsed.data.addedBy || undefined,
      browserId,
    });

    if (!result.listingId) {
      return {
        error: `"${parsed.data.name}" is already on the list - rate the existing listing instead of adding a duplicate`,
      };
    }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to create entry' };
  }

  revalidatePath('/');
  return { success: true };
}

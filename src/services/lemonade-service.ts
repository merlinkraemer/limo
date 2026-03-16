import { createClient } from '@/lib/supabase/server';
import { parseStoragePublicUrl } from '@/lib/supabase/storage.shared';
import { CreateLemonadeInput, Lemonade } from '@/types/lemonade';

export interface UpdateLemonadeInput {
  name: string;
  description: string;
  flavorRating: number;
  sournessRating: number;
  imageUrl?: string | null;
  locationCity?: string | null;
  addedBy?: string | null;
}

/**
 * Create a new lemonade entry in the database
 */
export async function createLemonade(data: CreateLemonadeInput): Promise<Lemonade> {
  const supabase = await createClient();

  const dbData = {
    name: data.name,
    description: data.description,
    flavor_rating: data.flavorRating,
    sourness_rating: data.sournessRating,
    image_url: data.imageUrl || null,
    location_city: data.locationCity || null,
    added_by: data.addedBy || null,
  };

  const { data: result, error } = await supabase
    .from('lemonades')
    .insert(dbData)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create limo entry: ${error.message}`);
  }

  return result;
}

/**
 * Get all lemonades ordered by score
 */
export async function getAllLemonades(): Promise<Lemonade[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('lemonades')
    .select('*')
    .order('overall_score', { ascending: false })
    .order('created_at', { ascending: true });

  if (error) {
    throw new Error('Failed to fetch lemonades.');
  }

  return data || [];
}

/**
 * Delete a storage object by its public URL (e.g. when replacing or removing an image)
 */
export async function deleteStorageImage(url: string): Promise<void> {
  const parsed = parseStoragePublicUrl(url);
  if (!parsed) return;
  const supabase = await createClient();
  await supabase.storage.from(parsed.bucket).remove([parsed.path]);
}

/**
 * Delete a lemonade and its storage image if present.
 * Row delete always runs; storage delete is best-effort (e.g. if RLS blocks it, row still deletes).
 */
export async function deleteLemonade(id: string, imageUrl: string | null): Promise<void> {
  const supabase = await createClient();

  const urlToRemove = typeof imageUrl === 'string' && imageUrl.trim() ? imageUrl : null;
  if (urlToRemove) {
    const parsed = parseStoragePublicUrl(urlToRemove);
    if (parsed) {
      try {
        await supabase.storage.from(parsed.bucket).remove([parsed.path]);
      } catch {
        // Best-effort: row delete still runs so the entry is removed from the list
      }
    }
  }

  const { error } = await supabase.from('lemonades').delete().eq('id', id);

  if (error) {
    throw new Error(`Failed to delete lemonade: ${error.message}`);
  }
}

/**
 * Update a lemonade by id
 */
export async function updateLemonade(id: string, data: UpdateLemonadeInput): Promise<Lemonade> {
  const supabase = await createClient();

  const dbData = {
    name: data.name,
    description: data.description,
    flavor_rating: data.flavorRating,
    sourness_rating: data.sournessRating,
    image_url: data.imageUrl ?? null,
    location_city: data.locationCity ?? null,
    added_by: data.addedBy ?? null,
  };

  const { data: result, error } = await supabase
    .from('lemonades')
    .update(dbData)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update lemonade: ${error.message}`);
  }

  return result;
}

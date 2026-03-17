import { createClient } from '@/lib/supabase/server';
import { CreateLemonadeInput, Lemonade } from '@/types/lemonade';

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

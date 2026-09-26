import { createServiceClient } from '@/lib/supabase/service';
import { Lemonade } from '@/types/lemonade';

/**
 * Legacy read model for the pre-Phase-B leaderboard component.
 *
 * New UI code should use `getAllListingSummaries()` / `searchListings()` from
 * `listing-service.ts`, which expose truthful community aggregates. This
 * function only returns canonical listings that still carry the old two-axis
 * metrics, so the legacy component never sees a NULL `overall_score`.
 */
export async function getAllLemonades(): Promise<Lemonade[]> {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from('lemonades')
    .select('*')
    .is('merged_into', null)
    .not('overall_score', 'is', null)
    .order('overall_score', { ascending: false })
    .order('created_at', { ascending: true });

  if (error) {
    throw new Error('Failed to fetch lemonades.');
  }

  return data || [];
}

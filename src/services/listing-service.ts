import { createServiceClient } from '@/lib/supabase/service';
import type {
  BrowserRating,
  CreateListingInput,
  CreateListingResult,
  ListingSearchResult,
  ListingSummary,
  MatchupResult,
  RatingSubmissionInput,
} from '@/types/lemonade';

/**
 * Phase A server data layer.
 *
 * Reads use the `listing_summaries` view (truthful aggregates, merged aliases
 * excluded); every mutation goes through a validated SECURITY DEFINER RPC so
 * creation + first rating and vote/photo invariants stay atomic.
 */

const PAGE_SIZE = 1000;

function toNumberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toCount(value: unknown): number {
  const parsed = toNumberOrNull(value);
  return parsed === null ? 0 : Math.max(0, Math.trunc(parsed));
}

function toStringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

export function mapListingSummary(row: Record<string, unknown>): ListingSummary {
  return {
    id: String(row.id),
    name: String(row.name ?? ''),
    description: typeof row.description === 'string' ? row.description : '',
    image_url: toStringOrNull(row.image_url),
    location_city: toStringOrNull(row.location_city),
    added_by: toStringOrNull(row.added_by),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
    flavor_rating: toNumberOrNull(row.flavor_rating),
    sourness_rating: toNumberOrNull(row.sourness_rating),
    overall_score: toNumberOrNull(row.overall_score),
    rating_count: toCount(row.rating_count),
    legacy_rating_count: toCount(row.legacy_rating_count),
    visitor_rating_count: toCount(row.visitor_rating_count),
    legacy_score: toNumberOrNull(row.legacy_score),
    visitor_avg_score: toNumberOrNull(row.visitor_avg_score),
    avg_score: toNumberOrNull(row.avg_score),
    min_score: toNumberOrNull(row.min_score),
    max_score: toNumberOrNull(row.max_score),
    trait_sour_avg: toNumberOrNull(row.trait_sour_avg),
    trait_sweet_avg: toNumberOrNull(row.trait_sweet_avg),
    trait_fizz_avg: toNumberOrNull(row.trait_fizz_avg),
    trait_fruity_avg: toNumberOrNull(row.trait_fruity_avg),
    trait_sour_count: toCount(row.trait_sour_count),
    trait_sweet_count: toCount(row.trait_sweet_count),
    trait_fizz_count: toCount(row.trait_fizz_count),
    trait_fruity_count: toCount(row.trait_fruity_count),
  };
}

function mapSearchResult(row: Record<string, unknown>): ListingSearchResult {
  return {
    id: String(row.id),
    name: String(row.name ?? ''),
    description: typeof row.description === 'string' ? row.description : '',
    image_url: toStringOrNull(row.image_url),
    location_city: toStringOrNull(row.location_city),
    added_by: toStringOrNull(row.added_by),
    created_at: String(row.created_at),
    flavor_rating: toNumberOrNull(row.flavor_rating),
    sourness_rating: toNumberOrNull(row.sourness_rating),
    overall_score: toNumberOrNull(row.overall_score),
    rating_count: toCount(row.rating_count),
    legacy_rating_count: toCount(row.legacy_rating_count),
    visitor_rating_count: toCount(row.visitor_rating_count),
    avg_score: toNumberOrNull(row.avg_score),
    legacy_score: toNumberOrNull(row.legacy_score),
  };
}

export function mapBrowserRating(row: Record<string, unknown>): BrowserRating {
  return {
    listing_id: String(row.lemonade_id),
    score: toNumberOrNull(row.score) ?? 0,
    trait_sour: toNumberOrNull(row.trait_sour),
    trait_sweet: toNumberOrNull(row.trait_sweet),
    trait_fizz: toNumberOrNull(row.trait_fizz),
    trait_fruity: toNumberOrNull(row.trait_fruity),
    comment: toStringOrNull(row.comment),
    updated_at: String(row.updated_at),
  };
}

export function mapMatchupResult(row: Record<string, unknown>): MatchupResult {
  return {
    lemonade_a: String(row.lemonade_a),
    lemonade_b: String(row.lemonade_b),
    votes_a: toCount(row.votes_a),
    votes_b: toCount(row.votes_b),
    total_votes: toCount(row.total_votes),
    percent_a: toNumberOrNull(row.percent_a),
    percent_b: toNumberOrNull(row.percent_b),
  };
}

/** Every canonical listing, paged explicitly so >1000 rows are never truncated. */
export async function getAllListingSummaries(): Promise<ListingSummary[]> {
  const supabase = createServiceClient();
  const listings: ListingSummary[] = [];

  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await supabase
      .from('listing_summaries')
      .select('*')
      .order('name', { ascending: true })
      .order('id', { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) {
      throw new Error(`Failed to fetch listings: ${error.message}`);
    }

    const page = (data ?? []).map(row => mapListingSummary(row as Record<string, unknown>));
    listings.push(...page);

    if (page.length < PAGE_SIZE) break;
  }

  return listings;
}

export async function searchListings(query: string, limit = 10): Promise<ListingSearchResult[]> {
  const supabase = createServiceClient();
  const { data, error } = await supabase.rpc('search_lemonades', {
    p_query: query,
    p_limit: limit,
  });

  if (error) {
    throw new Error(`Failed to search listings: ${error.message}`);
  }

  return (data ?? []).map((row: Record<string, unknown>) => mapSearchResult(row));
}

export async function getMatchupResult(
  lemonadeA: string,
  lemonadeB: string
): Promise<MatchupResult | null> {
  const supabase = createServiceClient();
  const { data, error } = await supabase.rpc('get_matchup_result', {
    p_lemonade_a: lemonadeA,
    p_lemonade_b: lemonadeB,
  });

  if (error) {
    throw new Error(`Failed to load matchup result: ${error.message}`);
  }

  const row = Array.isArray(data) ? data[0] : data;
  return row ? mapMatchupResult(row as Record<string, unknown>) : null;
}

export async function getBrowserRatings(browserId: string): Promise<BrowserRating[]> {
  const supabase = createServiceClient();
  const { data, error } = await supabase.rpc('get_browser_ratings', {
    p_browser_id: browserId,
  });

  if (error) {
    throw new Error(`Failed to load your ratings: ${error.message}`);
  }

  return (data ?? []).map((row: Record<string, unknown>) => mapBrowserRating(row));
}

export async function createListingWithFirstRating(
  input: CreateListingInput & { browserId: string }
): Promise<CreateListingResult> {
  const supabase = createServiceClient();
  const { data, error } = await supabase.rpc('create_lemonade_with_rating', {
    p_name: input.name,
    p_description: input.description ?? null,
    p_image_url: input.imageUrl ?? null,
    p_location_city: input.locationCity ?? null,
    p_added_by: input.addedBy ?? null,
    p_score: input.score,
    p_trait_sour: input.traits?.sour ?? null,
    p_trait_sweet: input.traits?.sweet ?? null,
    p_trait_fizz: input.traits?.fizz ?? null,
    p_trait_fruity: input.traits?.fruity ?? null,
    p_comment: input.comment ?? null,
    p_browser_id: input.browserId,
  });

  if (error) {
    throw new Error(`Failed to create listing: ${error.message}`);
  }

  const row = (Array.isArray(data) ? data[0] : data) as Record<string, unknown> | undefined;
  if (!row) {
    throw new Error('Failed to create listing: the server returned no result');
  }

  return {
    listingId: toStringOrNull(row.listing_id),
    duplicateOf: toStringOrNull(row.duplicate_of),
  };
}

export async function submitListingRating(
  input: RatingSubmissionInput & { browserId: string }
): Promise<{ ratingId: string }> {
  const supabase = createServiceClient();
  const { data, error } = await supabase.rpc('rate_lemonade', {
    p_lemonade_id: input.listingId,
    p_score: input.score,
    p_trait_sour: input.traits?.sour ?? null,
    p_trait_sweet: input.traits?.sweet ?? null,
    p_trait_fizz: input.traits?.fizz ?? null,
    p_trait_fruity: input.traits?.fruity ?? null,
    p_comment: input.comment ?? null,
    p_browser_id: input.browserId,
  });

  if (error) {
    throw new Error(`Failed to save rating: ${error.message}`);
  }

  const row = (Array.isArray(data) ? data[0] : data) as Record<string, unknown> | undefined;
  if (!row?.rating_id) {
    throw new Error('Failed to save rating: the server returned no result');
  }

  return { ratingId: String(row.rating_id) };
}

export async function contributeListingPhoto(input: {
  listingId: string;
  imageUrl: string;
}): Promise<{ updated: boolean; imageUrl: string | null }> {
  const supabase = createServiceClient();
  const { data, error } = await supabase.rpc('set_lemonade_photo', {
    p_lemonade_id: input.listingId,
    p_image_url: input.imageUrl,
  });

  if (error) {
    throw new Error(`Failed to save photo: ${error.message}`);
  }

  const row = (Array.isArray(data) ? data[0] : data) as Record<string, unknown> | undefined;
  if (!row) {
    throw new Error('Failed to save photo: the server returned no result');
  }

  return {
    updated: row.updated === true,
    imageUrl: toStringOrNull(row.current_image_url),
  };
}

export async function castMatchupVote(input: {
  lemonadeA: string;
  lemonadeB: string;
  picked: string;
  browserId: string;
}): Promise<{ voteId: string }> {
  const supabase = createServiceClient();
  const { data, error } = await supabase.rpc('cast_matchup_vote', {
    p_lemonade_a: input.lemonadeA,
    p_lemonade_b: input.lemonadeB,
    p_picked: input.picked,
    p_browser_id: input.browserId,
  });

  if (error) {
    throw new Error(`Failed to save vote: ${error.message}`);
  }

  const row = (Array.isArray(data) ? data[0] : data) as Record<string, unknown> | undefined;
  if (!row?.vote_id) {
    throw new Error('Failed to save vote: the server returned no result');
  }

  return { voteId: String(row.vote_id) };
}

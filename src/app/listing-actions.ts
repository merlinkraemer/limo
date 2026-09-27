'use server';

import { revalidatePath } from 'next/cache';
import { getBrowserId, getOrCreateBrowserId } from '@/lib/browser-identity';
import { isAllowedImageUrl } from '@/lib/image-url';
import {
  castMatchupVote,
  contributeListingPhoto,
  createListingWithFirstRating,
  getAllListingSummaries,
  getBrowserRatings,
  getMatchupResult,
  searchListings,
  submitListingRating,
} from '@/services/listing-service';
import {
  BrowserRating,
  CreateListingInput,
  ListingSearchResult,
  ListingSummary,
  MatchupResult,
  firstFieldError,
  matchupVoteSchema,
  newListingSchema,
  photoContributionSchema,
  ratingSubmissionSchema,
} from '@/types/lemonade';

/**
 * Phase A server actions for the Phase B UI. All mutations are validated here
 * (zod + allowed image hosts) and again inside the database RPCs; browser
 * identity comes from the server-issued HttpOnly cookie.
 */

export type ActionFailure = { ok: false; error: string };

export type CreateListingActionResult =
  | { ok: true; listingId: string }
  | { ok: false; error: string; duplicateOf?: string };

export type RateListingActionResult = { ok: true; ratingId: string } | ActionFailure;
export type ContributePhotoActionResult =
  | { ok: true; updated: boolean; imageUrl: string | null }
  | ActionFailure;
export type CastVoteActionResult =
  | { ok: true; voteId: string; result: MatchupResult | null }
  | ActionFailure;
export type SearchListingsActionResult = { ok: true; results: ListingSearchResult[] } | ActionFailure;
export type FetchLeaderboardActionResult = { ok: true; listings: ListingSummary[] } | ActionFailure;
export type FetchMyRatingsActionResult = { ok: true; ratings: BrowserRating[] } | ActionFailure;
export type FetchMatchupResultActionResult =
  | { ok: true; result: MatchupResult | null }
  | ActionFailure;

function messageOf(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

export async function createListing(input: CreateListingInput): Promise<CreateListingActionResult> {
  const parsed = newListingSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: firstFieldError(parsed.error) };
  }

  if (parsed.data.imageUrl && !isAllowedImageUrl(parsed.data.imageUrl)) {
    return { ok: false, error: 'Image URL must be from your storage bucket' };
  }

  try {
    const browserId = await getOrCreateBrowserId();
    const result = await createListingWithFirstRating({
      name: parsed.data.name,
      description: parsed.data.description || undefined,
      score: parsed.data.score,
      traits: parsed.data.traits,
      comment: parsed.data.comment || undefined,
      imageUrl: parsed.data.imageUrl || undefined,
      locationCity: parsed.data.locationCity || undefined,
      addedBy: parsed.data.addedBy || undefined,
      browserId,
    });

    if (!result.listingId) {
      return {
        ok: false,
        error: 'A listing with this name already exists - rate it instead.',
        duplicateOf: result.duplicateOf ?? undefined,
      };
    }

    revalidatePath('/');
    return { ok: true, listingId: result.listingId };
  } catch (error) {
    return { ok: false, error: messageOf(error, 'Failed to create listing') };
  }
}

export async function rateListing(input: {
  listingId: string;
  score: number;
  traits?: CreateListingInput['traits'];
  comment?: string;
}): Promise<RateListingActionResult> {
  const parsed = ratingSubmissionSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: firstFieldError(parsed.error) };
  }

  try {
    const browserId = await getOrCreateBrowserId();
    const result = await submitListingRating({
      listingId: parsed.data.listingId,
      score: parsed.data.score,
      traits: parsed.data.traits,
      comment: parsed.data.comment || undefined,
      browserId,
    });

    revalidatePath('/');
    return { ok: true, ratingId: result.ratingId };
  } catch (error) {
    return { ok: false, error: messageOf(error, 'Failed to save rating') };
  }
}

export async function contributePhoto(input: {
  listingId: string;
  imageUrl: string;
}): Promise<ContributePhotoActionResult> {
  const parsed = photoContributionSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: firstFieldError(parsed.error) };
  }

  if (!isAllowedImageUrl(parsed.data.imageUrl)) {
    return { ok: false, error: 'Image URL must be from your storage bucket' };
  }

  try {
    const result = await contributeListingPhoto({
      listingId: parsed.data.listingId,
      imageUrl: parsed.data.imageUrl,
    });

    revalidatePath('/');
    return { ok: true, updated: result.updated, imageUrl: result.imageUrl };
  } catch (error) {
    return { ok: false, error: messageOf(error, 'Failed to save photo') };
  }
}

export async function castVote(input: {
  lemonadeA: string;
  lemonadeB: string;
  picked: string;
}): Promise<CastVoteActionResult> {
  const parsed = matchupVoteSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: firstFieldError(parsed.error) };
  }

  try {
    const browserId = await getOrCreateBrowserId();
    const result = await castMatchupVote({
      lemonadeA: parsed.data.lemonadeA,
      lemonadeB: parsed.data.lemonadeB,
      picked: parsed.data.picked,
      browserId,
    });

    // One browser action = one persisted vote + the real post-vote aggregate.
    // A matchup vote never changes listing_summaries, so there is nothing to
    // revalidate here (and a full home RSC refresh would only add latency).
    let matchup: MatchupResult | null = null;
    try {
      matchup = await getMatchupResult(parsed.data.lemonadeA, parsed.data.lemonadeB);
    } catch {
      matchup = null;
    }

    return { ok: true, voteId: result.voteId, result: matchup };
  } catch (error) {
    return { ok: false, error: messageOf(error, 'Failed to save vote') };
  }
}

export async function searchListingsAction(query: string): Promise<SearchListingsActionResult> {
  if (typeof query !== 'string' || query.length > 100) {
    return { ok: false, error: 'Search query must be 100 characters or fewer' };
  }

  try {
    const results = await searchListings(query.trim(), 10);
    return { ok: true, results };
  } catch (error) {
    return { ok: false, error: messageOf(error, 'Failed to search listings') };
  }
}

export async function fetchLeaderboard(): Promise<FetchLeaderboardActionResult> {
  try {
    return { ok: true, listings: await getAllListingSummaries() };
  } catch (error) {
    return { ok: false, error: messageOf(error, 'Failed to load listings') };
  }
}

export async function fetchMyRatings(): Promise<FetchMyRatingsActionResult> {
  try {
    const browserId = await getBrowserId();
    if (!browserId) {
      return { ok: true, ratings: [] };
    }
    return { ok: true, ratings: await getBrowserRatings(browserId) };
  } catch (error) {
    return { ok: false, error: messageOf(error, 'Failed to load your ratings') };
  }
}

export async function fetchMatchupResult(
  lemonadeA: string,
  lemonadeB: string
): Promise<FetchMatchupResultActionResult> {
  if (
    typeof lemonadeA !== 'string' ||
    typeof lemonadeB !== 'string' ||
    !lemonadeA ||
    !lemonadeB ||
    lemonadeA === lemonadeB
  ) {
    return { ok: false, error: 'Pick two different lemonades' };
  }

  try {
    return { ok: true, result: await getMatchupResult(lemonadeA, lemonadeB) };
  } catch (error) {
    return { ok: false, error: messageOf(error, 'Failed to load matchup result') };
  }
}

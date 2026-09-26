import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/services/listing-service', () => ({
  createListingWithFirstRating: vi.fn(),
  submitListingRating: vi.fn(),
  contributeListingPhoto: vi.fn(),
  castMatchupVote: vi.fn(),
  searchListings: vi.fn(),
  getAllListingSummaries: vi.fn(),
  getBrowserRatings: vi.fn(),
  getMatchupResult: vi.fn(),
}));

vi.mock('@/lib/browser-identity', () => ({
  getOrCreateBrowserId: vi.fn(),
  getBrowserId: vi.fn(),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

import {
  castVote,
  contributePhoto,
  createListing,
  fetchLeaderboard,
  fetchMyRatings,
  rateListing,
  searchListingsAction,
} from '@/app/listing-actions';
import {
  castMatchupVote,
  contributeListingPhoto,
  createListingWithFirstRating,
  getAllListingSummaries,
  getBrowserRatings,
  searchListings,
  submitListingRating,
} from '@/services/listing-service';
import { getBrowserId, getOrCreateBrowserId } from '@/lib/browser-identity';

const BROWSER_ID = '11111111-2222-4333-8444-555555555555';
const LISTING_ID = '22222222-2222-4333-8444-555555555555';
const OTHER_ID = '33333333-2222-4333-8444-555555555555';
const CLOUDINARY_URL = 'https://res.cloudinary.com/demo/image/upload/x.jpg';

describe('listing actions', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv, NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME: 'demo' };
    vi.mocked(getOrCreateBrowserId).mockResolvedValue(BROWSER_ID);
    vi.mocked(getBrowserId).mockResolvedValue(BROWSER_ID);
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('createListing validates and forwards a real first rating', async () => {
    vi.mocked(createListingWithFirstRating).mockResolvedValue({ listingId: LISTING_ID, duplicateOf: null });

    const result = await createListing({
      name: 'Limona',
      score: 8,
      traits: { sour: 2 },
      comment: '',
    });

    expect(result).toEqual({ ok: true, listingId: LISTING_ID });
    expect(createListingWithFirstRating).toHaveBeenCalledWith({
      name: 'Limona',
      description: undefined,
      score: 8,
      traits: { sour: 2 },
      comment: undefined,
      imageUrl: undefined,
      locationCity: undefined,
      addedBy: undefined,
      browserId: BROWSER_ID,
    });
  });

  it('createListing returns the duplicate target instead of creating a twin', async () => {
    vi.mocked(createListingWithFirstRating).mockResolvedValue({ listingId: null, duplicateOf: LISTING_ID });

    const result = await createListing({ name: 'Twister Soda Trai Cay', score: 7 });

    expect(result).toEqual({
      ok: false,
      error: 'A listing with this name already exists - rate it instead.',
      duplicateOf: LISTING_ID,
    });
  });

  it('createListing rejects invalid input and unsupported image hosts before writing', async () => {
    expect(await createListing({ name: 'L', score: 8 })).toEqual({
      ok: false,
      error: 'Name must be at least 2 characters',
    });
    expect(await createListing({ name: 'Limona', score: 8, imageUrl: 'https://evil.com/x.jpg' })).toEqual({
      ok: false,
      error: 'Image URL must be from your storage bucket',
    });
    expect(createListingWithFirstRating).not.toHaveBeenCalled();
  });

  it('rateListing validates the score and forwards the browser identity', async () => {
    vi.mocked(submitListingRating).mockResolvedValue({ ratingId: 'rating-1' });

    const result = await rateListing({ listingId: LISTING_ID, score: 9, comment: 'nice' });
    expect(result).toEqual({ ok: true, ratingId: 'rating-1' });
    expect(submitListingRating).toHaveBeenCalledWith(
      expect.objectContaining({ listingId: LISTING_ID, score: 9, browserId: BROWSER_ID })
    );

    expect(await rateListing({ listingId: LISTING_ID, score: 0 })).toMatchObject({ ok: false });
    expect(submitListingRating).toHaveBeenCalledTimes(1);
  });

  it('contributePhoto enforces allowed hosts and reports the winner', async () => {
    vi.mocked(contributeListingPhoto).mockResolvedValue({ updated: false, imageUrl: CLOUDINARY_URL });

    expect(await contributePhoto({ listingId: LISTING_ID, imageUrl: 'https://evil.com/x.jpg' })).toEqual({
      ok: false,
      error: 'Image URL must be from your storage bucket',
    });

    const result = await contributePhoto({ listingId: LISTING_ID, imageUrl: CLOUDINARY_URL });
    expect(result).toEqual({ ok: true, updated: false, imageUrl: CLOUDINARY_URL });
  });

  it('castVote rejects picks outside the pair and forwards valid votes', async () => {
    expect(
      await castVote({ lemonadeA: LISTING_ID, lemonadeB: OTHER_ID, picked: BROWSER_ID })
    ).toMatchObject({ ok: false });

    vi.mocked(castMatchupVote).mockResolvedValue({ voteId: 'vote-1' });
    const result = await castVote({ lemonadeA: LISTING_ID, lemonadeB: OTHER_ID, picked: OTHER_ID });
    expect(result).toEqual({ ok: true, voteId: 'vote-1' });
    expect(castMatchupVote).toHaveBeenCalledWith({
      lemonadeA: LISTING_ID,
      lemonadeB: OTHER_ID,
      picked: OTHER_ID,
      browserId: BROWSER_ID,
    });
  });

  it('searchListingsAction trims the query and surfaces failures', async () => {
    vi.mocked(searchListings).mockResolvedValue([]);
    expect(await searchListingsAction('  lemon  ')).toEqual({ ok: true, results: [] });
    expect(searchListings).toHaveBeenCalledWith('lemon', 10);

    vi.mocked(searchListings).mockRejectedValue(new Error('db down'));
    expect(await searchListingsAction('lemon')).toEqual({ ok: false, error: 'db down' });
    expect(await searchListingsAction('x'.repeat(101))).toMatchObject({ ok: false });
  });

  it('fetchLeaderboard returns aggregates or an error', async () => {
    vi.mocked(getAllListingSummaries).mockResolvedValue([]);
    expect(await fetchLeaderboard()).toEqual({ ok: true, listings: [] });

    vi.mocked(getAllListingSummaries).mockRejectedValue(new Error('boom'));
    expect(await fetchLeaderboard()).toEqual({ ok: false, error: 'boom' });
  });

  it('fetchMyRatings stays empty for a fresh browser', async () => {
    vi.mocked(getBrowserId).mockResolvedValue(null);
    expect(await fetchMyRatings()).toEqual({ ok: true, ratings: [] });
    expect(getBrowserRatings).not.toHaveBeenCalled();
  });
});

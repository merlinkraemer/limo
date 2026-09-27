import { describe, expect, it } from 'vitest';
import {
  mapBrowserRating,
  mapListingSummary,
  mapMatchupResult,
} from '@/services/listing-service';

describe('mapListingSummary', () => {
  it('coerces PostgREST numerics and NULLs truthfully', () => {
    const summary = mapListingSummary({
      id: '11111111-2222-4333-8444-555555555555',
      name: 'Limona',
      description: 'zing',
      image_url: null,
      location_city: null,
      added_by: null,
      created_at: '2026-07-03T00:00:00Z',
      updated_at: '2026-07-03T00:00:00Z',
      flavor_rating: null,
      sourness_rating: null,
      overall_score: null,
      rating_count: '1',
      legacy_rating_count: 0,
      visitor_rating_count: 1,
      legacy_score: null,
      visitor_avg_score: '6.30',
      avg_score: '6.3',
      min_score: '6.3',
      max_score: '6.3',
      trait_sour_avg: null,
      trait_sweet_avg: null,
      trait_fizz_avg: '1.00000000000000000000',
      trait_fruity_avg: null,
      trait_sour_count: 0,
      trait_sweet_count: 0,
      trait_fizz_count: 1,
      trait_fruity_count: 0,
    });

    expect(summary.avg_score).toBe(6.3);
    expect(summary.flavor_rating).toBeNull();
    expect(summary.overall_score).toBeNull();
    expect(summary.rating_count).toBe(1);
    expect(summary.trait_sour_avg).toBeNull();
    expect(summary.trait_fizz_avg).toBe(1);
  });
});

describe('mapMatchupResult', () => {
  it('keeps NULL percentages when nobody voted', () => {
    const result = mapMatchupResult({
      lemonade_a: 'a',
      lemonade_b: 'b',
      votes_a: 0,
      votes_b: 0,
      total_votes: 0,
      percent_a: null,
      percent_b: null,
    });

    expect(result.total_votes).toBe(0);
    expect(result.percent_a).toBeNull();
    expect(result.percent_b).toBeNull();
  });

  it('coerces numeric vote percentages', () => {
    const result = mapMatchupResult({
      lemonade_a: 'a',
      lemonade_b: 'b',
      votes_a: '2',
      votes_b: 1,
      total_votes: 3,
      percent_a: '66.67',
      percent_b: '33.33',
    });

    expect(result.percent_a).toBe(66.67);
    expect(result.percent_b).toBe(33.33);
  });
});

describe('mapBrowserRating', () => {
  it('maps the browser own rating rows only', () => {
    const rating = mapBrowserRating({
      lemonade_id: 'a',
      score: '8.00',
      trait_sour: 2,
      trait_sweet: null,
      trait_fizz: null,
      trait_fruity: null,
      comment: null,
      updated_at: '2026-07-03T00:00:00Z',
    });

    expect(rating.listing_id).toBe('a');
    expect(rating.score).toBe(8);
    expect(rating.trait_sour).toBe(2);
    expect(rating.comment).toBeNull();
  });
});

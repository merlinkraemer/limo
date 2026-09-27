import { describe, expect, it } from 'vitest';
import {
  matchupVoteSchema,
  newListingSchema,
  ratingSubmissionSchema,
} from '@/types/lemonade';

const LISTING_ID = '11111111-2222-4333-8444-555555555555';
const OTHER_ID = '22222222-2222-4333-8444-555555555555';

describe('newListingSchema', () => {
  it('accepts a minimal listing with a real first score', () => {
    const result = newListingSchema.safeParse({ name: 'Limona', score: 8 });
    expect(result.success).toBe(true);
  });

  it('accepts optional traits, comment and photo', () => {
    const result = newListingSchema.safeParse({
      name: 'Limona',
      description: '',
      score: 10,
      traits: { sour: 3, sweet: 0, fizz: null },
      comment: 'zingy',
      imageUrl: 'https://res.cloudinary.com/demo/image/upload/x.jpg',
      locationCity: 'Berlin',
      addedBy: 'Mo',
    });
    expect(result.success).toBe(true);
  });

  it('rejects fractional / out-of-range scores and traits', () => {
    expect(newListingSchema.safeParse({ name: 'Limona', score: 7.5 }).success).toBe(false);
    expect(newListingSchema.safeParse({ name: 'Limona', score: 11 }).success).toBe(false);
    expect(
      newListingSchema.safeParse({ name: 'Limona', score: 8, traits: { sour: 4 } }).success
    ).toBe(false);
  });

  it('rejects comments over 140 characters', () => {
    const result = newListingSchema.safeParse({
      name: 'Limona',
      score: 8,
      comment: 'x'.repeat(141),
    });
    expect(result.success).toBe(false);
  });
});

describe('ratingSubmissionSchema', () => {
  it('accepts a valid rating', () => {
    const result = ratingSubmissionSchema.safeParse({
      listingId: LISTING_ID,
      score: 1,
      traits: { fruity: 2 },
      comment: '',
    });
    expect(result.success).toBe(true);
  });

  it('rejects unknown listing ids and zero scores', () => {
    expect(ratingSubmissionSchema.safeParse({ listingId: 'nope', score: 5 }).success).toBe(false);
    expect(ratingSubmissionSchema.safeParse({ listingId: LISTING_ID, score: 0 }).success).toBe(false);
  });
});

describe('matchupVoteSchema', () => {
  it('accepts a pick inside the pair', () => {
    const result = matchupVoteSchema.safeParse({
      lemonadeA: LISTING_ID,
      lemonadeB: OTHER_ID,
      picked: OTHER_ID,
    });
    expect(result.success).toBe(true);
  });

  it('rejects equal listings and picks outside the pair', () => {
    expect(
      matchupVoteSchema.safeParse({
        lemonadeA: LISTING_ID,
        lemonadeB: LISTING_ID,
        picked: LISTING_ID,
      }).success
    ).toBe(false);
    expect(
      matchupVoteSchema.safeParse({
        lemonadeA: LISTING_ID,
        lemonadeB: OTHER_ID,
        picked: '33333333-2222-4333-8444-555555555555',
      }).success
    ).toBe(false);
  });
});

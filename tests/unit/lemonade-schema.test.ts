import { describe, expect, it } from 'vitest';
import { lemonadeFormSchema } from '@/types/lemonade';

describe('lemonadeFormSchema', () => {
  it('accepts a valid limo submission', () => {
    const result = lemonadeFormSchema.safeParse({
      name: 'Classic Limo',
      description: 'Sharp lemon kick with a clean finish.',
      flavorRating: 8,
      sournessRating: 7,
      imageUrl: '',
      locationCity: 'Seattle',
    });

    expect(result.success).toBe(true);
  });

  it('rejects short names and out-of-range ratings', () => {
    const result = lemonadeFormSchema.safeParse({
      name: 'A',
      description: 'bad',
      flavorRating: 0,
      sournessRating: 11,
      imageUrl: 'not-a-url',
      locationCity: '',
    });

    expect(result.success).toBe(false);

    if (result.success) {
      return;
    }

    const errors = result.error.flatten().fieldErrors;
    expect(errors.name?.[0]).toContain('at least 2');
    expect(errors.flavorRating?.[0]).toContain('at least 1');
    expect(errors.sournessRating?.[0]).toContain('at most 10');
    expect(errors.imageUrl?.[0]).toContain('Invalid image URL');
  });
});

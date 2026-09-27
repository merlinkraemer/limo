import { createClient } from '@supabase/supabase-js';
import { test, expect, type Locator, type Page } from '@playwright/test';

/**
 * Stored photos must render through the Next.js image optimizer:
 * - local Supabase Storage URLs (loopback IP) must be optimized in development;
 * - a landscape photo must keep its natural aspect ratio in the detail hero
 *   and in the mobile lightbox instead of being forced into a 3:4 box.
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const BUCKET = 'limo-images';

/** 64×32 solid-colour PNG (landscape, 2:1). */
const LANDSCAPE_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAEAAAAAgCAIAAAAt/+nTAAAANklEQVR42u3PQQkAAAgEsItof+yiGXwKgxVYpuu1CAgICAgICAgICAgICAgICAgICAgICAhcLVNJWQBOMv0IAAAAAElFTkSuQmCC',
  'base64'
);

const supabase = () =>
  createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

async function seedLandscapeListing(name: string, key: string) {
  const client = supabase();
  const path = `e2e/${key}-landscape.png`;
  const { error: uploadError } = await client.storage
    .from(BUCKET)
    .upload(path, LANDSCAPE_PNG, { contentType: 'image/png', upsert: true });
  expect(uploadError).toBeNull();

  const { data: publicUrl } = client.storage.from(BUCKET).getPublicUrl(path);
  const { data, error } = await client
    .from('lemonades')
    .insert({
      name,
      description: 'e2e landscape photo sample',
      flavor_rating: 8,
      sourness_rating: 6,
      image_url: publicUrl.publicUrl,
      location_city: 'E2E',
      added_by: 'e2e',
    })
    .select('id')
    .single();
  expect(error).toBeNull();

  // A real score keeps the listing above the fold on the leaderboard.
  const { error: ratingError } = await client
    .from('lemonade_ratings')
    .insert({ lemonade_id: data!.id, score: 9.5, source: 'legacy' });
  expect(ratingError).toBeNull();

  return { id: data!.id as string, imageUrl: publicUrl.publicUrl };
}

async function ratioProbe(image: Locator) {
  return image.evaluate(async element => {
    const img = element as HTMLImageElement;
    const src = img.currentSrc || img.src;
    const response = await fetch(src, { cache: 'no-store' });
    const box = img.getBoundingClientRect();
    return {
      src,
      status: response.status,
      contentType: response.headers.get('content-type') ?? '',
      naturalRatio: img.naturalWidth / img.naturalHeight,
      boxRatio: box.width / box.height,
    };
  });
}

async function waitForImage(image: Locator) {
  await expect(image).toBeVisible();
  await expect
    .poll(() => image.evaluate(element => (element as HTMLImageElement).naturalWidth))
    .toBeGreaterThan(0);
  return ratioProbe(image);
}

/** The deck is deterministic: keep picking until the listing enters a round. */
async function revealCardWith(page: Page, name: string) {
  for (let round = 0; round < 10; round++) {
    const card = page.locator('.card-wrap', { hasText: name }).first();
    if ((await card.count()) > 0) return card;

    await page.locator('.card-wrap[data-card-position="left"] button.qc').click();
    await expect(page.locator('.reveal')).toHaveCount(2);
    await page.getByRole('button', { name: 'next!' }).click();
    await expect(page.locator('.reveal')).toHaveCount(0);
  }
  throw new Error(`${name} never entered the game deck`);
}

test.describe('stored photos render through the image optimizer', () => {
  const stamp = Date.now();
  const nameA = `E2E Landscape A ${stamp}`;
  const nameB = `E2E Landscape B ${stamp}`;
  let listingA: { id: string; imageUrl: string };

  test.beforeAll(async () => {
    listingA = await seedLandscapeListing(nameA, `${stamp}-a`);
    await seedLandscapeListing(nameB, `${stamp}-b`);
  });

  test('local Storage detail hero is optimized and keeps its natural ratio', async ({ page }) => {
    await page.goto('/');
    await page.locator('.board .row', { hasText: nameA }).first().click();

    const detail = page.getByRole('dialog', { name: nameA });
    const probe = await waitForImage(detail.locator('.detail-photo img'));

    expect(probe.src).toContain('/_next/image?');
    expect(decodeURIComponent(probe.src)).toContain(listingA.imageUrl.split('/storage/')[0]);
    expect(probe.status).toBe(200);
    expect(probe.contentType).toContain('image/');
    expect(probe.naturalRatio).toBeCloseTo(2, 1);
    expect(probe.boxRatio).toBeCloseTo(probe.naturalRatio, 1);
  });

  test.describe('mobile lightbox', () => {
    test.use({ viewport: { width: 390, height: 844 } });

    test('lightbox keeps the natural ratio of a landscape photo', async ({ page }) => {
      await page.goto('/');
      await page.locator('.top-actions button.btn').first().click();

      const card = await revealCardWith(page, nameA);
      await card.locator('.card-expand').click();

      const lightbox = page.locator('.card-lightbox.is-open');
      await expect(lightbox).toBeVisible();
      const probe = await waitForImage(lightbox.locator('.card-lightbox-photo img'));

      expect(probe.status).toBe(200);
      expect(probe.contentType).toContain('image/');
      expect(probe.naturalRatio).toBeCloseTo(2, 1);
      expect(probe.boxRatio).toBeCloseTo(probe.naturalRatio, 1);
    });
  });
});

import { test, expect, type Page } from '@playwright/test';

/**
 * Vote latency, medal ordinals and image states (desktop).
 *
 * Vote-affecting tests are serial: each pick is a real stored vote.
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const SERVICE_HEADERS = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  'Content-Type': 'application/json',
};

async function createListing(page: Page, name: string, stars: number) {
  await page.getByRole('button', { name: 'add yours' }).click();
  await page.locator('#add-q').fill(name);
  await page.getByRole('button', { name: /as new/ }).click();
  await page.getByRole('button', { name: `${stars} out of 10 stars` }).click();
  await page.getByRole('button', { name: 'add limo' }).click();
  await expect(page.getByText('added! 🍋')).toBeVisible({ timeout: 15000 });
  await page.keyboard.press('Escape');
  await expect(page.getByText('added! 🍋')).toBeHidden();
}

let uploadedImageUrl: string | null = null;

/** Upload a real 1x1 PNG to local storage; the optimizer can decode it. */
async function e2eImageUrl(): Promise<string> {
  if (uploadedImageUrl) return uploadedImageUrl;
  const path = `e2e/ux-followup-${Date.now()}.png`;
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64'
  );
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/limo-images/${path}`, {
    method: 'POST',
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'image/png',
      'x-upsert': 'true',
    },
    body: png,
  });
  if (!res.ok) throw new Error(`storage upload failed: ${res.status} ${await res.text()}`);
  uploadedImageUrl = `${SUPABASE_URL}/storage/v1/object/public/limo-images/${path}`;
  return uploadedImageUrl;
}

async function attachImagesToAllListings(url: string) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/lemonades?id=not.is.null`, {
    method: 'PATCH',
    headers: SERVICE_HEADERS,
    body: JSON.stringify({ image_url: url }),
  });
  if (!res.ok) throw new Error(`attach failed: ${res.status} ${await res.text()}`);
}

test.describe('ux follow-up (desktop)', () => {
  test.describe.configure({ mode: 'serial' });
  test.setTimeout(120_000);

  test('one browser action per pick: pending feedback, then the real result', async ({ page }) => {
    await page.goto('/');
    const card = page.locator('.card-wrap[data-card-position="left"] button.qc');
    await expect(card).toBeVisible();

    const actionPosts: string[] = [];
    await page.route('**/*', async route => {
      const request = route.request();
      if (request.method() === 'POST' && request.headers()['next-action']) {
        actionPosts.push(request.url());
        await new Promise(resolve => setTimeout(resolve, 700));
      }
      await route.continue();
    });

    await card.click();
    // Immediate visible pending/selected feedback on tap.
    await expect(page.locator('.qc.is-pending')).toBeVisible();
    await expect(page.locator('.qc.is-pending .qc-pending')).toHaveText('picking…');
    await expect(page.locator('.qc.is-pending')).toHaveAttribute('aria-busy', 'true');
    // Then the persisted vote + real aggregate reveal in the same action.
    await expect(page.locator('.reveal')).toHaveCount(2, { timeout: 20000 });
    await expect(page.locator('.qc-pending')).toHaveCount(0);
    expect(actionPosts).toHaveLength(1);
  });

  test('unique ordinal medals; detail shows the same rank and no source row', async ({ page }) => {
    await page.goto('/');
    const stamp = Date.now();
    for (let i = 0; i < 3; i++) await createListing(page, `E2E Medal ${stamp}-${i}`, 10);

    await page.goto('/');
    await expect(page.locator('.rk.medal')).toHaveCount(3);
    const labels = await page
      .locator('.rk.medal')
      .evaluateAll(els => els.map(el => el.getAttribute('aria-label')));
    expect(labels).toEqual(['gold, rank 1', 'silver, rank 2', 'bronze, rank 3']);

    await page.locator('.board .row').first().click();
    await expect(page.locator('.sheet-bar p')).toHaveText(/^#1 of \d+$/);
    await expect(page.locator('.detail-traits')).not.toContainText('historical self-report');
    const labs = await page.locator('.detail-traits .qc-lab').allTextContents();
    expect(labs).not.toContain('source');
  });

  test('game follow-up buttons stack vertically on desktop (>=44px)', async ({ page }) => {
    await page.goto('/');
    await page.locator('.card-wrap[data-card-position="left"] button.qc').click();
    await expect(page.locator('.game .or.has-followup')).toBeVisible();

    const yes = await page.getByRole('button', { name: 'yes' }).boundingBox();
    const next = await page.getByRole('button', { name: 'next!' }).boundingBox();
    expect(yes && next).toBeTruthy();
    expect(yes!.height).toBeGreaterThanOrEqual(44);
    expect(next!.height).toBeGreaterThanOrEqual(44);
    expect(yes!.y + yes!.height).toBeLessThanOrEqual(next!.y + 1);
    expect(Math.abs(yes!.x - next!.x)).toBeLessThanOrEqual(1);
  });

  test('photos get a skeleton then settle; missing photos keep the placeholder', async ({ page }) => {
    const imageUrl = await e2eImageUrl();
    await page.goto('/');
    const name = `E2E Photo ${Date.now()}`;
    await createListing(page, name, 7);
    const patch = await fetch(`${SUPABASE_URL}/rest/v1/lemonades?name=eq.${encodeURIComponent(name)}`, {
      method: 'PATCH',
      headers: SERVICE_HEADERS,
      body: JSON.stringify({ image_url: imageUrl }),
    });
    expect(patch.ok).toBe(true);

    // The skeleton is server-rendered until the optimized image decodes.
    const html = await (await page.request.get('/')).text();
    expect(html).toContain('img-skeleton');
    expect(html).toContain('data-photo-state="loading"');

    await page.goto('/');
    const row = page.locator('.board li', { hasText: name });
    await row.scrollIntoViewIfNeeded();
    await expect(row.locator('img')).toHaveAttribute('data-photo-state', 'loaded', { timeout: 30000 });
    await expect(row.locator('.img-skeleton')).toHaveCount(0);
    const noPhoto = `E2E NoPhoto ${Date.now()}`;
    await createListing(page, noPhoto, 6);
    await page.goto('/');
    await expect(page.locator('.board li', { hasText: noPhoto }).locator('.thumb .ph')).toBeVisible();
  });

  test('prewarms only the next pair at the card variant and swaps it on advance', async ({ page }) => {
    const imageUrl = await e2eImageUrl();
    await attachImagesToAllListings(imageUrl);
    await page.goto('/');
    const warm = page.locator('.game-warm img');
    await expect(warm).toHaveCount(2);
    const before = await page.locator('.game-warm').getAttribute('data-warm-ids');
    expect(before).toBeTruthy();
    const beforeSources = await warm.evaluateAll(imgs => imgs.map(img => (img as HTMLImageElement).src));
    expect(beforeSources.every(src => src.includes('/_next/image'))).toBe(true);

    await page.locator('.card-wrap[data-card-position="left"] button.qc').click();
    await expect(page.locator('.reveal')).toHaveCount(2);
    await page.getByRole('button', { name: 'next!' }).click();
    await expect(page.locator('.game-warm img')).toHaveCount(2);
    await expect.poll(() => page.locator('.game-warm').getAttribute('data-warm-ids')).not.toBe(before);
  });

  test('respects Data Saver: no prewarm when saveData is on', async ({ page }) => {
    const imageUrl = await e2eImageUrl();
    await attachImagesToAllListings(imageUrl);
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'connection', {
        get: () => ({ saveData: true }),
        configurable: true,
      });
    });
    await page.goto('/');
    await expect(page.locator('.card-wrap[data-card-position="left"] button.qc')).toBeVisible();
    await expect(page.locator('.game-warm')).toHaveCount(0);
  });
});

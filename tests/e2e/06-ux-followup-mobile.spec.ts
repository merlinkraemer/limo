import { test, expect, type Page } from '@playwright/test';

/**
 * Mobile add/search drawer + game follow-up layout.
 *
 * Headless Chromium cannot show a real virtual keyboard, so the short-viewport
 * test models a `resizes-content` keyboard; real iOS visual-viewport behaviour
 * (resizes-visual + body lock) still needs a device check.
 */

async function createListingMobile(page: Page, name: string, stars: number) {
  await page.locator('.fab').click();
  await page.locator('#add-q').fill(name);
  await page.getByRole('button', { name: /as new/ }).click();
  await page.getByRole('button', { name: `${stars} out of 10 stars` }).click();
  await page.getByRole('button', { name: 'add limo' }).click();
  await expect(page.getByText('added! 🍋')).toBeVisible({ timeout: 15000 });
  await page.keyboard.press('Escape');
  await expect(page.getByText('added! 🍋')).toBeHidden();
}

test.use({ viewport: { width: 390, height: 844 } });

test.describe('ux follow-up (mobile)', () => {
  test.describe.configure({ mode: 'serial' });
  test.setTimeout(120_000);

  test('drawer locks html/body scroll and restores the original position', async ({ page }) => {
    await page.goto('/');
    const stamp = Date.now();
    for (let i = 0; i < 4; i++) await createListingMobile(page, `E2E Mobile Lock ${stamp}-${i}`, 5);

    await page.evaluate(() => window.scrollTo(0, 200));
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
    const before = await page.evaluate(() => window.scrollY);

    await page.locator('.fab').click();
    await expect(page.locator('.sheet-host[data-open="true"]')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.classList.contains('locked'))).toBe(true);
    expect(await page.evaluate(() => document.body.classList.contains('locked'))).toBe(true);
    expect(await page.evaluate(() => getComputedStyle(document.body).position)).toBe('fixed');
    expect(await page.evaluate(() => document.body.style.top)).toBe(`-${before}px`);

    // The panel is the scroller; the document must not move behind it.
    await page.locator('.sheet-host:not(.detail) .panel').evaluate(el => {
      el.scrollTop = 120;
    });
    expect(await page.evaluate(() => window.scrollY)).toBe(0);

    await page.locator('.sheet-host:not(.detail) .panel .icon-btn[aria-label="close"]').first().click();
    await expect(page.locator('.sheet-host[data-open="true"]')).toHaveCount(0);
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(before);
    expect(await page.evaluate(() => document.documentElement.classList.contains('locked'))).toBe(false);
  });

  test('sticky search + new-listing CTA stay pinned above the results', async ({ page }) => {
    await page.goto('/');
    await page.locator('.fab').click();
    await page.locator('#add-q').fill('E2E Mobile');
    const cta = page.getByRole('button', { name: /as new/ });
    await expect(cta).toBeVisible();
    // Let the sheet's slide-in transition finish before measuring geometry.
    await page.waitForTimeout(400);

    const barBox = await page.locator('.sheet-host:not(.detail) .add-bar:not(.rate-sheet-bar)').boundingBox();
    const ctaBox = await cta.boundingBox();
    // The CTA lives inside the sticky bar, directly under the search field.
    expect(ctaBox!.y).toBeGreaterThanOrEqual(barBox!.y);
    expect(ctaBox!.y + ctaBox!.height).toBeLessThanOrEqual(barBox!.y + barBox!.height + 1);

    await page.locator('.sheet-host:not(.detail) .panel').evaluate(el => {
      el.scrollTop = el.scrollHeight;
    });
    const barAfter = await page.locator('.sheet-host:not(.detail) .add-bar:not(.rate-sheet-bar)').boundingBox();
    expect(Math.abs(barAfter!.y - barBox!.y)).toBeLessThanOrEqual(1);
    await expect(cta).toBeVisible();
  });

  test('keyboard-sized viewport keeps search + CTA visible above the fold', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 520 });
    await page.goto('/');
    await page.locator('.fab').click();
    await page.locator('#add-q').fill('E2E');

    await expect(page.locator('.sheet-host:not(.detail) .add-bar:not(.rate-sheet-bar)')).toBeInViewport();
    await expect(page.getByRole('button', { name: /as new/ })).toBeInViewport();
    const maxHeight = await page
      .locator('.sheet-host:not(.detail) .panel')
      .evaluate(el => parseFloat(getComputedStyle(el).maxHeight));
    expect(maxHeight).toBeLessThanOrEqual(520);
  });

  test('follow-up actions stay side by side on mobile (>=44px)', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /lemoguesser/ }).click();
    await expect(page.locator('.game-layer.is-open')).toBeVisible();
    await page.locator('.card-wrap[data-card-position="left"] button.qc').click();
    await expect(page.locator('.game .or.has-followup')).toBeVisible();

    const yes = await page.getByRole('button', { name: 'yes' }).boundingBox();
    const next = await page.getByRole('button', { name: 'next!' }).boundingBox();
    expect(yes && next).toBeTruthy();
    expect(Math.abs(yes!.y - next!.y)).toBeLessThanOrEqual(2);
    expect(yes!.x + yes!.width).toBeLessThanOrEqual(next!.x + 1);
    expect(yes!.height).toBeGreaterThanOrEqual(44);
    expect(next!.height).toBeGreaterThanOrEqual(44);
  });
});

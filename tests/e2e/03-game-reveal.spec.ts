import { test, expect, type Page } from '@playwright/test';

/**
 * The game reveal must stay honest:
 * - fewer than 3 real votes on a matchup: score fallback, no percentage, no "crowd";
 * - 3+ real votes: genuine preference percentages, winner = crowd majority;
 * - ties stay neutral.
 *
 * Every context below is a separate browser identity, so each pick is a real
 * stored vote on the same pair (the deck is deterministic for a listing set).
 */

const score = (page: Page, side: 'left' | 'right') =>
  page.locator(`.card-wrap[data-card-position="${side}"] .result-score > span`).first();

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

async function pickOnFreshPage(browserContextPage: Page, side: 'left' | 'right') {
  await browserContextPage.goto('/');
  const card = browserContextPage.locator(`.card-wrap[data-card-position="${side}"] button.qc`);
  await expect(card).toBeVisible();
  const ariaName = await card.getAttribute('aria-label');
  await card.click();
  await expect(browserContextPage.locator('.reveal')).toHaveCount(2);
  return ariaName ?? '';
}

test.describe('game reveal modes', () => {
  // Exact crowd percentages pin the real stored votes; retrying would add more.
  test.describe.configure({ mode: 'serial', retries: 0 });
  test.setTimeout(120_000);

  test('score fallback below 3 votes, crowd percentages at 3+, neutral ties', async ({ browser, page }) => {
    const stamp = Date.now();
    await page.goto('/');
    await createListing(page, `E2E Reveal A ${stamp}`, 9);
    await createListing(page, `E2E Reveal B ${stamp}`, 4);

    // ── context 1: first real vote on the pair → score fallback ──
    const ctx1 = await browser.newContext();
    const page1 = await ctx1.newPage();
    const leftAria = await pickOnFreshPage(page1, 'left');
    await expect(page1.locator('.reveal .pct')).toHaveCount(0);
    expect((await page1.locator('.reveal').allTextContents()).join(' ')).not.toContain('%');
    const labels1 = await page1.locator('.reveal .lab').allTextContents();
    expect(labels1).toHaveLength(2);
    expect(labels1.every(label => /score/i.test(label))).toBe(true);
    expect(labels1.join(' ')).not.toMatch(/crowd|tied vote/i);
    const names = await page1.locator('.card-wrap[data-card-position="left"] .qc-name').textContent();

    // Score fallback picks the higher listed score as the winner.
    const leftScore = Number(await score(page1, 'left').textContent());
    const rightScore = Number(await score(page1, 'right').textContent());
    if (Number.isFinite(leftScore) && Number.isFinite(rightScore) && leftScore !== rightScore) {
      const winner = leftScore > rightScore ? 'left' : 'right';
      await expect(page1.locator(`.card-wrap[data-card-position="${winner}"] .reveal`)).toHaveClass(/\bwin\b/);
      await expect(page1.locator(`.card-wrap[data-card-position="${winner === 'left' ? 'right' : 'left'}"] .reveal`)).toHaveClass(/\blose\b/);
    }
    await ctx1.close();

    // ── context 2: second real vote → still score fallback ──
    const ctx2 = await browser.newContext();
    const page2 = await ctx2.newPage();
    const rightAria = await pickOnFreshPage(page2, 'right');
    expect(leftAria).not.toBe(rightAria);
    expect(await page2.locator('.card-wrap[data-card-position="left"] .qc-name').textContent()).toBe(names);
    await expect(page2.locator('.reveal .pct')).toHaveCount(0);
    await ctx2.close();

    // ── context 3: third real vote → crowd mode, real percentages ──
    const ctx3 = await browser.newContext();
    const page3 = await ctx3.newPage();
    await pickOnFreshPage(page3, 'left');
    const leftPct = page3.locator('.card-wrap[data-card-position="left"] .reveal .pct');
    const rightPct = page3.locator('.card-wrap[data-card-position="right"] .reveal .pct');
    await expect(leftPct).toBeVisible();
    await expect(rightPct).toBeVisible();
    await expect(leftPct).toHaveText('66,7%');
    await expect(rightPct).toHaveText('33,3%');
    await expect(page3.locator('.card-wrap[data-card-position="left"] .reveal')).toHaveClass(/\bwin\b/);
    await expect(page3.locator('.card-wrap[data-card-position="right"] .reveal')).toHaveClass(/\blose\b/);
    await expect(page3.locator('.reveal .lab').first()).toHaveText('crowd vote');
    await ctx3.close();

    // ── context 4: fourth real vote ties the crowd 2-2 → neutral ──
    const ctx4 = await browser.newContext();
    const page4 = await ctx4.newPage();
    await pickOnFreshPage(page4, 'right');
    await expect(page4.locator('.card-wrap[data-card-position="left"] .reveal')).toHaveClass(/\btie\b/);
    await expect(page4.locator('.card-wrap[data-card-position="right"] .reveal')).toHaveClass(/\btie\b/);
    await expect(page4.locator('.reveal .pct').first()).toHaveText('50,0%');
    await expect(page4.locator('.reveal .lab').first()).toHaveText('tied vote');
    await ctx4.close();
  });
});

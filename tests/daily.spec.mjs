import { test, expect } from '@playwright/test';

// Wyzwanie dnia, statystyki, awatary i kolory drużyn.

const playDaily = async (page, offsets) => {
  await page.click('#btn-daily');
  for (let i = 0; i < 10; i++) {
    await page.evaluate((o) => dial.set(Math.max(0, Math.min(100, state.target + o))), offsets[i] || 0);
    await page.click('#btn-confirm');
    await page.click('#btn-next');
  }
};

test('wyzwanie dnia: ten sam zestaw dla wszystkich danego dnia, inny następnego dnia', async ({ browser }) => {
  const rounds = async (iso) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.clock.setFixedTime(new Date(iso));
    await page.goto('/');
    await page.click('#btn-daily');
    const r = await page.evaluate(() => state.game.rounds.map((x) => `${x.left}|${x.right}|${x.clue}`));
    await ctx.close();
    return r;
  };
  const a = await rounds('2026-10-29T10:00:00');
  const b = await rounds('2026-10-29T21:30:00');
  const c = await rounds('2026-10-30T10:00:00');
  expect(a).toHaveLength(10);
  expect(b).toEqual(a);
  expect(c).not.toEqual(a);
});

test('wyzwanie dnia: zwykła szerokość pól, liczy się pierwsze podejście, wynik do udostępnienia', async ({ page }) => {
  test.setTimeout(90000); // dwa pełne wyzwania (20 rund)
  await page.clock.setFixedTime(new Date('2026-10-29T12:00:00'));
  await page.addInitScript(() => localStorage.setItem('krag.settings', JSON.stringify({ difficulty: 'hard' })));
  await page.goto('/');
  await page.click('#btn-daily');
  expect(await page.evaluate(() => BAND)).toBe(4);
  await page.click('#btn-home');
  await page.click('#btn-resume-drop');
  // 4 trafienia w środek, reszta 3 pkt
  await playDaily(page, [0, 0, 0, 0, 5, 5, 5, 5, 5, 5]);
  const score = await page.evaluate(() => state.game.score);
  await expect(page.locator('#end-text')).toContainText('Twój wynik dnia');
  await expect(page.locator('#btn-share')).toBeVisible();
  const text = await page.evaluate(() => dailyShareText());
  expect(text.split('\n')[0]).toBe(`Krąg obfitości – wyzwanie dnia 29.10.2026: ${score}/40 pkt`);
  expect(text.split('\n')[1]).toMatch(/^[🟥🟧🟨⬛]{10}$/u);
  // drugie podejście to trening
  await page.click('#btn-menu');
  await expect(page.locator('#daily-desc')).toContainText(`Dziś: ${score}/40 pkt`);
  await playDaily(page, []);
  await expect(page.locator('#end-text')).toContainText(`liczy się pierwsze podejście dnia (${score} pkt)`);
  expect(await page.evaluate(() => Stats.daily.get('2026-10-29').score)).toBe(score);
});

test('wyzwanie dnia: seria kolejnych dni', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-10-29T12:00:00'));
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.setItem('krag.daily', JSON.stringify({ '2026-10-26': { score: 20, pts: [] }, '2026-10-27': { score: 30, pts: [] }, '2026-10-28': { score: 25, pts: [] } }));
  });
  expect(await page.evaluate(() => [Stats.daily.streak(), Stats.daily.best()])).toEqual([3, 30]);
  await page.evaluate(() => localStorage.setItem('krag.daily', JSON.stringify({ '2026-10-25': { score: 20, pts: [] }, '2026-10-27': { score: 30, pts: [] } })));
  expect(await page.evaluate(() => Stats.daily.streak())).toBe(0);
});

test('statystyki: rundy, celność, najlepsza wyrocznia i ulubione kategorie', async ({ page }) => {
  await page.goto('/');
  await page.click('#btn-teams');
  await page.fill('#team-a-players', 'Ania, Bartek');
  await page.fill('#team-b-players', 'Celina');
  await page.click('#btn-start-teams');
  await page.click('#btn-cats-start');
  // 4 tury: Ania (środek), Celina (pudło), Bartek (środek), Celina (środek) – Ania i Bartek mają po 1 rundzie
  for (const hit of [true, false, true, true]) {
    await page.click('#btn-psychic-ready');
    await page.click('#btn-hide');
    await page.evaluate((h) => dial.set(h ? state.target : (state.target > 50 ? 0 : 100)), hit);
    await page.click('#btn-confirm');
    await page.click('#btn-left');
    await page.click('#btn-next');
  }
  const s = await page.evaluate(() => Stats.summary());
  expect(s.rounds).toBe(4);
  expect(s.centrePct).toBe(75);
  expect(s.missPct).toBe(25);
  expect(s.bestOracle).toBeNull(); // nikt nie ma jeszcze 3 rund jako wyrocznia
  await page.click('#btn-home');
  await page.click('#btn-stats');
  await expect(page.locator('#stats-grid .stat').first()).toBeVisible();
  await expect(page.locator('#stats-grid')).toContainText('75%');
  await expect(page.locator('#stats-grid')).toContainText('Liczy się od 3 rund');
  // czyszczenie wymaga potwierdzenia
  await page.click('#btn-stats-clear');
  await expect(page.locator('#btn-stats-clear')).toContainText('Na pewno');
  await page.click('#btn-stats-clear');
  expect(await page.evaluate(() => Stats.summary().rounds)).toBe(0);
});

test('statystyki: najlepsza wyrocznia od 3 rund', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    for (let i = 0; i < 3; i++) Stats.round({ pts: 4, centre: true, cat: 'music', oracle: 'Ania' });
    for (let i = 0; i < 3; i++) Stats.round({ pts: 2, centre: false, cat: 'general', oracle: 'Bartek' });
    Stats.round({ pts: 3, centre: false, cat: 'music', oracle: 'Celina' });
  });
  const s = await page.evaluate(() => Stats.summary());
  expect(s.bestOracle).toMatchObject({ name: 'Ania', rounds: 3, avg: 4 });
  expect(s.favCats[0]).toEqual({ id: 'music', n: 4 });
});

test('drużyny: awatary i kolory do wyboru, zapamiętane, widoczne w grze i na dużym ekranie', async ({ context }) => {
  const page = await context.newPage();
  const tvPage = await context.newPage();
  await page.goto('/');
  await tvPage.goto('/tv.html?local=1');
  await page.click('#btn-teams');
  await expect(page.locator('#team-a-avatar')).toHaveText('🦊');
  await page.click('#team-a-avatar');
  await expect(page.locator('#team-a-avatar')).toHaveText('🐸'); // 🐼 ma druga drużyna – pomijamy
  await page.click('#team-a-color');
  await page.click('#team-a-color'); // turkusowy → (różowy zajęty) żółty → zielony
  const colorA = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--team-a').trim());
  expect(colorA).toBe('#6ee36e');
  await page.fill('#team-a-name', 'Lisy');
  await page.click('#btn-start-teams');
  await page.click('#btn-cats-start');
  await expect(page.locator('#pass-chip')).toHaveText('Tura: 🐸 Lisy');
  await page.click('#btn-psychic-ready');
  await expect(page.locator('#scores .team-a span')).toHaveText('🐸 Lisy');
  await expect.poll(() => tvPage.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--team-a').trim())).toBe('#6ee36e');
  await expect(tvPage.locator('#tv-scores .team-a span')).toHaveText('🐸 Lisy');
  // przy następnej grze ustawienia drużyn są zapamiętane
  await page.click('#btn-home');
  await page.reload();
  await page.click('#btn-teams');
  await expect(page.locator('#team-a-name')).toHaveValue('Lisy');
  await expect(page.locator('#team-a-avatar')).toHaveText('🐸');
});

import { test, expect } from '@playwright/test';
import { fits, dialogFits } from './fit.mjs';

// Wersja angielska (dłuższe napisy) też mieści się bez przewijania: menu, ustawienia, zasady, tura z najdłuższymi
// kartami i podpowiedzią, koniec gry, statystyki, własne talie.
test.use({ locale: 'en-US' });

for (const [w, h, look] of [
  [320, 568, {}], [360, 640, {}], [390, 844, { bigText: true }], [430, 932, {}],
  [568, 320, {}], [844, 390, { bigText: true }], [768, 1024, {}], [1366, 768, { theme: 'light' }],
]) {
  test(`po angielsku mieści się bez przewijania: ${w}×${h} ${JSON.stringify(look)}`, async ({ page }) => {
    await page.addInitScript((l) => { if (!sessionStorage.getItem('set')) { localStorage.setItem('krag.settings', JSON.stringify(l)); sessionStorage.setItem('set', '1'); } }, look);
    await page.setViewportSize({ width: w, height: h });
    await page.goto('/');
    expect(await page.evaluate(() => LANG)).toBe('en');
    await fits(page, 'menu');
    await page.click('#btn-settings');
    await fits(page, 'settings');
    await page.click('#btn-settings-done');
    await page.click('#btn-rules');
    for (const t of ['basics', 'teams', 'coop', 'clues']) {
      await page.click(`.tab[data-tab=${t}]`);
      await fits(page, `rules ${t}`);
    }
    await page.click('#btn-keys');
    await dialogFits(page, 'keyboard shortcuts');
    await page.keyboard.press('Escape');
    await page.click('#screen-rules .back');
    await page.click('#btn-teams');
    await fits(page, 'teams setup');
    await page.fill('#team-a-players', 'Alexandra Longsurname, Benjamin');
    await page.fill('#team-b-players', 'Chloe');
    await page.click('#btn-start-teams');
    await fits(page, 'categories');
    await page.click('#btn-cats-start');
    await fits(page, 'pass');
    await page.click('#btn-psychic-ready');
    await page.evaluate(() => {
      const all = CATEGORIES.flatMap((c) => c.cards.map((k) => ({ left: k[0], right: k[1], examples: k[2] || [] })));
      all.sort((a, b) => (b.left + b.right).length - (a.left + a.right).length);
      state.choices = [all[0], all[1]];
      psychicPhase();
    });
    await page.click('#btn-hint');
    await fits(page, 'oracle with hint');
    await page.fill('#clue-input', 'A rather long clue from the Oracle');
    await page.click('#btn-hide');
    await fits(page, 'guess');
    await page.click('#btn-confirm');
    await fits(page, 'left/right');
    await page.click('#btn-left');
    await fits(page, 'reveal');
    await page.evaluate(() => { state.game.winner = 0; endGame(); });
    await fits(page, 'end');
    await page.click('#btn-menu');
    await page.click('#btn-stats');
    await fits(page, 'stats');
    await page.click('#screen-stats .back');
    await page.click('#btn-decks');
    await fits(page, 'decks');
    await page.click('#btn-deck-new');
    await page.click('#btn-card-new');
    await fits(page, 'card');
  });
}

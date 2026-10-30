import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// Dostępność: automatyczne sprawdzenie WCAG 2.2 AA (axe-core) na wszystkich ekranach, gra samą klawiaturą,
// okna (fokus, Esc, niedostępne tło), zakładki zasad, opisy dla czytników ekranu.

test.use({ reducedMotion: 'reduce' }); // bez animacji przejść – kontrast mierzony na gotowym ekranie

async function axe(page, label) {
  const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
  expect(r.violations.map((v) => `${label}: ${v.id} – ${v.nodes.map((n) => n.target.join(' ')).slice(0, 3).join(' | ')}`)).toEqual([]);
}

for (const [locale, theme] of [['pl-PL', 'dark'], ['pl-PL', 'light'], ['pl-PL', 'contrast'], ['en-US', 'dark']]) {
  test(`WCAG 2.2 AA (axe-core): ${locale}, motyw ${theme}`, async ({ browser }) => {
    test.setTimeout(90000);
    const ctx = await browser.newContext({ locale, reducedMotion: 'reduce' });
    await ctx.addInitScript((t) => {
      if (!sessionStorage.getItem('t')) { localStorage.setItem('krag.settings', JSON.stringify({ theme: t })); sessionStorage.setItem('t', '1'); }
    }, theme);
    const page = await ctx.newPage();
    await page.goto('/');
    await axe(page, 'menu');
    await page.click('#btn-settings'); await axe(page, 'ustawienia'); await page.click('#btn-settings-done');
    await page.click('#btn-rules'); await axe(page, 'zasady'); await page.click('#screen-rules .back');
    await page.click('#btn-stats'); await axe(page, 'statystyki'); await page.click('#screen-stats .back');
    await page.click('#btn-tv'); await axe(page, 'duży ekran'); await page.click('#btn-tv-close');
    await page.click('#btn-teams'); await axe(page, 'drużyny');
    await page.fill('#team-a-players', 'Ania, Bartek');
    await page.fill('#team-b-players', 'Celina');
    await page.click('#btn-start-teams'); await axe(page, 'kategorie');
    await page.click('#btn-cats-start'); await axe(page, 'przekazanie');
    await page.click('#btn-psychic-ready'); await page.click('#btn-hint'); await axe(page, 'wyrocznia');
    await page.click('#btn-hide'); await axe(page, 'zgadywanie');
    await page.click('#btn-confirm'); await axe(page, 'lewo/prawo');
    await page.click('#btn-left'); await axe(page, 'odsłonięcie');
    await page.evaluate(() => { state.game.winner = 0; endGame(); }); await axe(page, 'koniec');
    await page.click('#btn-menu');
    await page.click('#btn-decks'); await axe(page, 'talie');
    await page.click('#btn-deck-new'); await page.fill('#deck-name', 'Test');
    await page.click('#btn-card-new'); await page.fill('#card-left', 'A'); await page.fill('#card-right', 'B'); await axe(page, 'karta');
    await page.click('#btn-card-save'); await axe(page, 'talia');
    await page.evaluate(() => { KragNet.qrSvg = async () => '<svg viewBox="0 0 10 10"></svg>'; });
    await page.click('#btn-deck-share'); await axe(page, 'udostępnianie');
    await ctx.close();
  });
}

test('klawiatura: runda jednoosobowa bez myszy, opis położenia wskazówki', async ({ page }) => {
  await page.goto('/');
  await page.focus('#btn-solo');
  await page.keyboard.press('Enter');
  await expect(page.locator('#screen-cats h2')).toBeFocused();
  await page.focus('#btn-cats-start');
  await page.keyboard.press('Enter');
  const range = page.locator('#dial-range');
  await expect(range).toBeFocused();
  const card = await page.evaluate(() => state.card);
  await expect(range).toHaveAttribute('aria-label', `Wskazówka na skali: ${card.left} ↔ ${card.right}`);
  await page.keyboard.press('Shift+ArrowRight');
  await page.keyboard.press('Shift+ArrowRight');
  await page.keyboard.press('PageUp');
  expect(await page.evaluate(() => dial.value)).toBe(70);
  await expect(range).toHaveAttribute('aria-valuetext', `70 – bliżej: ${card.right}`);
  await page.keyboard.press('ArrowLeft');
  expect(await page.evaluate(() => dial.value)).toBe(69.5);
  await page.keyboard.press('Enter'); // Enter na suwaku – „Sprawdź”
  await expect(page.locator('#result')).toBeVisible();
  await expect(page.locator('#target-desc')).toContainText('Cel:');
  await expect(page.locator('#btn-next')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(range).toBeFocused();
  expect(await page.evaluate(() => state.game.index)).toBe(1);
});

test('klawiatura: tura drużyn – wybór karty 1/2, hasło, Enter, „P” jak prawo', async ({ page }) => {
  await page.goto('/');
  await page.click('#btn-teams');
  await page.fill('#team-a-players', 'Ania');
  await page.fill('#team-b-players', 'Bartek');
  await page.click('#btn-start-teams');
  await page.click('#btn-cats-start');
  await expect(page.locator('#pass-title')).toBeFocused();
  await page.keyboard.press('Enter'); // Enter na ekranie przekazania – „Jestem wyrocznią”
  await expect(page.locator('#card-choice .choice[data-i="0"]')).toBeFocused();
  await expect(page.locator('#target-desc')).toContainText('Cel na tej skali:');
  await page.keyboard.press('2');
  await expect(page.locator('#card-choice .choice[data-i="1"]')).toHaveAttribute('aria-pressed', 'true');
  expect(await page.evaluate(() => state.card === state.choices[1])).toBe(true);
  await page.focus('#clue-input');
  await page.keyboard.type('herbata');
  await page.keyboard.press('Enter');
  await expect(page.locator('#dial-range')).toBeFocused();
  await expect(page.locator('#target-desc')).toHaveText('');
  await page.keyboard.press('Enter');
  await expect(page.locator('#btn-left')).toBeFocused();
  await page.keyboard.press('p');
  expect(await page.evaluate(() => [state.phase, state.lr])).toEqual(['reveal', 'R']);
});

test('okna: fokus w oknie, tło niedostępne, Esc zamyka i oddaje fokus', async ({ page }) => {
  await page.goto('/');
  await page.focus('#btn-tv');
  await page.keyboard.press('Enter');
  await expect(page.locator('#tv-dialog')).toBeVisible();
  expect(await page.evaluate(() => [document.querySelector('#tv-dialog').contains(document.activeElement), $('#screen-menu').inert, document.querySelector('header').inert]))
    .toEqual([true, true, true]);
  await page.keyboard.press('Escape');
  await expect(page.locator('#tv-dialog')).toBeHidden();
  await expect(page.locator('#btn-tv')).toBeFocused();
  expect(await page.evaluate(() => $('#screen-menu').inert)).toBe(false);
  // lista skrótów klawiszem „?”
  await page.keyboard.press('?');
  await expect(page.locator('#deck-dialog-title')).toHaveText('Skróty klawiszowe');
  await expect(page.locator('.keys dt')).toHaveCount(7);
  await page.keyboard.press('Escape');
  await expect(page.locator('#deck-dialog')).toBeHidden();
});

test('zakładki zasad: strzałki, Home i End; stan dla czytników', async ({ page }) => {
  await page.goto('/');
  await page.click('#btn-rules');
  await page.focus('#tab-basics');
  await expect(page.locator('#tab-basics')).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('#tab-teams')).toBeFocused();
  await expect(page.locator('#tab-teams')).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('#page-teams')).toBeVisible();
  await expect(page.locator('#page-basics')).toBeHidden();
  await page.keyboard.press('End');
  await expect(page.locator('#tab-clues')).toBeFocused();
  await page.keyboard.press('ArrowRight'); // z ostatniej na pierwszą
  await expect(page.locator('#tab-basics')).toBeFocused();
  expect(await page.evaluate(() => [...document.querySelectorAll('#screen-rules .tab')].map((t) => t.tabIndex))).toEqual([0, -1, -1, -1]);
});

test('czytnik ekranu: nazwy kategorii z liczbą kart, kart do wyboru i wierszy talii', async ({ page }) => {
  await page.goto('/');
  await page.click('#btn-teams');
  await page.click('#btn-start-teams');
  await expect(page.locator('#cats .chip[data-cat="music"]')).toHaveAccessibleName(/^Muzyka ?, kart: \d+$/);
  await page.click('#btn-cats-start');
  await page.click('#btn-psychic-ready');
  const c = await page.evaluate(() => state.choices[0]);
  await expect(page.locator('#card-choice .choice[data-i="0"]')).toHaveAccessibleName(`${c.left} – ${c.right}`);
});

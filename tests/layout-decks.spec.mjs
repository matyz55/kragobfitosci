import { test, expect } from '@playwright/test';
import { VIEWPORTS, fits, dialogFits } from './fit.mjs';

// Ekrany własnych talii też mieszczą się bez przewijania: najwięcej talii (8), najdłuższa talia (60 kart, strony),
// długie nazwy i końce skali, okna udostępniania i wklejania linku, kategorie z ośmioma taliami.
const DECKS = Array.from({ length: 8 }, (_, i) => ({
  id: `talia${i}`,
  name: i === 0 ? 'Bardzo długa nazwa talii xyz' : `Talia ${i + 1}`,
  icon: '⭐',
  cards: Array.from({ length: i === 0 ? 60 : 3 }, (_, j) => [`Lewy koniec długiej karty ${j}`, `Prawy koniec długiej karty ${j}`, [[`Hasło ${j}`, (j * 7) % 100]]]),
}));

for (const [w, h] of VIEWPORTS) {
  test(`własne talie mieszczą się bez przewijania: ${w}×${h}`, async ({ page }) => {
    await page.addInitScript((d) => {
      if (!sessionStorage.getItem('seeded')) { localStorage.setItem('krag.decks', JSON.stringify(d)); sessionStorage.setItem('seeded', '1'); }
    }, DECKS);
    await page.setViewportSize({ width: w, height: h });
    await page.goto('/');
    // kod QR rysujemy na miejscu (bez biblioteki z sieci)
    await page.evaluate(() => { KragNet.qrSvg = async () => '<svg viewBox="0 0 10 10"><rect width="10" height="10"/></svg>'; });
    await page.click('#btn-decks');
    await fits(page, 'lista talii');
    await page.click('#decks-list .deck-row >> nth=0');
    await fits(page, 'talia z 60 kartami');
    // duży ekran mieści całą talię, mniejszy – stronami
    if (await page.locator('#deck-pager').isVisible()) {
      await page.click('#btn-deck-next');
      await fits(page, 'talia – druga strona');
    } else expect(await page.locator('#deck-cards .card-row').count()).toBe(60);
    await page.click('#deck-cards .card-row >> nth=0');
    await fits(page, 'karta');
    await page.click('#btn-card-cancel');
    await page.click('#btn-deck-share');
    await expect(page.locator('.share-qr svg')).toBeVisible();
    await dialogFits(page, 'udostępnianie');
    await page.click('#btn-deck-dialog-close');
    await page.click('#btn-deck-done');
    await page.click('#btn-deck-paste');
    await dialogFits(page, 'wklejanie linku');
    await page.click('#btn-deck-dialog-close');
    await page.click('#btn-decks-back');
    await page.click('#btn-teams');
    await page.click('#btn-start-teams');
    await page.click('#btn-cats-all');
    await expect(page.locator('#cats .chip')).toHaveCount(30); // 22 kategorie + 8 talii
    await fits(page, 'kategorie z ośmioma taliami');
    // pusta lista i nowa karta
    await page.evaluate(() => { localStorage.setItem('krag.decks', '[]'); });
    await page.reload();
    await page.click('#btn-decks');
    await expect(page.locator('#decks-empty')).toBeVisible();
    await fits(page, 'pusta lista talii');
    await page.click('#btn-deck-new');
    await fits(page, 'nowa talia');
    await page.click('#btn-card-new');
    await fits(page, 'nowa karta');
    // propozycja dodania talii z linku
    const link = await page.evaluate(() => deckLink({ name: 'Talia od znajomych z długą nazwą', icon: '🎉', cards: [['Pierwsza karta z długim lewym końcem', 'I długim prawym końcem'], ['B', 'C'], ['D', 'E'], ['F', 'G']] }));
    await page.goto(link);
    await expect(page.locator('#btn-import-add')).toBeVisible();
    await dialogFits(page, 'talia z linku');
  });
}

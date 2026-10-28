import { test, expect } from '@playwright/test';

// Duży ekran na tym samym urządzeniu (BroadcastChannel): dwie karty w jednej przeglądarce.
// ?local=1 – duży ekran nie tworzy pokoju sieciowego (testy bez internetu).

test('duży ekran pokazuje grę, a cel dopiero po odsłonięciu', async ({ context }) => {
  const phone = await context.newPage();
  const tvPage = await context.newPage();
  const errors = [];
  for (const p of [phone, tvPage]) p.on('pageerror', (e) => errors.push(e.message));
  // wszystko, co dociera do dużego ekranu
  await tvPage.addInitScript(() => {
    window.__got = [];
    const ch = new BroadcastChannel('krag-tv');
    ch.onmessage = (e) => window.__got.push(e.data);
  });
  await phone.goto('/');
  await tvPage.goto('/tv.html?local=1');
  await expect(tvPage.locator('#tv-ov-text')).toContainText('Wybierzcie tryb');

  await phone.click('#btn-teams');
  await phone.fill('#team-a-players', 'Ania, Bartek');
  await phone.fill('#team-b-players', 'Celina');
  await phone.click('#btn-start-teams');
  await phone.click('#btn-cats-start');
  await expect(tvPage.locator('#tv-ov-title')).toHaveText('Psychik: Ania');

  await phone.click('#btn-psychic-ready');
  const card = await phone.evaluate(() => state.card);
  await expect(tvPage.locator('#tv-left')).toHaveText(card.left);
  await expect(tvPage.locator('#tv-status')).toContainText('Ania patrzy na cel');
  // telefon psychika pokazuje cel, duży ekran – nie
  await expect(phone.locator('#dial .band')).not.toHaveCount(0);
  await expect(tvPage.locator('#tv-dial .band')).toHaveCount(0);

  await phone.fill('#clue-input', 'herbata');
  await phone.click('#btn-hide');
  await expect(tvPage.locator('#tv-clue')).toContainText('herbata');
  await phone.locator('#dial-range').fill('20');
  await expect.poll(() => tvPage.evaluate(() => dialApi.value)).toBe(20);
  await phone.click('#btn-confirm');
  await expect(tvPage.locator('#tv-status')).toContainText('na lewo czy na prawo');
  await expect(tvPage.locator('#tv-dial .band')).toHaveCount(0);

  // żadna wiadomość przed odsłonięciem nie zawierała położenia celu
  const leaked = await tvPage.evaluate(() => window.__got.filter((m) => m.t === 'state' && 'target' in m).length);
  expect(leaked).toBe(0);

  await phone.click('#btn-left');
  await expect(tvPage.locator('#tv-dial .band-center')).toHaveCount(1);
  await expect(tvPage.locator('#tv-result')).toBeVisible();
  const target = await phone.evaluate(() => state.target);
  expect(await tvPage.evaluate(() => tv.last.target)).toBe(target);

  await phone.evaluate(() => { state.game.winner = 0; endGame(); });
  await expect(tvPage.locator('#tv-ov-title')).toHaveText('Wygrywa „Drużyna A”!');
  expect(errors).toEqual([]);
});

test('duży ekran otwarty później dostaje bieżący stan (hello)', async ({ context }) => {
  const phone = await context.newPage();
  await phone.goto('/');
  await phone.click('#btn-solo');
  await phone.click('#btn-cats-start');
  const tvPage = await context.newPage();
  await tvPage.goto('/tv.html?local=1');
  const clue = await phone.evaluate(() => state.clue);
  await expect(tvPage.locator('#tv-clue')).toContainText(clue);
});

test('okno łączenia z dużym ekranem', async ({ page }) => {
  await page.goto('/');
  await page.click('#btn-tv');
  await expect(page.locator('#tv-dialog')).toBeVisible();
  await expect(page.locator('#tv-url')).toContainText('tv.html');
  await page.fill('#tv-code', 'AB');
  await page.click('#btn-tv-connect');
  await expect(page.locator('#tv-status')).toContainText('4 znaki');
  await page.click('#btn-tv-close');
  await expect(page.locator('#tv-dialog')).toBeHidden();
});

import { test, expect } from '@playwright/test';

// Ustawienia (motyw, tekst, trudność, minutnik, podpowiedzi) i wznawianie przerwanej gry.

async function setOption(page, name, value) {
  await page.click('#btn-settings');
  await page.locator(`#settings-form input[name="${name}"][value="${value}"]`).check();
  await page.click('#btn-settings-done');
}

async function startTeams(page) {
  await page.click('#btn-teams');
  await page.fill('#team-a-players', 'Ania, Bartek');
  await page.fill('#team-b-players', 'Celina');
  await page.click('#btn-start-teams');
  await page.click('#btn-cats-start');
}

test('motyw i wielkość tekstu – zmiana od razu i po ponownym otwarciu', async ({ page }) => {
  await page.goto('/');
  expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe('dark');
  await setOption(page, 'theme', 'light');
  expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe('light');
  await setOption(page, 'bigText', '1');
  await page.reload();
  expect(await page.evaluate(() => [document.documentElement.dataset.theme, document.documentElement.classList.contains('big-text')]))
    .toEqual(['light', true]);
  await setOption(page, 'theme', 'contrast');
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(bg).toBe('rgb(0, 0, 0)');
});

test('poziom trudności zmienia szerokość pól celu', async ({ page }) => {
  await page.goto('/');
  for (const [level, band] of [['hard', 2.8], ['easy', 5.5], ['normal', 4]]) {
    await setOption(page, 'difficulty', level);
    await startTeams(page);
    expect(await page.evaluate(() => BAND)).toBe(band);
    // na granicy środka (pół pola) nadal 4 pkt, tuż za nią – 3
    expect(await page.evaluate((b) => [scoreFor(50 + b / 2, 50), scoreFor(50 + b / 2 + 0.01, 50)], band)).toEqual([4, 3]);
    await page.click('#btn-home');
  }
});

test('minutnik narady: odliczanie, cykanie i koniec czasu', async ({ page }) => {
  // zegar zatrzymany – czas płynie tylko w runFor (wynik nie zależy od obciążenia komputera)
  await page.clock.install({ time: new Date('2026-10-30T10:00:00') });
  await page.clock.pauseAt(new Date('2026-10-30T10:00:01'));
  await page.goto('/');
  await setOption(page, 'timer', '30');
  await startTeams(page);
  await page.click('#btn-psychic-ready');
  await expect(page.locator('#timer')).toBeHidden();
  await page.click('#btn-hide');
  await expect(page.locator('#timer')).toBeVisible();
  await expect(page.locator('#timer-left')).toHaveText('0:30');
  await page.clock.runFor(22000);
  await expect(page.locator('#timer')).toHaveClass(/urgent/);
  await page.clock.runFor(9000);
  await expect(page.locator('#timer')).toHaveClass(/over/);
  await expect(page.locator('#status')).toContainText('Czas minął');
  // po zatwierdzeniu minutnik znika
  await page.click('#btn-confirm');
  await expect(page.locator('#timer')).toBeHidden();
});

test('minutnik wyłączony domyślnie i w grze jednoosobowej', async ({ page }) => {
  await page.goto('/');
  await setOption(page, 'timer', '60');
  await page.click('#btn-solo');
  await page.click('#btn-cats-start');
  await expect(page.locator('#timer')).toBeHidden();
});

test('podpowiedź dla wyroczni: przykładowe hasło najbliższe celowi', async ({ page }) => {
  await page.goto('/');
  await startTeams(page);
  await page.evaluate(() => {
    state.choices = [
      { left: 'Zimne', right: 'Gorące', examples: [['Lody', 8], ['Lawa', 98]], cat: 'general' },
      { left: 'Nudny', right: 'Ciekawy', examples: [], cat: 'general' },
    ];
    state.target = 97;
  });
  await page.click('#btn-psychic-ready');
  await page.click('#btn-hint');
  await expect(page.locator('#hint-box')).toHaveText('Pasuje np. „Lawa”.');
  // druga karta nie ma przykładów
  await page.click('#card-choice .choice[data-i="1"]');
  await expect(page.locator('#hint-box')).toBeHidden();
  await page.click('#btn-hint');
  await expect(page.locator('#hint-box')).toContainText('nie ma przykładowych haseł');
  // podpowiedzi można wyłączyć
  await page.click('#btn-home');
  await setOption(page, 'hints', '0');
  await page.click('#btn-resume');
  await page.click('#btn-psychic-ready');
  await expect(page.locator('#btn-hint')).toBeHidden();
});

test('wznawianie: zgadywanie po odświeżeniu – to samo hasło, wynik i położenie wskazówki', async ({ page }) => {
  await page.goto('/');
  await startTeams(page);
  await page.click('#btn-psychic-ready');
  await page.fill('#clue-input', 'herbata');
  await page.click('#btn-hide');
  await page.evaluate(() => { dial.set(30, true); saveGame(); });
  const before = await page.evaluate(() => ({ card: state.card, target: state.target, scores: state.game.teams.map((t) => t.score) }));
  await page.reload();
  await expect(page.locator('#resume-box')).toBeVisible();
  await expect(page.locator('#resume-info')).toContainText(/Drużyna A 0 : 1 .*Drużyna B/);
  await page.click('#btn-resume');
  await expect(page.locator('#clue-box')).toContainText('herbata');
  expect(await page.evaluate(() => ({ card: state.card, target: state.target, scores: state.game.teams.map((t) => t.score) }))).toEqual(before);
  expect(await page.evaluate(() => [state.phase, dial.value, document.querySelector('#dial-range').disabled])).toEqual(['guess', 30, false]);
  await expect(page.locator('#spec-left')).toHaveText(before.card.left);
});

test('wznawianie: po odsłonięciu punkty nie liczą się drugi raz', async ({ page }) => {
  await page.goto('/');
  await startTeams(page);
  await page.click('#btn-psychic-ready');
  await page.click('#btn-hide');
  await page.evaluate(() => dial.set(state.target));
  await page.click('#btn-confirm');
  await page.click('#btn-left');
  const scores = await page.evaluate(() => state.game.teams.map((t) => t.score));
  expect(scores[0]).toBe(4);
  await page.reload();
  await page.click('#btn-resume');
  await expect(page.locator('#result')).toContainText('4 pkt');
  await expect(page.locator('#dial .band.hit')).toHaveCount(1);
  expect(await page.evaluate(() => state.game.teams.map((t) => t.score))).toEqual(scores);
  await expect(page.locator('#dial-range')).toBeDisabled();
  await page.click('#btn-next');
  await expect(page.locator('#pass-title')).toContainText('Wyrocznia: Celina');
});

test('wznawianie: przerwanie u wyroczni wraca do ekranu przekazania (cel się nie pokazuje)', async ({ page }) => {
  await page.goto('/');
  await startTeams(page);
  await page.click('#btn-psychic-ready');
  const target = await page.evaluate(() => state.target);
  await page.reload();
  await page.click('#btn-resume');
  await expect(page.locator('#screen-pass')).toBeVisible();
  await expect(page.locator('#dial .band')).toHaveCount(0);
  await page.click('#btn-psychic-ready');
  expect(await page.evaluate(() => state.target)).toBe(target);
});

test('wznawianie: menu w trakcie gry, porzucenie i koniec gry', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#resume-box')).toBeHidden();
  await page.click('#btn-solo');
  await page.click('#btn-cats-start');
  await page.click('#btn-home');
  await expect(page.locator('#resume-box')).toBeVisible();
  await expect(page.locator('#resume-info')).toContainText('Jeden gracz · runda 1/10');
  await page.click('#btn-resume-drop');
  await expect(page.locator('#resume-box')).toBeHidden();
  expect(await page.evaluate(() => localStorage.getItem('krag.save'))).toBeNull();
  // koniec gry kasuje zapis
  await page.click('#btn-solo');
  await page.click('#btn-cats-start');
  for (let i = 0; i < 10; i++) { await page.click('#btn-confirm'); await page.click('#btn-next'); }
  await expect(page.locator('#screen-end')).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('krag.save'))).toBeNull();
  await page.click('#btn-menu');
  await expect(page.locator('#resume-box')).toBeHidden();
});

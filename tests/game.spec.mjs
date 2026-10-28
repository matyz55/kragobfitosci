import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.errors = errors;
  await page.goto('/');
});

test.afterEach(async ({ page }) => {
  expect(page.errors).toEqual([]);
});

test('punktacja 4/3/2/0, granica pola daje lepszy wynik', async ({ page }) => {
  const r = await page.evaluate(() => [scoreFor(50, 50), scoreFor(52, 50), scoreFor(52.5, 50), scoreFor(56, 50),
    scoreFor(57, 50), scoreFor(60, 50), scoreFor(61, 50), scoreFor(50, 50, 3)]);
  expect(r).toEqual([4, 4, 3, 3, 2, 2, 0, 3]);
});

test('lewo/prawo', async ({ page }) => {
  const r = await page.evaluate(() => [leftRightCorrect('L', 60, 40), leftRightCorrect('R', 60, 40), leftRightCorrect('R', 30, 40)]);
  expect(r).toEqual([true, false, true]);
});

test('karty: każda ma dwa końce, przykłady mieszczą się na skali', async ({ page }) => {
  const bad = await page.evaluate(() => {
    const out = [];
    for (const c of CATEGORIES) for (const k of c.cards) {
      if (typeof k[0] !== 'string' || typeof k[1] !== 'string' || !k[0] || !k[1]) out.push(k);
      for (const ex of k[2] || []) if (!(ex[1] >= 0 && ex[1] <= 100)) out.push(ex);
    }
    return out;
  });
  expect(bad).toEqual([]);
  const ids = await page.evaluate(() => CATEGORIES.map((c) => c.id));
  expect(ids).toEqual(expect.arrayContaining(['general', 'music']));
});

test('drużyny: druga drużyna zaczyna z 1 pkt, zmiana tury i dodatkowa tura przy stracie', async ({ page }) => {
  const r = await page.evaluate(() => {
    const g = newTeamGame([{ name: 'A', players: ['a1', 'a2'] }, { name: 'B', players: ['b1'] }], 10);
    const start = g.teams.map((t) => t.score);
    finishTeamTurn(g, 0, 50, 'R'); // A pudło, B trafia lewo/prawo
    const after1 = [g.teams[0].score, g.teams[1].score, g.active];
    finishTeamTurn(g, 50, 50, 'L'); // B 4 pkt, prowadzi – zmiana tury
    const after2 = [g.teams[0].score, g.teams[1].score, g.active];
    const res = finishTeamTurn(g, 50, 50, null); // A 4 pkt, ale wciąż przegrywa 4:6 – dodatkowa tura
    return { start, after1, after2, extra: res.extra, active: g.active, psychic: psychicOf(g.teams[0]) };
  });
  expect(r.start).toEqual([0, 1]);
  expect(r.after1).toEqual([0, 2, 1]);
  expect(r.after2).toEqual([0, 6, 0]);
  expect(r.extra).toBe(true);
  expect(r.active).toBe(0);
  expect(r.psychic).toBe('a1'); // trzecia tura drużyny A – psychik wraca do pierwszego gracza
});

test('drużyny: remis przy progu – dogrywka', async ({ page }) => {
  const r = await page.evaluate(() => {
    const g = newTeamGame([{ name: 'A', players: [] }, { name: 'B', players: [] }], 5);
    g.teams[0].score = 2; g.teams[1].score = 5; g.active = 0;
    finishTeamTurn(g, 50, 50, null); // A: 4 pkt → 6:5? nie – 2+4 = 6, wygrywa A
    const w1 = g.winner;
    const h = newTeamGame([{ name: 'A', players: [] }, { name: 'B', players: [] }], 5);
    h.teams[0].score = 2; h.teams[1].score = 5; h.active = 0;
    finishTeamTurn(h, 55, 50, 'R'); // A: 3 pkt → 5:5 remis
    const sd = !!h.suddenDeath && h.winner == null;
    finishTeamTurn(h, 50, 50, null); // B w dogrywce 4 pkt
    finishTeamTurn(h, 0, 50, 'R'); // A pudło, B +1
    return { w1, sd, w2: h.winner };
  });
  expect(r.w1).toBe(0);
  expect(r.sd).toBe(true);
  expect(r.w2).toBe(1);
});

test('współpraca: środek daje 3 pkt i dodatkową kartę', async ({ page }) => {
  const r = await page.evaluate(() => {
    const g = newCoopGame(['a', 'b'], 2);
    const a = finishCoopTurn(g, 50, 50);
    const left1 = g.cardsLeft;
    finishCoopTurn(g, 0, 50);
    finishCoopTurn(g, 0, 50);
    return { a, left1, done: g.done, score: g.score, rank: coopRank(16) };
  });
  expect(r.a).toEqual({ pts: 3, bonus: true });
  expect(r.left1).toBe(2);
  expect(r.done).toBe(true);
  expect(r.score).toBe(3);
  expect(r.rank).toContain('Wygrana');
});

test('jeden gracz: 10 rund i podsumowanie', async ({ page }) => {
  await page.click('#btn-solo');
  for (let i = 0; i < 10; i++) {
    await expect(page.locator('#clue-box')).toBeVisible();
    await page.evaluate(() => dial.set(state.target));
    await page.click('#btn-confirm');
    await expect(page.locator('#result')).toContainText('4 pkt');
    await page.click('#btn-next');
  }
  await expect(page.locator('#end-title')).toHaveText('40 / 40 pkt');
  await expect(page.locator('#end-text')).toHaveText('Nowy rekord!');
});

test('dwie drużyny: pełna tura w interfejsie', async ({ page }) => {
  await page.click('#btn-teams');
  await page.fill('#team-a-players', 'Ania, Bartek');
  await page.fill('#team-b-players', 'Celina');
  await page.click('#btn-start-teams');
  await expect(page.locator('#pass-title')).toHaveText('Psychik: Ania');
  await page.click('#btn-psychic-ready');
  await expect(page.locator('#dial .band-center')).toHaveCount(1);
  await page.click('#card-choice .choice[data-i="1"]');
  const card = await page.evaluate(() => state.choices[1]);
  await expect(page.locator('#spec-left')).toHaveText(card.left);
  await page.fill('#clue-input', 'herbata');
  await page.click('#btn-hide');
  await expect(page.locator('#dial .band')).toHaveCount(0);
  await expect(page.locator('#clue-box')).toContainText('herbata');
  await page.evaluate(() => dial.set(state.target > 50 ? 0 : 100));
  await page.click('#btn-confirm');
  const side = await page.evaluate(() => (state.target < dial.value ? 'left' : 'right'));
  await page.click(`#btn-${side}`);
  await expect(page.locator('#result')).toContainText('+1 pkt');
  await expect(page.locator('#scores .team-b b')).toHaveText('2');
  await page.click('#btn-next');
  await expect(page.locator('#pass-title')).toHaveText('Psychik: Celina');
});

test('współpraca: wymaga dwóch graczy, potem gra do końca talii', async ({ page }) => {
  await page.click('#btn-coop');
  await page.fill('#coop-players', 'Ania');
  await page.click('#btn-start-coop');
  await expect(page.locator('#coop-error')).toBeVisible();
  await page.fill('#coop-players', 'Ania, Bartek');
  await page.selectOption('#coop-cards', '5');
  await page.click('#btn-start-coop');
  for (let i = 0; i < 5; i++) {
    await page.click('#btn-psychic-ready');
    await page.click('#btn-hide');
    await page.evaluate(() => dial.set(state.target > 50 ? 0 : 100));
    await page.click('#btn-confirm');
    await page.click('#btn-next');
  }
  await expect(page.locator('#end-title')).toHaveText('0 pkt');
});

test('kategorie: wybór zapamiętany, co najmniej jedna zostaje', async ({ page }) => {
  for (const id of ['general', 'movies', 'food', 'sport', 'science', 'poland', 'games']) await page.click(`.chip[data-cat=${id}]`);
  await page.click('.chip[data-cat=music]'); // ostatniej nie da się wyłączyć
  await page.reload();
  const on = await page.$$eval('.chip.on', (x) => x.map((y) => y.dataset.cat));
  expect(on).toEqual(['music']);
  await page.click('#btn-solo');
  const cats = await page.evaluate(() => [...new Set(state.game.rounds.map((r) => r.cat))]);
  expect(cats).toEqual(['music']);
});

test('tarcza reaguje na przeciąganie', async ({ page }) => {
  await page.click('#btn-solo');
  const box = await page.locator('#dial').boundingBox();
  // lewy dolny róg tarczy → okolice 0
  await page.mouse.move(box.x + box.width * 0.08, box.y + box.height * 0.9);
  await page.mouse.down();
  await page.mouse.up();
  expect(await page.evaluate(() => dial.value)).toBeLessThan(10);
});

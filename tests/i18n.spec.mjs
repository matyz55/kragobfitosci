import { test, expect } from '@playwright/test';

// Wersja angielska: wybór języka, napisy strony, angielskie karty, wyzwanie dnia i duży ekran w tym samym języku.

const POLISH = /[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/;

// polskie litery na stronie poza nazwą gry (marka) i celowo polskimi napisami przy wyborze języka
const polishLeft = (page) => page.evaluate(() => {
  const out = [];
  // napis na tarczy to nazwa gry (grafika), a „Polski” i „Język” przy wyborze języka są celowo po polsku
  const ok = (el) => el.closest('[lang="pl"]') || el.closest('.seg-hint') || el.closest('svg');
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = w.nextNode(); n; n = w.nextNode()) {
    const t = n.nodeValue.replace(/Krąg obfitości|Krąg|obfitości/g, '');
    if (/[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/.test(t) && !ok(n.parentElement)) out.push(n.nodeValue.trim());
  }
  for (const el of document.querySelectorAll('[placeholder], [aria-label], [title]')) {
    for (const a of ['placeholder', 'aria-label', 'title']) {
      const v = (el.getAttribute(a) || '').replace(/Krąg obfitości/g, '');
      if (/[ąćęłńóśźż]/i.test(v)) out.push(`${a}: ${v}`);
    }
  }
  return out;
});

test.describe('angielska przeglądarka', () => {
  test.use({ locale: 'en-US' });

  test('interfejs i karty po angielsku, bez polskich napisów', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('/');
    expect(await page.evaluate(() => [LANG, document.documentElement.lang])).toEqual(['en', 'en']);
    await expect(page.locator('#btn-solo')).toContainText('Solo');
    await expect(page.locator('#btn-lang')).toHaveText('Polski');
    expect(await polishLeft(page)).toEqual([]);
    await page.click('#btn-teams');
    await expect(page.locator('#team-a-name')).toHaveValue('Team A');
    await page.fill('#team-a-players', 'Anna, Ben');
    await page.fill('#team-b-players', 'Chloe');
    await page.click('#btn-start-teams');
    await expect(page.locator('#cats .chip').first()).toContainText('General');
    await expect(page.locator('#cats .chip')).toHaveCount(21); // bez „Polskich klimatów”
    await page.click('#btn-cats-start');
    await expect(page.locator('#pass-title')).toHaveText('Oracle: Anna');
    await page.click('#btn-psychic-ready');
    const card = await page.evaluate(() => state.card);
    expect(POLISH.test(card.left + card.right)).toBe(false);
    await page.fill('#clue-input', 'Tea');
    await page.click('#btn-hide');
    await expect(page.locator('#clue-box')).toContainText('“Tea”');
    await page.click('#btn-confirm');
    await expect(page.locator('#btn-left')).toHaveText('◀ Left');
    await page.click('#btn-left');
    await expect(page.locator('#result')).toContainText('pts');
    expect(await polishLeft(page)).toEqual([]);
    await page.click('#btn-home');
    await page.click('#btn-rules');
    await expect(page.locator('#page-basics')).toContainText('Each card is a scale between opposites');
    expect(errors).toEqual([]);
  });

  test('angielskie karty: każda kategoria grywalna osobno, bez powtórzeń i polskich liter', async ({ page }) => {
    await page.goto('/');
    const r = await page.evaluate(() => {
      const seen = new Set(), dup = [], small = [], pl = [], ids = [];
      for (const c of CARDS_EN) {
        ids.push(c.id);
        const hasla = c.cards.reduce((n, k) => n + (k[2] || []).length, 0);
        if (c.cards.length < 32 || hasla < 15) small.push(`${c.id}: ${c.cards.length} kart, ${hasla} haseł`);
        for (const k of c.cards) {
          const key = `${k[0]}|${k[1]}`.toLowerCase();
          if (seen.has(key)) dup.push(key);
          seen.add(key);
          for (const t of [k[0], k[1], ...(k[2] || []).map((e) => e[0])]) if (/[ąćęłńóśźżĄĆĘŁŃÓŚŹŻЀ-ӿ]/.test(t)) pl.push(t);
          for (const e of k[2] || []) if (!(e[1] >= 0 && e[1] <= 100)) pl.push(`pozycja ${e}`);
        }
      }
      const plIds = CARDS_PL.map((c) => c.id).filter((id) => id !== 'poland');
      return { small, dup, pl, sameIds: JSON.stringify(ids) === JSON.stringify(plIds) };
    });
    expect(r).toEqual({ small: [], dup: [], pl: [], sameIds: true });
  });

  test('wyzwanie dnia po angielsku: inny zestaw niż po polsku, data po angielsku w wyniku', async ({ page }) => {
    await page.clock.setFixedTime(new Date('2026-10-29T12:00:00'));
    await page.goto('/');
    await page.click('#btn-daily');
    const en = await page.evaluate(() => state.game.rounds.map((x) => x.clue));
    expect(en.some((c) => POLISH.test(c))).toBe(false);
    for (let i = 0; i < 10; i++) { await page.click('#btn-confirm'); await page.click('#btn-next'); }
    const text = await page.evaluate(() => dailyShareText());
    expect(text.split('\n')[0]).toMatch(/^Krąg obfitości – daily challenge Oct 29, 2026: \d+\/40 pts$/);
  });

  test('duży ekran przełącza się na język telefonu', async ({ context }) => {
    const phone = await context.newPage();
    const tvPage = await context.newPage();
    await tvPage.goto('/tv.html?local=1&lang=pl');
    expect(await tvPage.evaluate(() => LANG)).toBe('pl');
    await phone.goto('/');
    await phone.click('#btn-solo');
    await phone.click('#btn-cats-start');
    await expect.poll(() => tvPage.evaluate(() => LANG).catch(() => null)).toBe('en');
    await expect(tvPage.locator('#tv-status')).toHaveText('Where on this scale is the clue?');
  });
});

test('polska przeglądarka: po polsku; zmiana języka w ustawieniach i w menu zostaje zapamiętana', async ({ page }) => {
  await page.goto('/');
  expect(await page.evaluate(() => LANG)).toBe('pl');
  await expect(page.locator('#btn-lang')).toHaveText('English');
  await page.click('#btn-settings');
  const nav = page.waitForEvent('load');
  await page.locator('#settings-form input[name="lang"][value="en"]').click();
  await nav;
  await expect(page.locator('#btn-settings')).toContainText('Settings');
  expect(await page.evaluate(() => [LANG, JSON.parse(localStorage.getItem('krag.settings')).lang])).toEqual(['en', 'en']);
  await page.reload();
  expect(await page.evaluate(() => LANG)).toBe('en');
  // szybki przełącznik w menu
  await page.click('#btn-lang');
  await expect(page.locator('#btn-settings')).toContainText('Ustawienia');
  expect(await page.evaluate(() => LANG)).toBe('pl');
});

test('angielski u polskiego gracza: wybrane „Polskie klimaty” wracają po powrocie do polskiego', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => { settings.cats = ['poland', 'music']; saveSettings(); });
  let nav = page.waitForEvent('load');
  await page.evaluate(() => { setTimeout(() => setLang('en'), 0); });
  await nav;
  expect(await page.evaluate(() => [LANG, activeCats(), settings.cats.includes('poland')])).toEqual(['en', ['music'], true]);
  await page.click('#btn-solo');
  await expect(page.locator('#cats .chip.on')).toHaveCount(1);
  await page.click('#btn-home');
  nav = page.waitForEvent('load');
  await page.click('#btn-lang');
  await nav;
  expect(await page.evaluate(() => [LANG, activeCats().sort()])).toEqual(['pl', ['music', 'poland']]);
});

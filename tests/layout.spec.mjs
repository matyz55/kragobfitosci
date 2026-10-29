import { test, expect } from '@playwright/test';
import { VIEWPORTS, fits } from './fit.mjs';

for (const [w, h] of VIEWPORTS) {
  test(`mieści się bez przewijania: ${w}×${h}`, async ({ page }) => {
    page.on('dialog', (d) => d.accept());
    await page.setViewportSize({ width: w, height: h });
    await page.goto('/');
    await fits(page, 'menu');
    await page.click('#btn-rules');
    for (const t of ['basics', 'teams', 'coop', 'clues']) {
      await page.click(`.tab[data-tab=${t}]`);
      await fits(page, `zasady ${t}`);
    }
    await page.click('#screen-rules .back');
    await page.click('#btn-settings');
    await fits(page, 'ustawienia');
    await page.click('#btn-install');
    await fits(page, 'instalacja');
    await page.click('#btn-install-close');
    await page.click('#btn-settings-done');
    await page.click('#btn-tv');
    await fits(page, 'duży ekran – okno');
    await page.click('#btn-tv-close');

    await page.click('#btn-solo');
    await fits(page, 'kategorie');
    await page.click('#btn-cats-start');
    await fits(page, 'solo');
    await page.click('#btn-confirm');
    await fits(page, 'solo – wynik');
    await page.click('#btn-home');
    await expect(page.locator('#resume-box')).toBeVisible();
    await fits(page, 'menu z przerwaną grą');

    await page.click('#btn-teams');
    await fits(page, 'ustawienia drużyn');
    await page.fill('#team-a-players', 'Aleksandra Długonazwiskowa, Bartłomiej');
    await page.fill('#team-b-players', 'Celina');
    await page.click('#btn-start-teams');
    await fits(page, 'kategorie – drużyny');
    await page.click('#btn-cats-start');
    await fits(page, 'przekazanie');
    await page.click('#btn-psychic-ready');
    // najdłuższe karty, żeby sprawdzić zawijanie
    await page.evaluate(() => {
      const all = CATEGORIES.flatMap((c) => c.cards.map((k) => ({ left: k[0], right: k[1], examples: [] })));
      all.sort((a, b) => (b.left + b.right).length - (a.left + a.right).length);
      state.choices = [all[0], all[1]];
      psychicPhase();
    });
    await fits(page, 'wyrocznia');
    const dialH = await page.evaluate(() => document.querySelector('#dial').getBoundingClientRect().height);
    expect(dialH, 'wysokość tarczy').toBeGreaterThan(90);
    await page.fill('#clue-input', 'Bardzo długie hasło wyroczni');
    await page.click('#btn-hide');
    await fits(page, 'zgadywanie');
    await page.click('#btn-confirm');
    await fits(page, 'lewo/prawo');
    await page.click('#btn-left');
    await fits(page, 'odkrycie');
    await page.evaluate(() => { state.game.winner = 0; endGame(); });
    await fits(page, 'koniec');
    await page.click('#btn-menu');

    await page.click('#btn-coop');
    await fits(page, 'ustawienia współpracy');
    await page.click('#screen-setup-coop .back');
    await page.click('#btn-stats');
    await fits(page, 'statystyki');
    await page.click('#screen-stats .back');
    await page.click('#btn-daily');
    await page.evaluate(() => { state.game.index = 9; state.history = [4, 3, 2, 0, 4, 3, 2, 0, 4].map((p) => ({ pts: p, centre: p === 4 })); });
    await page.click('#btn-confirm');
    await page.click('#btn-next');
    await expect(page.locator('#btn-share')).toBeVisible();
    await fits(page, 'koniec wyzwania dnia');
  });
}

// sam duży ekran: telewizory i monitory
for (const [w, h] of [[1280, 720], [1920, 1080], [3840, 2160], [1366, 768], [1024, 768]]) {
  test(`duży ekran mieści się: ${w}×${h}`, async ({ context }) => {
    const phone = await context.newPage();
    const tvPage = await context.newPage();
    await tvPage.setViewportSize({ width: w, height: h });
    await tvPage.goto('/tv.html?local=1');
    const over = () => tvPage.evaluate(() => {
      const out = [];
      for (const el of document.querySelectorAll('body *')) {
        if (!el.getClientRects().length || el.closest('.fx, .bg')) continue;
        const r = el.getBoundingClientRect();
        if (r.width && r.height && (r.bottom > innerHeight + 1 || r.right > innerWidth + 1)) out.push(`${el.tagName}#${el.id}.${el.className?.baseVal ?? el.className}`);
      }
      return out.slice(0, 6);
    });
    expect(await over()).toEqual([]);
    await phone.goto('/');
    await phone.click('#btn-teams');
    await phone.fill('#team-a-name', 'Bardzo długa nazwa drużyny');
    await phone.click('#btn-start-teams');
    await phone.click('#btn-cats-start');
    await phone.click('#btn-psychic-ready');
    await phone.evaluate(() => {
      const all = CATEGORIES.flatMap((c) => c.cards.map((k) => ({ left: k[0], right: k[1] })));
      all.sort((a, b) => (b.left + b.right).length - (a.left + a.right).length);
      state.choices = [all[0], all[1]];
      psychicPhase();
    });
    await phone.fill('#clue-input', 'Długie hasło wyroczni');
    await phone.click('#btn-hide');
    await phone.click('#btn-confirm');
    await phone.click('#btn-left');
    await expect(tvPage.locator('#tv-result')).toBeVisible();
    expect(await over()).toEqual([]);
  });
}

// duży tekst, motywy i minutnik na najmniejszych ekranach
for (const [w, h, look] of [
  [320, 568, { bigText: true, timer: 60 }],
  [360, 640, { bigText: true, theme: 'contrast', timer: 90 }],
  [390, 844, { bigText: true, theme: 'light', timer: 60 }],
  [667, 375, { bigText: true, timer: 60 }],
  [568, 320, { bigText: true, theme: 'light', timer: 30 }],
  [1366, 768, { bigText: true, theme: 'contrast', timer: 120 }],
]) {
  test(`mieści się z ustawieniami ${JSON.stringify(look)}: ${w}×${h}`, async ({ page }) => {
    await page.addInitScript((l) => { if (!sessionStorage.getItem('set')) { localStorage.setItem('krag.settings', JSON.stringify(l)); sessionStorage.setItem('set', '1'); } }, look);
    await page.setViewportSize({ width: w, height: h });
    await page.goto('/');
    await fits(page, 'menu');
    await page.click('#btn-settings');
    await fits(page, 'ustawienia');
    await page.click('#btn-settings-done');
    await page.click('#btn-teams');
    await fits(page, 'ustawienia drużyn');
    await page.fill('#team-a-players', 'Aleksandra Długonazwiskowa, Bartłomiej');
    await page.click('#btn-start-teams');
    await fits(page, 'kategorie');
    await page.click('#btn-cats-start');
    await fits(page, 'przekazanie');
    await page.click('#btn-psychic-ready');
    await page.evaluate(() => {
      const all = CATEGORIES.flatMap((c) => c.cards.map((k) => ({ left: k[0], right: k[1], examples: k[2] || [] })));
      all.sort((a, b) => (b.left + b.right).length - (a.left + a.right).length);
      state.choices = [all[0], all[1]];
      psychicPhase();
    });
    await page.click('#btn-hint');
    await fits(page, 'wyrocznia z podpowiedzią');
    await page.fill('#clue-input', 'Bardzo długie hasło wyroczni');
    await page.click('#btn-hide');
    await expect(page.locator('#timer')).toBeVisible();
    await fits(page, 'zgadywanie z minutnikiem');
    await page.click('#btn-confirm');
    await page.click('#btn-left');
    await fits(page, 'odkrycie');
    await page.evaluate(() => { state.game.winner = 0; endGame(); });
    await fits(page, 'koniec');
    await page.click('#btn-menu');
    await page.click('#btn-solo');
    await page.click('#btn-cats-start');
    await page.click('#btn-home');
    await fits(page, 'menu z przerwaną grą');
  });
}

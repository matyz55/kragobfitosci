import { test, expect } from '@playwright/test';

// Gra ma się mieścić w oknie bez przewijania – na telefonach (pionowo i poziomo), tabletach i komputerach.
const VIEWPORTS = [
  [320, 568], [360, 640], [375, 667], [390, 844], [430, 932], [412, 915],
  [480, 800], [540, 720], [600, 960], [568, 320], [667, 375], [844, 390], [932, 430],
  [768, 1024], [1024, 768], [820, 1180], [1280, 720], [1366, 768], [1920, 1080],
];

// Sprawdza, że strona się nie przewija i że żaden widoczny element nie wystaje poza okno.
async function fits(page, label) {
  const bad = await page.evaluate(() => {
    const out = [];
    const W = window.innerWidth, H = window.innerHeight;
    const se = document.scrollingElement;
    if (se.scrollHeight > H + 1 || se.scrollWidth > W + 1) out.push(`strona ${se.scrollWidth}x${se.scrollHeight}`);
    const scr = [...document.querySelectorAll('.screen')].find((s) => !s.classList.contains('hidden'));
    const els = [scr, ...scr.querySelectorAll('*')];
    for (const el of els) {
      if (!el.getClientRects().length) continue;
      if (el.closest('.rules')) continue; // treść zasad mierzymy niżej (pole z treścią)
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      if (r.bottom > H + 1 || r.right > W + 1 || r.left < -1 || r.top < -1) {
        out.push(`${el.tagName}#${el.id}.${el.className?.baseVal ?? el.className} ${Math.round(r.left)},${Math.round(r.top)}–${Math.round(r.right)},${Math.round(r.bottom)}`);
      }
    }
    const rules = scr.querySelector('.rules');
    if (rules && rules.scrollHeight > rules.clientHeight + 1) out.push(`zasady ${rules.scrollHeight}>${rules.clientHeight}`);
    // elementy przewijane wewnątrz (np. lista kategorii) też nie mogą się przewijać
    for (const el of els) if (el.scrollHeight > el.clientHeight + 1 && getComputedStyle(el).overflowY !== 'visible' && el.tagName !== 'INPUT') out.push(`przewijanie w ${el.tagName}.${el.className}`);
    // napisy na przyciskach nie mogą być ucięte
    for (const b of scr.querySelectorAll('button')) if (b.getClientRects().length && b.scrollWidth > b.clientWidth + 1) out.push(`ucięty przycisk: ${b.innerText}`);
    return out.slice(0, 8);
  });
  expect(bad, label).toEqual([]);
}

for (const [w, h] of VIEWPORTS) {
  test(`mieści się bez przewijania: ${w}×${h}`, async ({ page }) => {
    page.on('dialog', (d) => d.accept());
    await page.setViewportSize({ width: w, height: h });
    await page.goto('/');
    await fits(page, 'menu');
    await page.click('#btn-cats');
    await fits(page, 'kategorie');
    await page.click('#screen-cats .back');
    await page.click('#btn-rules');
    for (const t of ['basics', 'teams', 'coop', 'clues']) {
      await page.click(`.tab[data-tab=${t}]`);
      await fits(page, `zasady ${t}`);
    }
    await page.click('#screen-rules .back');
    await page.click('#btn-install');
    await fits(page, 'instalacja');
    await page.click('#btn-install-close');

    await page.click('#btn-solo');
    await fits(page, 'solo');
    await page.click('#btn-confirm');
    await fits(page, 'solo – wynik');
    await page.click('#btn-home');

    await page.click('#btn-teams');
    await fits(page, 'ustawienia drużyn');
    await page.fill('#team-a-players', 'Aleksandra Długonazwiskowa, Bartłomiej');
    await page.fill('#team-b-players', 'Celina');
    await page.click('#btn-start-teams');
    await fits(page, 'przekazanie');
    await page.click('#btn-psychic-ready');
    // najdłuższe karty, żeby sprawdzić zawijanie
    await page.evaluate(() => {
      const all = CATEGORIES.flatMap((c) => c.cards.map((k) => ({ left: k[0], right: k[1], examples: [] })));
      all.sort((a, b) => (b.left + b.right).length - (a.left + a.right).length);
      state.choices = [all[0], all[1]];
      psychicPhase();
    });
    await fits(page, 'psychik');
    const dialH = await page.evaluate(() => document.querySelector('#dial').getBoundingClientRect().height);
    expect(dialH, 'wysokość tarczy').toBeGreaterThan(90);
    await page.fill('#clue-input', 'Bardzo długie hasło psychika');
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
  });
}

import { expect } from '@playwright/test';

// Gra ma się mieścić w oknie bez przewijania – na telefonach (pionowo i poziomo), tabletach i komputerach.
export const VIEWPORTS = [
  [320, 568], [360, 640], [375, 667], [390, 844], [430, 932], [412, 915],
  [480, 800], [540, 720], [600, 960], [568, 320], [667, 375], [844, 390], [932, 430],
  [768, 1024], [1024, 768], [820, 1180], [1280, 720], [1366, 768], [1920, 1080],
];

// Sprawdza, że strona się nie przewija i że żaden widoczny element nie wystaje poza okno.
export async function fits(page, label) {
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
      if (el.closest('.sr-only')) continue; // tekst tylko dla czytników ekranu jest celowo poza widokiem
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      if (r.bottom > H + 1 || r.right > W + 1 || r.left < -1 || r.top < -1) {
        out.push(`${el.tagName}#${el.id}.${el.className?.baseVal ?? el.className} ${Math.round(r.left)},${Math.round(r.top)}–${Math.round(r.right)},${Math.round(r.bottom)}`);
      }
    }
    const rules = scr.querySelector('.rules');
    if (rules && rules.scrollHeight > rules.clientHeight + 1) out.push(`zasady ${rules.scrollHeight}>${rules.clientHeight}`);
    // elementy przewijane wewnątrz (np. lista kategorii) też nie mogą się przewijać
    for (const el of els) {
      if (el.closest('.sr-only') || el.tagName === 'INPUT') continue; // tekst tylko dla czytników ekranu jest celowo ukryty
      if (el.scrollHeight > el.clientHeight + 1 && getComputedStyle(el).overflowY !== 'visible') out.push(`przewijanie w ${el.tagName}.${el.className}`);
    }
    // napisy na przyciskach nie mogą być ucięte
    for (const b of scr.querySelectorAll('button')) {
      if (b.getClientRects().length && (b.scrollWidth > b.clientWidth + 1 || b.scrollHeight > b.clientHeight + 1)) out.push(`ucięty przycisk: ${b.innerText}`);
    }
    // kolejne bloki ekranu nie mogą na siebie nachodzić (ani ich zawartość)
    const blocks = [...scr.children].filter((c) => c.getClientRects().length);
    for (let i = 1; i < blocks.length; i++) {
      const prev = blocks[i - 1], cur = blocks[i];
      const bottom = Math.max(prev.getBoundingClientRect().bottom, ...[...prev.querySelectorAll('*')].filter((x) => x.getClientRects().length).map((x) => x.getBoundingClientRect().bottom));
      const top = cur.getBoundingClientRect().top;
      const sameRow = Math.abs(prev.getBoundingClientRect().top - top) < 2;
      if (!sameRow && getComputedStyle(scr).display === 'flex' && bottom > top + 1) out.push(`nachodzi: ${prev.className || prev.id} na ${cur.className || cur.id}`);
    }
    return out.slice(0, 8);
  });
  expect(bad, label).toEqual([]);
}

// Otwarte okno (np. udostępnianie talii) mieści się w ekranie, a napisy na jego przyciskach nie są ucięte.
export async function dialogFits(page, label) {
  const bad = await page.evaluate(() => {
    const d = [...document.querySelectorAll('.overlay')].find((o) => !o.classList.contains('hidden'));
    if (!d) return ['brak okna'];
    const out = [];
    for (const el of [d, ...d.querySelectorAll('*')]) {
      if (!el.getClientRects().length) continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      if (r.bottom > innerHeight + 1 || r.right > innerWidth + 1 || r.left < -1 || r.top < -1) out.push(`${el.tagName}.${el.className?.baseVal ?? el.className}`);
    }
    for (const b of d.querySelectorAll('button')) {
      if (b.getClientRects().length && (b.scrollWidth > b.clientWidth + 1 || b.scrollHeight > b.clientHeight + 1)) out.push(`ucięty przycisk: ${b.innerText}`);
    }
    return out.slice(0, 8);
  });
  expect(bad, label).toEqual([]);
}

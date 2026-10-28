import { test, expect } from '@playwright/test';

// Wibracje: zapisujemy wywołania navigator.vibrate zamiast prawdziwej wibracji.
test.use({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } });

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.__vib = [];
    Object.defineProperty(navigator, 'vibrate', { configurable: true, value: (p) => { window.__vib.push(p); return true; } });
  });
});

test('wskazówka „klika” na kreskach podziałki, mocniej na dłuższych i na końcu skali', async ({ page }) => {
  await page.goto('/');
  await page.click('#btn-solo');
  await page.click('#btn-cats-start');
  await page.evaluate(() => { window.__vib = []; });
  // przesuwanie suwakiem krok po kroku: 50 → 0
  for (let v = 49; v >= 0; v -= 1) {
    await page.locator('#dial-range').fill(String(v));
    await page.waitForTimeout(30);
  }
  const vib = await page.evaluate(() => window.__vib);
  expect(vib.length).toBeGreaterThanOrEqual(8); // 10 kresek po drodze (część może pominąć ogranicznik szybkości)
  expect(vib).toContain(7);
  expect(vib).toContain(14);
  expect(vib[vib.length - 1]).toBe(28); // koniec skali
});

test('wibracje przy wyniku i przełącznik obok dźwięku', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#btn-haptics')).toBeVisible();
  await page.click('#btn-solo');
  await page.click('#btn-cats-start');
  await page.evaluate(() => { dial.set(state.target, true); window.__vib = []; });
  await page.click('#btn-confirm');
  const vib = await page.evaluate(() => window.__vib);
  expect(vib).toContainEqual([40, 50, 40, 50, 120]); // 4 pkt
  // wyłączenie
  page.on('dialog', (d) => d.accept());
  await page.click('#btn-home');
  await page.click('#btn-haptics');
  await expect(page.locator('#btn-haptics')).toHaveClass(/off/);
  await expect(page.locator('#btn-haptics')).toHaveText('📴');
  await page.reload();
  await expect(page.locator('#btn-haptics')).toHaveClass(/off/);
  await page.click('#btn-solo');
  await page.click('#btn-cats-start');
  await page.evaluate(() => { window.__vib = []; });
  await page.locator('#dial-range').fill('10');
  await page.click('#btn-confirm');
  expect(await page.evaluate(() => window.__vib)).toEqual([]);
});

test('przycisk wibracji jest w górnym pasku obok dźwięku i wszystko mieści się na wąskim telefonie', async ({ page }) => {
  for (const [w, h] of [[320, 568], [360, 640], [390, 844]]) {
    await page.setViewportSize({ width: w, height: h });
    await page.goto('/');
    const ids = await page.$$eval('.top-btns button:not(.hidden)', (bs) => bs.map((b) => b.id));
    expect(ids.slice(0, 2)).toEqual(['btn-tv', 'btn-haptics']);
    expect(ids).toContain('btn-sound');
    expect(await page.locator('.menu-row #btn-haptics').count()).toBe(0);
    // w trakcie gry (z przyciskiem ✕) też się mieści
    await page.click('#btn-solo');
    const r = await page.evaluate(() => {
      const top = document.querySelector('.topbar');
      const els = [...top.querySelectorAll('h1, button:not(.hidden)')];
      const overlap = els.some((a, i) => els.slice(i + 1).some((b) => {
        const x = a.getBoundingClientRect(), y = b.getBoundingClientRect();
        return x.right > y.left + 1 && y.right > x.left + 1;
      }));
      return { right: Math.max(...els.map((e) => e.getBoundingClientRect().right)), scroll: document.scrollingElement.scrollWidth, overlap };
    });
    expect(r.right, `${w}px`).toBeLessThanOrEqual(w);
    expect(r.scroll, `${w}px`).toBeLessThanOrEqual(w);
    expect(r.overlap, `${w}px`).toBe(false);
  }
});

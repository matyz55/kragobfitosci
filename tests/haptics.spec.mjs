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

test('wibracje przy wyniku i przełącznik w menu', async ({ page }) => {
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
  await page.reload();
  await expect(page.locator('#btn-haptics')).toHaveClass(/off/);
  await page.click('#btn-solo');
  await page.click('#btn-cats-start');
  await page.evaluate(() => { window.__vib = []; });
  await page.locator('#dial-range').fill('10');
  await page.click('#btn-confirm');
  expect(await page.evaluate(() => window.__vib)).toEqual([]);
});

test('menu z przyciskiem wibracji mieści się na wąskim telefonie', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto('/');
  const bad = await page.$$eval('.menu-row button:not(.hidden)', (bs) => bs.filter((b) => b.scrollWidth > b.clientWidth + 1).map((b) => b.innerText));
  expect(bad).toEqual([]);
  const right = await page.$$eval('.menu-row button:not(.hidden)', (bs) => Math.max(...bs.map((b) => b.getBoundingClientRect().right)));
  expect(right).toBeLessThanOrEqual(320);
});

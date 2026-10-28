import { test, expect } from '@playwright/test';

// Polskie znaki muszą się rysować czcionkami gry, a nie zastępczą czcionką systemu.
// Sposób: ta sama litera z czcionką gry i dwiema różnymi czcionkami zapasowymi (monospace / serif).
// Jeśli czcionka gry ma znak, szerokość jest identyczna; jeśli nie ma – przeglądarka bierze znak z zapasowej
// i szerokości się różnią.
const CHARS = 'ąćęłńóśźżĄĆĘŁŃÓŚŹŻ„”–…';

for (const page_ of ['/', '/tv.html?local=1']) {
  test(`czcionki mają polskie znaki: ${page_}`, async ({ page }) => {
    await page.goto(page_);
    const missing = await page.evaluate(async (chars) => {
      const out = [];
      const cvs = document.createElement('canvas').getContext('2d');
      for (const [family, weight] of [['Baloo 2', 600], ['Nunito', 600], ['Nunito', 800]]) {
        await document.fonts.load(`${weight} 40px "${family}"`, chars);
        for (const ch of chars) {
          cvs.font = `${weight} 40px "${family}", monospace`;
          const a = cvs.measureText(ch).width;
          cvs.font = `${weight} 40px "${family}", serif`;
          const b = cvs.measureText(ch).width;
          if (Math.abs(a - b) > 0.01) out.push(`${family} ${weight}: ${ch}`);
        }
      }
      return out;
    }, CHARS);
    expect(missing).toEqual([]);
  });
}

test('nagłówki i przyciski używają czcionki z polskimi znakami', async ({ page }) => {
  await page.goto('/');
  const fams = await page.evaluate(() => [...new Set([...document.querySelectorAll('h1, h2, button')].map((e) => getComputedStyle(e).fontFamily.split(',')[0].trim()))]);
  expect(fams).toEqual(expect.arrayContaining(['"Baloo 2"']));
  expect(fams.join()).not.toContain('Fredoka');
});

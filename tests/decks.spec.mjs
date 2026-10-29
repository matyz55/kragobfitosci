import { test, expect } from '@playwright/test';

// Własne talie: edytor, zapis w telefonie, link i kod QR, dodawanie talii z linku, gra własną talią.

const CARDS = [['Ranny ptaszek', 'Nocny marek', 'Kasia', 85], ['Kot', 'Pies', 'Zosia', 20], ['Herbata', 'Kawa', '', 0]];

test.beforeEach(async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.errors = errors;
});

test.afterEach(async ({ page }) => {
  expect(page.errors).toEqual([]);
});

async function makeDeck(page, name, cards) {
  await page.click('#btn-decks');
  await page.click('#btn-deck-new');
  await page.fill('#deck-name', name);
  for (const [l, r, c, pos] of cards) {
    await page.click('#btn-card-new');
    await page.fill('#card-left', l);
    await page.fill('#card-right', r);
    if (c) {
      await page.fill('#card-clue', c);
      await page.evaluate((v) => Editor.dial.set(v, true), pos);
    }
    await page.click('#btn-card-save');
  }
  await page.click('#btn-deck-done');
}

// talia zapisana od razu w pamięci przeglądarki (bez klikania w edytorze)
const seedDecks = (page, decks) => page.addInitScript((d) => {
  if (!sessionStorage.getItem('seeded')) { localStorage.setItem('krag.decks', JSON.stringify(d)); sessionStorage.setItem('seeded', '1'); }
}, decks);

test('edytor: nowa talia zapisuje się w telefonie i od razu jest wybrana do gry', async ({ page }) => {
  await page.goto('/');
  await makeDeck(page, 'Nasza paczka', CARDS);
  await expect(page.locator('#decks-list .deck-row')).toHaveCount(1);
  await expect(page.locator('#decks-list .deck-row')).toContainText('Nasza paczka');
  await expect(page.locator('#decks-list .deck-row')).toContainText('kart: 3');
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('krag.decks')));
  expect(saved).toHaveLength(1);
  expect(saved[0].cards).toEqual([['Ranny ptaszek', 'Nocny marek', [['Kasia', 85]]], ['Kot', 'Pies', [['Zosia', 20]]], ['Herbata', 'Kawa']]);
  expect(await page.evaluate(() => settings.cats)).toEqual([`u:${saved[0].id}`]);
  await page.click('#decks-list .deck-row');
  await expect(page.locator('#deck-count')).toHaveText('Karty: 3/60 hasła: 2');
  await page.click('#btn-deck-done');
  // po ponownym otwarciu gry talia i wybór zostają
  await page.reload();
  await page.click('#btn-teams');
  await page.fill('#team-a-players', 'Ania');
  await page.fill('#team-b-players', 'Bartek');
  await page.click('#btn-start-teams');
  const first = page.locator('#cats .chip').first();
  await expect(first).toContainText('Nasza paczka');
  await expect(first).toHaveClass(/custom/);
  await expect(first).toHaveClass(/on/);
  await expect(page.locator('#cats .chip.on')).toHaveCount(1);
  await expect(page.locator('#cats-info')).toHaveText('kart: 3');
  await page.click('#btn-cats-start');
  await page.click('#btn-psychic-ready');
  const lefts = await page.evaluate(() => state.choices.map((c) => c.left));
  expect(lefts.every((l) => ['Ranny ptaszek', 'Kot', 'Herbata'].includes(l))).toBe(true);
  expect(new Set(lefts).size).toBe(2); // dwie różne karty
});

test('edytor: wymagane oba końce skali, poprawianie i usuwanie kart, usuwanie talii', async ({ page }) => {
  await page.goto('/');
  await page.click('#btn-decks');
  await expect(page.locator('#decks-empty')).toBeVisible();
  await page.click('#btn-deck-new');
  await expect(page.locator('#btn-deck-share')).toBeDisabled();
  await page.click('#btn-card-new');
  await page.click('#btn-card-save');
  await expect(page.locator('#card-error')).toBeVisible();
  await page.fill('#card-left', '  Lato  ');
  await page.click('#btn-card-save');
  await expect(page.locator('#card-error')).toBeVisible();
  await page.fill('#card-right', 'Zima');
  await expect(page.locator('#card-spec-right')).toHaveText('Zima');
  await page.click('#btn-card-save');
  await expect(page.locator('#deck-cards .card-row')).toHaveCount(1);
  await expect(page.locator('#deck-cards .card-row')).toHaveAttribute('aria-label', 'Lato – Zima');
  // poprawka karty i dopisanie hasła
  await page.click('#deck-cards .card-row');
  await expect(page.locator('#card-left')).toHaveValue('Lato');
  await page.fill('#card-right', 'Mroźna zima');
  await page.fill('#card-clue', 'Lipiec');
  await page.evaluate(() => Editor.dial.set(12, true));
  await page.click('#btn-card-save');
  await expect(page.locator('#deck-cards .card-row')).toHaveAttribute('aria-label', 'Lato – Mroźna zima, hasło: Lipiec');
  expect(await page.evaluate(() => Decks.list()[0].cards)).toEqual([['Lato', 'Mroźna zima', [['Lipiec', 12]]]]);
  // talia bez nazwy dostaje nazwę zastępczą i jest wybrana do gry
  expect(await page.evaluate(() => gameCategories()[0].name)).toBe('Moja talia');
  // usunięcie karty wymaga potwierdzenia
  await page.click('#deck-cards .card-row');
  await page.click('#btn-card-delete');
  await expect(page.locator('#btn-card-delete')).toHaveText('Na pewno?');
  await page.click('#btn-card-delete');
  await expect(page.locator('#deck-cards .card-row')).toHaveCount(0);
  // talia bez kart nie jest kategorią gry, a wybór wraca do wbudowanych kategorii
  expect(await page.evaluate(() => [gameCategories().some((c) => c.custom), settings.cats.length === CATEGORIES.length])).toEqual([false, true]);
  await page.fill('#deck-name', 'Pora roku');
  await page.click('#btn-deck-done');
  await expect(page.locator('#decks-list .deck-row')).toContainText('kart: 0');
  await page.click('#decks-list .deck-row');
  await page.click('#btn-deck-delete');
  await page.click('#btn-deck-delete');
  await expect(page.locator('#decks-empty')).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('krag.decks'))).toBe('[]');
  // pusta talia bez nazwy nie zostaje zapisana
  await page.click('#btn-deck-new');
  await page.click('#btn-deck-done');
  await expect(page.locator('#decks-empty')).toBeVisible();
});

test('link do talii: kodowanie bez strat, z kompresją i bez niej', async ({ page }) => {
  await page.goto('/');
  const r = await page.evaluate(async () => {
    const deck = { name: 'Zażółć gęślą jaźń', icon: '🏢', cards: [['Nudne zebranie', 'Świetny projekt', [['Raport kwartalny', 22.5]]], ['Biuro', 'Praca zdalna']] };
    const z = await encodeDeck(deck);
    const back = await decodeDeck(z);
    const CS = window.CompressionStream;
    window.CompressionStream = undefined;
    const j = await encodeDeck(deck);
    window.CompressionStream = CS;
    const backJ = await decodeDeck(j);
    const link = await deckLink(deck);
    return { z: z[0], j: j[0], back: [back.name, back.icon, back.cards], backJ: [backJ.name, backJ.icon, backJ.cards], code: deckCodeFrom(link) === z, link };
  });
  expect(r.z).toBe('z');
  expect(r.j).toBe('j');
  const expected = ['Zażółć gęślą jaźń', '🏢', [['Nudne zebranie', 'Świetny projekt', [['Raport kwartalny', 22.5]]], ['Biuro', 'Praca zdalna']]];
  expect(r.back).toEqual(expected);
  expect(r.backJ).toEqual(expected);
  expect(r.code).toBe(true);
  expect(r.link).toMatch(/^http:\/\/localhost:\d+\/#talia=z[A-Za-z0-9_-]+$/);
});

test('link od znajomych: propozycja dodania, zapis, wybór do gry, adres bez talii', async ({ browser }) => {
  const a = await (await browser.newContext()).newPage();
  await a.goto('/');
  const link = await a.evaluate(() => deckLink({ name: 'Firma', icon: '💼', cards: [['Poniedziałek', 'Piątek', [['Wypłata', 95]]], ['Kawa z automatu', 'Kawa z kawiarni']] }));
  const ctx = await browser.newContext();
  const b = await ctx.newPage();
  await b.goto(link);
  await expect(b.locator('#deck-dialog')).toBeVisible();
  await expect(b.locator('#deck-dialog-title')).toHaveText('Nowa talia: 💼 Firma');
  await expect(b.locator('.deck-preview li')).toHaveCount(2);
  expect(await b.evaluate(() => location.hash)).toBe('');
  await b.click('#btn-import-add');
  await expect(b.locator('#screen-decks')).toBeVisible();
  await expect(b.locator('#decks-list .deck-row.new')).toContainText('Firma');
  const r = await b.evaluate(() => [Decks.list().map((d) => [d.name, d.icon, d.cards.length]), settings.cats[0].startsWith('u:'), settings.cats.length]);
  expect(r).toEqual([[['Firma', '💼', 2]], true, 1]);
  // ten sam link drugi raz – talia już jest
  await b.goto(link);
  await expect(b.locator('#deck-dialog-title')).toHaveText('Masz już tę talię');
  await b.click('#deck-dialog-actions button');
  await expect(b.locator('#deck-dialog')).toBeHidden();
  expect(await b.evaluate(() => Decks.list().length)).toBe(1);
  // rezygnacja – nic się nie zapisuje
  const c = await (await browser.newContext()).newPage();
  await c.goto(link);
  await c.click('#deck-dialog-actions button.ghost');
  expect(await c.evaluate(() => localStorage.getItem('krag.decks'))).toBeNull();
});

test('link z błędem albo podróbką: komunikat, limity, tekst nigdy nie staje się kodem strony', async ({ page }) => {
  await page.goto('/#talia=zAAAAAAAAAAAAAAAAAAAAAAAAA');
  await expect(page.locator('#deck-dialog-title')).toHaveText('Nie da się otworzyć talii');
  await page.click('#deck-dialog-actions button');
  // ręcznie zrobiona talia: znaczniki HTML, za dużo kart, za długie teksty, błędne pola
  const code = await page.evaluate(() => {
    const cards = [];
    for (let i = 0; i < 70; i++) cards.push([`<b>Lewo ${i}</b>${'x'.repeat(40)}`, `Prawo ${i}`, [[`<img src=x onerror="window.hacked=1">`, 250]]]);
    cards.unshift(['', 'bez lewej strony'], 'nie karta', [42, 'liczba']);
    const json = JSON.stringify({ v: 1, n: '<img src=x onerror="window.hacked=1">Talia z bardzo długą nazwą ponad limit', i: 'zła ikona', c: cards });
    return 'j' + b64url(new TextEncoder().encode(json));
  });
  await page.evaluate((c) => { location.hash = `talia=${c}`; }, code);
  await expect(page.locator('#deck-dialog-title')).toContainText('Nowa talia');
  await page.click('#btn-import-add');
  const d = await page.evaluate(() => Decks.list()[0]);
  expect(d.cards).toHaveLength(60);
  expect(d.name).toBe('<img src=x onerror="window.hac');
  expect(d.icon).toBe('⭐');
  expect(d.cards[0][0]).toHaveLength(32);
  expect(d.cards[0][2]).toEqual([['<img src=x onerror="window.hacked=1">', 100]]);
  await page.click('#decks-list .deck-row');
  await expect(page.locator('#deck-name')).toHaveValue('<img src=x onerror="window.hac');
  expect(await page.evaluate(() => [document.querySelectorAll('img[src=x]').length, window.hacked])).toEqual([0, undefined]);
  // „bomba” – mały kod, który po rozpakowaniu miałby setki kilobajtów
  const err = await page.evaluate(async () => {
    const json = JSON.stringify({ v: 1, n: 'x', i: '⭐', c: [['a', 'b']], pad: ' '.repeat(400000) });
    const z = await pipeBytes(new TextEncoder().encode(json), new CompressionStream('deflate-raw'));
    const code = 'z' + b64url(z);
    try { await decodeDeck(code); return ['ok', code.length]; } catch (e) { return [e.message, code.length]; }
  });
  expect(err[0]).toBe('too-big');
  expect(err[1]).toBeLessThan(2000);
});

test('wklejony link: dodawanie talii, gdy link otworzył się w innej przeglądarce niż gra', async ({ page }) => {
  await page.goto('/');
  const link = await page.evaluate(() => deckLink({ name: 'Klasa 3b', icon: '🏫', cards: [['Pierwsza ławka', 'Ostatnia ławka']] }));
  await page.click('#btn-decks');
  await page.click('#btn-deck-paste');
  await page.fill('#deck-paste-input', 'coś innego');
  await page.click('#btn-paste-go');
  await expect(page.locator('#deck-paste-error')).toContainText('To nie jest link do talii');
  await page.fill('#deck-paste-input', `Zagrajmy w to: ${link} :)`);
  await page.press('#deck-paste-input', 'Enter');
  await expect(page.locator('#deck-dialog-title')).toHaveText('Nowa talia: 🏫 Klasa 3b');
  await page.click('#btn-import-add');
  await expect(page.locator('#decks-list .deck-row')).toContainText('Klasa 3b');
});

test('udostępnianie: kod QR i kopiowanie linku', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/');
  // kod QR rysujemy na miejscu (bez pobierania biblioteki z sieci w teście)
  await page.evaluate(() => { KragNet.qrSvg = async (text, ecc) => `<svg data-ecc="${ecc}" data-len="${text.length}" viewBox="0 0 10 10"></svg>`; });
  await makeDeck(page, 'Nasza paczka', CARDS);
  await page.click('#decks-list .deck-row');
  await page.click('#btn-deck-share');
  await expect(page.locator('.share-qr svg')).toHaveAttribute('data-ecc', 'L');
  await page.click('#btn-share-copy');
  await expect(page.locator('#btn-share-copy')).toHaveText('Skopiowano');
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied).toBe(await page.evaluate(() => $('#deck-dialog').dataset.link));
  const deck = await page.evaluate(async () => decodeDeck(deckCodeFrom(await navigator.clipboard.readText())));
  expect(deck.name).toBe('Nasza paczka');
  await page.click('#btn-deck-dialog-close');
  await expect(page.locator('#deck-dialog')).toBeHidden();
  // bez internetu (biblioteka QR się nie wczyta) – podpowiedź, żeby wysłać link
  await page.evaluate(() => { KragNet.qrSvg = async () => { throw new Error('script'); }; });
  await page.click('#btn-deck-share');
  await expect(page.locator('.share-qr')).toContainText('potrzebuje internetu');
});

test('limity: 8 talii, 60 kart w talii', async ({ page }) => {
  const decks = Array.from({ length: 8 }, (_, i) => ({ id: `deck${i}`, name: `Talia ${i}`, icon: '⭐', cards: [['A', 'B']] }));
  decks[0].cards = Array.from({ length: 60 }, (_, i) => [`Lewo ${i}`, `Prawo ${i}`]);
  await seedDecks(page, decks);
  await page.goto('/');
  await page.click('#btn-decks');
  await expect(page.locator('#decks-list .deck-row')).toHaveCount(8);
  await expect(page.locator('#btn-deck-new')).toBeDisabled();
  await page.click('#decks-list .deck-row >> nth=0');
  await expect(page.locator('#btn-card-new')).toBeDisabled();
  await expect(page.locator('#deck-count')).toHaveText('Karty: 60/60 hasła: 0');
  // strony kart: do ostatniej i z powrotem
  const pages = Number((await page.textContent('#deck-page')).split('/')[1]);
  expect(pages).toBeGreaterThan(1);
  for (let i = 1; i < pages; i++) await page.click('#btn-deck-next');
  await expect(page.locator('#btn-deck-next')).toBeDisabled();
  await expect(page.locator('#deck-cards .card-row').last()).toHaveAttribute('aria-label', 'Lewo 59 – Prawo 59');
  await page.click('#btn-deck-prev');
  await expect(page.locator('#deck-page')).toHaveText(`${pages - 1}/${pages}`);
  await expect(page.locator('#btn-deck-next')).toBeEnabled();
  // dziewiąta talia z linku – brak miejsca
  const link = await page.evaluate(() => deckLink({ name: 'Nowa', icon: '🎉', cards: [['X', 'Y']] }));
  await page.goto(link);
  await expect(page.locator('#deck-dialog-title')).toHaveText('Brak miejsca');
});

test('gra własną talią: jedna karta, tryb jednoosobowy z hasłami talii', async ({ page }) => {
  await seedDecks(page, [
    { id: 'jedna', name: 'Jedna karta', icon: '🎲', cards: [['Mały', 'Duży', [['Mrówka', 3]]]] },
    { id: 'solo', name: 'Solo', icon: '🧠', cards: [['Zimno', 'Gorąco', [['Lód', 2]]], ['Cicho', 'Głośno', [['Szept', 10]]], ['Bez hasła', 'Też bez']] },
  ]);
  await page.goto('/');
  // talia z jedną kartą: wyrocznia widzi jedną kartę
  await page.evaluate(() => { settings.cats = ['u:jedna']; saveSettings(); });
  await page.click('#btn-teams');
  await page.click('#btn-start-teams');
  await page.click('#btn-cats-start');
  await page.click('#btn-psychic-ready');
  await expect(page.locator('#card-choice .choice')).toHaveCount(1);
  await expect(page.locator('#spec-left')).toHaveText('Mały');
  // podpowiedź z hasła talii
  await page.click('#btn-hint');
  await expect(page.locator('#hint-box')).toContainText('„Mrówka”');
  await page.click('#btn-home');
  await page.click('#btn-resume-drop');
  // gra jednoosobowa: tylko karty z hasłem
  await page.evaluate(() => { settings.cats = ['u:solo']; saveSettings(); });
  await page.click('#btn-solo');
  await expect(page.locator('#cats-info')).toHaveText('haseł: 2');
  await page.click('#btn-cats-start');
  const rounds = await page.evaluate(() => state.game.rounds.map((r) => r.clue).sort());
  expect(rounds).toEqual(['Lód', 'Szept']);
});

test('przerwana gra własną talią, która potem zniknęła – gra toczy się dalej kartami wbudowanymi', async ({ page }) => {
  await seedDecks(page, [{ id: 'mala', name: 'Mała', icon: '🎲', cards: [['Mały', 'Duży'], ['Ciemno', 'Jasno']] }]);
  await page.goto('/');
  await page.evaluate(() => { settings.cats = ['u:mala']; saveSettings(); });
  await page.click('#btn-teams');
  await page.click('#btn-start-teams');
  await page.click('#btn-cats-start');
  await page.click('#btn-psychic-ready');
  await page.click('#btn-hide');
  await page.click('#btn-confirm');
  await page.click('#btn-left');
  await page.click('#btn-home');
  // talia usunięta, zanim gra została wznowiona
  await page.click('#btn-decks');
  await page.click('#decks-list .deck-row');
  await page.click('#btn-deck-delete');
  await page.click('#btn-deck-delete');
  await page.click('#btn-decks-back');
  await page.click('#btn-resume');
  for (let i = 0; i < 3; i++) {
    await page.click('#btn-next');
    await page.click('#btn-psychic-ready');
    const n = await page.evaluate(() => state.choices.filter((c) => c && c.left).length);
    expect(n).toBe(2);
    await page.click('#btn-hide');
    await page.click('#btn-confirm');
    await page.click('#btn-left');
  }
});

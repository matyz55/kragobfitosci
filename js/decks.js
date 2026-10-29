'use strict';
// Własne talie: karty pisane przez graczy (np. o znajomych albo o firmie), zapisane tylko w tej przeglądarce.
// Talię przekazuje się linkiem albo kodem QR. Cała talia siedzi w adresie po znaku „#”, a tej części adresu
// przeglądarka nie wysyła na serwer – nie trzeba konta ani serwera, a treść kart zostaje między graczami.

const DECKS_KEY = 'krag.decks';
const DECK_LIMITS = { decks: 8, cards: 60, name: 30, side: 32, clue: 40 };
const DECK_ICONS = ['⭐', '🎉', '👥', '🏢', '💼', '🏫', '🍕', '⚽', '🎵', '🎬', '🐾', '❤️', '🎲', '🌍', '🧠', '🔥'];
const DECK_PREFIX = 'u:'; // identyfikator kategorii z własnej talii: „u:” + id talii

// Porządkuje talię z dowolnego źródła (zapis w telefonie, link): tylko dozwolone pola, przycięte teksty, limity.
// Zwraca null, gdy nie ma w niej ani jednej poprawnej karty i nazwy.
function cleanDeck(d) {
  if (!d || typeof d !== 'object') return null;
  const text = (x, max) => (typeof x === 'string' ? x.replace(/\s+/g, ' ').trim().slice(0, max) : '');
  const cards = [];
  for (const k of Array.isArray(d.cards) ? d.cards : []) {
    if (!Array.isArray(k)) continue;
    const left = text(k[0], DECK_LIMITS.side), right = text(k[1], DECK_LIMITS.side);
    if (!left || !right) continue;
    const card = [left, right];
    const ex = Array.isArray(k[2]) && Array.isArray(k[2][0]) ? k[2][0] : null;
    const clue = ex ? text(ex[0], DECK_LIMITS.clue) : '';
    const pos = ex ? Number(ex[1]) : NaN;
    if (clue && Number.isFinite(pos)) card.push([[clue, Math.round(Math.min(100, Math.max(0, pos)) * 2) / 2]]);
    cards.push(card);
    if (cards.length >= DECK_LIMITS.cards) break;
  }
  const name = text(d.name, DECK_LIMITS.name);
  if (!cards.length && !name) return null;
  return {
    id: typeof d.id === 'string' && /^[a-z0-9]{4,16}$/.test(d.id) ? d.id : newDeckId(),
    name,
    icon: DECK_ICONS.includes(d.icon) ? d.icon : DECK_ICONS[0],
    cards,
    at: Number(d.at) || Date.now(),
  };
}

function newDeckId() {
  return Date.now().toString(36).slice(-5) + Math.random().toString(36).slice(2, 7);
}

const Decks = (() => {
  let cache = null;
  const read = () => {
    try { const v = JSON.parse(localStorage.getItem(DECKS_KEY)); return Array.isArray(v) ? v : []; } catch { return []; }
  };
  const write = (list) => {
    cache = list;
    try { localStorage.setItem(DECKS_KEY, JSON.stringify(list)); return true; } catch { return false; }
  };
  const list = () => cache || (cache = read().map(cleanDeck).filter(Boolean));
  return {
    list,
    get: (id) => list().find((d) => d.id === id) || null,
    // zapis (nowa albo zmieniona talia); false – brak miejsca w przeglądarce
    save(deck) {
      const all = list().slice();
      const i = all.findIndex((d) => d.id === deck.id);
      const copy = { id: deck.id, name: deck.name, icon: deck.icon, cards: deck.cards.map((k) => k.slice()), at: Date.now() };
      if (i >= 0) all[i] = copy; else all.push(copy);
      return write(all);
    },
    remove(id) { write(list().filter((d) => d.id !== id)); },
    full: () => list().length >= DECK_LIMITS.decks,
    // ta sama talia (nazwa i karty) jest już zapisana?
    same: (deck) => list().find((d) => d.name === deck.name && JSON.stringify(d.cards) === JSON.stringify(deck.cards)) || null,
  };
})();

const deckName = (d) => d.name || T('Moja talia');

// Własna talia jako kategoria gry.
function deckCategory(d) {
  return { id: DECK_PREFIX + d.id, name: deckName(d), icon: d.icon, cards: d.cards, custom: true };
}

// Kategorie do wyboru: najpierw własne talie (te z kartami), potem wbudowane.
function gameCategories() {
  return Decks.list().filter((d) => d.cards.length).map(deckCategory).concat(CATEGORIES);
}

// ---------- talia w linku: JSON → kompresja (deflate) → base64url ----------
// „z” na początku – dane skompresowane, „j” – sam JSON (przeglądarka bez CompressionStream).

const DECK_CODE_MAX = 24000; // dłuższego tekstu nie próbujemy nawet rozpakować
const DECK_JSON_MAX = 64 * 1024; // ochrona przed „bombą” – rozpakowane dane nie mogą być większe

function b64url(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function unb64url(text) {
  const s = atob(text.replace(/-/g, '+').replace(/_/g, '/'));
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

// Przepuszcza bajty przez strumień (kompresja albo rozpakowanie); limit – największy dopuszczalny wynik.
async function pipeBytes(bytes, stream, limit = Infinity) {
  const writer = stream.writable.getWriter();
  writer.write(bytes).catch(() => {});
  writer.close().catch(() => {});
  const reader = stream.readable.getReader();
  const chunks = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > limit) { reader.cancel().catch(() => {}); throw new Error('too-big'); }
    chunks.push(value);
  }
  const out = new Uint8Array(size);
  let at = 0;
  for (const c of chunks) { out.set(c, at); at += c.length; }
  return out;
}

async function encodeDeck(deck) {
  const json = JSON.stringify({ v: 1, n: deck.name, i: deck.icon, c: deck.cards });
  const bytes = new TextEncoder().encode(json);
  if (typeof CompressionStream === 'function') {
    try { return 'z' + b64url(await pipeBytes(bytes, new CompressionStream('deflate-raw'))); } catch { /* bez kompresji */ }
  }
  return 'j' + b64url(bytes);
}

// Tekst z linku → talia (już uporządkowana) albo wyjątek: 'format' | 'unsupported' | 'too-big' | 'empty'.
async function decodeDeck(code) {
  if (typeof code !== 'string' || code.length < 2 || code.length > DECK_CODE_MAX || !/^[zj][A-Za-z0-9_-]+$/.test(code)) throw new Error('format');
  let bytes;
  try { bytes = unb64url(code.slice(1)); } catch { throw new Error('format'); }
  if (code[0] === 'z') {
    let stream;
    try { stream = new DecompressionStream('deflate-raw'); } catch { throw new Error('unsupported'); }
    try { bytes = await pipeBytes(bytes, stream, DECK_JSON_MAX); } catch (e) { throw new Error(e.message === 'too-big' ? 'too-big' : 'format', { cause: e }); }
  } else if (bytes.length > DECK_JSON_MAX) throw new Error('too-big');
  let obj;
  try { obj = JSON.parse(new TextDecoder().decode(bytes)); } catch { throw new Error('format'); }
  if (!obj || obj.v !== 1) throw new Error('format');
  const deck = cleanDeck({ name: obj.n, icon: obj.i, cards: obj.c });
  if (!deck || !deck.cards.length) throw new Error('empty');
  return deck;
}

// Adres strony gry z talią po znaku „#”.
async function deckLink(deck) {
  const u = new URL('./', window.location.href);
  u.hash = 'talia=' + await encodeDeck(deck);
  return u.toString();
}

// Kod talii z adresu albo z wklejonego tekstu (cały link lub sam kod).
function deckCodeFrom(text) {
  const m = /(?:^|[#&?])talia=([zj][A-Za-z0-9_-]+)/.exec(String(text || '').trim());
  return m ? m[1] : null;
}

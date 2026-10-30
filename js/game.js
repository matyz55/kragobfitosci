'use strict';
// Logika gry (bez interfejsu): talia, punktacja, kolejność tur.
// Tryb drużynowy: punkty 4/3/2, zgadywanie „lewo/prawo”, gra do 10 pkt, dogrywka, nadrabianie straty;
// tryb współpracy: 7 kart, środek celu dokłada kartę.

const GAME_VERSION = '2.0.0';

// Szerokość jednego pola celu na skali 0–100. Cel ma pięć pól: 2 | 3 | 4 | 3 | 2.
// Poziom trudności zmienia szerokość pól: łatwy – szersze (np. dla dzieci), trudny – węższe.
const DIFFICULTY = { easy: 5.5, normal: 4, hard: 2.8 };
let BAND = DIFFICULTY.normal;
function setDifficulty(level) {
  BAND = DIFFICULTY[level] || DIFFICULTY.normal;
  return BAND;
}
// szerokość pól zapisana w przerwanej grze albo przysłana na duży ekran
function setBand(width) {
  if (typeof width === 'number' && width > 0) BAND = width;
}

// Punkty za wskazanie: odległość od środka celu. Na granicy pól liczy się lepszy wynik.
function scoreFor(guess, target, center = 4) {
  const d = Math.abs(guess - target);
  if (d <= BAND / 2) return center;
  if (d <= BAND * 1.5) return 3;
  if (d <= BAND * 2.5) return 2;
  return 0;
}

// Losowy środek celu – nie przy samej krawędzi, żeby zawsze było widać pole za 4 pkt.
function randomTarget(rand = Math.random) {
  return Math.round((3 + rand() * 94) * 2) / 2;
}

function shuffle(arr, rand = Math.random) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Wszystkie kategorie gry: wbudowane i własne talie gracza (gameCategories z decks.js, jeśli jest).
function allCategories() {
  return typeof gameCategories === 'function' ? gameCategories() : CATEGORIES;
}

// Talia kart z wybranych kategorii; po wyczerpaniu tasowana od nowa.
// savedPile – stos zapisany przy wznawianiu gry (kolejność kart zostaje ta sama).
function makeDeck(categoryIds, savedPile) {
  let cats = allCategories().filter((c) => categoryIds.includes(c.id) && c.cards.length);
  // wybrana własna talia zniknęła (np. usunięta w trakcie przerwanej gry) – grają karty wbudowane
  if (!cats.length) cats = CATEGORIES;
  const all = [];
  for (const c of cats) for (const k of c.cards) all.push({ left: k[0], right: k[1], examples: k[2] || [], cat: c.id });
  let pile = savedPile ? savedPile.slice() : shuffle(all);
  return {
    size: all.length,
    cats: categoryIds.slice(),
    get pile() { return pile; },
    draw() {
      if (!pile.length) pile = shuffle(all);
      return pile.pop();
    },
  };
}

// Zestaw rund trybu jednoosobowego: pary (karta, przykład) z wybranych kategorii.
function soloRounds(categoryIds, count, rand = Math.random) {
  const items = [];
  for (const c of allCategories().filter((x) => categoryIds.includes(x.id))) {
    for (const k of c.cards) for (const ex of k[2] || []) items.push({ left: k[0], right: k[1], clue: ex[0], target: ex[1], cat: c.id });
  }
  return shuffle(items, rand).slice(0, count);
}

// Podpowiedź dla wyroczni: przykładowe hasło z puli gry jednoosobowej najbliższe celowi na tej karcie.
// Wynik: null (karta bez przykładów) albo { clue, pos, diff } – diff < 0: cel leży dalej w lewo, > 0: w prawo.
function hintFor(card, target) {
  const ex = (card && card.examples) || [];
  if (!ex.length) return null;
  let best = ex[0];
  for (const e of ex) if (Math.abs(e[1] - target) < Math.abs(best[1] - target)) best = e;
  return { clue: best[0], pos: best[1], diff: target - best[1] };
}

// Czy wskazanie „lewo/prawo” drużyny przeciwnej jest trafne (środek celu względem wskazówki).
function leftRightCorrect(side, guess, target) {
  if (target === guess) return false;
  return side === 'L' ? target < guess : target > guess;
}

// Ocena wyniku trybu współpracy (próg punktów → opis).
const COOP_RANKS = [
  [0, 'Fale się rozminęły – spróbujcie jeszcze raz'],
  [4, 'Pierwsze sygnały'],
  [7, 'Coś zaczyna iskrzyć'],
  [10, 'Niezłe porozumienie'],
  [13, 'Prawie jak telepatia'],
  [16, 'Wygrana! Nadajecie na tych samych falach'],
  [19, 'Wspólny umysł'],
  [22, 'Czytacie sobie w myślach'],
  [25, 'Krąg doskonały'],
];
function coopRank(points) {
  let r = COOP_RANKS[0][1];
  for (const [min, text] of COOP_RANKS) if (points >= min) r = text;
  return r;
}

// ---- Tryb drużynowy ----
// teams: [{ name, players: [], avatar, color }]. Drużyna zaczynająca ma 0 pkt, druga 1 pkt (wyrównanie za kolejność).
function newTeamGame(teams, goal = 10) {
  return {
    mode: 'teams', goal,
    teams: teams.map((t, i) => ({ name: t.name, players: t.players, avatar: t.avatar || '', color: t.color || '', score: i === 0 ? 0 : 1, psychic: 0 })),
    active: 0, turn: 0, suddenDeath: null, winner: null, extraTurn: false,
  };
}

function psychicOf(team) {
  return team.players.length ? team.players[team.psychic % team.players.length] : team.name;
}

// Zapisuje wynik tury i ustala, kto gra dalej. lr: 'L' | 'R' | null (wskazanie drużyny przeciwnej).
function finishTeamTurn(g, guess, target, lr) {
  const me = g.teams[g.active], other = g.teams[1 - g.active];
  const pts = scoreFor(guess, target);
  const lrOk = pts !== 4 && lr != null && leftRightCorrect(lr, guess, target);
  me.score += pts;
  if (lrOk) other.score += 1;
  me.psychic++;
  g.turn++;
  const res = { pts, lrOk, team: g.active, extra: false };

  if (g.suddenDeath) {
    g.suddenDeath.round[g.active] += pts;
    if (lrOk) g.suddenDeath.round[1 - g.active] += 1;
    g.suddenDeath.left--;
    if (g.suddenDeath.left === 0) {
      const [a, b] = g.suddenDeath.round;
      if (a !== b) g.winner = a > b ? 0 : 1;
      else g.suddenDeath = { round: [0, 0], left: 2 };
    }
    g.active = 1 - g.active;
    return res;
  }

  const reached = g.teams.some((t) => t.score >= g.goal);
  if (reached) {
    if (me.score === other.score) {
      // remis – każda drużyna gra jeszcze jedną turę „nagłej śmierci”
      g.suddenDeath = { round: [0, 0], left: 2 };
      g.active = 1 - g.active;
    } else {
      g.winner = me.score > other.score ? g.active : 1 - g.active;
    }
    return res;
  }
  // nadrabianie straty: 4 pkt, a drużyna nadal przegrywa – od razu kolejna tura (z inną wyrocznią)
  if (pts === 4 && me.score < other.score) {
    res.extra = true;
  } else {
    g.active = 1 - g.active;
  }
  return res;
}

// ---- Tryb współpracy ----
function newCoopGame(players, cards = 7) {
  return { mode: 'coop', players, psychic: 0, cardsLeft: cards, cardsTotal: cards, score: 0, turn: 0, done: false };
}

function finishCoopTurn(g, guess, target) {
  const pts = scoreFor(guess, target, 3);
  const bonus = Math.abs(guess - target) <= BAND / 2;
  g.score += pts;
  g.cardsLeft--;
  if (bonus) { g.cardsLeft++; g.cardsTotal++; }
  g.psychic++;
  g.turn++;
  if (g.cardsLeft <= 0) g.done = true;
  return { pts, bonus };
}

// ---- Tryb jednoosobowy ----
function newSoloGame(categoryIds, count = 10) {
  const rounds = soloRounds(categoryIds, count);
  return { mode: 'solo', rounds, index: 0, score: 0, done: rounds.length === 0 };
}

// ---- Wyzwanie dnia ----
// 10 haseł wylosowanych tylko na podstawie daty (i języka): ten sam zestaw u wszystkich graczy danego dnia,
// zawsze ze zwykłą szerokością pól. Wbudowane kategorie, bez własnych talii.
const DAILY_ROUNDS = 10;
const todayKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

function seededRandom(text) {
  let h = 1779033703 ^ text.length;
  for (let i = 0; i < text.length; i++) { h = Math.imul(h ^ text.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
  let a = h >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function newDailyGame(day, lang) {
  const ids = CATEGORIES.map((c) => c.id);
  const rounds = soloRounds(ids, DAILY_ROUNDS, seededRandom(`krag-${lang || 'pl'}-${day}`));
  return { mode: 'solo', daily: day, rounds, index: 0, score: 0, done: rounds.length === 0 };
}

// Kwadraty wyniku do udostępnienia: 4 pkt – czerwony (środek), 3 – pomarańczowy, 2 – żółty, pudło – czarny.
const dailySquares = (pts) => pts.map((p) => ({ 4: '🟥', 3: '🟧', 2: '🟨' }[p] || '⬛')).join('');

function finishSoloTurn(g, guess) {
  const r = g.rounds[g.index];
  const pts = scoreFor(guess, r.target);
  g.score += pts;
  g.index++;
  if (g.index >= g.rounds.length) g.done = true;
  return { pts };
}

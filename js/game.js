'use strict';
// Logika gry (bez interfejsu): talia, punktacja, kolejność tur.
// Tryb drużynowy: punkty 4/3/2, zgadywanie „lewo/prawo”, gra do 10 pkt, dogrywka, nadrabianie straty;
// tryb współpracy: 7 kart, środek celu dokłada kartę.

const GAME_VERSION = '1.4.0';

// Szerokość jednego pola celu na skali 0–100. Cel ma pięć pól: 2 | 3 | 4 | 3 | 2.
const BAND = 4;

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

// Talia kart z wybranych kategorii; po wyczerpaniu tasowana od nowa.
function makeDeck(categoryIds) {
  const cats = CATEGORIES.filter((c) => categoryIds.includes(c.id));
  const all = [];
  for (const c of cats) for (const k of c.cards) all.push({ left: k[0], right: k[1], examples: k[2] || [], cat: c.id });
  let pile = shuffle(all);
  return {
    size: all.length,
    draw() {
      if (!pile.length) pile = shuffle(all);
      return pile.pop();
    },
  };
}

// Zestaw rund trybu jednoosobowego: pary (karta, przykład) z wybranych kategorii.
function soloRounds(categoryIds, count) {
  const items = [];
  for (const c of CATEGORIES.filter((x) => categoryIds.includes(x.id))) {
    for (const k of c.cards) for (const ex of k[2] || []) items.push({ left: k[0], right: k[1], clue: ex[0], target: ex[1], cat: c.id });
  }
  return shuffle(items).slice(0, count);
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
// teams: [{ name, players: [] }]. Drużyna zaczynająca ma 0 pkt, druga 1 pkt (wyrównanie za kolejność).
function newTeamGame(teams, goal = 10) {
  return {
    mode: 'teams', goal,
    teams: teams.map((t, i) => ({ name: t.name, players: t.players, score: i === 0 ? 0 : 1, psychic: 0 })),
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
  // nadrabianie straty: 4 pkt, a drużyna nadal przegrywa – od razu kolejna tura (z innym psychikiem)
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

function finishSoloTurn(g, guess) {
  const r = g.rounds[g.index];
  const pts = scoreFor(guess, r.target);
  g.score += pts;
  g.index++;
  if (g.index >= g.rounds.length) g.done = true;
  return { pts };
}

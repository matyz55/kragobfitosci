'use strict';
// Interfejs gry: ekrany, przebieg tur, ustawienia i zapis przerwanej gry (wznawianie).

const $ = (s) => document.querySelector(s);
const SETTINGS_KEY = 'krag.settings';
const BEST_KEY = 'krag.soloBest';
const SAVE_KEY = 'krag.save';
const SAVE_VERSION = 1;

function loadJSON(key, def) {
  try { const v = JSON.parse(localStorage.getItem(key)); return v == null ? def : v; } catch { return def; }
}
function saveJSON(key, v) {
  try { localStorage.setItem(key, JSON.stringify(v)); } catch {}
}

// Ustawienia gracza (zapamiętywane w przeglądarce).
const DEFAULTS = { theme: 'dark', bigText: false, difficulty: 'normal', timer: 0, hints: true };
const settings = Object.assign({ cats: CATEGORIES.map((c) => c.id) }, DEFAULTS, loadJSON(SETTINGS_KEY, {}));
settings.cats = settings.cats.filter((id) => allCategories().some((c) => c.id === id));
if (!settings.cats.length) settings.cats = CATEGORIES.map((c) => c.id);

function saveSettings() { saveJSON(SETTINGS_KEY, settings); }

// Stan bieżącej gry (dostępny globalnie – także dla testów).
const state = {
  game: null, phase: 'menu', deck: null, card: null, choices: null, target: null, clue: '', lr: null, last: null,
  setup: null, pending: null, history: [], timer: null, extra: false,
};

let dial;

function show(id) {
  document.querySelectorAll('.screen').forEach((s) => s.classList.toggle('hidden', s.id !== id));
  $('#btn-home').classList.toggle('hidden', id === 'screen-menu');
  if (id !== 'screen-play') stopTimer();
}

function parseNames(s) {
  return s.split(/[,;\n]/).map((x) => x.trim()).filter(Boolean).slice(0, 20);
}

function button(text, cls, onClick, id) {
  const b = document.createElement('button');
  b.textContent = text;
  if (cls) b.className = cls;
  if (id) b.id = id;
  b.addEventListener('click', onClick);
  return b;
}

// Przyciski etapu tury; to też chwila, w której stan gry trafia na duży ekran i do zapisu (wznawianie).
function setActions(...btns) {
  const a = $('#actions');
  a.textContent = '';
  a.append(...btns);
  tvSync();
  saveGame();
}

// ---------- wygląd i ustawienia ----------

function applyLook() {
  const root = document.documentElement;
  root.dataset.theme = settings.theme;
  root.classList.toggle('big-text', !!settings.bigText);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = { light: '#f3f0fa', contrast: '#000000' }[settings.theme] || '#120c22';
}

function openSettings() {
  const f = $('#settings-form');
  const vals = { theme: settings.theme, bigText: settings.bigText ? '1' : '0', difficulty: settings.difficulty, timer: String(settings.timer), hints: settings.hints ? '1' : '0' };
  for (const [name, val] of Object.entries(vals)) {
    const input = f.querySelector(`input[name="${name}"][value="${val}"]`);
    if (input) input.checked = true;
  }
  show('screen-settings');
}

function onSettingChange(e) {
  const t = e.target;
  if (!t.name) return;
  const v = t.value;
  if (t.name === 'theme') settings.theme = v;
  else if (t.name === 'bigText') settings.bigText = v === '1';
  else if (t.name === 'difficulty') settings.difficulty = v;
  else if (t.name === 'timer') settings.timer = Number(v);
  else if (t.name === 'hints') settings.hints = v === '1';
  saveSettings();
  applyLook();
}

// ---------- wybór kategorii (po wyborze trybu) ----------

const MODE_NAMES = { solo: 'Jeden gracz', teams: 'Dwie drużyny', coop: 'Współpraca' };

function openCats(mode) {
  state.pending = mode;
  $('#cats-mode').textContent = T(MODE_NAMES[mode]);
  $('#cats-error').classList.add('hidden');
  renderCats();
  show('screen-cats');
}

function catsBack() {
  show({ solo: 'screen-menu', teams: 'screen-setup-teams', coop: 'screen-setup-coop' }[state.pending] || 'screen-menu');
}

function catsStart() {
  if (state.pending === 'solo' && !soloRounds(settings.cats, 1).length) { $('#cats-error').classList.remove('hidden'); return; }
  ({ solo: startSolo, teams: startTeams, coop: startCoop })[state.pending]();
}

function renderCats() {
  const box = $('#cats');
  box.textContent = '';
  for (const c of allCategories()) {
    const on = settings.cats.includes(c.id);
    const b = button(`${c.icon} ${c.name}`, 'chip' + (on ? ' on' : ''), () => {
      if (on && settings.cats.length === 1) return; // co najmniej jedna kategoria
      setCats(on ? settings.cats.filter((x) => x !== c.id) : settings.cats.concat(c.id));
    });
    const count = state.pending === 'solo' ? soloRounds([c.id], 9999).length : c.cards.length;
    const small = document.createElement('small');
    small.textContent = String(count);
    small.title = state.pending === 'solo' ? T('haseł') : T('kart');
    b.append(small);
    b.dataset.cat = c.id;
    b.setAttribute('aria-pressed', String(on));
    box.append(b);
  }
  const cards = allCategories().filter((c) => settings.cats.includes(c.id)).reduce((n, c) => n + c.cards.length, 0);
  $('#cats-info').textContent = state.pending === 'solo'
    ? T('Haseł do wylosowania: {0} (gra ma 10 rund)', soloRounds(settings.cats, 9999).length)
    : T('Kart w talii: {0}', cards);
}

function setCats(ids) {
  settings.cats = allCategories().map((c) => c.id).filter((id) => ids.includes(id));
  saveSettings();
  renderCats();
}

function showRulesTab(tab) {
  document.querySelectorAll('#screen-rules .tab').forEach((t) => t.classList.toggle('on', t.dataset.tab === tab));
  document.querySelectorAll('#screen-rules .tab-page').forEach((p) => p.classList.toggle('hidden', p.dataset.page !== tab));
}

// ---------- instalacja ----------

let installEvent = null;

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
}

function updateInstallButton() {
  $('#btn-install').classList.toggle('hidden', isStandalone());
}

// Instrukcja dla przeglądarek bez okna instalacji (iOS, Safari, Firefox) albo gdy przeglądarka jeszcze go nie udostępniła.
function installHelp() {
  const ua = navigator.userAgent;
  const ios = /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  if (ios) return T('Stuknij przycisk „Udostępnij” (kwadrat ze strzałką w górę) i wybierz dodanie do ekranu początkowego.');
  if (/Firefox/.test(ua) && !/Android/.test(ua)) return T('Firefox na komputerze nie instaluje aplikacji ze stron. Otwórz grę w Chrome albo Edge i kliknij „Zainstaluj” jeszcze raz.');
  if (/Macintosh/.test(ua) && /Safari/.test(ua) && !/Chrome|Chromium|Edg/.test(ua)) return T('W Safari otwórz menu „Plik” i wybierz dodanie do Docka (macOS Sonoma lub nowszy).');
  return T('Otwórz menu przeglądarki (⋮ albo …) i wybierz instalację aplikacji albo dodanie do ekranu głównego.');
}

async function install() {
  if (installEvent) {
    const e = installEvent;
    installEvent = null;
    e.prompt();
    try { await e.userChoice; } catch {}
    updateInstallButton();
    return;
  }
  $('#install-text').textContent = installHelp();
  $('#install-dialog').classList.remove('hidden');
}

// ---------- wspólne elementy rozgrywki ----------

function setCard(card) {
  state.card = card;
  $('#spec-left').textContent = card.left;
  $('#spec-right').textContent = card.right;
}

// Konfetti (przy trafieniu w środek i na koniec wygranej gry).
function confetti(n = 70) {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const fx = $('#fx'), colors = ['#ffd166', '#ff8a3d', '#ff4f7b', '#a66bff', '#4f7cff', '#3fe0d0'];
  for (let i = 0; i < n; i++) {
    const c = document.createElement('i');
    c.style.left = `${Math.random() * 100}%`;
    c.style.background = colors[i % colors.length];
    c.style.animationDelay = `${Math.random() * 0.4}s`;
    c.style.setProperty('--dx', `${(Math.random() - 0.5) * 40}vw`);
    c.style.setProperty('--r', `${(Math.random() - 0.5) * 1440}deg`);
    c.style.setProperty('--t', `${1.4 + Math.random() * 1.2}s`);
    fx.append(c);
  }
  setTimeout(() => { fx.textContent = ''; }, 3200);
}

// Kropki rund: punkty rozegranych rund, null – runda jeszcze przed nami.
function roundDots(total) {
  const pts = state.history.map((h) => h.pts);
  return Array.from({ length: Math.max(total, pts.length) }, (_, i) => (i < pts.length ? pts[i] : null));
}

// Dane tablicy wyników – te same dla telefonu i dużego ekranu.
function scoreList() {
  const g = state.game;
  if (g.mode === 'teams') {
    return g.teams.map((t, i) => ({ name: t.name, score: t.score, active: i === g.active, team: i ? 'b' : 'a', progress: t.score / g.goal, bump: true }))
      .concat({ name: T('gra do'), score: g.goal, small: true });
  }
  if (g.mode === 'coop') {
    return [{ name: T('Wspólny wynik'), score: g.score, active: true, bump: true },
      { name: T('Karty'), score: g.cardsLeft, dots: roundDots(g.cardsTotal) }];
  }
  return [{ name: T('Wynik'), score: g.score, active: true, bump: true },
    { name: T('Runda'), score: `${Math.min(g.index + 1, g.rounds.length)}/${g.rounds.length}`, dots: roundDots(g.rounds.length) },
    { name: T('Rekord'), score: loadJSON(BEST_KEY, 0) }];
}

function renderScores() {
  renderScoreboard($('#scores'), scoreList());
}

// Początek nowej gry: poziom trudności z ustawień, czysta historia rund i tablica wyników bez „podskoków”.
function newGameView() {
  setDifficulty(settings.difficulty);
  state.history = [];
  state.extra = false;
  $('#scores')._prev = null;
}

function resetPlayView() {
  stopTimer();
  dial.hideTarget();
  dial.showLR(null);
  dial.locked = false;
  dial.set(50);
  $('#card-choice').classList.add('hidden');
  $('#clue-box').classList.add('hidden');
  $('#clue-box').classList.remove('compact');
  $('#clue-input-box').classList.add('hidden');
  hideHint();
  $('#result').classList.add('hidden');
  $('#screen-play').classList.remove('psychic-view');
}

function currentPsychic() {
  const g = state.game;
  if (g.mode === 'teams') return psychicOf(g.teams[g.active]);
  return g.players[g.psychic % g.players.length];
}

function showClue() {
  const box = $('#clue-box');
  box.classList.remove('hidden');
  renderClue(box, state.clue, state.game.mode === 'solo' ? null : state.psychic);
}

// ---------- minutnik narady ----------
// Odliczanie w czasie ustawiania wskazówki (drużyny i współpraca); w ostatnich 10 s cyka, na koniec sygnał.

let timerId = null;
let timerShown = null;

function timerLeft() {
  return state.timer ? Math.max(0, Math.ceil((state.timer.end - Date.now()) / 1000)) : 0;
}

const clock = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

function startTimer(seconds, total) {
  stopTimer();
  if (!seconds) return;
  state.timer = { total: total || seconds, end: Date.now() + seconds * 1000, over: false };
  timerShown = null;
  $('#timer').classList.remove('hidden', 'over', 'urgent');
  tickTimer();
  timerId = setInterval(tickTimer, 200);
}

function stopTimer() {
  clearInterval(timerId);
  timerId = null;
  state.timer = null;
  const el = $('#timer');
  if (el) { el.classList.add('hidden'); el.classList.remove('over', 'urgent'); }
}

function tickTimer() {
  const t = state.timer;
  if (!t) return;
  const ms = Math.max(0, t.end - Date.now());
  const left = Math.ceil(ms / 1000);
  $('#timer .timer-bar i').style.width = `${(ms / (t.total * 1000)) * 100}%`;
  if (left === timerShown) return;
  timerShown = left;
  $('#timer-left').textContent = clock(left);
  $('#timer').classList.toggle('urgent', left > 0 && left <= 10);
  if (left > 0 && left <= 10) SFX.timerTick(left <= 5);
  if (left === 0 && !t.over) {
    t.over = true;
    clearInterval(timerId);
    $('#timer').classList.add('over');
    $('#status').textContent = T('Czas minął! Zatwierdźcie wskazówkę.');
    SFX.timeUp(); Haptics.timeUp();
    tvSync();
  }
}

// ---------- tryb jednoosobowy ----------

function startSolo() {
  state.setup = { mode: 'solo' };
  newGameView();
  state.game = newSoloGame(settings.cats, 10);
  if (state.game.done) { alert(T('W wybranych kategoriach nie ma haseł do gry jednoosobowej. Dodaj kategorię.')); return; }
  soloRound();
}

function soloRound() {
  const g = state.game, r = g.rounds[g.index];
  state.phase = 'guess';
  state.target = r.target;
  state.clue = r.clue;
  state.card = { left: r.left, right: r.right, cat: r.cat, examples: [] };
  renderGuess(50, null);
}

function soloReveal() {
  const g = state.game;
  const res = finishSoloTurn(g, dial.value);
  state.phase = 'reveal';
  state.last = res;
  state.history.push({ pts: res.pts, centre: res.pts === 4 });
  state.result = { pts: res.pts, title: T('{0} pkt', res.pts) };
  SFX.points(res.pts); Haptics.points(res.pts);
  if (res.pts === 4) confetti(40);
  renderReveal();
}

// ---------- tryby z wyrocznią (drużyny i współpraca) ----------

function startTeams() {
  const names = [$('#team-a-name').value.trim() || T('Drużyna A'), $('#team-b-name').value.trim() || T('Drużyna B')];
  const players = [parseNames($('#team-a-players').value), parseNames($('#team-b-players').value)];
  const goal = Number($('#team-goal').value);
  state.setup = { mode: 'teams', names, players, goal };
  newGameView();
  state.game = newTeamGame(names.map((n, i) => ({ name: n, players: players[i] })), goal);
  state.deck = makeDeck(settings.cats);
  passDevice();
}

function prepareCoop() {
  if (parseNames($('#coop-players').value).length < 2) { $('#coop-error').classList.remove('hidden'); return; }
  $('#coop-error').classList.add('hidden');
  openCats('coop');
}

function startCoop() {
  const players = parseNames($('#coop-players').value);
  const cards = Number($('#coop-cards').value);
  state.setup = { mode: 'coop', players, cards };
  newGameView();
  state.game = newCoopGame(players, cards);
  state.deck = makeDeck(settings.cats);
  passDevice();
}

function passDevice(extra) {
  state.phase = 'pass';
  state.choices = [state.deck.draw(), state.deck.draw()];
  state.target = randomTarget();
  state.clue = '';
  state.lr = null;
  state.extra = !!extra;
  state.psychic = currentPsychic();
  renderPass();
}

function renderPass() {
  const g = state.game;
  show('screen-pass');
  $('#pass-title').textContent = T('Wyrocznia: {0}', state.psychic);
  const chip = $('#pass-chip');
  let text = T('Przekaż urządzenie wyroczni.');
  if (g.mode === 'teams') {
    chip.textContent = g.suddenDeath ? T('Dogrywka · {0}', g.teams[g.active].name) : T('Tura: {0}', g.teams[g.active].name);
    chip.className = `turn-chip team-${g.active ? 'b' : 'a'}`;
    if (state.extra) text = T('Sam środek, a drużyna wciąż przegrywa – dodatkowa tura!') + ' ' + text;
  } else {
    chip.textContent = T('Współpraca · karty: {0}', g.cardsLeft);
    chip.className = 'turn-chip';
  }
  $('#pass-text').textContent = text;
  tvSync();
  saveGame();
}

function psychicPhase() {
  state.phase = 'psychic';
  show('screen-play');
  resetPlayView();
  $('#screen-play').classList.add('psychic-view');
  renderScores();
  dial.locked = true;
  dial.showTarget(state.target, state.game.mode === 'coop');
  SFX.mystic(); Haptics.mystic();
  $('#status').textContent = state.game.mode === 'coop'
    ? T('Tylko Ty widzisz cel. Środek „3+” to 3 pkt i dodatkowa karta.')
    : T('Tylko Ty widzisz cel. Wybierz kartę i wymyśl hasło.');
  const box = $('#card-choice');
  box.classList.remove('hidden');
  box.textContent = '';
  state.choices.forEach((c, i) => {
    const b = button('', 'choice', () => pick(i));
    const l = document.createElement('span'), bar = document.createElement('span'), r = document.createElement('span');
    l.className = 'ch-l'; l.textContent = c.left;
    bar.className = 'ch-bar';
    r.className = 'ch-r'; r.textContent = c.right;
    b.append(l, bar, r);
    b.dataset.i = i;
    b.setAttribute('aria-label', `${c.left} – ${c.right}`);
    box.append(b);
  });
  function pick(i) {
    setCard(state.choices[i]);
    box.querySelectorAll('.choice').forEach((b, j) => { b.classList.toggle('on', i === j); b.setAttribute('aria-pressed', String(i === j)); });
    hideHint();
    tvSync();
  }
  pick(0);
  $('#clue-input-box').classList.remove('hidden');
  $('#btn-hint').classList.toggle('hidden', !settings.hints);
  $('#clue-input').value = '';
  setActions(button(T('Ukryj cel i oddaj drużynie'), 'primary big', guessPhase, 'btn-hide'));
}

// Podpowiedź dla wyroczni: przykładowe hasło z puli gry jednoosobowej, najbliższe celowi na wybranej karcie.
function hideHint() {
  $('#hint-box').classList.add('hidden');
  $('#clue-input-head').classList.remove('has-hint');
}

function showHint() {
  const box = $('#hint-box');
  box.classList.remove('hidden');
  $('#clue-input-head').classList.add('has-hint');
  const h = hintFor(state.card, state.target);
  if (!h) { box.textContent = T('Ta karta nie ma przykładowych haseł – wybierz drugą albo wymyśl własne.'); return; }
  const d = Math.abs(h.diff), side = h.diff < 0 ? T('lewo') : T('prawo');
  if (d <= BAND / 2) box.textContent = T('Pasuje np. „{0}”.', h.clue);
  else if (d <= BAND * 2.5) box.textContent = T('Np. „{0}” – cel leży tuż obok, odrobinę w {1}.', h.clue, side);
  else if (d <= 20) box.textContent = T('Np. „{0}” – cel leży trochę dalej w {1}.', h.clue, side);
  else box.textContent = T('Np. „{0}” – cel leży dużo dalej w {1}.', h.clue, side);
}

function guessPhase() {
  state.clue = $('#clue-input').value.trim();
  state.phase = 'guess';
  SFX.hide(); Haptics.hide();
  renderGuess(50, settings.timer || null);
}

// Ekran ustawiania wskazówki (także po wznowieniu gry: dialValue – zapisane położenie, timerSeconds – pozostały czas).
function renderGuess(dialValue, timerSeconds) {
  const g = state.game;
  show('screen-play');
  resetPlayView();
  setCard(state.card);
  if (dialValue != null) dial.set(dialValue);
  renderScores();
  showClue();
  if (g.mode === 'solo') {
    $('#status').textContent = T('Gdzie na tej skali leży hasło? Ustaw wskazówkę.');
    setActions(button(T('Sprawdź'), 'primary big', soloReveal, 'btn-confirm'));
    return;
  }
  $('#status').textContent = g.mode === 'teams'
    ? T('„{0}” ustawia wskazówkę. Wyrocznia milczy!', g.teams[g.active].name)
    : T('Wszyscy oprócz wyroczni ustawiają wskazówkę.');
  if (timerSeconds) startTimer(timerSeconds, settings.timer || timerSeconds);
  setActions(button(T('Zatwierdź wskazówkę'), 'primary big', afterGuess, 'btn-confirm'));
}

function afterGuess() {
  const g = state.game;
  stopTimer();
  dial.locked = true;
  if (g.mode === 'teams') {
    state.phase = 'lr';
    renderLR();
  } else {
    reveal(null);
  }
}

function renderLR() {
  const g = state.game;
  stopTimer();
  dial.locked = true;
  $('#status').textContent = T('„{0}”: środek celu jest na lewo czy na prawo od wskazówki? Trafienie: 1 pkt.', g.teams[1 - g.active].name);
  setActions(
    button(T('◀ Na lewo'), 'lr', () => reveal('L'), 'btn-left'),
    button(T('Na prawo ▶'), 'lr', () => reveal('R'), 'btn-right'),
  );
}

// Wynik rundy: { pts, title, sub, eyebrow, bonus } – ten sam obiekt trafia na duży ekran.
function showResult(r) {
  state.result = r;
  renderResult($('#result'), r);
}

function reveal(lr) {
  const g = state.game;
  state.lr = lr;
  state.phase = 'reveal';
  if (g.mode === 'teams') {
    const me = g.active;
    const team = g.teams[me].name, other = g.teams[1 - me].name;
    state.lrTeam = me ? 'team-a' : 'team-b';
    const res = finishTeamTurn(g, dial.value, state.target, lr);
    state.last = res;
    state.history.push({ pts: res.pts, team: me, lrOk: res.lrOk, centre: res.pts === 4 });
    state.result = {
      pts: res.pts,
      title: T('„{0}”: {1} pkt', team, res.pts),
      sub: res.pts === 4 ? T('Sam środek – „{0}” nie zgaduje', other) : (res.lrOk ? T('„{0}”: +1 pkt za lewo/prawo', other) : T('„{0}”: pudło w lewo/prawo', other)),
    };
    SFX.points(res.pts); Haptics.points(res.pts);
    SFX.bonus(res.lrOk); Haptics.bonus(res.lrOk);
    if (res.pts === 4) confetti(40);
  } else {
    const res = finishCoopTurn(g, dial.value, state.target);
    state.last = res;
    state.history.push({ pts: res.pts, centre: res.bonus });
    state.result = { pts: res.pts, bonus: res.bonus, title: T('{0} pkt', res.pts), eyebrow: res.bonus ? T('Sam środek!') : undefined, sub: res.bonus ? T('+1 karta do talii') : undefined };
    SFX.points(res.pts); Haptics.points(res.pts);
    if (res.bonus) confetti(40);
  }
  renderReveal();
}

// Odsłonięcie celu i wynik rundy (punkty są już policzone – po wznowieniu gry rysujemy tylko ekran).
function renderReveal() {
  const g = state.game;
  dial.locked = true;
  dial.showTarget(state.target, g.mode === 'coop');
  dial.markHit(dial.value);
  if (g.mode === 'teams' && state.lr) dial.showLR(state.lr, state.lrTeam);
  $('#clue-box').classList.add('compact');
  renderScores();
  showResult(state.result);
  $('#status').textContent = '';
  let label, next;
  if (g.mode === 'solo') {
    label = g.done ? T('Podsumowanie') : T('Dalej');
    next = () => (g.done ? endGame() : soloRound());
  } else if (g.mode === 'teams') {
    const done = g.winner != null;
    label = done ? T('Wyniki') : T('Następna tura');
    next = () => (done ? endGame() : passDevice(state.last && state.last.extra));
  } else {
    label = g.done ? T('Wyniki') : T('Następna runda');
    next = () => (g.done ? endGame() : passDevice());
  }
  setActions(button(label, 'primary big', next, 'btn-next'));
}

// ---------- zapis i wznawianie przerwanej gry ----------

function saveGame() {
  if (!state.game || !['pass', 'psychic', 'guess', 'lr', 'reveal'].includes(state.phase)) return;
  saveJSON(SAVE_KEY, {
    v: SAVE_VERSION, at: Date.now(), phase: state.phase, setup: state.setup, game: state.game, history: state.history,
    deck: state.deck ? { cats: state.deck.cats, pile: state.deck.pile } : null,
    choices: state.choices, card: state.card, target: state.target, clue: state.clue, lr: state.lr, last: state.last,
    result: state.result, psychic: state.psychic, lrTeam: state.lrTeam, extra: state.extra,
    dial: dial.value, band: BAND, timerLeft: state.timer && !state.timer.over ? timerLeft() : null,
  });
}

function clearSave() {
  try { localStorage.removeItem(SAVE_KEY); } catch {}
}

function loadSave() {
  const s = loadJSON(SAVE_KEY, null);
  // zapis sprzed ponad 3 dni albo w starym formacie – nie proponujemy wznowienia
  if (!s || s.v !== SAVE_VERSION || !s.game || Date.now() - s.at > 3 * 24 * 3600 * 1000) return null;
  return s;
}

function saveSummary(s) {
  const g = s.game;
  if (g.mode === 'teams') return `${T('Dwie drużyny')} · ${g.teams[0].name} ${g.teams[0].score} : ${g.teams[1].score} ${g.teams[1].name}`;
  if (g.mode === 'coop') return T('Współpraca · {0} pkt, karty: {1}', g.score, g.cardsLeft);
  return T('Jeden gracz · runda {0}/{1}, {2} pkt', Math.min(g.index + 1, g.rounds.length), g.rounds.length, g.score);
}

function updateResumeBox() {
  const s = loadSave();
  $('#resume-box').classList.toggle('hidden', !s);
  if (s) $('#resume-info').textContent = saveSummary(s);
}

function resumeGame() {
  const s = loadSave();
  if (!s) { updateResumeBox(); return; }
  Object.assign(state, {
    game: s.game, setup: s.setup, history: s.history || [], choices: s.choices, card: s.card, target: s.target,
    clue: s.clue, lr: s.lr, last: s.last, result: s.result, psychic: s.psychic, lrTeam: s.lrTeam, extra: !!s.extra,
  });
  setBand(s.band);
  state.deck = s.deck ? makeDeck(s.deck.cats, s.deck.pile) : null;
  $('#scores')._prev = null;
  if (s.phase === 'pass' || s.phase === 'psychic') {
    // u wyroczni zaczynamy od ekranu przekazania – cel nie pojawi się nikomu przypadkiem
    state.phase = 'pass';
    renderPass();
  } else if (s.phase === 'guess') {
    state.phase = 'guess';
    renderGuess(s.dial, s.timerLeft);
  } else if (s.phase === 'lr') {
    state.phase = 'lr';
    renderGuess(s.dial, null);
    renderLR();
  } else {
    state.phase = 'reveal';
    renderGuess(s.dial, null);
    renderReveal();
  }
}

// ---------- koniec gry ----------

// Liczba z jednym miejscem po przecinku (polski zapis z przecinkiem).
const plNum = (x) => (LANG === 'pl' ? x.toFixed(1).replace('.', ',') : x.toFixed(1));

// Podsumowanie gry: paski drużyn albo kropki rund, statystyki trafień.
function endSummary() {
  const g = state.game, h = state.history;
  const centres = (team) => h.filter((x) => x.centre && (team == null || x.team === team)).length;
  if (g.mode === 'teams') {
    const max = Math.max(g.goal, ...g.teams.map((t) => t.score));
    return {
      kind: 'teams',
      rows: g.teams.map((t, i) => ({ name: t.name, score: t.score, max, win: i === g.winner, team: i ? 'b' : 'a' })),
      stats: T('Tury: {0} · trafienia w sam środek: {1} : {2}', h.length, centres(0), centres(1)),
    };
  }
  if (g.mode === 'coop') {
    return {
      kind: 'rounds', dots: h.map((x) => x.pts),
      meter: { value: g.score, max: Math.max(25, g.score), mark: 16, label: T('Wygrana od 16 pkt') },
      stats: T('Rozegrane karty: {0} · trafienia w sam środek: {1}', g.turn, centres()),
    };
  }
  return {
    kind: 'rounds', dots: h.map((x) => x.pts), meter: null,
    stats: T('Średnio {0} pkt na rundę · trafienia w sam środek: {1}', plNum(g.score / Math.max(1, h.length)), centres()),
  };
}

function endGame() {
  const g = state.game;
  state.phase = 'end';
  clearSave();
  show('screen-end');
  let win;
  if (g.mode === 'teams') {
    const w = g.teams[g.winner];
    state.endIcon = 'trophy';
    $('#end-title').textContent = T('Wygrywa „{0}”!', w.name);
    $('#end-text').textContent = `${g.teams[0].name} ${g.teams[0].score} : ${g.teams[1].score} ${g.teams[1].name}`;
    win = true;
  } else if (g.mode === 'coop') {
    win = g.score >= 16;
    state.endIcon = win ? 'trophy' : 'orb';
    $('#end-title').textContent = T('{0} pkt', g.score);
    $('#end-text').textContent = T(coopRank(g.score));
  } else {
    const best = loadJSON(BEST_KEY, 0);
    const record = g.score > best;
    if (record) saveJSON(BEST_KEY, g.score);
    win = record || g.score >= 30;
    state.endIcon = win ? 'trophy' : 'target';
    $('#end-title').textContent = T('{0} / {1} pkt', g.score, g.rounds.length * 4);
    $('#end-text').textContent = record ? T('Nowy rekord!') : T('Rekord: {0} pkt', best);
  }
  $('#end-icon').innerHTML = art(state.endIcon);
  $('#end-icon').className = `big-icon ${state.endIcon === 'trophy' ? 'trophy' : 'orb'}`;
  state.summary = endSummary();
  renderSummary($('#end-summary'), state.summary);
  if (win) { SFX.win(); Haptics.win(); confetti(); } else { SFX.end(); Haptics.end(); }
  tvSync();
}

function again() {
  const s = state.setup;
  if (!s) return show('screen-menu');
  if (s.mode === 'solo') return startSolo();
  newGameView();
  state.deck = makeDeck(settings.cats);
  if (s.mode === 'teams') state.game = newTeamGame(s.names.map((n, i) => ({ name: n, players: s.players[i] })), s.goal);
  else state.game = newCoopGame(s.players, s.cards);
  passDevice();
}

// Powrót do menu w trakcie gry nie kasuje jej – w menu pojawia się „Wznów”.
function home() {
  saveGame();
  stopTimer();
  state.game = null;
  state.phase = 'menu';
  show('screen-menu');
  updateResumeBox();
  tvSync();
}

// ---------- start ----------

let saveSoon = null;

function init() {
  applyLook();
  $('#version').textContent = GAME_VERSION;
  fillIcons(document);
  dial = createDial($('#dial'), $('#dial-range'), (v, user) => {
    if (user) {
      SFX.tick(v); Haptics.dial(v);
      // położenie wskazówki też trafia do zapisu (wznawianie), najwyżej raz na pół sekundy
      if (!saveSoon) saveSoon = setTimeout(() => { saveSoon = null; saveGame(); }, 500);
    } else Haptics.sync(v);
    tvDial(v);
  });
  const hero = createDial($('#hero-dial'), $('#hero-range'));
  hero.locked = true;
  hero.showTarget(68);
  hero.set(64);

  $('#btn-solo').addEventListener('click', () => openCats('solo'));
  // dźwięk: stuknięcie każdego przycisku, przełącznik w górnym pasku
  document.addEventListener('click', (e) => { const b = e.target.closest('button'); if (b && b.id !== 'btn-sound' && !b.disabled) { SFX.click(); if (b.id !== 'btn-haptics') Haptics.tap(); } });
  const soundBtn = $('#btn-sound');
  const soundIcon = () => {
    soundBtn.innerHTML = icon(SFX.enabled ? 'soundOn' : 'soundOff');
    soundBtn.setAttribute('aria-label', SFX.enabled ? T('Dźwięk włączony') : T('Dźwięk wyłączony'));
  };
  soundBtn.addEventListener('click', () => { SFX.toggle(); soundIcon(); });
  soundIcon();
  // wibracje: przycisk tylko na urządzeniach dotykowych, które je obsługują
  const hapticBtn = $('#btn-haptics');
  const hapticLabel = () => {
    hapticBtn.classList.toggle('off', !Haptics.enabled);
    hapticBtn.innerHTML = icon(Haptics.enabled ? 'vibrate' : 'vibrateOff');
    hapticBtn.setAttribute('aria-pressed', String(Haptics.enabled));
    hapticBtn.title = Haptics.enabled ? T('Wibracje włączone') : T('Wibracje wyłączone');
    hapticBtn.setAttribute('aria-label', hapticBtn.title);
  };
  hapticBtn.classList.toggle('hidden', !(Haptics.supported && window.matchMedia('(pointer: coarse)').matches));
  hapticBtn.addEventListener('click', () => { Haptics.toggle(); hapticLabel(); });
  hapticLabel();
  $('#btn-teams').addEventListener('click', () => show('screen-setup-teams'));
  $('#btn-coop').addEventListener('click', () => show('screen-setup-coop'));
  $('#btn-rules').addEventListener('click', () => { showRulesTab('basics'); show('screen-rules'); });
  $('#btn-settings').addEventListener('click', openSettings);
  $('#settings-form').addEventListener('change', onSettingChange);
  $('#btn-cats-back').addEventListener('click', catsBack);
  $('#btn-cats-start').addEventListener('click', catsStart);
  $('#btn-cats-all').addEventListener('click', () => setCats(allCategories().map((c) => c.id)));
  $('#btn-cats-none').addEventListener('click', () => setCats([settings.cats[0]]));
  document.querySelectorAll('#screen-rules .tab').forEach((t) => t.addEventListener('click', () => showRulesTab(t.dataset.tab)));
  $('#btn-install').addEventListener('click', install);
  $('#btn-install-close').addEventListener('click', () => $('#install-dialog').classList.add('hidden'));
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installEvent = e; updateInstallButton(); });
  window.addEventListener('appinstalled', () => { installEvent = null; updateInstallButton(); });
  updateInstallButton();
  document.querySelectorAll('.back').forEach((b) => b.addEventListener('click', () => show('screen-menu')));
  $('#btn-start-teams').addEventListener('click', () => openCats('teams'));
  $('#btn-start-coop').addEventListener('click', prepareCoop);
  $('#btn-psychic-ready').addEventListener('click', psychicPhase);
  $('#btn-hint').addEventListener('click', showHint);
  $('#btn-menu').addEventListener('click', home);
  $('#btn-again').addEventListener('click', again);
  $('#btn-home').addEventListener('click', home);
  $('#logo').addEventListener('click', home);
  $('#clue-input').addEventListener('keydown', (e) => { if (e.key === 'Enter') guessPhase(); });
  $('#btn-resume').addEventListener('click', resumeGame);
  $('#btn-resume-drop').addEventListener('click', () => { clearSave(); updateResumeBox(); });
  // przed zamknięciem karty lub schowaniem aplikacji zapisujemy grę (np. bieżące położenie wskazówki)
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') saveGame(); });
  window.addEventListener('pagehide', saveGame);
  updateResumeBox();

  initRemote();
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
}

init();

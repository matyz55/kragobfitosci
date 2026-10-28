'use strict';
// Interfejs gry: ekrany, przebieg tur i zapis ustawień.

const $ = (s) => document.querySelector(s);
const SETTINGS_KEY = 'krag.settings';
const BEST_KEY = 'krag.soloBest';

function loadJSON(key, def) {
  try { const v = JSON.parse(localStorage.getItem(key)); return v == null ? def : v; } catch { return def; }
}
function saveJSON(key, v) {
  try { localStorage.setItem(key, JSON.stringify(v)); } catch {}
}

const settings = Object.assign({ cats: CATEGORIES.map((c) => c.id) }, loadJSON(SETTINGS_KEY, {}));
settings.cats = settings.cats.filter((id) => CATEGORIES.some((c) => c.id === id));
if (!settings.cats.length) settings.cats = CATEGORIES.map((c) => c.id);

// Stan bieżącej gry (dostępny globalnie – także dla testów).
const state = { game: null, phase: 'menu', deck: null, card: null, choices: null, target: null, clue: '', lr: null, last: null, setup: null, pending: null, history: [] };

let dial;

function show(id) {
  document.querySelectorAll('.screen').forEach((s) => s.classList.toggle('hidden', s.id !== id));
  $('#btn-home').classList.toggle('hidden', id === 'screen-menu');
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

function setActions(...btns) {
  const a = $('#actions');
  a.textContent = '';
  a.append(...btns);
  tvSync();
}

// ---------- wybór kategorii (po wyborze trybu) ----------

const MODE_NAMES = { solo: 'Jeden gracz', teams: 'Dwie drużyny', coop: 'Współpraca' };

function openCats(mode) {
  state.pending = mode;
  $('#cats-mode').textContent = MODE_NAMES[mode];
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
  for (const c of CATEGORIES) {
    const on = settings.cats.includes(c.id);
    const b = button(`${c.icon} ${c.name}`, 'chip' + (on ? ' on' : ''), () => {
      if (on && settings.cats.length === 1) return; // co najmniej jedna kategoria
      setCats(on ? settings.cats.filter((x) => x !== c.id) : settings.cats.concat(c.id));
    });
    const count = state.pending === 'solo' ? soloRounds([c.id], 9999).length : c.cards.length;
    const small = document.createElement('small');
    small.textContent = String(count);
    small.title = state.pending === 'solo' ? 'haseł' : 'kart';
    b.append(small);
    b.dataset.cat = c.id;
    b.setAttribute('aria-pressed', String(on));
    box.append(b);
  }
  const cards = CATEGORIES.filter((c) => settings.cats.includes(c.id)).reduce((n, c) => n + c.cards.length, 0);
  $('#cats-info').textContent = state.pending === 'solo'
    ? `Haseł do wylosowania: ${soloRounds(settings.cats, 9999).length} (gra ma 10 rund)`
    : `Kart w talii: ${cards}`;
}

function setCats(ids) {
  settings.cats = CATEGORIES.map((c) => c.id).filter((id) => ids.includes(id));
  saveJSON(SETTINGS_KEY, settings);
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
  if (ios) return 'Stuknij przycisk „Udostępnij” (kwadrat ze strzałką w górę) i wybierz dodanie do ekranu początkowego.';
  if (/Firefox/.test(ua) && !/Android/.test(ua)) return 'Firefox na komputerze nie instaluje aplikacji ze stron. Otwórz grę w Chrome albo Edge i kliknij „Zainstaluj” jeszcze raz.';
  if (/Macintosh/.test(ua) && /Safari/.test(ua) && !/Chrome|Chromium|Edg/.test(ua)) return 'W Safari otwórz menu „Plik” i wybierz dodanie do Docka (macOS Sonoma lub nowszy).';
  return 'Otwórz menu przeglądarki (⋮ albo …) i wybierz instalację aplikacji albo dodanie do ekranu głównego.';
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
      .concat({ name: 'gra do', score: g.goal, small: true });
  }
  if (g.mode === 'coop') {
    return [{ name: 'Wspólny wynik', score: g.score, active: true, bump: true },
      { name: 'Karty', score: g.cardsLeft, dots: roundDots(g.cardsTotal) }];
  }
  return [{ name: 'Wynik', score: g.score, active: true, bump: true },
    { name: 'Runda', score: `${Math.min(g.index + 1, g.rounds.length)}/${g.rounds.length}`, dots: roundDots(g.rounds.length) },
    { name: 'Rekord', score: loadJSON(BEST_KEY, 0) }];
}

function renderScores() {
  renderScoreboard($('#scores'), scoreList());
}

// Początek nowej gry: czysta historia rund i tablica wyników bez „podskoków”.
function newGameView() {
  state.history = [];
  $('#scores')._prev = null;
}

function resetPlayView() {
  dial.hideTarget();
  dial.showLR(null);
  dial.locked = false;
  dial.set(50);
  $('#card-choice').classList.add('hidden');
  $('#clue-box').classList.add('hidden');
  $('#clue-box').classList.remove('compact');
  $('#clue-input-box').classList.add('hidden');
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

// ---------- tryb jednoosobowy ----------

function startSolo() {
  state.setup = { mode: 'solo' };
  state.game = newSoloGame(settings.cats, 10);
  newGameView();
  if (state.game.done) { alert('W wybranych kategoriach nie ma haseł do gry jednoosobowej. Dodaj kategorię.'); return; }
  soloRound();
}

function soloRound() {
  const g = state.game, r = g.rounds[g.index];
  show('screen-play');
  resetPlayView();
  state.phase = 'guess';
  state.target = r.target;
  state.clue = r.clue;
  setCard({ left: r.left, right: r.right });
  renderScores();
  showClue();
  $('#status').textContent = 'Gdzie na tej skali leży hasło? Ustaw wskazówkę.';
  setActions(button('Sprawdź', 'primary big', soloReveal, 'btn-confirm'));
}

function soloReveal() {
  const g = state.game;
  const res = finishSoloTurn(g, dial.value);
  state.phase = 'reveal';
  state.last = res;
  state.history.push({ pts: res.pts, centre: res.pts === 4 });
  dial.locked = true;
  dial.showTarget(state.target);
  dial.markHit(dial.value);
  $('#clue-box').classList.add('compact');
  renderScores();
  showResult({ pts: res.pts, title: `${res.pts} pkt` });
  SFX.points(res.pts); Haptics.points(res.pts);
  if (res.pts === 4) confetti(40);
  $('#status').textContent = '';
  setActions(button(g.done ? 'Podsumowanie' : 'Dalej', 'primary big', () => (g.done ? endGame() : soloRound()), 'btn-next'));
}

// ---------- tryby z psychikiem (drużyny i współpraca) ----------

function startTeams() {
  const names = [$('#team-a-name').value.trim() || 'Drużyna A', $('#team-b-name').value.trim() || 'Drużyna B'];
  const players = [parseNames($('#team-a-players').value), parseNames($('#team-b-players').value)];
  const goal = Number($('#team-goal').value);
  state.setup = { mode: 'teams', names, players, goal };
  state.game = newTeamGame(names.map((n, i) => ({ name: n, players: players[i] })), goal);
  state.deck = makeDeck(settings.cats);
  newGameView();
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
  state.game = newCoopGame(players, cards);
  state.deck = makeDeck(settings.cats);
  newGameView();
  passDevice();
}

function passDevice(extra) {
  const g = state.game;
  state.phase = 'pass';
  state.choices = [state.deck.draw(), state.deck.draw()];
  state.target = randomTarget();
  state.clue = '';
  state.lr = null;
  show('screen-pass');
  const who = currentPsychic();
  state.psychic = who;
  $('#pass-title').textContent = `Psychik: ${who}`;
  const chip = $('#pass-chip');
  let text = 'Przekaż urządzenie psychikowi.';
  if (g.mode === 'teams') {
    chip.textContent = g.suddenDeath ? `Dogrywka · ${g.teams[g.active].name}` : `Tura: ${g.teams[g.active].name}`;
    chip.className = `turn-chip team-${g.active ? 'b' : 'a'}`;
    if (extra) text = 'Sam środek, a drużyna wciąż przegrywa – dodatkowa tura! ' + text;
  } else {
    chip.textContent = `Współpraca · karty: ${g.cardsLeft}`;
    chip.className = 'turn-chip';
  }
  $('#pass-text').textContent = text;
  tvSync();
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
    ? 'Tylko Ty widzisz cel. Środek „3+” to 3 pkt i dodatkowa karta.'
    : 'Tylko Ty widzisz cel. Wybierz kartę i wymyśl hasło.';
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
    tvSync();
  }
  pick(0);
  $('#clue-input-box').classList.remove('hidden');
  $('#clue-input').value = '';
  setActions(button('Ukryj cel i oddaj drużynie', 'primary big', guessPhase, 'btn-hide'));
}

function guessPhase() {
  const g = state.game;
  state.clue = $('#clue-input').value.trim();
  state.phase = 'guess';
  resetPlayView();
  SFX.hide(); Haptics.hide();
  renderScores();
  showClue();
  $('#status').textContent = g.mode === 'teams'
    ? `„${g.teams[g.active].name}” ustawia wskazówkę. Psychik milczy!`
    : 'Wszyscy oprócz psychika ustawiają wskazówkę.';
  setActions(button('Zatwierdź wskazówkę', 'primary big', afterGuess, 'btn-confirm'));
}

function afterGuess() {
  const g = state.game;
  dial.locked = true;
  if (g.mode === 'teams') {
    state.phase = 'lr';
    const other = g.teams[1 - g.active].name;
    $('#status').textContent = `„${other}”: środek celu jest na lewo czy na prawo od wskazówki? Trafienie: 1 pkt.`;
    setActions(
      button('◀ Na lewo', 'lr', () => reveal('L'), 'btn-left'),
      button('Na prawo ▶', 'lr', () => reveal('R'), 'btn-right'),
    );
  } else {
    reveal(null);
  }
}

// Wynik rundy: { pts, title, sub, eyebrow } – ten sam obiekt trafia na duży ekran.
function showResult(r) {
  state.result = r;
  renderResult($('#result'), r);
}

function reveal(lr) {
  const g = state.game;
  state.lr = lr;
  state.phase = 'reveal';
  dial.showTarget(state.target, g.mode === 'coop');
  dial.markHit(dial.value);
  $('#clue-box').classList.add('compact');
  let done;
  if (g.mode === 'teams') {
    const me = g.active;
    const team = g.teams[me].name, other = g.teams[1 - me].name;
    state.lrTeam = me ? 'team-a' : 'team-b';
    if (lr) dial.showLR(lr, state.lrTeam);
    const res = finishTeamTurn(g, dial.value, state.target, lr);
    state.last = res;
    state.history.push({ pts: res.pts, team: me, lrOk: res.lrOk, centre: res.pts === 4 });
    done = g.winner != null;
    renderScores();
    showResult({
      pts: res.pts,
      title: `„${team}”: ${res.pts} pkt`,
      sub: res.pts === 4 ? `Sam środek – „${other}” nie zgaduje` : `„${other}”: ${res.lrOk ? '+1 pkt za lewo/prawo' : 'pudło w lewo/prawo'}`,
    });
    SFX.points(res.pts); Haptics.points(res.pts);
    SFX.bonus(res.lrOk); Haptics.bonus(res.lrOk);
    if (res.pts === 4) confetti(40);
    $('#status').textContent = '';
    setActions(button(done ? 'Wyniki' : 'Następna tura', 'primary big', () => (done ? endGame() : passDevice(res.extra)), 'btn-next'));
  } else {
    const res = finishCoopTurn(g, dial.value, state.target);
    state.last = res;
    state.history.push({ pts: res.pts, centre: res.bonus });
    done = g.done;
    renderScores();
    showResult({ pts: res.pts, bonus: res.bonus, title: `${res.pts} pkt`, eyebrow: res.bonus ? 'Sam środek!' : undefined, sub: res.bonus ? '+1 karta do talii' : undefined });
    SFX.points(res.pts); Haptics.points(res.pts);
    if (res.bonus) confetti(40);
    $('#status').textContent = '';
    setActions(button(done ? 'Wyniki' : 'Następna runda', 'primary big', () => (done ? endGame() : passDevice()), 'btn-next'));
  }
}

// ---------- koniec gry ----------

// Liczba z przecinkiem dziesiętnym (polski zapis).
const plNum = (x) => x.toFixed(1).replace('.', ',');

// Podsumowanie gry: paski drużyn albo kropki rund, statystyki trafień.
function endSummary() {
  const g = state.game, h = state.history;
  const centres = (team) => h.filter((x) => x.centre && (team == null || x.team === team)).length;
  if (g.mode === 'teams') {
    const max = Math.max(g.goal, ...g.teams.map((t) => t.score));
    return {
      kind: 'teams',
      rows: g.teams.map((t, i) => ({ name: t.name, score: t.score, max, win: i === g.winner, team: i ? 'b' : 'a' })),
      stats: `Tury: ${h.length} · trafienia w sam środek: ${centres(0)} : ${centres(1)}`,
    };
  }
  if (g.mode === 'coop') {
    return {
      kind: 'rounds', dots: h.map((x) => x.pts),
      meter: { value: g.score, max: Math.max(25, g.score), mark: 16, label: 'Wygrana od 16 pkt' },
      stats: `Rozegrane karty: ${g.turn} · trafienia w sam środek: ${centres()}`,
    };
  }
  return {
    kind: 'rounds', dots: h.map((x) => x.pts), meter: null,
    stats: `Średnio ${plNum(g.score / Math.max(1, h.length))} pkt na rundę · trafienia w sam środek: ${centres()}`,
  };
}

function endGame() {
  const g = state.game;
  state.phase = 'end';
  show('screen-end');
  let win;
  if (g.mode === 'teams') {
    const w = g.teams[g.winner];
    state.endIcon = 'trophy';
    $('#end-title').textContent = `Wygrywa „${w.name}”!`;
    $('#end-text').textContent = `${g.teams[0].name} ${g.teams[0].score} : ${g.teams[1].score} ${g.teams[1].name}`;
    win = true;
  } else if (g.mode === 'coop') {
    win = g.score >= 16;
    state.endIcon = win ? 'trophy' : 'orb';
    $('#end-title').textContent = `${g.score} pkt`;
    $('#end-text').textContent = coopRank(g.score);
  } else {
    const best = loadJSON(BEST_KEY, 0);
    const record = g.score > best;
    if (record) saveJSON(BEST_KEY, g.score);
    win = record || g.score >= 30;
    state.endIcon = win ? 'trophy' : 'target';
    $('#end-title').textContent = `${g.score} / ${g.rounds.length * 4} pkt`;
    $('#end-text').textContent = record ? 'Nowy rekord!' : `Rekord: ${best} pkt`;
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
  state.deck = makeDeck(settings.cats);
  if (s.mode === 'teams') state.game = newTeamGame(s.names.map((n, i) => ({ name: n, players: s.players[i] })), s.goal);
  else state.game = newCoopGame(s.players, s.cards);
  newGameView();
  passDevice();
}

function home() {
  if (state.game && state.phase !== 'end' && !confirm('Przerwać grę i wrócić do menu?')) return;
  state.game = null;
  state.phase = 'menu';
  show('screen-menu');
  tvSync();
}

// ---------- start ----------

function init() {
  $('#version').textContent = GAME_VERSION;
  fillIcons(document);
  dial = createDial($('#dial'), $('#dial-range'), (v, user) => { if (user) { SFX.tick(v); Haptics.dial(v); } else Haptics.sync(v); tvDial(v); });
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
    soundBtn.setAttribute('aria-label', SFX.enabled ? 'Dźwięk włączony' : 'Dźwięk wyłączony');
  };
  soundBtn.addEventListener('click', () => { SFX.toggle(); soundIcon(); });
  soundIcon();
  // wibracje: przycisk tylko na urządzeniach dotykowych, które je obsługują
  const hapticBtn = $('#btn-haptics');
  const hapticLabel = () => {
    hapticBtn.classList.toggle('off', !Haptics.enabled);
    hapticBtn.innerHTML = icon(Haptics.enabled ? 'vibrate' : 'vibrateOff');
    hapticBtn.setAttribute('aria-pressed', String(Haptics.enabled));
    hapticBtn.title = Haptics.enabled ? 'Wibracje włączone' : 'Wibracje wyłączone';
    hapticBtn.setAttribute('aria-label', hapticBtn.title);
  };
  hapticBtn.classList.toggle('hidden', !(Haptics.supported && window.matchMedia('(pointer: coarse)').matches));
  hapticBtn.addEventListener('click', () => { Haptics.toggle(); hapticLabel(); });
  hapticLabel();
  $('#btn-teams').addEventListener('click', () => show('screen-setup-teams'));
  $('#btn-coop').addEventListener('click', () => show('screen-setup-coop'));
  $('#btn-rules').addEventListener('click', () => { showRulesTab('basics'); show('screen-rules'); });
  $('#btn-cats-back').addEventListener('click', catsBack);
  $('#btn-cats-start').addEventListener('click', catsStart);
  $('#btn-cats-all').addEventListener('click', () => setCats(CATEGORIES.map((c) => c.id)));
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
  $('#btn-menu').addEventListener('click', home);
  $('#btn-again').addEventListener('click', again);
  $('#btn-home').addEventListener('click', home);
  $('#logo').addEventListener('click', home);
  $('#clue-input').addEventListener('keydown', (e) => { if (e.key === 'Enter') guessPhase(); });

  initRemote();
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
}

init();

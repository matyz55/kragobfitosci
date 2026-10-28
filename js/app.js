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
const state = { game: null, phase: 'menu', deck: null, card: null, choices: null, target: null, clue: '', lr: null, last: null, setup: null, pending: null };

let dial;

function show(id) {
  document.querySelectorAll('.screen').forEach((s) => s.classList.toggle('hidden', s.id !== id));
  $('#btn-home').classList.toggle('hidden', id === 'screen-menu');
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
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

let shownScores = [];

function renderScores() {
  const g = state.game, box = $('#scores');
  if (g.mode === 'teams') {
    box.innerHTML = g.teams.map((t, i) => `<div class="score team-${i ? 'b' : 'a'}${i === g.active ? ' active' : ''}">` +
      `<span>${esc(t.name)}</span><b>${t.score}</b></div>`).join('') +
      `<div class="score goal"><span>gra do</span><b>${g.goal}</b></div>`;
  } else if (g.mode === 'coop') {
    box.innerHTML = `<div class="score active"><span>Wspólny wynik</span><b>${g.score}</b></div>` +
      `<div class="score"><span>Karty</span><b>${g.cardsLeft}</b></div>`;
  } else {
    const best = loadJSON(BEST_KEY, 0);
    box.innerHTML = `<div class="score active"><span>Wynik</span><b>${g.score}</b></div>` +
      `<div class="score"><span>Runda</span><b>${Math.min(g.index + 1, g.rounds.length)}/${g.rounds.length}</b></div>` +
      `<div class="score"><span>Rekord</span><b>${best}</b></div>`;
  }
  // podskok liczby, która właśnie wzrosła (tylko wyniki, nie runda ani karty)
  const vals = [...box.querySelectorAll('.score b')].map((b) => Number(b.textContent.split('/')[0]));
  box.querySelectorAll('.score b').forEach((b, i) => {
    const label = b.previousElementSibling.textContent;
    if (/Wynik|wynik/.test(label) || b.parentElement.matches('.team-a, .team-b')) {
      if (shownScores[i] != null && vals[i] > shownScores[i]) b.classList.add('bump');
    }
  });
  shownScores = vals;
}

function resetPlayView() {
  dial.hideTarget();
  dial.showLR(null);
  dial.locked = false;
  dial.set(50);
  $('#card-choice').classList.add('hidden');
  $('#clue-box').classList.add('hidden');
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
  box.innerHTML = state.clue ? `Hasło: <b>${esc(state.clue)}</b>` : `<span class="muted">Hasło podane na głos</span>`;
}

// ---------- tryb jednoosobowy ----------

function startSolo() {
  state.setup = { mode: 'solo' };
  state.game = newSoloGame(settings.cats, 10);
  if (state.game.done) { alert('W wybranych kategoriach nie ma haseł do gry jednoosobowej. Dodaj kategorię.'); return; }
  soloRound();
}

function soloRound() {
  if (state.game.index === 0) shownScores = [];
  const g = state.game, r = g.rounds[g.index];
  show('screen-play');
  resetPlayView();
  state.phase = 'guess';
  state.target = r.target;
  state.clue = r.clue;
  setCard({ left: r.left, right: r.right });
  renderScores();
  showClue();
  $('#status').textContent = 'Gdzie na tej skali leży hasło? Przesuń wskazówkę.';
  setActions(button('Sprawdź', 'primary big', soloReveal, 'btn-confirm'));
}

function soloReveal() {
  const g = state.game;
  const res = finishSoloTurn(g, dial.value);
  state.phase = 'reveal';
  state.last = res;
  dial.locked = true;
  dial.showTarget(state.target);
  renderScores();
  showResult(`${pointsText(res.pts)}`, res.pts);
  SFX.points(res.pts);
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
  passDevice();
}

function passDevice(extra) {
  if (state.game.turn === 0 && !extra) shownScores = [];
  const g = state.game;
  state.phase = 'pass';
  state.choices = [state.deck.draw(), state.deck.draw()];
  state.target = randomTarget();
  state.clue = '';
  state.lr = null;
  show('screen-pass');
  const who = currentPsychic();
  $('#pass-title').textContent = `Psychik: ${who}`;
  let text = 'Przekaż urządzenie psychikowi. Pozostali – nie patrzcie na ekran!';
  if (g.mode === 'teams') {
    text = `${extra ? 'Trafienie w sam środek i wciąż strata – dodatkowa tura! ' : ''}Tura drużyny „${g.teams[g.active].name}”. ` + text;
    if (g.suddenDeath) text = 'Dogrywka! ' + text;
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
  SFX.mystic();
  $('#status').textContent = 'Tylko ty widzisz cel. Wybierz kartę i wymyśl hasło.';
  const box = $('#card-choice');
  box.classList.remove('hidden');
  box.textContent = '';
  state.choices.forEach((c, i) => {
    const b = button(`${c.left} ↔ ${c.right}`, 'choice', () => pick(i));
    b.dataset.i = i;
    box.append(b);
  });
  function pick(i) {
    setCard(state.choices[i]);
    box.querySelectorAll('.choice').forEach((b, j) => b.classList.toggle('on', i === j));
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
  SFX.hide();
  renderScores();
  showClue();
  const who = g.mode === 'teams' ? `Drużyna „${g.teams[g.active].name}”` : 'Wszyscy oprócz psychika';
  $('#status').textContent = `${who}: ustawcie wskazówkę. Psychik milczy!`;
  setActions(button('Zatwierdź wskazówkę', 'primary big', afterGuess, 'btn-confirm'));
}

function afterGuess() {
  const g = state.game;
  dial.locked = true;
  if (g.mode === 'teams') {
    state.phase = 'lr';
    const other = g.teams[1 - g.active].name;
    $('#status').textContent = `„${other}”: środek celu jest na lewo czy na prawo od wskazówki? (1 pkt)`;
    setActions(
      button('◀ Na lewo', 'lr', () => reveal('L'), 'btn-left'),
      button('Na prawo ▶', 'lr', () => reveal('R'), 'btn-right'),
    );
  } else {
    reveal(null);
  }
}

function pointsText(p) {
  return p === 0 ? 'Pudło – 0 pkt' : `${p} pkt`;
}

function showResult(html, pts) {
  const r = $('#result');
  r.className = 'result pts-' + pts;
  r.innerHTML = html;
}

function reveal(lr) {
  const g = state.game;
  state.lr = lr;
  state.phase = 'reveal';
  dial.showTarget(state.target, g.mode === 'coop');
  if (lr) dial.showLR(lr);
  let html, done;
  if (g.mode === 'teams') {
    const team = g.teams[g.active].name, other = g.teams[1 - g.active].name;
    const res = finishTeamTurn(g, dial.value, state.target, lr);
    state.last = res;
    html = `„${esc(team)}”: <b>${pointsText(res.pts)}</b>`;
    if (res.pts === 4) html += `<br><span class="muted">Środek celu – „${esc(other)}” nie zgaduje.</span>`;
    else html += `<br>„${esc(other)}”: ${res.lrOk ? '<b>+1 pkt</b> za lewo/prawo' : 'pudło w lewo/prawo'}`;
    done = g.winner != null;
    renderScores();
    showResult(html, res.pts);
    SFX.points(res.pts);
    SFX.bonus(res.lrOk);
    if (res.pts === 4) confetti(40);
    $('#status').textContent = '';
    setActions(button(done ? 'Wyniki' : 'Następna tura', 'primary big', () => (done ? endGame() : passDevice(res.extra)), 'btn-next'));
  } else {
    const res = finishCoopTurn(g, dial.value, state.target);
    state.last = res;
    html = `<b>${pointsText(res.pts)}</b>` + (res.bonus ? '<br>Sam środek! +1 karta do talii.' : '');
    done = g.done;
    renderScores();
    showResult(html, res.pts);
    SFX.points(res.pts);
    if (res.bonus) confetti(40);
    $('#status').textContent = '';
    setActions(button(done ? 'Wyniki' : 'Następna runda', 'primary big', () => (done ? endGame() : passDevice()), 'btn-next'));
  }
}

// ---------- koniec gry ----------

function endGame() {
  const g = state.game;
  state.phase = 'end';
  show('screen-end');
  if (g.mode === 'teams') {
    const w = g.teams[g.winner];
    $('#end-icon').textContent = '🏆';
    $('#end-title').textContent = `Wygrywa „${w.name}”!`;
    $('#end-text').textContent = `${g.teams[0].name} ${g.teams[0].score} : ${g.teams[1].score} ${g.teams[1].name}`;
    SFX.win();
    confetti();
  } else if (g.mode === 'coop') {
    $('#end-title').textContent = `${g.score} pkt`;
    $('#end-text').textContent = `${coopRank(g.score)} (rozegrane karty: ${g.turn})`;
    if (g.score >= 16) { SFX.win(); confetti(); } else SFX.end();
    $('#end-icon').textContent = g.score >= 16 ? '🏆' : '🔮';
  } else {
    const best = loadJSON(BEST_KEY, 0);
    const record = g.score > best;
    if (record) saveJSON(BEST_KEY, g.score);
    $('#end-title').textContent = `${g.score} / ${g.rounds.length * 4} pkt`;
    $('#end-text').textContent = record ? 'Nowy rekord!' : `Rekord: ${best} pkt`;
    if (record || g.score >= 30) { SFX.win(); confetti(); } else SFX.end();
    $('#end-icon').textContent = record || g.score >= 30 ? '🏆' : '🎯';
  }
  tvSync();
}

function again() {
  const s = state.setup;
  if (!s) return show('screen-menu');
  if (s.mode === 'solo') return startSolo();
  state.deck = makeDeck(settings.cats);
  if (s.mode === 'teams') state.game = newTeamGame(s.names.map((n, i) => ({ name: n, players: s.players[i] })), s.goal);
  else state.game = newCoopGame(s.players, s.cards);
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
  dial = createDial($('#dial'), $('#dial-range'), (v, user) => { if (user) SFX.tick(v); tvDial(v); });
  const hero = createDial($('#hero-dial'), $('#hero-range'));
  hero.locked = true;
  hero.showTarget(68);
  hero.set(64);

  $('#btn-solo').addEventListener('click', () => openCats('solo'));
  // dźwięk: stuknięcie każdego przycisku, przełącznik w górnym pasku
  document.addEventListener('click', (e) => { const b = e.target.closest('button'); if (b && b.id !== 'btn-sound' && !b.disabled) SFX.click(); });
  const soundBtn = $('#btn-sound');
  const soundIcon = () => {
    soundBtn.textContent = SFX.enabled ? '🔊' : '🔇';
    soundBtn.setAttribute('aria-label', SFX.enabled ? 'Dźwięk włączony' : 'Dźwięk wyłączony');
  };
  soundBtn.addEventListener('click', () => { SFX.toggle(); soundIcon(); });
  soundIcon();
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

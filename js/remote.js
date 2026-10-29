'use strict';
// Duży ekran (tv.html): telewizor, rzutnik albo drugie okno. To urządzenie jest pilotem i wysyła stan gry.
// Kanały: okno na tym samym urządzeniu (BroadcastChannel) i telewizor przez sieć (KragNet – kod pokoju / QR).
// Położenie celu trafia na duży ekran dopiero przy odsłonięciu – patrzący na telewizor nie mogą go podejrzeć.

const TV_KEY = 'krag.tvCode';
let tvChannel = null;
let tvConn = null;
let tvCode = '';
let tvRetry = 0;
let dialTimer = null;

function tvSend(msg) {
  try { if (tvChannel) tvChannel.postMessage(msg); } catch {}
  try { if (tvConn && tvConn.open) tvConn.send(msg); } catch {}
}

// Stan dla dużego ekranu – tylko dane (bez HTML), żeby nic z sieci nie trafiało na stronę jako kod.
function tvSnapshot() {
  const g = state.game;
  const s = { t: 'state', ver: GAME_VERSION, phase: g ? state.phase : 'menu' };
  if (!g) return s;
  s.mode = g.mode;
  s.scores = scoreList();
  s.dial = dial.value;
  s.band = BAND;
  if (state.timer) s.timer = { left: Math.max(0, (state.timer.end - Date.now()) / 1000), total: state.timer.total };
  if (g.mode !== 'solo') s.psychic = state.psychic;
  if (g.mode === 'teams') {
    s.team = g.teams[g.active].name; s.other = g.teams[1 - g.active].name; s.sudden = !!g.suddenDeath;
    s.colors = [g.teams[0].color, g.teams[1].color];
  }
  if (state.phase !== 'pass' && state.card) { s.left = state.card.left; s.right = state.card.right; }
  if (['guess', 'lr', 'reveal'].includes(state.phase)) s.clue = state.clue;
  if (state.phase === 'reveal' || state.phase === 'end') {
    s.target = state.target;
    s.lr = state.lr;
    s.lrTeam = state.lrTeam;
    s.coop = g.mode === 'coop';
    s.result = state.result;
  }
  if (state.phase === 'end') {
    s.end = { title: $('#end-title').textContent, text: $('#end-text').textContent, icon: state.endIcon, summary: state.summary };
  }
  return s;
}

function tvSync() {
  if (tvChannel || (tvConn && tvConn.open)) tvSend(tvSnapshot());
}

// ruch wskazówki – najwyżej ~20 razy na sekundę
function tvDial(v) {
  if (dialTimer) return;
  dialTimer = setTimeout(() => { dialTimer = null; tvSend({ t: 'dial', v: dial.value }); }, 50);
}

function tvStatus(text) {
  $('#tv-status').textContent = text;
  $('#btn-tv-disconnect').classList.toggle('hidden', !(tvConn && tvConn.open));
  $('#btn-tv').classList.toggle('on', !!(tvConn && tvConn.open));
}

async function connectTv(code, silent) {
  code = KragNet.normCode(code);
  if (code.length !== 4) { tvStatus('Kod ma 4 znaki – widać go na dużym ekranie.'); return; }
  if (!silent) tvStatus('Łączenie…');
  try {
    const { conn } = await KragNet.connect('tv', code);
    if (tvConn) try { tvConn.close(); } catch {}
    tvConn = conn;
    tvCode = code;
    tvRetry = 0;
    try { localStorage.setItem(TV_KEY, code); } catch {}
    conn.on('data', (m) => { if (m && m.t === 'hello') tvSync(); });
    conn.on('close', () => {
      if (tvConn !== conn) return;
      tvConn = null;
      tvStatus('Rozłączono z dużym ekranem.');
      // telewizor mógł się odświeżyć – kilka prób ponownego połączenia z tym samym kodem
      if (tvCode && tvRetry < 5) { tvRetry++; setTimeout(() => { if (!tvConn && tvCode) connectTv(tvCode, true); }, 3000); }
    });
    tvStatus(`✔ Połączono z dużym ekranem (${code}).`);
    tvSync();
  } catch (e) {
    if (!silent) tvStatus('Nie udało się połączyć. Sprawdź kod i czy duży ekran jest włączony.');
  }
}

function disconnectTv() {
  tvCode = '';
  try { localStorage.removeItem(TV_KEY); } catch {}
  const c = tvConn;
  tvConn = null;
  if (c) try { c.close(); } catch {}
  tvStatus('Rozłączono.');
}

function openTvWindow() {
  window.open('tv.html', 'krag-tv', 'width=1280,height=720');
  $('#tv-dialog').classList.add('hidden');
}

function initRemote() {
  if ('BroadcastChannel' in window) {
    tvChannel = new BroadcastChannel('krag-tv');
    tvChannel.onmessage = (e) => { if (e.data && e.data.t === 'hello') tvSync(); };
  }
  $('#btn-tv').addEventListener('click', () => {
    $('#tv-url').textContent = KragNet.pageUrl('tv.html').replace(/^https?:\/\//, '');
    $('#tv-dialog').classList.remove('hidden');
  });
  $('#btn-tv-close').addEventListener('click', () => $('#tv-dialog').classList.add('hidden'));
  $('#btn-tv-window').addEventListener('click', openTvWindow);
  $('#btn-tv-connect').addEventListener('click', () => connectTv($('#tv-code').value));
  $('#tv-code').addEventListener('keydown', (e) => { if (e.key === 'Enter') connectTv($('#tv-code').value); });
  $('#btn-tv-disconnect').addEventListener('click', disconnectTv);
  // telefon zeskanował QR z dużego ekranu: index.html?tv=KOD
  const params = new URLSearchParams(location.search);
  const fromQr = params.get('tv');
  if (fromQr) {
    history.replaceState(null, '', location.pathname);
    $('#tv-code').value = KragNet.normCode(fromQr);
    $('#tv-dialog').classList.remove('hidden');
    connectTv(fromQr);
  } else {
    let saved = '';
    try { saved = localStorage.getItem(TV_KEY) || ''; } catch {}
    if (saved) { tvCode = saved; $('#tv-code').value = saved; connectTv(saved, true); }
  }
}

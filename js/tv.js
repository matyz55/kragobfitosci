'use strict';
// Duży ekran: pokazuje grę sterowaną z telefonu. Dane przychodzą z okna na tym samym urządzeniu (BroadcastChannel)
// albo przez sieć (KragNet – ten ekran tworzy pokój z kodem i kodem QR). Ekran niczego nie zmienia w grze.

const $ = (s) => document.querySelector(s);
const tv = { last: null, phase: null, room: null };
let dialApi;

function show(el, on) { $(el).classList.toggle('hidden', !on); }

function confetti(n = 90) {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const fx = $('#fx'), colors = ['#ffd166', '#ff8a3d', '#ff4f7b', '#a66bff', '#4f7cff', '#3fe0d0'];
  for (let i = 0; i < n; i++) {
    const c = document.createElement('i');
    c.style.left = `${Math.random() * 100}%`;
    c.style.background = colors[i % colors.length];
    c.style.animationDelay = `${Math.random() * 0.5}s`;
    c.style.setProperty('--dx', `${(Math.random() - 0.5) * 40}vw`);
    c.style.setProperty('--r', `${(Math.random() - 0.5) * 1440}deg`);
    c.style.setProperty('--t', `${1.6 + Math.random() * 1.4}s`);
    fx.append(c);
  }
  setTimeout(() => { fx.textContent = ''; }, 3600);
}

function renderScores(scores) {
  renderScoreboard($('#tv-scores'), scores || []);
}

// Komunikat na cały ekran (menu, przekazanie telefonu, koniec gry); artName: orb | trophy | target.
function overlay(artName, title, text, summary) {
  show('#tv-overlay', !!artName);
  if (!artName) return;
  const ic = $('#tv-ov-icon');
  if (ic.dataset.art !== artName) { ic.innerHTML = art(artName); ic.dataset.art = artName; }
  ic.className = `big-icon ${artName === 'trophy' ? 'trophy' : 'orb'}`;
  $('#tv-ov-title').textContent = title;
  $('#tv-ov-text').textContent = text || '';
  renderSummary($('#tv-ov-summary'), summary || null);
}

// Napis nad tarczą – zależny od etapu tury.
function statusFor(s) {
  switch (s.phase) {
    case 'psychic': return `Wyrocznia ${s.psychic} patrzy na cel i wymyśla hasło…`;
    case 'guess':
      if (s.mode === 'solo') return 'Gdzie na tej skali leży hasło?';
      return s.mode === 'teams' ? `„${s.team}” ustawia wskazówkę. Wyrocznia milczy!` : 'Wszyscy oprócz wyroczni ustawiają wskazówkę.';
    case 'lr': return `„${s.other}”: środek celu jest na lewo czy na prawo od wskazówki?`;
    default: return '';
  }
}

function render(s) {
  const prev = tv.phase;
  tv.last = s;
  tv.phase = s.phase;
  // starsza wersja dużego ekranu niż gry na telefonie – jednorazowe odświeżenie
  if (s.ver && s.ver !== GAME_VERSION) {
    try {
      if (sessionStorage.getItem('krag.tvReload') !== s.ver) { sessionStorage.setItem('krag.tvReload', s.ver); location.reload(); return; }
    } catch {}
  }
  show('#tv-lobby', false);
  show('#tv-game', true);
  // kolory drużyn wybrane na telefonie (tylko poprawne zapisy koloru, np. #3fe0d0)
  if (Array.isArray(s.colors)) {
    s.colors.forEach((c, i) => { if (/^#[0-9a-f]{6}$/i.test(c || '')) document.documentElement.style.setProperty(i ? '--team-b' : '--team-a', c); });
  }
  renderScores(s.scores);

  if (s.phase !== 'guess') showTimer(null);
  if (s.phase === 'menu') {
    renderScores([]);
    overlay('orb', 'Krąg obfitości', 'Wybierzcie tryb gry na telefonie.');
    return;
  }
  if (s.phase === 'pass') {
    overlay('orb', `Wyrocznia: ${s.psychic}`, `${s.sudden ? 'Dogrywka! ' : ''}${s.mode === 'teams' ? `Tura drużyny „${s.team}”. ` : ''}Przekażcie telefon wyroczni – tylko ona patrzy na cel.`);
    return;
  }
  if (s.phase === 'end' && s.end) {
    const name = ['trophy', 'orb', 'target'].includes(s.end.icon) ? s.end.icon : 'trophy';
    overlay(name, s.end.title, s.end.text, s.end.summary);
    if (prev !== 'end') {
      if (name === 'trophy') { confetti(); SFX.win(); } else SFX.end();
    }
    return;
  }
  overlay(null);
  setBand(s.band);
  showTimer(s.phase === 'guess' ? s.timer : null);

  $('#tv-left').textContent = s.left || '';
  $('#tv-right').textContent = s.right || '';
  $('#tv-status').textContent = statusFor(s);
  dialApi.set(s.dial != null ? s.dial : 50);

  show('#tv-clue', s.clue != null);
  if (s.clue != null) renderClue($('#tv-clue'), s.clue, s.psychic);

  if (s.phase === 'reveal' && s.target != null && s.result) {
    if (prev !== 'reveal') {
      dialApi.showTarget(s.target, s.coop);
      dialApi.markHit(dialApi.value);
      dialApi.showLR(s.lr || null, s.lrTeam);
      SFX.points(s.result.pts);
      if (s.result.pts === 4) confetti(50);
    }
    renderResult($('#tv-result'), s.result);
    show('#tv-result', true);
  } else {
    if (prev === 'reveal' || prev == null || s.phase === 'psychic') { dialApi.hideTarget(); dialApi.showLR(null); }
    show('#tv-result', false);
    if (s.phase === 'psychic' && prev !== 'psychic') SFX.mystic();
    if (s.phase === 'guess' && prev === 'psychic') SFX.hide();
  }
}

// minutnik narady na dużym ekranie: liczy sam od pozostałego czasu przysłanego z telefonu
let tvTimer = null;
function showTimer(t) {
  clearInterval(tvTimer);
  tvTimer = null;
  const box = $('#tv-timer');
  if (!t) { box.classList.add('hidden'); return; }
  const end = Date.now() + t.left * 1000;
  box.classList.remove('hidden');
  const tick = () => {
    const ms = Math.max(0, end - Date.now()), left = Math.ceil(ms / 1000);
    $('#tv-timer-left').textContent = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
    box.querySelector('.timer-bar i').style.width = `${(ms / (t.total * 1000)) * 100}%`;
    box.classList.toggle('urgent', left > 0 && left <= 10);
    box.classList.toggle('over', left === 0);
    if (left === 0) { clearInterval(tvTimer); tvTimer = null; }
  };
  tick();
  tvTimer = setInterval(tick, 200);
}

function onMessage(m) {
  if (!m || typeof m !== 'object') return;
  if (m.t === 'state') render(m);
  else if (m.t === 'dial' && typeof m.v === 'number' && tv.phase !== 'reveal') dialApi.set(m.v);
}

// pokój sieciowy: kod i QR dla telefonu
async function hostRoom() {
  show('#tv-host', false);
  $('#tv-net-status').textContent = 'Tworzenie pokoju…';
  try {
    tv.room = await KragNet.host('tv', (conn) => {
      conn.on('data', onMessage);
      conn.send({ t: 'hello' });
    }, (() => { try { return localStorage.getItem('krag.tvRoom') || ''; } catch { return ''; } })());
    try { localStorage.setItem('krag.tvRoom', tv.room.code); } catch {}
    $('#tv-code').textContent = tv.room.code;
    $('#tv-room').textContent = `Kod: ${tv.room.code}`;
    show('#tv-room', true);
    show('#tv-code-box', true);
    $('#tv-net-status').textContent = '';
    const url = KragNet.pageUrl('index.html', { tv: tv.room.code });
    try { $('#tv-qr').innerHTML = await KragNet.qrSvg(url); } catch { $('#tv-qr').textContent = ''; }
  } catch (e) {
    $('#tv-net-status').textContent = 'Nie udało się utworzyć pokoju (brak internetu?). Spróbuj ponownie.';
    show('#tv-host', true);
  }
}

function init() {
  fillIcons(document);
  dialApi = createDial($('#tv-dial'), $('#tv-dial-range'));
  dialApi.locked = true;
  const hero = createDial($('#tv-hero'), $('#tv-hero-range'));
  $('#tv-hero').setAttribute('preserveAspectRatio', 'xMidYMid meet');
  hero.locked = true;
  hero.showTarget(68);
  hero.set(64);

  // dźwięk na dużym ekranie wymaga jednego kliknięcia (zasada przeglądarek)
  const soundBtn = $('#tv-sound');
  const soundLabel = () => {
    const on = SFX.enabled && tv.soundOn;
    soundBtn.innerHTML = icon(on ? 'soundOn' : 'soundOff') + (on ? '' : '<span>Włącz dźwięk</span>');
    soundBtn.setAttribute('aria-label', on ? 'Dźwięk włączony' : 'Włącz dźwięk');
  };
  soundBtn.addEventListener('click', () => {
    if (!tv.soundOn) { tv.soundOn = true; if (!SFX.enabled) SFX.toggle(); else SFX.click(); } else { SFX.toggle(); }
    soundLabel();
  });
  soundLabel();
  $('#tv-full').addEventListener('click', () => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else document.documentElement.requestFullscreen().catch(() => {});
  });
  $('#tv-host').addEventListener('click', hostRoom);

  if ('BroadcastChannel' in window) {
    const ch = new BroadcastChannel('krag-tv');
    ch.onmessage = (e) => onMessage(e.data);
    ch.postMessage({ t: 'hello' });
  }
  // okno otwarte z gry na tym samym urządzeniu nie potrzebuje sieci; w innym przypadku od razu tworzymy pokój
  if (window.opener) {
    $('#tv-lobby-text').textContent = 'Czekam na grę z okna obok…';
    show('#tv-host', true);
  } else if (!/[?&]local=1/.test(location.search)) {
    hostRoom();
  } else {
    show('#tv-host', true);
  }
}

init();

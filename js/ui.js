'use strict';
// Wspólne elementy wyglądu gry i dużego ekranu: ikony SVG, ilustracje, karta hasła, karta wyniku,
// tablica wyników i podsumowanie gry. Teksty wstawiamy przez textContent – nic z sieci nie trafia na stronę jako kod.

// Ikony liniowe 24×24 (rysowane dla tej gry), kolor z otoczenia (currentColor).
const ICONS = {
  tv: '<rect x="3" y="4.5" width="18" height="12" rx="2"/><path d="M8.5 20h7M12 16.5V20"/>',
  soundOn: '<path d="M4 9.5v5h3.5L12 18V6L7.5 9.5z"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/>',
  soundOff: '<path d="M4 9.5v5h3.5L12 18V6L7.5 9.5z"/><path d="M16 9.5l5 5M21 9.5l-5 5"/>',
  vibrate: '<rect x="8" y="3.5" width="8" height="17" rx="2"/><path d="M5 8l-1.6 2 1.6 2-1.6 2 1.6 2M19 8l1.6 2-1.6 2 1.6 2-1.6 2"/>',
  vibrateOff: '<rect x="8" y="3.5" width="8" height="17" rx="2"/><path d="M4 4l16 16"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  book: '<path d="M3 5.5c3-1.4 6-1.4 9 0 3-1.4 6-1.4 9 0v13c-3-1.4-6-1.4-9 0-3-1.4-6-1.4-9 0z"/><path d="M12 5.5v13"/>',
  install: '<path d="M12 3.5v11M7.5 10l4.5 4.5 4.5-4.5M5 20h14"/>',
  expand: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
  solo: '<circle cx="12" cy="8" r="4"/><path d="M4.5 20.5c.8-4 3.8-6.5 7.5-6.5s6.7 2.5 7.5 6.5"/>',
  teams: '<circle cx="5.5" cy="8" r="2.7"/><path d="M1.5 19c.3-3.2 1.8-5.2 4-5.2s3.7 2 4 5.2"/><circle cx="18.5" cy="8" r="2.7"/><path d="M14.5 19c.3-3.2 1.8-5.2 4-5.2s3.7 2 4 5.2"/><path d="M13 5l-2.4 5h2.8L11 15"/>',
  coop: '<circle cx="12" cy="7" r="3"/><circle cx="5" cy="10" r="2.4"/><circle cx="19" cy="10" r="2.4"/><path d="M7 20c.4-3.3 2.4-5.5 5-5.5s4.6 2.2 5 5.5M1.8 19c.3-2.4 1.6-4 3.4-4.3M22.2 19c-.3-2.4-1.6-4-3.4-4.3"/>',
  crown: '<path d="M3.5 8l4.5 4.2L12 5l4 7.2L20.5 8l-2 11h-13z"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  sliders: '<path d="M4 6.5h9M18 6.5h2M4 12h3M11 12h9M4 17.5h11M19 17.5h1"/><circle cx="15.5" cy="6.5" r="2.2"/><circle cx="9" cy="12" r="2.2"/><circle cx="17" cy="17.5" r="2.2"/>',
  bulb: '<path d="M9.5 18h5M10.5 21h3"/><path d="M12 3a6 6 0 0 0-3.6 10.8c.7.6 1.1 1.4 1.1 2.2v.5h5V16c0-.8.4-1.6 1.1-2.2A6 6 0 0 0 12 3z"/>',
  timer: '<circle cx="12" cy="13.5" r="7.5"/><path d="M12 13.5V9.5M9.5 2.5h5M18.5 6.5l1.5-1.5"/>',
  play: '<path d="M8 5.5v13l10.5-6.5z"/>',
};

function icon(name) {
  return `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS[name] || ''}</svg>`;
}

// Ilustracje (kryształowa kula, puchar, tarcza strzelnicza) – zamiast emotek, wyglądają tak samo na każdym urządzeniu.
const ART = {
  orb: `<svg viewBox="0 0 120 120" aria-hidden="true">
    <defs>
      <radialGradient id="art-orb" cx="40%" cy="36%" r="68%"><stop offset="0" stop-color="#f5ecff"/><stop offset=".32" stop-color="#bb95ff"/><stop offset=".72" stop-color="#6b3fd8"/><stop offset="1" stop-color="#341c80"/></radialGradient>
      <linearGradient id="art-stand" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#ffe08a"/><stop offset="1" stop-color="#d4902a"/></linearGradient>
    </defs>
    <ellipse cx="60" cy="110" rx="30" ry="5" fill="#000" opacity=".28"/>
    <path d="M37 106l6-15h34l6 15z" fill="url(#art-stand)"/>
    <rect x="33" y="103" width="54" height="6" rx="3" fill="#c9821f"/>
    <circle cx="60" cy="54" r="38" fill="url(#art-orb)"/>
    <ellipse cx="46" cy="38" rx="12" ry="7" fill="#fff" opacity=".45" transform="rotate(-32 46 38)"/>
    <path d="M78 30l2.6 6.2 6.2 2.6-6.2 2.6L78 47.6l-2.6-6.2-6.2-2.6 6.2-2.6z" fill="#fff" opacity=".92"/>
    <path d="M65 62l1.6 3.8 3.8 1.6-3.8 1.6L65 72.8l-1.6-3.8-3.8-1.6 3.8-1.6z" fill="#fff" opacity=".7"/>
    <path d="M45 66l1 2.4 2.4 1-2.4 1-1 2.4-1-2.4-2.4-1 2.4-1z" fill="#fff" opacity=".55"/>
  </svg>`,
  trophy: `<svg viewBox="0 0 120 120" aria-hidden="true">
    <defs>
      <linearGradient id="art-cup" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stop-color="#ffe9a3"/><stop offset=".5" stop-color="#ffc53d"/><stop offset="1" stop-color="#d48a12"/></linearGradient>
    </defs>
    <ellipse cx="60" cy="111" rx="32" ry="5" fill="#000" opacity=".28"/>
    <path d="M35 22H23c0 18 8 26 16 28M85 22h12c0 18-8 26-16 28" fill="none" stroke="url(#art-cup)" stroke-width="7" stroke-linecap="round"/>
    <path d="M34 13h52v27c0 18-12 30-26 30S34 58 34 40z" fill="url(#art-cup)"/>
    <path d="M42 20v18c0 8 3 14 8 18" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" opacity=".45"/>
    <path d="M60 25l4 8.4 9.2 1.2-6.7 6.4 1.7 9.1-8.2-4.4-8.2 4.4 1.7-9.1-6.7-6.4 9.2-1.2z" fill="#fff" opacity=".9"/>
    <path d="M54 70h12l2 16H52z" fill="url(#art-cup)"/>
    <rect x="40" y="86" width="40" height="9" rx="3" fill="url(#art-cup)"/>
    <rect x="33" y="95" width="54" height="13" rx="4" fill="#5b3fd0"/>
    <rect x="44" y="99" width="32" height="5" rx="2" fill="#ffd166" opacity=".8"/>
  </svg>`,
  target: `<svg viewBox="0 0 120 120" aria-hidden="true">
    <ellipse cx="56" cy="111" rx="30" ry="5" fill="#000" opacity=".28"/>
    <circle cx="56" cy="62" r="42" fill="#2b2350" stroke="#6a58a6" stroke-width="2"/>
    <circle cx="56" cy="62" r="35" fill="#f3e9d2"/>
    <circle cx="56" cy="62" r="25" fill="#ffa45c"/>
    <circle cx="56" cy="62" r="15" fill="#ff5470"/>
    <circle cx="56" cy="62" r="5.5" fill="#fff"/>
    <path d="M58 60L100 18" stroke="#ffd166" stroke-width="5" stroke-linecap="round"/>
    <path d="M96 14l12-3-3 12-6 1z" fill="#ff8a3d"/>
  </svg>`,
};

function art(name) { return ART[name] || ART.orb; }

function mk(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

// Tablica wyników. scores: [{ name, score, active, team ('a'|'b'), progress (0–1), dots ([pkt|null]), bump, small }]
// Liczba, która wzrosła od ostatniego rysowania (bump: true), krótko podskakuje.
function renderScoreboard(box, scores) {
  const prev = box._prev || {};
  const now = {};
  box.textContent = '';
  for (const s of scores || []) {
    const d = mk('div', `score${s.active ? ' active' : ''}${s.team ? ` team-${s.team}` : ''}${s.small ? ' goal' : ''}`);
    const v = mk('b', null, String(s.score));
    d.append(mk('span', null, s.name), v);
    if (s.progress != null) {
      const bar = mk('div', 'score-bar');
      const fill = mk('i');
      fill.style.width = `${Math.round(Math.max(0, Math.min(1, s.progress)) * 100)}%`;
      bar.append(fill);
      d.append(bar);
    }
    if (s.dots) {
      const dots = mk('div', 'score-dots');
      const cur = s.dots.indexOf(null);
      s.dots.forEach((p, i) => dots.append(mk('i', p == null ? (i === cur ? 'cur' : '') : `p${p}`)));
      d.append(dots);
    }
    if (s.bump && typeof s.score === 'number') {
      if (prev[s.name] != null && s.score > prev[s.name]) v.classList.add('bump');
      now[s.name] = s.score;
    }
    box.append(d);
  }
  box._prev = now;
}

// Karta hasła: duży cytat i podpis (kto jest wyrocznią).
function renderClue(el, clue, psychic) {
  el.textContent = '';
  el.append(mk('div', 'clue-label', psychic ? `Hasło · wyrocznia ${psychic}` : 'Hasło'));
  el.append(mk('div', `clue-text${clue ? '' : ' none'}`, clue ? `„${clue}”` : 'podane na głos'));
}

// Karta wyniku rundy: odznaka z punktami, nazwa trafienia, punkty, dodatkowa informacja.
const HIT_NAMES = { 4: 'Sam środek!', 3: 'Bardzo blisko', 2: 'Na brzegu celu', 0: 'Pudło' };
function renderResult(el, r) {
  el.className = `result pts-${r.pts}${r.bonus ? ' bonus' : ''}`;
  el.textContent = '';
  el.append(mk('div', 'res-badge', r.pts ? `+${r.pts}` : '0'));
  const txt = mk('div', 'res-txt');
  txt.append(mk('span', 'res-eyebrow', r.eyebrow || HIT_NAMES[r.pts] || ''));
  txt.append(mk('b', 'res-title', r.title));
  if (r.sub) txt.append(mk('span', 'res-sub', r.sub));
  el.append(txt);
}

// Podsumowanie gry: paski drużyn albo kropki rund (+ licznik do wygranej), na końcu krótkie statystyki.
// sum: { kind: 'teams', rows: [{ name, score, max, win, team }], stats }
//    | { kind: 'rounds', dots: [pkt], meter: { value, max, mark, label } | null, stats }
function renderSummary(el, sum) {
  el.textContent = '';
  if (!sum) return;
  if (sum.kind === 'teams') {
    for (const r of sum.rows) {
      const row = mk('div', `sum-team team-${r.team}${r.win ? ' win' : ''}`);
      const name = mk('span', 'sum-name');
      if (r.win) name.insertAdjacentHTML('afterbegin', icon('crown'));
      name.append(r.name);
      const bar = mk('div', 'sum-bar');
      const fill = mk('i');
      fill.style.width = `${Math.round(Math.min(1, r.score / Math.max(1, r.max)) * 100)}%`;
      bar.append(fill);
      row.append(name, bar, mk('b', 'sum-score', String(r.score)));
      el.append(row);
    }
  } else {
    if (sum.meter) {
      const m = mk('div', 'sum-meter');
      const fill = mk('i');
      fill.style.width = `${Math.round(Math.min(1, sum.meter.value / sum.meter.max) * 100)}%`;
      const mark = mk('span', 'mark');
      mark.style.left = `${Math.round((sum.meter.mark / sum.meter.max) * 100)}%`;
      mark.title = sum.meter.label;
      m.append(fill, mark);
      el.append(m, mk('div', 'sum-meter-label', sum.meter.label));
    }
    const dots = mk('div', 'sum-dots');
    for (const p of sum.dots) dots.append(mk('i', `p${p}`, String(p)));
    el.append(dots);
  }
  if (sum.stats) el.append(mk('p', 'sum-stats', sum.stats));
}

// Wstawia ikony do elementów z atrybutem data-icon i ilustracje do elementów z data-art.
function fillIcons(root) {
  (root || document).querySelectorAll('[data-icon]').forEach((e) => {
    if (!e.querySelector(':scope > .ico')) e.insertAdjacentHTML('afterbegin', icon(e.dataset.icon));
  });
  (root || document).querySelectorAll('[data-art]').forEach((e) => { e.innerHTML = art(e.dataset.art); });
}

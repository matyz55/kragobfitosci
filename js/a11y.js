'use strict';
// Klawiatura i czytniki ekranu: okna (fokus w środku, reszta strony niedostępna, Esc zamyka, powrót fokusu),
// zakładki zasad sterowane strzałkami, skróty klawiszowe w grze i okno z ich listą.

const touchOnly = () => window.matchMedia('(pointer: coarse)').matches;

// ---------- okna ----------
// Działa dla każdego okna .overlay – niezależnie od tego, który fragment gry je otwiera (klasa „hidden”).
const Overlays = { opener: new Map(), open: new Map() };

function openOverlay() {
  return [...document.querySelectorAll('.overlay')].find((o) => !o.classList.contains('hidden')) || null;
}

// Fokus w oknie: pole tekstowe (nie na telefonie – nie wyskakuje klawiatura), główny przycisk, pierwszy przycisk.
function overlayFocus(o) {
  const vis = (el) => el && el.getClientRects().length;
  const input = o.querySelector('input[type="text"]');
  if (vis(input) && !touchOnly()) return input;
  const btns = [...o.querySelectorAll('.actions button')].filter(vis);
  return btns.find((b) => b.classList.contains('primary')) || btns[0] || o.querySelector('button');
}

function overlayChanged(o) {
  const open = !o.classList.contains('hidden');
  // tylko prawdziwe otwarcie albo zamknięcie (zmiana samej treści otwartego okna – patrz deckDialog)
  if (Overlays.open.get(o) === open) return;
  Overlays.open.set(o, open);
  // tło (górny pasek i ekrany) niedostępne, dopóki okno jest otwarte – Tab i czytnik ekranu zostają w oknie
  document.querySelectorAll('body > header, body > main').forEach((el) => { el.inert = !!openOverlay(); });
  if (open) {
    if (!Overlays.opener.has(o)) Overlays.opener.set(o, document.activeElement);
    if (!o.contains(document.activeElement)) { const f = overlayFocus(o); if (f) f.focus(); }
  } else {
    const back = Overlays.opener.get(o);
    Overlays.opener.delete(o);
    if (back && back.isConnected && !back.closest('[inert]')) back.focus({ preventScroll: true });
  }
}

function closeOverlay(o) {
  const btn = o.querySelector('[data-close]');
  if (btn) btn.click(); else o.classList.add('hidden');
}

// ---------- zakładki zasad: strzałki, Home, End ----------

function rulesTabKeys(e) {
  const tabs = [...document.querySelectorAll('#screen-rules .tab')];
  const i = tabs.indexOf(e.target);
  if (i < 0) return;
  const next = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: tabs.length - 1 }[e.key];
  if (next == null) return;
  e.preventDefault();
  const t = tabs[(next + tabs.length) % tabs.length];
  showRulesTab(t.dataset.tab);
  t.focus();
}

// ---------- skróty w grze ----------
// Enter – główny przycisk etapu (gdy fokus nie stoi na przycisku), L / P (ang. R) albo strzałki – lewo/prawo,
// 1 / 2 – wybór karty przez wyrocznię, ? – lista skrótów, Esc – zamknięcie okna.

function onKey(e) {
  if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
  const o = openOverlay();
  if (e.key === 'Escape') {
    if (o) { e.preventDefault(); closeOverlay(o); }
    return;
  }
  if (o) return;
  const t = e.target;
  if (t.matches && t.matches('input[type="text"], textarea, select')) return;
  if (e.key === '?') { e.preventDefault(); showKeys(); return; }
  const screen = document.querySelector('.screen:not(.hidden)');
  if (!screen) return;
  const k = e.key.toLowerCase();
  if (screen.id === 'screen-play') {
    const onRange = t.id === 'dial-range';
    if (state.phase === 'lr') {
      const right = LANG === 'pl' ? 'p' : 'r';
      if (k === 'l' || (k === 'arrowleft' && !onRange)) { e.preventDefault(); $('#btn-left').click(); return; }
      if (k === right || (k === 'arrowright' && !onRange)) { e.preventDefault(); $('#btn-right').click(); return; }
    }
    if (state.phase === 'psychic' && (k === '1' || k === '2')) {
      const c = document.querySelector(`#card-choice .choice[data-i="${Number(k) - 1}"]`);
      if (c) { e.preventDefault(); c.click(); c.focus(); }
      return;
    }
  }
  if (e.key === 'Enter' && t.tagName !== 'BUTTON' && ['screen-play', 'screen-pass'].includes(screen.id)) {
    const b = [...screen.querySelectorAll('button.primary')].find((x) => x.getClientRects().length && !x.disabled);
    if (b) { e.preventDefault(); b.click(); }
  }
}

// Okno z listą skrótów (przycisk „Klawiatura” w zasadach albo klawisz „?”).
function showKeys() {
  const rows = [
    [T('← →'), T('przesuwają wskazówkę (z Shift o 5, PageUp i PageDown o 10)')],
    [T('Enter'), T('zatwierdza i przechodzi dalej')],
    [LANG === 'pl' ? 'L / P' : 'L / R', T('lewo albo prawo (drużyna przeciwna)')],
    ['1 / 2', T('wybór karty przez wyrocznię')],
    [T('Tab'), T('przejście do następnego przycisku')],
    [T('Esc'), T('zamyka okno')],
    ['?', T('ta lista')],
  ];
  const dl = mk('dl', 'keys');
  for (const [key, what] of rows) dl.append(mk('dt', null, key), mk('dd', null, what));
  deckDialog(T('Skróty klawiszowe'), [dl], [button(T('OK'), 'primary', closeDeckDialog)]);
}

function initA11y() {
  const obs = new MutationObserver((list) => {
    for (const m of list) if (m.target.classList.contains('overlay')) overlayChanged(m.target);
  });
  document.querySelectorAll('.overlay').forEach((o) => obs.observe(o, { attributes: true, attributeFilter: ['class'] }));
  document.addEventListener('keydown', onKey);
  document.querySelector('#screen-rules .tabs').addEventListener('keydown', rulesTabKeys);
  $('#btn-keys').addEventListener('click', showKeys);
  showRulesTab('basics');
}

initA11y();

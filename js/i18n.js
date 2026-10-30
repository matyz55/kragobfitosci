'use strict';
// Język gry: polski (tekst źródłowy) albo angielski. Tłumaczy słownik „tekst polski → angielski” (js/i18n-en.js):
// T('Tekst {0}', x) w kodzie i translatePage() dla stałych napisów strony (teksty, placeholder, aria-label, title).
// Wybór języka: ?lang= w adresie, potem ustawienie gracza, potem języki przeglądarki (jest wśród nich polski → pl).
const LANGS = ['pl', 'en'];
const LANG = (() => {
  try {
    const q = new URLSearchParams(window.location.search).get('lang');
    if (LANGS.includes(q)) return q;
    const s = JSON.parse(localStorage.getItem('krag.settings') || '{}');
    if (s && LANGS.includes(s.lang)) return s.lang;
  } catch {}
  const langs = navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || 'pl'];
  return langs.some((l) => /^pl\b/i.test(l)) ? 'pl' : 'en';
})();
document.documentElement.lang = LANG;
window.I18N_EN = window.I18N_EN || {};

const hasKey = (o, k) => Object.prototype.hasOwnProperty.call(o, k);

function T(text, ...args) {
  const out = LANG === 'en' && hasKey(window.I18N_EN, text) ? window.I18N_EN[text] : text;
  return args.length ? out.replace(/\{(\d+)\}/g, (m, i) => (args[i] != null ? args[i] : m)) : out;
}

// Stałe napisy strony w języku gry. Fragmenty z wyróżnieniami (np. zasady) mają data-i18n i gotowy HTML w słowniku
// I18N_EN_HTML – to nasze własne teksty z pliku gry, nie dane z zewnątrz.
function translatePage(root = document.body) {
  if (LANG === 'pl') return;
  const dict = window.I18N_EN;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const v = n.nodeValue, key = v.replace(/\s+/g, ' ').trim();
    if (key && hasKey(dict, key)) n.nodeValue = v.match(/^\s*/)[0] + dict[key] + v.match(/\s*$/)[0];
  }
  for (const el of root.querySelectorAll('[placeholder], [aria-label], [title], [alt], input[type="text"][value]')) {
    for (const a of ['placeholder', 'aria-label', 'title', 'alt', 'value']) {
      const v = el.getAttribute(a);
      if (v && hasKey(dict, v)) el.setAttribute(a, dict[v]);
    }
  }
  const html = window.I18N_EN_HTML || {};
  for (const el of root.querySelectorAll('[data-i18n]')) if (hasKey(html, el.dataset.i18n)) el.innerHTML = html[el.dataset.i18n];
  const meta = document.querySelector('meta[name="description"]');
  if (meta && hasKey(dict, meta.content)) meta.content = dict[meta.content];
  if (hasKey(dict, document.title)) document.title = dict[document.title];
}

'use strict';
// Język interfejsu: polski (tekst źródłowy) albo angielski (słownik tekst polski → angielski w i18n-en.js),
// tak jak w Songsterze. T('Tekst {0}', x) – tłumaczy i wstawia wartości w miejsca {0}, {1}…
const LANG = 'pl';
window.I18N_EN = window.I18N_EN || {};

function T(text, ...args) {
  const out = LANG === 'en' && Object.prototype.hasOwnProperty.call(window.I18N_EN, text) ? window.I18N_EN[text] : text;
  return args.length ? out.replace(/\{(\d+)\}/g, (m, i) => (args[i] != null ? args[i] : m)) : out;
}

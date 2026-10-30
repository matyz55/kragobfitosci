'use strict';
// Ekrany własnych talii: lista talii, karty jednej talii (strony zamiast przewijania), formularz karty z tarczą,
// udostępnianie (link i kod QR) oraz dodawanie talii z linku. Teksty z talii zawsze przez textContent.

const Editor = { deck: null, card: -1, page: 0, back: 'screen-menu', dial: null, wasPlayable: false };

// napis na przycisku z ikoną (ikona zostaje)
const setLabel = (b, text) => { b.lastChild.nodeValue = text; };

// Przycisk wymagający potwierdzenia: pierwsze stuknięcie zmienia napis na „Na pewno?”, drugie wykonuje akcję.
function confirmTap(btn, label, action) {
  if (!btn.dataset.confirm) {
    btn.dataset.confirm = '1';
    setLabel(btn, T('Na pewno?'));
    clearTimeout(btn._reset);
    btn._reset = setTimeout(() => resetConfirm(btn, label), 4000);
    return;
  }
  resetConfirm(btn, label);
  action();
}
function resetConfirm(btn, label) {
  clearTimeout(btn._reset);
  btn.dataset.confirm = '';
  setLabel(btn, label);
}

// talia, która właśnie dostała pierwszą kartę (albo przyszła w linku), od razu jest wybrana do gry – sama
function chooseDeck(id) {
  settings.cats = [DECK_PREFIX + id];
  saveSettings();
}

// ---------- lista talii ----------

function openDecks(back) {
  Editor.back = back || 'screen-menu';
  renderDecks();
  show('screen-decks');
}

function decksBack() {
  if (Editor.back === 'screen-cats') {
    show('screen-cats');
    renderCats();
  } else show('screen-menu');
}

function renderDecks(highlight) {
  const list = $('#decks-list');
  list.textContent = '';
  const decks = Decks.list();
  $('#decks-empty').classList.toggle('hidden', decks.length > 0);
  list.classList.toggle('hidden', !decks.length);
  $('#decks-note').textContent = decks.length ? T('{0} z {1}', decks.length, DECK_LIMITS.decks) : '';
  for (const d of decks) {
    const b = button('', `deck-row${d.id === highlight ? ' new' : ''}`, () => editDeck(d.id));
    b.append(mk('span', 'deck-ico', d.icon), mk('b', 'deck-title', deckName(d)), mk('small', 'deck-meta', T('kart: {0}', d.cards.length)));
    b.dataset.id = d.id;
    list.append(b);
  }
  $('#btn-deck-new').disabled = Decks.full();
}

// ---------- jedna talia: nazwa, ikona i karty ----------

function newDeck() {
  if (Decks.full()) return;
  const used = Decks.list().map((d) => d.icon);
  Editor.deck = { id: newDeckId(), name: '', icon: DECK_ICONS.find((i) => !used.includes(i)) || DECK_ICONS[0], cards: [] };
  openDeck();
  focusLater($('#deck-name'));
}

function editDeck(id) {
  const d = Decks.get(id);
  if (!d) return;
  Editor.deck = { id: d.id, name: d.name, icon: d.icon, cards: d.cards.map((k) => k.slice()) };
  openDeck();
}

function openDeck(focusCard) {
  Editor.wasPlayable = Editor.deck.cards.length > 0;
  $('#deck-name').value = Editor.deck.name;
  showDeckIcon();
  resetConfirm($('#btn-deck-delete'), T('Usuń talię'));
  show('screen-deck');
  renderDeckCards(focusCard == null ? 0 : focusCard);
}

function showDeckIcon() {
  const b = $('#deck-icon');
  b.textContent = Editor.deck.icon;
  b.setAttribute('aria-label', T('Ikona talii: {0} (stuknij, żeby zmienić)', Editor.deck.icon));
}

// Zapis po każdej zmianie (nazwa, ikona, karty). Pusta talia bez nazwy nie zostaje w telefonie.
function persistDeck() {
  const d = Editor.deck;
  if (!d.cards.length && !d.name) Decks.remove(d.id);
  else Decks.save(d);
  if (d.cards.length && !Editor.wasPlayable) chooseDeck(d.id);
  Editor.wasPlayable = d.cards.length > 0;
  syncCats();
  saveSettings();
}

function deckDone() {
  const d = Editor.deck;
  if (!d.cards.length && !d.name) Decks.remove(d.id);
  syncCats();
  saveSettings();
  Editor.deck = null;
  renderDecks(d.id);
  show('screen-decks');
}

function deleteDeck() {
  confirmTap($('#btn-deck-delete'), T('Usuń talię'), () => {
    Decks.remove(Editor.deck.id);
    syncCats();
    saveSettings();
    Editor.deck = null;
    renderDecks();
    show('screen-decks');
  });
}

// Jedna karta na liście: końce skali i (jeśli jest) kropka w miejscu przykładowego hasła.
function cardRow(k, i) {
  const b = button('', 'choice card-row', () => openCard(i));
  const bar = mk('span', 'ch-bar');
  bar.append(mk('span', 'sr-only', ' – '));
  if (k[2]) {
    const dot = mk('i');
    dot.style.left = `${k[2][0][1]}%`;
    bar.append(dot);
  }
  b.append(mk('span', 'ch-l', k[0]), bar, mk('span', 'ch-r', k[1]));
  if (k[2]) b.append(mk('span', 'sr-only', T(', hasło: {0}', k[2][0][0])));
  return b;
}

// Karty talii stronami: tyle wierszy, ile mieści się na ekranie (bez przewijania).
function renderDeckCards(focus) {
  const list = $('#deck-cards');
  const cards = Editor.deck.cards;
  list.textContent = '';
  list.classList.toggle('empty', !cards.length);
  $('#deck-count').textContent = T('Karty: {0}/{1}', cards.length, DECK_LIMITS.cards);
  $('#deck-count').append(' ', mk('span', 'muted', T('hasła: {0}', cards.filter((k) => k[2]).length)));
  $('#btn-card-new').disabled = cards.length >= DECK_LIMITS.cards;
  $('#btn-deck-share').disabled = !cards.length;
  if (!cards.length) {
    $('#deck-pager').classList.add('hidden');
    list.append(mk('p', 'deck-empty', T('Dodaj pierwszą kartę: dwa przeciwieństwa, np. „Ranny ptaszek” i „Nocny marek”. W talii o znajomych hasłem może być imię.')));
    return;
  }
  // na szerokim ekranie karty stoją w kilku kolumnach
  const probe = cardRow(cards[0], 0);
  list.append(probe);
  const css = getComputedStyle(list);
  const gap = parseFloat(css.rowGap) || 0;
  const cols = css.gridTemplateColumns.split(' ').filter(Boolean).length || 1;
  let per = cols * Math.max(1, Math.floor((list.clientHeight + gap) / (probe.offsetHeight + gap)));
  if (focus != null) Editor.page = Math.floor(focus / per);
  const draw = () => {
    const pages = Math.ceil(cards.length / per);
    Editor.page = Math.max(0, Math.min(Editor.page, pages - 1));
    list.textContent = '';
    cards.slice(Editor.page * per, (Editor.page + 1) * per).forEach((k, j) => list.append(cardRow(k, Editor.page * per + j)));
    $('#deck-pager').classList.toggle('hidden', pages < 2);
    $('#deck-page').textContent = `${Editor.page + 1}/${pages}`;
    $('#btn-deck-prev').disabled = Editor.page === 0;
    $('#btn-deck-next').disabled = Editor.page >= pages - 1;
  };
  draw();
  // pokazanie przycisków stron mogło zabrać miejsce – wtedy o wiersz mniej
  while (per > 1 && list.scrollHeight > list.clientHeight + 1) { per--; draw(); }
}

function deckPage(step) {
  Editor.page += step;
  renderDeckCards();
}

// ---------- jedna karta ----------

function openCard(i) {
  Editor.card = i;
  const k = i >= 0 ? Editor.deck.cards[i] : null;
  $('#card-title').textContent = k ? T('Karta {0}', i + 1) : T('Nowa karta');
  $('#card-left').value = k ? k[0] : '';
  $('#card-right').value = k ? k[1] : '';
  $('#card-clue').value = k && k[2] ? k[2][0][0] : '';
  $('#card-error').classList.add('hidden');
  $('#btn-card-delete').classList.toggle('hidden', !k);
  resetConfirm($('#btn-card-delete'), T('Usuń'));
  show('screen-card');
  Editor.dial.set(k && k[2] ? k[2][0][1] : 50);
  updateCardPreview();
  if (!k) focusLater($('#card-left'));
}

// Podgląd na tarczy: końce skali z pól, wskazówka w miejscu hasła (przygaszona, gdy hasła nie ma).
function updateCardPreview() {
  const left = $('#card-left').value.trim(), right = $('#card-right').value.trim(), clue = $('#card-clue').value.trim();
  $('#card-spec-left').textContent = left || T('Lewy koniec');
  $('#card-spec-right').textContent = right || T('Prawy koniec');
  $('#card-dial-wrap').classList.toggle('dim', !clue);
  $('#card-note').textContent = clue
    ? T('Przesuń wskazówkę tam, gdzie leży „{0}”.', clue)
    : T('Hasło z miejscem na skali przyda się w grze jednoosobowej i w podpowiedziach dla wyroczni.');
  if (left && right) $('#card-error').classList.add('hidden');
}

const cleanText = (s, max) => s.replace(/\s+/g, ' ').trim().slice(0, max);

function saveCard() {
  const left = cleanText($('#card-left').value, DECK_LIMITS.side), right = cleanText($('#card-right').value, DECK_LIMITS.side);
  if (!left || !right) {
    $('#card-error').classList.remove('hidden');
    (left ? $('#card-right') : $('#card-left')).focus();
    return;
  }
  const clue = cleanText($('#card-clue').value, DECK_LIMITS.clue);
  const card = clue ? [left, right, [[clue, Editor.dial.value]]] : [left, right];
  const cards = Editor.deck.cards;
  let at = Editor.card;
  if (at >= 0) cards[at] = card;
  else { cards.push(card); at = cards.length - 1; }
  persistDeck();
  show('screen-deck');
  renderDeckCards(at);
}

function deleteCard() {
  confirmTap($('#btn-card-delete'), T('Usuń'), () => {
    const at = Editor.card;
    Editor.deck.cards.splice(at, 1);
    persistDeck();
    show('screen-deck');
    renderDeckCards(Math.max(0, at - 1));
  });
}

function cancelCard() {
  show('screen-deck');
  renderDeckCards(Math.max(0, Editor.card));
}

// ---------- okno talii (udostępnianie, dodawanie z linku, komunikaty) ----------

function deckDialog(title, body, actions) {
  const dlg = $('#deck-dialog'), wasOpen = !dlg.classList.contains('hidden');
  $('#deck-dialog-title').textContent = title;
  $('#deck-dialog-body').replaceChildren(...body);
  $('#deck-dialog-actions').replaceChildren(...actions);
  dlg.classList.remove('hidden');
  // nowa treść w otwartym już oknie: fokus na tytuł (czytnik ogłosi zmianę, trwające Enter niczego nie kliknie)
  if (wasOpen) $('#deck-dialog-title').focus();
}

function closeDeckDialog() {
  $('#deck-dialog').classList.add('hidden');
}

const deckErrors = {
  format: 'Ten link nie zawiera poprawnej talii – może został ucięty przy kopiowaniu.',
  empty: 'W tej talii nie ma żadnej karty.',
  'too-big': 'Ta talia jest za duża.',
  unsupported: 'Ta przeglądarka nie potrafi otworzyć talii z linku – zaktualizuj ją albo otwórz link w innej.',
};

function deckMessage(title, text) {
  deckDialog(title, [mk('p', null, text)], [button(T('OK'), 'primary', closeDeckDialog)]);
}

async function shareDeck() {
  const d = Editor.deck;
  if (!d.cards.length) return;
  persistDeck();
  const link = await deckLink(d);
  const qr = mk('div', 'share-qr', T('Tworzę kod QR…'));
  const copy = button(T('Kopiuj link'), 'ghost', async () => {
    try { await navigator.clipboard.writeText(link); setLabel(copy, T('Skopiowano')); } catch { setLabel(copy, T('Nie udało się skopiować')); }
  }, 'btn-share-copy');
  copy.dataset.icon = 'link';
  const actions = [copy];
  if (navigator.share) {
    const send = button(T('Wyślij'), 'primary', () => navigator.share({ title: deckName(d), text: T('Talia do gry Krąg obfitości: {0} {1}', d.icon, deckName(d)), url: link }).catch(() => {}), 'btn-share-send');
    send.dataset.icon = 'share';
    actions.push(send);
  }
  const box = mk('div', 'share-box');
  box.append(qr, mk('p', 'muted', T('Zeskanuj kod aparatem drugiego telefonu albo wyślij link. Cała talia jest w linku – bez konta i bez serwera.')));
  deckDialog(T('Udostępnij: {0} {1}', d.icon, deckName(d)), [box], actions);
  fillIcons($('#deck-dialog'));
  $('#deck-dialog').dataset.link = link;
  try {
    qr.innerHTML = await KragNet.qrSvg(link, 'L');
    qr.setAttribute('role', 'img');
    qr.setAttribute('aria-label', T('Kod QR z talią'));
  } catch (e) {
    qr.textContent = e && e.message === 'script'
      ? T('Kod QR potrzebuje internetu – wyślij link.')
      : T('Ta talia nie zmieści się w kodzie QR – wyślij link.');
    qr.classList.add('none');
  }
}

// Wklejenie linku (np. gdy gra jest zainstalowana i link otworzył się w przeglądarce, a nie w aplikacji).
function openPaste() {
  const input = document.createElement('input');
  input.type = 'text';
  input.id = 'deck-paste-input';
  input.placeholder = T('wklej tu link do talii');
  input.autocomplete = 'off';
  input.setAttribute('aria-label', T('Link do talii'));
  const err = mk('p', 'error hidden', '');
  err.id = 'deck-paste-error';
  const go = async () => {
    const code = deckCodeFrom(input.value);
    if (!code) { err.textContent = T('To nie jest link do talii z gry Krąg obfitości.'); err.classList.remove('hidden'); return; }
    try { offerDeck(await decodeDeck(code)); } catch (e) { err.textContent = T(deckErrors[e.message] || deckErrors.format); err.classList.remove('hidden'); }
  };
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
  deckDialog(T('Talia z linku'), [mk('p', 'muted', T('Wklej link, który dostałeś od znajomych.')), input, err],
    [button(T('Anuluj'), 'ghost', closeDeckDialog), button(T('Dalej'), 'primary', go, 'btn-paste-go')]);
  input.focus();
}

// Propozycja dodania talii z linku: nazwa, liczba kart i kilka pierwszych kart.
function offerDeck(deck) {
  if (Decks.same(deck)) { deckMessage(T('Masz już tę talię'), T('Talia „{0}” jest już zapisana w tym telefonie.', deckName(deck))); return; }
  if (Decks.full()) { deckMessage(T('Brak miejsca'), T('Masz już {0} talii – usuń którąś w „Moje talie”, żeby dodać nową.', DECK_LIMITS.decks)); return; }
  const preview = mk('ul', 'deck-preview');
  for (const k of deck.cards.slice(0, 3)) preview.append(mk('li', null, `${k[0]} ↔ ${k[1]}`));
  if (deck.cards.length > 3) preview.append(mk('li', 'muted', T('i jeszcze {0}…', deck.cards.length - 3)));
  const add = () => {
    deck.id = newDeckId();
    if (!Decks.save(deck)) { deckMessage(T('Nie udało się zapisać'), T('W pamięci przeglądarki brakuje miejsca.')); return; }
    chooseDeck(deck.id);
    closeDeckDialog();
    openDecks('screen-menu');
    renderDecks(deck.id);
  };
  deckDialog(T('Nowa talia: {0} {1}', deck.icon, deckName(deck)),
    [mk('p', null, T('Kart: {0}. Talia zapisze się tylko w tym telefonie i od razu będzie wybrana do gry.', deck.cards.length)), preview],
    [button(T('Nie, dziękuję'), 'ghost', closeDeckDialog), button(T('Dodaj talię'), 'primary', add, 'btn-import-add')]);
}

// Talia w adresie strony (#talia=…): po otwarciu linku od znajomych albo zeskanowaniu kodu QR.
async function checkSharedDeck() {
  const code = deckCodeFrom(window.location.hash);
  if (!code) return;
  history.replaceState(null, '', window.location.pathname + window.location.search);
  try { offerDeck(await decodeDeck(code)); } catch (e) { deckMessage(T('Nie da się otworzyć talii'), T(deckErrors[e.message] || deckErrors.format)); }
}

// ---------- start ----------

function initEditor() {
  Editor.dial = createDial($('#card-dial'), $('#card-range'), (v, user) => { if (user) { SFX.tick(v); Haptics.dial(v); } });
  Editor.dial.describe = (v) => describeNeedle(v, { left: $('#card-left').value.trim() || T('Lewy koniec'), right: $('#card-right').value.trim() || T('Prawy koniec') });
  $('#btn-decks').addEventListener('click', () => openDecks('screen-menu'));
  $('#btn-cats-decks').addEventListener('click', () => openDecks('screen-cats'));
  $('#btn-decks-back').addEventListener('click', decksBack);
  $('#btn-deck-new').addEventListener('click', newDeck);
  $('#btn-deck-paste').addEventListener('click', openPaste);
  $('#deck-name').addEventListener('input', () => { Editor.deck.name = cleanText($('#deck-name').value, DECK_LIMITS.name); persistDeck(); });
  $('#deck-icon').addEventListener('click', () => {
    Editor.deck.icon = DECK_ICONS[(DECK_ICONS.indexOf(Editor.deck.icon) + 1) % DECK_ICONS.length];
    showDeckIcon();
    persistDeck();
  });
  $('#btn-deck-prev').addEventListener('click', () => deckPage(-1));
  $('#btn-deck-next').addEventListener('click', () => deckPage(1));
  $('#btn-card-new').addEventListener('click', () => openCard(-1));
  $('#btn-deck-share').addEventListener('click', shareDeck);
  $('#btn-deck-delete').addEventListener('click', deleteDeck);
  $('#btn-deck-done').addEventListener('click', deckDone);
  ['#card-left', '#card-right', '#card-clue'].forEach((s) => $(s).addEventListener('input', updateCardPreview));
  $('#card-clue').addEventListener('keydown', (e) => { if (e.key === 'Enter') saveCard(); });
  $('#btn-card-save').addEventListener('click', saveCard);
  $('#btn-card-cancel').addEventListener('click', cancelCard);
  $('#btn-card-delete').addEventListener('click', deleteCard);
  $('#btn-deck-dialog-close').addEventListener('click', closeDeckDialog);
  $('#deck-dialog').addEventListener('keydown', (e) => { if (e.key === 'Escape') closeDeckDialog(); });
  // zmiana rozmiaru okna: liczba kart na stronie i układ kategorii liczone od nowa
  window.addEventListener('resize', () => {
    if (!$('#screen-deck').classList.contains('hidden')) renderDeckCards();
    if (!$('#screen-cats').classList.contains('hidden')) fitCats();
  });
  window.addEventListener('hashchange', checkSharedDeck);
  checkSharedDeck();
}

initEditor();

'use strict';
// Tarcza (półkole SVG) ze wskazówką i polami celu. Wartości na skali 0–100: 0 = lewy koniec, 100 = prawy.

const SVGNS = 'http://www.w3.org/2000/svg';
const DIAL = { cx: 200, cy: 200, r: 176 };

function dialPoint(v, r) {
  const a = Math.PI * (1 - v / 100);
  return [DIAL.cx + r * Math.cos(a), DIAL.cy - r * Math.sin(a)];
}

// Wycinek koła od wartości v1 do v2 (przycięty do skali).
function wedgePath(v1, v2, r) {
  v1 = Math.max(0, v1); v2 = Math.min(100, v2);
  if (v2 <= v1) return '';
  const [x1, y1] = dialPoint(v1, r), [x2, y2] = dialPoint(v2, r);
  return `M${DIAL.cx},${DIAL.cy} L${x1.toFixed(2)},${y1.toFixed(2)} A${r},${r} 0 0 1 ${x2.toFixed(2)},${y2.toFixed(2)} Z`;
}

// Łuk (sam obrys) od v1 do v2.
function arcPath(v1, v2, r) {
  const [x1, y1] = dialPoint(v1, r), [x2, y2] = dialPoint(v2, r);
  return `M${x1.toFixed(2)},${y1.toFixed(2)} A${r},${r} 0 0 1 ${x2.toFixed(2)},${y2.toFixed(2)}`;
}

function el(tag, attrs) {
  const e = document.createElementNS(SVGNS, tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  return e;
}

// Gradienty i cień – osobne identyfikatory dla każdej tarczy na stronie.
function dialDefs(id) {
  const { cx, cy, r } = DIAL;
  const radial = (name, stops, rr = r) => `<radialGradient id="${id}-${name}" gradientUnits="userSpaceOnUse" cx="${cx}" cy="${cy}" r="${rr}">${stops}</radialGradient>`;
  const stop = (o, c) => `<stop offset="${o}" stop-color="${c}"/>`;
  return `<defs>
    ${radial('face', stop(0, '#fffdf7') + stop(0.65, '#fbf1dc') + stop(1, '#ecd9b0'))}
    ${radial('bezel', stop(0.9, '#4a3a72') + stop(0.96, '#2a1f48') + stop(1, '#171029'), r + 16)}
    ${radial('b2', stop(0.15, '#f2b62f') + stop(1, '#ffe27a'))}
    ${radial('b3', stop(0.15, '#e9662a') + stop(1, '#ffa45c'))}
    ${radial('b4', stop(0.15, '#c81d45') + stop(1, '#ff5470'))}
    ${radial('hub', stop(0, '#7d6aa8') + stop(0.6, '#3a2b5e') + stop(1, '#1d1433'), 20)}
    <linearGradient id="${id}-rim" x1="0" x2="1" y1="0" y2="0">${stop(0, '#4f7cff')}${stop(0.5, '#a66bff')}${stop(1, '#ff5470')}</linearGradient>
    <linearGradient id="${id}-needle" x1="0" x2="1" y1="0" y2="0">${stop(0, '#2b1d3c')}${stop(0.5, '#53407a')}${stop(1, '#2b1d3c')}</linearGradient>
    <linearGradient id="${id}-shine" x1="0" x2="1" y1="0" y2="0">${stop(0, 'rgba(255,255,255,0)')}${stop(0.5, 'rgba(255,255,255,.55)')}${stop(1, 'rgba(255,255,255,0)')}</linearGradient>
    <filter id="${id}-shadow" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="3" stdDeviation="3" flood-color="#0b0614" flood-opacity=".45"/></filter>
    <filter id="${id}-glow" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="0" stdDeviation="4" flood-color="#fff" flood-opacity=".85"/></filter>
    <path id="${id}-arc" d="${arcPath(16, 84, r * 0.52)}"/>
  </defs>`;
}

// Tworzy tarczę w kontenerze. onChange(v, user) wywoływane przy ruszaniu wskazówką (user – ruch gracza).
function createDial(svg, range, onChange) {
  const id = svg.id || 'dial';
  const url = (n) => `url(#${id}-${n})`;
  const { cx, cy, r } = DIAL;
  svg.setAttribute('viewBox', '0 0 400 222');
  svg.setAttribute('preserveAspectRatio', 'xMidYMax meet');
  svg.innerHTML = dialDefs(id);

  // obudowa: półkole z obręczą i podstawa
  svg.append(el('path', { d: `${wedgePath(0, 100, r + 14)}`, fill: url('bezel'), class: 'dial-bezel', filter: url('shadow') }));
  svg.append(el('rect', { x: cx - r - 18, y: cy - 4, width: 2 * r + 36, height: 20, rx: 10, class: 'dial-base' }));
  svg.append(el('path', { d: arcPath(6, 40, r + 7), stroke: url('shine'), class: 'dial-shine' }));
  svg.append(el('path', { d: wedgePath(0, 100, r), fill: url('face'), class: 'dial-face' }));
  svg.append(el('path', { d: arcPath(0.4, 99.6, r - 4), stroke: url('rim'), class: 'dial-rim' }));
  // zdobienia: przerywany pierścień i napis wzdłuż łuku
  svg.append(el('path', { d: arcPath(2, 98, r * 0.66), class: 'dial-ring' }));
  const brand = el('text', { class: 'dial-brand' });
  const tp = el('textPath', { href: `#${id}-arc`, startOffset: '50%' });
  tp.textContent = 'KRĄG OBFITOŚCI';
  brand.append(tp);
  svg.append(brand);

  const targetG = el('g', { class: 'dial-target' });
  svg.append(targetG);
  for (let v = 0; v <= 100; v += 5) {
    const major = v % 10 === 0;
    const [x1, y1] = dialPoint(v, r - (major ? 18 : 12)), [x2, y2] = dialPoint(v, r - 7);
    svg.append(el('line', { x1, y1, x2, y2, class: major ? 'dial-tick major' : 'dial-tick' }));
  }
  const lrMark = el('g', { class: 'dial-lr hidden' });
  svg.append(lrMark);

  // wskazówka: zwężający się grot obracany wokół osi
  const needle = el('g', { class: 'dial-needle', filter: url('shadow') });
  needle.append(
    el('path', { d: `M${cx - 9},${cy} L${cx - 2.5},${cy - r + 16} Q${cx},${cy - r + 8} ${cx + 2.5},${cy - r + 16} L${cx + 9},${cy} Z`, fill: url('needle') }),
    el('circle', { cx, cy: cy - r + 26, r: 3.2, class: 'needle-tip' }),
  );
  svg.append(needle);
  svg.append(el('circle', { cx, cy, r: 19, fill: url('hub'), class: 'dial-hub' }));
  svg.append(el('circle', { cx, cy, r: 7, class: 'dial-hub-cap' }));
  // liczby pól celu leżą nad wskazówką, żeby jej nie zasłaniała
  const labelsG = el('g', { class: 'dial-target dial-labels' });
  svg.append(labelsG);
  let bandPaths = [];
  let curTarget = null;

  // zablokowana tarcza: wskazówka i suwak pod nią nie reagują (po odpowiedzi, u psychika, na dużym ekranie)
  let locked = false;
  const api = {
    value: 50,
    get locked() { return locked; },
    set locked(v) {
      locked = !!v;
      range.disabled = locked;
      svg.classList.toggle('locked', locked);
    },
    set(v, user) {
      v = Math.max(0, Math.min(100, Math.round(v * 2) / 2));
      api.value = v;
      svg.classList.toggle('instant', !!user); // ruch gracza bez opóźnienia, ruch gry płynnie
      needle.style.transform = `rotate(${((v - 50) * 1.8).toFixed(2)}deg)`;
      range.value = String(v);
      if (onChange) onChange(v, !!user);
    },
    showTarget(t, coop) {
      api.hideTarget();
      curTarget = t;
      const bands = [[-2.5, -1.5, 2], [-1.5, -0.5, 3], [-0.5, 0.5, coop ? 3 : 4], [0.5, 1.5, 3], [1.5, 2.5, 2]];
      for (const [a, b, p] of bands) {
        const d = wedgePath(t + a * BAND, t + b * BAND, r - 1);
        if (!d) { bandPaths.push(null); continue; }
        const centre = a === -0.5;
        // środek celu zawsze wyróżniony (czerwony); we współpracy daje 3 pkt i dodatkową kartę – podpis „3+”
        const path = el('path', { d, fill: url(centre ? 'b4' : `b${p}`), class: `band band-${p}${centre ? ' band-center' : ''}${centre && coop ? ' band-bonus' : ''}` });
        targetG.append(path);
        bandPaths.push(path);
        const mid = (Math.max(0, t + a * BAND) + Math.min(100, t + b * BAND)) / 2;
        const [lx, ly] = dialPoint(mid, r - 30);
        if (mid > 0 && mid < 100 && Math.min(100, t + b * BAND) - Math.max(0, t + a * BAND) >= BAND * 0.6) {
          const bonus = centre && coop;
          const txt = el('text', { x: lx.toFixed(1), y: ly.toFixed(1), class: `band-label${bonus ? ' bonus' : ''}` });
          txt.textContent = bonus ? '3+' : String(p);
          labelsG.append(txt);
        }
      }
      // animacja odsłonięcia (wachlarz rozkłada się od osi)
      requestAnimationFrame(() => { targetG.classList.add('reveal'); labelsG.classList.add('reveal'); });
    },
    hideTarget() {
      targetG.textContent = '';
      labelsG.textContent = '';
      targetG.classList.remove('reveal', 'scored');
      labelsG.classList.remove('reveal');
      bandPaths = [];
      curTarget = null;
    },
    // wyróżnienie pola, w które trafiła wskazówka (pozostałe lekko przygaszone);
    // pole wybierane tak jak w punktacji (scoreFor) – na granicy dwóch pól liczy się lepsze
    markHit(v) {
      if (curTarget == null) return false;
      const d = Math.abs(v - curTarget), left = v < curTarget;
      const idx = d <= BAND / 2 ? 2 : d <= BAND * 1.5 ? (left ? 1 : 3) : d <= BAND * 2.5 ? (left ? 0 : 4) : -1;
      const hit = idx >= 0 ? bandPaths[idx] : null;
      targetG.classList.add('scored');
      for (const p of bandPaths) if (p) p.classList.toggle('hit', p === hit);
      if (hit) { hit.setAttribute('filter', url('glow')); targetG.append(hit); }
      return !!hit;
    },
    // znacznik wskazania „lewo/prawo” drużyny przeciwnej
    showLR(side, cls) {
      lrMark.textContent = '';
      lrMark.setAttribute('class', `dial-lr${cls ? ` ${cls}` : ''}${side ? '' : ' hidden'}`);
      if (!side) return;
      const off = side === 'L' ? -13 : 13;
      const [x, y] = dialPoint(Math.max(6, Math.min(94, api.value + off)), r * 0.5);
      lrMark.append(el('circle', { cx: x.toFixed(1), cy: y.toFixed(1), r: 17, class: 'lr-bg' }));
      const t = el('text', { x: x.toFixed(1), y: (y + 1).toFixed(1), class: 'lr-label' });
      t.textContent = side === 'L' ? '◀' : '▶';
      lrMark.append(t);
    },
  };

  function fromEvent(e) {
    const pt = svg.createSVGPoint();
    pt.x = e.clientX; pt.y = e.clientY;
    const p = pt.matrixTransform(svg.getScreenCTM().inverse());
    const a = Math.atan2(Math.max(0, cy - p.y), p.x - cx);
    return 100 * (1 - a / Math.PI);
  }
  let dragging = false;
  const drag = (on) => { dragging = on; };
  svg.addEventListener('pointerdown', (e) => {
    if (api.locked) return;
    drag(true);
    svg.setPointerCapture(e.pointerId);
    api.set(fromEvent(e), true);
  });
  svg.addEventListener('pointermove', (e) => { if (dragging && !api.locked) api.set(fromEvent(e), true); });
  svg.addEventListener('pointerup', () => drag(false));
  svg.addEventListener('pointercancel', () => drag(false));
  range.addEventListener('input', () => { if (!api.locked) api.set(Number(range.value), true); });

  api.set(50);
  return api;
}

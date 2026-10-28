'use strict';
// Tarcza (półkole SVG) ze wskazówką i polami celu. Wartości na skali 0–100: 0 = lewy koniec, 100 = prawy.

const SVGNS = 'http://www.w3.org/2000/svg';
const DIAL = { cx: 200, cy: 200, r: 180 };

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

function el(tag, attrs) {
  const e = document.createElementNS(SVGNS, tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  return e;
}

// Tworzy tarczę w kontenerze. onChange(v) wywoływane przy ruszaniu wskazówką.
function createDial(svg, range, onChange) {
  svg.setAttribute('viewBox', '0 0 400 215');
  svg.textContent = '';
  svg.append(el('path', { d: wedgePath(0, 100, DIAL.r), class: 'dial-face' }));
  const targetG = el('g', { class: 'dial-target' });
  svg.append(targetG);
  for (let v = 0; v <= 100; v += 10) {
    const [x1, y1] = dialPoint(v, DIAL.r - 8), [x2, y2] = dialPoint(v, DIAL.r);
    svg.append(el('line', { x1, y1, x2, y2, class: 'dial-tick' }));
  }
  const lrMark = el('g', { class: 'dial-lr hidden' });
  svg.append(lrMark);
  const needle = el('line', { x1: DIAL.cx, y1: DIAL.cy, x2: DIAL.cx, y2: DIAL.cy - DIAL.r + 6, class: 'dial-needle' });
  svg.append(needle, el('circle', { cx: DIAL.cx, cy: DIAL.cy, r: 14, class: 'dial-hub' }));

  const api = {
    value: 50,
    locked: false,
    set(v) {
      v = Math.max(0, Math.min(100, Math.round(v * 2) / 2));
      api.value = v;
      const [x, y] = dialPoint(v, DIAL.r - 6);
      needle.setAttribute('x2', x.toFixed(2));
      needle.setAttribute('y2', y.toFixed(2));
      range.value = String(v);
      if (onChange) onChange(v);
    },
    showTarget(t, coop) {
      targetG.textContent = '';
      const bands = [[-2.5, -1.5, 2], [-1.5, -0.5, 3], [-0.5, 0.5, coop ? 3 : 4], [0.5, 1.5, 3], [1.5, 2.5, 2]];
      for (const [a, b, p] of bands) {
        const d = wedgePath(t + a * BAND, t + b * BAND, DIAL.r - 2);
        if (!d) continue;
        targetG.append(el('path', { d, class: `band band-${p}${a === -0.5 ? ' band-center' : ''}` }));
        const mid = (Math.max(0, t + a * BAND) + Math.min(100, t + b * BAND)) / 2;
        const [lx, ly] = dialPoint(mid, DIAL.r - 26);
        if (mid > 0 && mid < 100 && Math.min(100, t + b * BAND) - Math.max(0, t + a * BAND) >= BAND * 0.6) {
          const txt = el('text', { x: lx.toFixed(1), y: ly.toFixed(1), class: 'band-label' });
          txt.textContent = String(p);
          targetG.append(txt);
        }
      }
    },
    hideTarget() { targetG.textContent = ''; },
    // strzałka wskazania „lewo/prawo” drużyny przeciwnej
    showLR(side) {
      lrMark.textContent = '';
      if (!side) { lrMark.classList.add('hidden'); return; }
      lrMark.classList.remove('hidden');
      const off = side === 'L' ? -12 : 12;
      const [x, y] = dialPoint(Math.max(2, Math.min(98, api.value + off)), DIAL.r * 0.55);
      const t = el('text', { x: x.toFixed(1), y: y.toFixed(1), class: 'lr-label' });
      t.textContent = side === 'L' ? '◀' : '▶';
      lrMark.append(t);
    },
  };

  function fromEvent(e) {
    const pt = svg.createSVGPoint();
    pt.x = e.clientX; pt.y = e.clientY;
    const p = pt.matrixTransform(svg.getScreenCTM().inverse());
    const a = Math.atan2(Math.max(0, DIAL.cy - p.y), p.x - DIAL.cx);
    return 100 * (1 - a / Math.PI);
  }
  let dragging = false;
  svg.addEventListener('pointerdown', (e) => {
    if (api.locked) return;
    dragging = true;
    svg.setPointerCapture(e.pointerId);
    api.set(fromEvent(e));
  });
  svg.addEventListener('pointermove', (e) => { if (dragging && !api.locked) api.set(fromEvent(e)); });
  svg.addEventListener('pointerup', () => { dragging = false; });
  svg.addEventListener('pointercancel', () => { dragging = false; });
  range.addEventListener('input', () => { if (!api.locked) api.set(Number(range.value)); });

  api.set(50);
  return api;
}

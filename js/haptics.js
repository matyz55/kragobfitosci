'use strict';
// Wibracje (Vibration API – telefony z Androidem; Safari na iPhonie tego nie obsługuje).
// Przy przesuwaniu wskazówki telefon „klika” na każdej kresce podziałki – mocniej na dłuższych kreskach i na końcach skali.
// Wibracje można wyłączyć przyciskiem 📳 w menu (ustawienie zapamiętywane).

const HAPTIC_KEY = 'krag.haptics';

const Haptics = (() => {
  const supported = 'vibrate' in navigator;
  let on = true;
  try { on = localStorage.getItem(HAPTIC_KEY) !== 'off'; } catch {}
  let lastStep = null;
  let lastAt = 0;
  let atEdge = false;

  function buzz(pattern) {
    if (!supported || !on) return;
    try { navigator.vibrate(pattern); } catch {}
  }

  return {
    supported,
    get enabled() { return on; },
    toggle() {
      on = !on;
      try { localStorage.setItem(HAPTIC_KEY, on ? 'on' : 'off'); } catch {}
      buzz(on ? 30 : 0);
      return on;
    },
    // wskazówka minęła kreskę podziałki (co 5 na skali 0–100; co 10 – dłuższa kreska)
    dial(v) {
      // dojście do końca skali – zawsze wyraźne „stuknięcie”
      const edge = v <= 0 || v >= 100;
      if (edge && !atEdge) { atEdge = true; lastStep = Math.round(v / 5); lastAt = performance.now(); buzz(28); return; }
      atEdge = edge;
      const step = Math.round(v / 5);
      if (lastStep === null) { lastStep = step; return; }
      if (step === lastStep) return;
      lastStep = step;
      const now = performance.now();
      if (now - lastAt < 22) return; // przy bardzo szybkim ruchu bez ciągłego brzęczenia
      lastAt = now;
      buzz(step % 2 === 0 ? 14 : 7);
    },
    // wskazówka ustawiona przez grę (nowa runda) – bez wibracji, tylko zapamiętanie pozycji
    sync(v) { lastStep = Math.round(v / 5); atEdge = v <= 0 || v >= 100; },
    tap() { buzz(8); },
    mystic() { buzz([12, 70, 12, 70, 24]); },
    hide() { buzz(35); },
    points(p) {
      if (p >= 4) buzz([40, 50, 40, 50, 120]);
      else if (p === 3) buzz([40, 60, 80]);
      else if (p === 2) buzz([60]);
      else buzz([150]);
    },
    bonus(ok) { if (ok) setTimeout(() => buzz([20, 40, 20]), 600); },
    win() { buzz([60, 60, 60, 60, 60, 60, 250]); },
    end() { buzz([80, 80, 80]); },
  };
})();

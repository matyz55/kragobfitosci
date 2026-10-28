'use strict';
// Efekty dźwiękowe tworzone na bieżąco (Web Audio API) – bez plików audio.
// Dźwięk można wyłączyć przyciskiem 🔊 w górnym pasku (ustawienie zapamiętywane).

const SOUND_KEY = 'krag.sound';

const SFX = (() => {
  let ctx = null;
  let master = null;
  let on = true;
  try { on = localStorage.getItem(SOUND_KEY) !== 'off'; } catch {}

  // Kontekst audio tworzymy dopiero po geście gracza (wymóg przeglądarek).
  function ac() {
    if (!on) return null;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    if (!ctx) {
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return ctx;
  }

  // Pojedynczy ton z krótkim narastaniem i wygaszaniem.
  function tone(freq, start, dur, { type = 'sine', vol = 0.3, slide = 0 } = {}) {
    const c = ac();
    if (!c) return;
    const t = c.currentTime + start;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  // Szum (świst przy zasłanianiu tarczy).
  function noise(start, dur, vol = 0.2, from = 1800, to = 300) {
    const c = ac();
    if (!c) return;
    const t = c.currentTime + start;
    const buf = c.createBuffer(1, Math.ceil(c.sampleRate * dur), c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    src.buffer = buf;
    f.type = 'bandpass';
    f.frequency.setValueAtTime(from, t);
    f.frequency.exponentialRampToValueAtTime(to, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + dur * 0.3);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(master);
    src.start(t);
  }

  let lastTick = 0;

  return {
    get enabled() { return on; },
    toggle() {
      on = !on;
      try { localStorage.setItem(SOUND_KEY, on ? 'on' : 'off'); } catch {}
      if (on) this.click();
      return on;
    },
    // stuknięcie przycisku
    click() { tone(520, 0, 0.06, { type: 'triangle', vol: 0.12 }); },
    // tyknięcie tarczy przy przesuwaniu wskazówki (wysokość rośnie w prawo)
    tick(v) {
      const now = performance.now();
      if (now - lastTick < 45) return;
      lastTick = now;
      tone(300 + v * 6, 0, 0.035, { type: 'square', vol: 0.05 });
    },
    // odsłonięcie celu dla psychika – tajemniczy akord
    mystic() { [440, 554, 659, 880].forEach((f, i) => tone(f, i * 0.07, 0.6, { vol: 0.12 })); },
    // zasłonięcie tarczy
    hide() { noise(0, 0.35, 0.25); },
    // wynik rundy: 4 pkt – fanfara, 3 i 2 – krótsze, 0 – pudło
    points(p) {
      if (p >= 4) [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.09, 0.35, { type: 'triangle', vol: 0.25 }));
      else if (p === 3) [523, 659, 784].forEach((f, i) => tone(f, i * 0.09, 0.3, { type: 'triangle', vol: 0.22 }));
      else if (p === 2) [523, 659].forEach((f, i) => tone(f, i * 0.09, 0.28, { type: 'triangle', vol: 0.2 }));
      else { tone(220, 0, 0.25, { type: 'sawtooth', vol: 0.12, slide: -80 }); tone(160, 0.2, 0.35, { type: 'sawtooth', vol: 0.12, slide: -60 }); }
    },
    // trafione / nietrafione „lewo/prawo”
    bonus(ok) { if (ok) tone(880, 0.45, 0.18, { type: 'sine', vol: 0.18 }); },
    // koniec gry
    win() {
      const notes = [523, 659, 784, 1047, 784, 1047];
      notes.forEach((f, i) => tone(f, i * 0.12, i === notes.length - 1 ? 0.7 : 0.2, { type: 'triangle', vol: 0.25 }));
    },
    end() { [392, 330, 262].forEach((f, i) => tone(f, i * 0.16, 0.3, { type: 'triangle', vol: 0.2 })); },
  };
})();

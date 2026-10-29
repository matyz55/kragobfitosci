'use strict';
// Statystyki zapisywane tylko w tej przeglądarce (nic nie wychodzi z urządzenia): rozegrane gry, celność,
// wyrocznie, ulubione kategorie oraz wyniki i seria dni wyzwania dnia.

const STATS_KEY = 'krag.stats';
const DAILY_KEY = 'krag.daily';

const Stats = (() => {
  const read = (key, def) => { try { const v = JSON.parse(localStorage.getItem(key)); return v == null ? def : v; } catch { return def; } };
  const write = (key, v) => { try { localStorage.setItem(key, JSON.stringify(v)); } catch {} };
  const empty = () => ({
    v: 1, games: { solo: 0, teams: 0, coop: 0, daily: 0 }, rounds: 0, points: 0, centres: 0, misses: 0,
    cats: {}, oracles: {}, best: { coop: 0 },
  });
  const load = () => {
    const s = Object.assign(empty(), read(STATS_KEY, {}));
    s.games = Object.assign(empty().games, s.games);
    s.best = Object.assign(empty().best, s.best);
    return s;
  };

  // dzień przed podanym (RRRR-MM-DD)
  const prevDay = (day) => {
    const [y, m, d] = day.split('-').map(Number);
    return todayKey(new Date(y, m - 1, d - 1));
  };

  return {
    // jedna runda: punkty, trafienie w środek, kategoria karty i (w drużynach i współpracy) imię wyroczni
    round({ pts, centre, cat, oracle }) {
      const s = load();
      s.rounds++;
      s.points += pts;
      if (centre) s.centres++;
      if (pts === 0) s.misses++;
      if (cat) s.cats[cat] = (s.cats[cat] || 0) + 1;
      if (oracle) {
        const o = s.oracles[oracle] || (s.oracles[oracle] = { rounds: 0, points: 0, centres: 0 });
        o.rounds++;
        o.points += pts;
        if (centre) o.centres++;
      }
      write(STATS_KEY, s);
    },
    // koniec gry; we współpracy zapamiętujemy najlepszy wspólny wynik
    game(mode, score) {
      const s = load();
      s.games[mode] = (s.games[mode] || 0) + 1;
      if (mode === 'coop') s.best.coop = Math.max(s.best.coop, score);
      write(STATS_KEY, s);
    },
    // gotowe liczby do ekranu statystyk
    summary() {
      const s = load();
      const games = Object.values(s.games).reduce((a, b) => a + b, 0);
      const oracles = Object.entries(s.oracles)
        .filter(([, o]) => o.rounds >= 3)
        .map(([name, o]) => ({ name, rounds: o.rounds, avg: o.points / o.rounds, centres: o.centres }))
        .sort((a, b) => b.avg - a.avg || b.rounds - a.rounds);
      const cats = Object.entries(s.cats).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([id, n]) => ({ id, n }));
      return {
        games, byMode: s.games, rounds: s.rounds,
        avg: s.rounds ? s.points / s.rounds : 0,
        centrePct: s.rounds ? Math.round((s.centres / s.rounds) * 100) : 0,
        missPct: s.rounds ? Math.round((s.misses / s.rounds) * 100) : 0,
        bestOracle: oracles[0] || null, favCats: cats, bestCoop: s.best.coop,
      };
    },
    clear() {
      try { localStorage.removeItem(STATS_KEY); localStorage.removeItem(DAILY_KEY); } catch {}
    },
    // wyzwanie dnia: { 'RRRR-MM-DD': { score, pts: [..] } } – liczy się pierwsze podejście dnia
    daily: {
      get(day) { return read(DAILY_KEY, {})[day] || null; },
      set(day, rec) {
        const all = read(DAILY_KEY, {});
        if (all[day]) return false;
        all[day] = rec;
        write(DAILY_KEY, all);
        return true;
      },
      // seria kolejnych dni z rozegranym wyzwaniem (dzisiejszy dzień może jeszcze czekać)
      streak(today = todayKey()) {
        const all = read(DAILY_KEY, {});
        let day = all[today] ? today : prevDay(today);
        let n = 0;
        while (all[day]) { n++; day = prevDay(day); }
        return n;
      },
      best() { return Object.values(read(DAILY_KEY, {})).reduce((m, r) => Math.max(m, r.score), 0); },
      days() { return Object.keys(read(DAILY_KEY, {})).length; },
    },
  };
})();

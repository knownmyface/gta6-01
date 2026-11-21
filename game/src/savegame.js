// CORAL HEAT — save/load. One localStorage slot holds mission progress,
// cash, owned cars and best race results; the game autosaves after every
// mission and whenever the player banks a car at a safehouse.
CH.savegame = (function () {
  const KEY = CH.CFG.saveKey;

  function blank() {
    return { mission: 0, cash: 500, owned: ['Sedan'], bestRace: {}, racesWon: 0, carsStolen: 0, version: 1 };
  }
  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return blank();
      const d = JSON.parse(raw);
      if (!d || typeof d.mission !== 'number') return blank();
      const b = blank();
      b.mission = Math.max(0, Math.min(21, d.mission | 0));
      b.cash = typeof d.cash === 'number' ? d.cash : 500;
      b.owned = Array.isArray(d.owned) && d.owned.length ? d.owned : ['Sedan'];
      b.bestRace = d.bestRace || {};
      b.racesWon = d.racesWon | 0;
      b.carsStolen = d.carsStolen | 0;
      return b;
    } catch (e) { return blank(); }
  }
  function save(data) {
    try { localStorage.setItem(KEY, JSON.stringify(data)); return true; }
    catch (e) { return false; }
  }
  function snapshotFromGame() {
    const S = CH.S;
    return {
      mission: S.missions.idx,
      cash: Math.round(S.player.cash),
      owned: S.garage.owned.slice(),
      bestRace: S.race.best || {},
      racesWon: S.stats.racesWon,
      carsStolen: S.stats.carsStolen,
      version: 1,
    };
  }
  function autosave() {
    return save(snapshotFromGame());
  }
  function clear() {
    try { localStorage.removeItem(KEY); } catch (e) {}
  }
  return { load, save, blank, autosave, clear, snapshotFromGame };
})();

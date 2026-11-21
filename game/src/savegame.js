// Coral Heat — save / load: cash, missions done, safehouses, garage,
// best laps and radio, in localStorage under one key.
const KEY = 'coral-heat-save-v211';

export function saveGame(G) {
  try {
    const data = {
      cash: G.player.cash,
      wanted: 0,
      missionsDone: G.missions.list.filter((m) => m.state === 'done').map((m) => m.id),
      owned: G.garage.owned,
      stored: G.garage.stored,
      bestLaps: G.bestLaps || {},
      radioIndex: G.radioIndex || 0,
      stats: G.stats,
      savedAt: new Date().toISOString(),
    };
    localStorage.setItem(KEY, JSON.stringify(data));
    return true;
  } catch (e) {
    return false;
  }
}

export function loadGame(G) {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return false;
    const data = JSON.parse(raw);
    if (typeof data.cash === 'number') G.player.cash = data.cash;
    if (Array.isArray(data.missionsDone)) {
      for (const id of data.missionsDone) {
        const m = G.missions.list.find((x) => x.id === id);
        if (m) m.state = 'done';
      }
      const next = G.missions.list.find((x) => x.state !== 'done');
      if (next && next.state === 'locked') next.state = 'available';
    }
    if (Array.isArray(data.owned)) G.garage.owned = data.owned;
    if (Array.isArray(data.stored)) G.garage.stored = data.stored;
    if (data.bestLaps) G.bestLaps = data.bestLaps;
    if (typeof data.radioIndex === 'number') G.radioIndex = data.radioIndex;
    if (data.stats) Object.assign(G.stats, data.stats);
    return true;
  } catch (e) {
    return false;
  }
}

export function hasSave() {
  try {
    return !!localStorage.getItem(KEY);
  } catch (e) {
    return false;
  }
}

export function clearSave() {
  try {
    localStorage.removeItem(KEY);
  } catch (e) {}
}

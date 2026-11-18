// Save / load for CORAL HEAT: missions, cash and settings in localStorage.
// Nothing leaves the browser; a fresh player starts on mission 1 with $1,250.
const KEY = 'coralheat.save.v1';

export function loadSave() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (typeof s !== 'object' || !s) return null;
    return s;
  } catch { return null; }
}

export function writeSave(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify({
      cash: Math.floor(state.cash),
      missionIndex: state.missionIndex,
      missionsDone: state.missionsDone,
      earned: state.earned,
      station: state.station,
      muted: state.muted,
      bestWanted: state.bestWanted,
      savedAt: Date.now(),
    }));
  } catch { /* storage full or blocked — the game still runs */ }
}

export function clearSave() {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
}

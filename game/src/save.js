// Save / load for CORAL HEAT v2.1: missions, cash, weapons, coins and stats in
// localStorage. Nothing leaves the browser; a fresh player starts on mission 1
// with $1,250 and a pistol. v2.1 moved the key to v2; v1 saves still load.
const KEY = 'coralheat.save.v2';
const OLD_KEY = 'coralheat.save.v1';

export function loadSave() {
  try {
    const raw = localStorage.getItem(KEY) ?? localStorage.getItem(OLD_KEY);
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
      weapons: state.weapons ?? null,   // { owned: [...], current, ammo: {...} }
      coins: state.coins ?? [],         // found Coral Coin ids
      stats: state.stats ?? null,       // { faresDone, shotsFired, kills, coinsEarned }
      savedAt: Date.now(),
    }));
  } catch { /* storage full or blocked — the game still runs */ }
}

export function clearSave() {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
}

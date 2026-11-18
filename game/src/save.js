// Save / load for CORAL HEAT v2.4: missions, cash, weapons, coins and stats
// in localStorage. Nothing leaves the browser; a fresh player starts on
// mission 1 with $1,250 and a pistol. v2.4 is a from-scratch rewrite of
// v2.3's save.js: same keys, same shape, same fallback, different code.
// The v2 key stays — v1 saves still load through the old key.
const SAVE_KEY = 'coralheat.save.v2';
const LEGACY_KEY = 'coralheat.save.v1';

// Read the saved run, or null when there is none / it is unreadable.
export function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY) ?? localStorage.getItem(LEGACY_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed !== 'object' || !parsed) return null;
    return parsed;
  } catch {
    return null;
  }
}

// Flatten a live run into the stored shape: cash floored, optional sections
// defaulted so an old or partial save never breaks the load.
function snapshot(state) {
  return {
    cash: Math.floor(state.cash),
    missionIndex: state.missionIndex,
    missionsDone: state.missionsDone,
    earned: state.earned,
    station: state.station,
    muted: state.muted,
    bestWanted: state.bestWanted,
    weapons: state.weapons ?? null, // { owned: [...], current, ammo: {...} }
    coins: state.coins ?? [], // found Coral Coin ids
    stats: state.stats ?? null, // { faresDone, shotsFired, kills, coinsEarned }
    savedAt: Date.now(),
  };
}

// Persist the run. A full or blocked store must never break the game.
export function writeSave(state) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(snapshot(state)));
  } catch {
    // Storage full or blocked — the game still runs.
  }
}

export function clearSave() {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    // Nothing to clear, or storage blocked — ignore.
  }
}

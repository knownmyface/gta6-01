// Save / load for CORAL HEAT v2.5: missions, cash, weapons, coins and stats
// in localStorage. Nothing leaves the browser; a fresh player starts on
// mission 1 with $1,250 and a pistol. v2.5 is a from-scratch rewrite of
// v2.4's save.js: same keys, same shape, same fallback, different code.
// The v2 key stays — v1 saves still load through the old key.
const STORE_KEY = 'coralheat.save.v2';
const OLD_KEY = 'coralheat.save.v1';

// Read the saved run, or null when there is none / it is unreadable.
export function loadSave() {
  try {
    const text = localStorage.getItem(STORE_KEY) ?? localStorage.getItem(OLD_KEY);
    if (!text) return null;
    const data = JSON.parse(text);
    if (typeof data !== 'object' || !data) return null;
    return data;
  } catch {
    return null;
  }
}

// Flatten a live run into the stored shape: cash floored, optional sections
// defaulted so an old or partial save never breaks the load.
function packState(state) {
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
    localStorage.setItem(STORE_KEY, JSON.stringify(packState(state)));
  } catch {
    // Storage full or blocked — the game still runs.
  }
}

export function clearSave() {
  try {
    localStorage.removeItem(STORE_KEY);
  } catch {
    // Nothing to clear, or storage blocked — ignore.
  }
}

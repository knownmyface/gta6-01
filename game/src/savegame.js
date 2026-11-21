// savegame.js — localStorage save/load for Coral Heat. Plain JSON, one key,
// versioned so an old save never crashes a new build.
const SAVE_KEY = "coralheat-save-v212";

export const DEFAULT_SAVE = {
  version: 212,
  cash: 2500,
  mission: 1,
  missionsDone: [],
  ownedCars: ["sunset-gt"],
  ownedBikes: ["coast-125"],
  ownedBoats: [],
  safehouses: ["marina-loft"],
  weapons: ["fists"],
  bestLap: {},
  totalEarned: 0,
  playMinutes: 0,
};

export function loadSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return { ...DEFAULT_SAVE };
    const data = JSON.parse(raw);
    if (!data || data.version !== 212) return { ...DEFAULT_SAVE };
    return { ...DEFAULT_SAVE, ...data };
  } catch (e) {
    return { ...DEFAULT_SAVE };
  }
}

export function writeSave(save) {
  try {
    save.version = 212;
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(save));
    return true;
  } catch (e) {
    return false;
  }
}

export function clearSave() {
  try {
    window.localStorage.removeItem(SAVE_KEY);
  } catch (e) { /* silent */ }
  return { ...DEFAULT_SAVE };
}

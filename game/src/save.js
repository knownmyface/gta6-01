// CORAL HEAT — persistence. The whole run (cash, story progress, arsenal,
// Coral Coins, lifetime stats) lives in localStorage under one key, so the
// game works offline and nothing is ever sent anywhere. A brand-new player
// starts with no record at all; main.js supplies the opening $1,250 and
// pistol when loadSave() comes back null. Saves written by the older v1
// build are still honoured through the legacy key below.
const CURRENT_KEY = 'coralheat.save.v2';
const LEGACY_KEY = 'coralheat.save.v1';

function storedText() {
  // Prefer the current slot; fall back to the v1 slot for old saves.
  // (?? on purpose: an empty string in the current slot is a corrupt save,
  // not a reason to silently resurrect the legacy one.)
  return localStorage.getItem(CURRENT_KEY) ?? localStorage.getItem(LEGACY_KEY);
}

function parseRecord(text) {
  if (!text) return null;
  let record;
  try {
    record = JSON.parse(text);
  } catch {
    return null;
  }
  return record !== null && typeof record === 'object' ? record : null;
}

// Read the saved run, or null when there is none / it is unreadable.
export function loadSave() {
  try {
    return parseRecord(storedText());
  } catch {
    return null;
  }
}

// Turn a live run into the stored record. Sections the run may not have
// (weapons / coins / stats) get safe defaults, so a partial or hand-edited
// save can never crash the load path in main.js.
function toRecord(run) {
  const record = {};
  record.savedAt = Date.now();
  record.stats = run.stats ?? null; // { faresDone, shotsFired, kills, coinsEarned }
  record.coins = run.coins ?? []; // found Coral Coin ids
  record.weapons = run.weapons ?? null; // { owned: [...], current, ammo: {...} }
  record.bestWanted = run.bestWanted;
  record.muted = run.muted;
  record.station = run.station;
  record.earned = run.earned;
  record.missionsDone = run.missionsDone;
  record.missionIndex = run.missionIndex;
  record.cash = Math.floor(run.cash);
  return record;
}

// Persist the run. A full or blocked store must never break the game.
export function writeSave(run) {
  try {
    localStorage.setItem(CURRENT_KEY, JSON.stringify(toRecord(run)));
  } catch {
    // Storage full or blocked — the game still runs.
  }
}

export function clearSave() {
  try {
    localStorage.removeItem(CURRENT_KEY);
  } catch {
    // Nothing to clear, or storage blocked — ignore.
  }
}

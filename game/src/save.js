// CORAL HEAT v2.8 — saves. One localStorage slot: cash, mission progress, the
// loadout, garage level, best chase stats. Loading is forgiving: a corrupt or
// foreign save just starts a fresh game. A save from an older version is
// migrated, not dropped — the version check lives in one place.

const SLOT = 'coral-heat-v28-save';
const SAVE_VERSION = 28;

export function freshSave() {
  return {
    version: SAVE_VERSION,
    cash: 2600,
    mission: 0,
    weapons: [true, true, false],
    ammo: [Infinity, 150, 28],
    garage: 0, // 0 stock, 1 tuned, 2 armored
    tokens: 0, // coral tokens collected
    best: { topSpeed: 0, maxWanted: 0, missionsDone: 0 },
    muted: false,
  };
}

function migrate(parsed) {
  const base = freshSave();
  if (!parsed || typeof parsed !== 'object') return base;
  if (parsed.version !== SAVE_VERSION) return base;
  return {
    ...base,
    ...parsed,
    best: { ...base.best, ...(parsed.best || {}) },
    weapons: Array.isArray(parsed.weapons) ? parsed.weapons : base.weapons,
  };
}

export function readSave() {
  try {
    const raw = localStorage.getItem(SLOT);
    if (!raw) return freshSave();
    return migrate(JSON.parse(raw));
  } catch {
    return freshSave();
  }
}

export function storeSave(state) {
  try {
    const snap = {
      version: SAVE_VERSION,
      cash: Math.floor(state.cash),
      mission: state.missionIndex,
      weapons: state.loadout.slots.map((s) => s.owned),
      ammo: state.loadout.slots.map((s) => (s.ammo === Infinity ? -1 : s.ammo)),
      garage: state.garage,
      tokens: state.tokens,
      best: state.best,
      muted: state.muted,
    };
    localStorage.setItem(SLOT, JSON.stringify(snap));
    return true;
  } catch {
    return false;
  }
}

export function clearSave() {
  try { localStorage.removeItem(SLOT); } catch { /* private mode */ }
}

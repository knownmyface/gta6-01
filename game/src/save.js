// Coral Heat — saves. One localStorage slot: cash, mission progress, the
// arsenal, garage level, best chase stats. Loading is forgiving: a corrupt or
// foreign save just starts a fresh game.

const SAVE_KEY = 'coral-heat-v27-save';

export function defaultSave() {
  return {
    version: 27,
    cash: 2450,
    mission: 0,
    weapons: [true, true, false],
    ammo: [Infinity, 120, 24],
    garage: 0,          // 0 stock, 1 tuned, 2 race
    tokens: 0,          // coral tokens collected
    best: { topSpeed: 0, maxWanted: 0, missionsDone: 0 },
    muted: false,
  };
}

export function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return defaultSave();
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || parsed.version !== 27) return defaultSave();
    const base = defaultSave();
    return {
      ...base,
      ...parsed,
      best: { ...base.best, ...(parsed.best || {}) },
      weapons: Array.isArray(parsed.weapons) ? parsed.weapons : base.weapons,
    };
  } catch {
    return defaultSave();
  }
}

export function writeSave(state) {
  try {
    const snap = {
      version: 27,
      cash: Math.floor(state.cash),
      mission: state.missionIndex,
      weapons: state.arsenal.slots.map((s) => s.owned),
      ammo: state.arsenal.slots.map((s) => (s.ammo === Infinity ? -1 : s.ammo)),
      garage: state.garage,
      tokens: state.tokens,
      best: state.best,
      muted: state.muted,
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(snap));
    return true;
  } catch {
    return false;
  }
}

export function wipeSave() {
  try { localStorage.removeItem(SAVE_KEY); } catch { /* private mode */ }
}

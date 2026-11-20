// CORAL HEAT v2.8 — seeded chance and small math helpers.
// One deterministic generator drives the whole bay: building heights, paint
// jobs, foot traffic, radio jingles. Same seed, same Coral Bay, every run.

export function seedFromText(text) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash = Math.imul(hash ^ text.charCodeAt(i), 0x01000193);
    hash ^= hash >>> 13;
  }
  return hash >>> 0;
}

export function makeRandom(seed) {
  let state = (seed >>> 0) || 0x2545f491;
  const step = () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    state >>>= 0;
    return state / 4294967296;
  };
  return {
    // float in [0, 1)
    next: step,
    // float in [lo, hi)
    range(lo, hi) { return lo + step() * (hi - lo); },
    // whole number in [lo, hi]
    int(lo, hi) { return lo + Math.floor(step() * (hi - lo + 1)); },
    // one entry from a list
    choose(list) { return list[Math.floor(step() * list.length)]; },
    // true with probability p
    odds(p) { return step() < p; },
    // -1 or 1, a coin flip
    flip() { return step() < 0.5 ? -1 : 1; },
    // smooth noise around 0, roughly [-1, 1]
    drift() { return (step() + step() + step() - 1.5) / 1.5; },
  };
}

export const clampVal = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
export const mix = (a, b, t) => a + (b - a) * t;
export const easeTo = (a, b, lambda, dt) => mix(a, b, 1 - Math.exp(-lambda * dt));

// Shortest signed gap between two headings, in radians.
export function headingGap(from, to) {
  let d = (to - from) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

export function pointTo(x, z, tx, tz) {
  return Math.atan2(tx - x, tz - z);
}

export function gap2d(ax, az, bx, bz) {
  const dx = bx - ax;
  const dz = bz - az;
  return Math.sqrt(dx * dx + dz * dz);
}

// Cash the way the HUD prints it: $12,450
export function moneyText(n) {
  return '$' + Math.floor(n).toLocaleString('en-US');
}

// A heading turned into a compass point for the map corner.
export function compassLabel(heading) {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const idx = Math.round((((-heading) % (Math.PI * 2)) + Math.PI * 2) / (Math.PI / 4)) % 8;
  return dirs[idx];
}

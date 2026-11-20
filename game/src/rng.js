// Coral Heat — deterministic dice. Every random choice in the city (building
// heights, traffic colours, pedestrian routes, radio jingles) flows through one
// seeded generator so the same seed always rebuilds the same Coral Bay.

export function hashSeed(text) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function makeDice(seed) {
  let a = seed >>> 0;
  if (a === 0) a = 0x9e3779b9;
  const next = () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    // float in [0, 1)
    roll: next,
    // float in [lo, hi)
    span(lo, hi) { return lo + next() * (hi - lo); },
    // integer in [lo, hi]
    whole(lo, hi) { return lo + Math.floor(next() * (hi - lo + 1)); },
    // one item from a list
    pick(list) { return list[Math.floor(next() * list.length)]; },
    // true with probability p
    chance(p) { return next() < p; },
    // -1 or 1
    sign() { return next() < 0.5 ? -1 : 1; },
    // gaussian-ish around 0, range about [-1, 1]
    wobble() { return (next() + next() + next() - 1.5) / 1.5; },
  };
}

export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const damp = (a, b, lambda, dt) => lerp(a, b, 1 - Math.exp(-lambda * dt));

// Shortest signed difference between two headings, in radians.
export function angleGap(from, to) {
  let d = (to - from) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

export function headingTo(x, z, tx, tz) {
  return Math.atan2(tx - x, tz - z);
}

export function dist2d(ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az;
  return Math.sqrt(dx * dx + dz * dz);
}

// Format cash the way the HUD shows it: $12,450
export function cashText(n) {
  return '$' + Math.floor(n).toLocaleString('en-US');
}

// Turn a heading into a compass-ish district label for the minimap corner.
export function compassLabel(heading) {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const idx = Math.round(((-heading % (Math.PI * 2)) + Math.PI * 2) / (Math.PI / 4)) % 8;
  return dirs[idx];
}

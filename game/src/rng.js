// Seeded RNG (mulberry32) + helpers shared by every system of CORAL HEAT.
// Every world layout decision flows through one seeded stream so a screenshot
// seed reproduces the same city, traffic and pedestrians. v2.3 is a
// from-scratch rewrite of v2.2's rng.js: same mulberry32 sequence, same
// helpers, same draw order, different code. The sequence is the contract —
// a different stream would deal a different city, so it is verified by a
// differential test against v2.2's implementation before any screenshot.
const MULBERRY_STEP = 0x6D2B79F5;
const UINT32 = 4294967296;

// Mulberry32: a small, fast seeded PRNG. `seed` is taken unsigned; each
// call advances the state by the golden-ratio step and scrambles it.
export function createRng(seed) {
  let state = seed >>> 0;
  return function next() {
    state |= 0;
    state = (state + MULBERRY_STEP) | 0;
    let mixed = Math.imul(state ^ (state >>> 15), 1 | state);
    mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed;
    return ((mixed ^ (mixed >>> 14)) >>> 0) / UINT32;
  };
}

export function pick(rng, arr) {
  return arr[Math.floor(rng() * arr.length)];
}

// Pick n distinct items, in random order — used for hostile jacket variety.
export function pickN(rng, arr, n) {
  const pool = arr.slice();
  const chosen = [];
  while (pool.length > 0 && chosen.length < n) {
    const at = Math.floor(rng() * pool.length);
    chosen.push(pool.splice(at, 1)[0]);
  }
  return chosen;
}

export function shuffle(rng, arr) {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = out[i];
    out[i] = out[j];
    out[j] = tmp;
  }
  return out;
}

// Pick a weighted option: [[weight, value], ...] — used by traffic mix and drops.
export function weighted(rng, entries) {
  let total = 0;
  for (const [w] of entries) total += w;
  let roll = rng() * total;
  for (const [w, v] of entries) {
    roll -= w;
    if (roll <= 0) return v;
  }
  return entries[entries.length - 1][1];
}

export function range(rng, min, max) {
  return min + rng() * (max - min);
}

export function rangeInt(rng, min, max) {
  return Math.floor(range(rng, min, max + 1));
}

export function chance(rng, p) {
  return rng() < p;
}

export function clamp(v, min, max) {
  if (v < min) return min;
  if (v > max) return max;
  return v;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function angleLerp(a, b, t) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

export function dist2(ax, az, bx, bz) {
  const dx = ax - bx;
  const dz = az - bz;
  return dx * dx + dz * dz;
}

// Seeded RNG (mulberry32) + helpers shared by every system of CORAL HEAT.
// Every world layout decision flows through one seeded stream so a screenshot
// seed reproduces the same city, traffic and pedestrians. v2.6 is a
// from-scratch rewrite of v2.5's rng.js: same mulberry32 sequence, same
// helpers, same draw order, different code. The sequence is the contract —
// a different stream would deal a different city, so it is verified by a
// differential test against v2.5's implementation before any screenshot.
const STEP = 0x6D2B79F5;
const MODULUS = 4294967296;

// Mulberry32: a small, fast seeded PRNG. `seed` is taken unsigned; each
// call advances the state by the golden-ratio step and scrambles it.
export function createRng(seed) {
  let state = seed >>> 0;
  return function next() {
    state |= 0;
    state = (state + STEP) | 0;
    let mixed = Math.imul(state ^ (state >>> 15), 1 | state);
    mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed;
    return ((mixed ^ (mixed >>> 14)) >>> 0) / MODULUS;
  };
}

// One random element — one draw from the stream.
export function pick(rng, arr) {
  const idx = Math.floor(rng() * arr.length);
  return arr[idx];
}

// Pick n distinct items, in random order — used for hostile jacket variety.
export function pickN(rng, arr, n) {
  const deck = arr.slice();
  const picked = [];
  while (deck.length > 0 && picked.length < n) {
    const idx = Math.floor(rng() * deck.length);
    picked.push(deck.splice(idx, 1)[0]);
  }
  return picked;
}

// Fisher-Yates, in place on a copy: one draw per swap, from the end down.
export function shuffle(rng, arr) {
  const copy = arr.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = copy[i];
    copy[i] = copy[j];
    copy[j] = tmp;
  }
  return copy;
}

// Pick a weighted option: [[weight, value], ...] — used by traffic mix and drops.
export function weighted(rng, entries) {
  let total = 0;
  for (const entry of entries) total += entry[0];
  let cursor = rng() * total;
  for (const entry of entries) {
    cursor -= entry[0];
    if (cursor <= 0) return entry[1];
  }
  return entries[entries.length - 1][1];
}

// A float in [min, max) — one draw.
export function range(rng, min, max) {
  return min + rng() * (max - min);
}

// An integer in [min, max] — one draw, inclusive on both ends.
export function rangeInt(rng, min, max) {
  return Math.floor(range(rng, min, max + 1));
}

// A coin flip with probability p — one draw.
export function chance(rng, p) {
  return rng() < p;
}

// Clamp a value into [min, max] — no draws.
export function clamp(v, min, max) {
  if (v < min) return min;
  if (v > max) return max;
  return v;
}

// Linear interpolation between a and b.
export function lerp(a, b, t) {
  return a + (b - a) * t;
}

// Interpolate an angle along the shortest arc, so a heading never spins
// the long way round when it crosses -π/π.
export function angleLerp(a, b, t) {
  let delta = (b - a) % (Math.PI * 2);
  if (delta > Math.PI) delta -= Math.PI * 2;
  if (delta < -Math.PI) delta += Math.PI * 2;
  return a + delta * t;
}

// Squared distance on the ground plane — no square root, for comparisons.
export function dist2(ax, az, bx, bz) {
  const dx = ax - bx;
  const dz = az - bz;
  return dx * dx + dz * dz;
}

// Seeded RNG (mulberry32) + helpers shared by every system of CORAL HEAT.
// Every world layout decision flows through one seeded stream so a screenshot
// seed reproduces the same city, traffic and pedestrians. v2.5 is a
// from-scratch rewrite of v2.4's rng.js: same mulberry32 sequence, same
// helpers, same draw order, different code. The sequence is the contract —
// a different stream would deal a different city, so it is verified by a
// differential test against v2.4's implementation before any screenshot.
const GOLDEN_STEP = 0x6D2B79F5;
const TWO_POW_32 = 4294967296;

// Mulberry32: a small, fast seeded PRNG. `initial` is taken unsigned; each
// call advances the state by the golden-ratio step and scrambles it.
export function createRng(initial) {
  let seed = initial >>> 0;
  return function next() {
    seed |= 0;
    seed = (seed + GOLDEN_STEP) | 0;
    let scrambled = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    scrambled = (scrambled + Math.imul(scrambled ^ (scrambled >>> 7), 61 | scrambled)) ^ scrambled;
    return ((scrambled ^ (scrambled >>> 14)) >>> 0) / TWO_POW_32;
  };
}

// One random element — one draw from the stream.
export function pick(rng, arr) {
  return arr[Math.floor(rng() * arr.length)];
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
    const swap = copy[i];
    copy[i] = copy[j];
    copy[j] = swap;
  }
  return copy;
}

// Pick a weighted option: [[weight, value], ...] — used by traffic mix and drops.
export function weighted(rng, entries) {
  let sum = 0;
  for (const [weight] of entries) sum += weight;
  let cursor = rng() * sum;
  for (const [weight, value] of entries) {
    cursor -= weight;
    if (cursor <= 0) return value;
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
  return Math.min(max, Math.max(min, v));
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
  const diffX = ax - bx;
  const diffZ = az - bz;
  return diffX * diffX + diffZ * diffZ;
}

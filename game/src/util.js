// CORAL HEAT — tiny math + random helpers shared by every system.
// All original code, written fresh for v2.9.
export function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
export function lerp(a, b, t) { return a + (b - a) * t; }
export function rand(a, b) { return a + Math.random() * (b - a); }
export function randi(a, b) { return Math.floor(rand(a, b + 1)); }
export function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
export function choiceWeighted(pairs) {
  let total = 0;
  for (const p of pairs) total += p[1];
  let r = Math.random() * total;
  for (const p of pairs) { r -= p[1]; if (r <= 0) return p[0]; }
  return pairs[pairs.length - 1][0];
}
// Shortest signed angle difference, in radians.
export function angDiff(a, b) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}
export function angLerp(a, b, t) { return a + angDiff(a, b) * t; }
export function dist2d(ax, az, bx, bz) {
  const dx = ax - bx, dz = az - bz;
  return Math.sqrt(dx * dx + dz * dz);
}
export function fmtCash(n) {
  return '$' + Math.floor(n).toLocaleString('en-US');
}
export function fmtTime(ms) {
  if (ms == null || !isFinite(ms)) return '--:--.---';
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const th = Math.floor(ms % 1000);
  return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0') + '.' + String(th).padStart(3, '0');
}
// Deterministic seeded random (mulberry32) for city layout variety.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
// Push a circle (x,z,r) out of every axis-aligned box collider. Returns corrected [x,z].
export function collideCircle(x, z, r, colliders) {
  for (const c of colliders) {
    const cx = clamp(x, c.x - c.hx, c.x + c.hx);
    const cz = clamp(z, c.z - c.hz, c.z + c.hz);
    const dx = x - cx, dz = z - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 < r * r) {
      if (d2 > 0.000001) {
        const d = Math.sqrt(d2);
        x = cx + (dx / d) * r;
        z = cz + (dz / d) * r;
      } else {
        // Dead centre inside the box: push out along the smallest penetration axis.
        const px = c.hx + r - Math.abs(x - c.x);
        const pz = c.hz + r - Math.abs(z - c.z);
        if (px < pz) x = c.x + (x >= c.x ? c.hx + r : -(c.hx + r));
        else z = c.z + (z >= c.z ? c.hz + r : -(c.hz + r));
      }
    }
  }
  return [x, z];
}
// Keep a point inside the playable map rectangle.
export function clampToMap(x, z, half) {
  return [clamp(x, -half, half), clamp(z, -half, half)];
}

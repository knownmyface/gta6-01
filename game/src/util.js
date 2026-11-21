// Coral Heat — small shared helpers (fresh write, round 7).
export const TAU = Math.PI * 2;

export function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
export function lerp(a, b, t) { return a + (b - a) * t; }
export function rand(lo = 0, hi = 1) { return lo + Math.random() * (hi - lo); }
export function randi(lo, hi) { return Math.floor(rand(lo, hi + 1)); }
export function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
export function choice(arr) { return pick(arr); }
export function fmtMoney(n) { return '$' + Math.floor(n).toLocaleString('en-US'); }
export function fmtClock(totalSeconds) {
  const s = Math.floor(totalSeconds % 60);
  const m = Math.floor(totalSeconds / 60) % 60;
  const h = Math.floor(totalSeconds / 3600) % 24;
  const p = (x) => String(x).padStart(2, '0');
  return p(h) + ':' + p(m) + ':' + p(s);
}
export function fmtLap(t) {
  if (!t || !isFinite(t)) return '--:--.---';
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  const ms = Math.floor((t % 1) * 1000);
  return m + ':' + String(s).padStart(2, '0') + '.' + String(ms).padStart(3, '0');
}
export function angleLerp(a, b, t) {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return a + d * t;
}
export function angleDiff(a, b) {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
}
export function dist2(ax, az, bx, bz) {
  const dx = ax - bx, dz = az - bz;
  return dx * dx + dz * dz;
}
export function makeEl(tag, cls, parent, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined && text !== null) e.textContent = text;
  if (parent) parent.appendChild(e);
  return e;
}
// Canvas texture with big legible text — used for neon signs and shop fronts.
export function textTexture(THREE, text, opts = {}) {
  const w = opts.w || 512, h = opts.h || 128;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.fillStyle = opts.bg || '#12081f';
  g.fillRect(0, 0, w, h);
  g.font = 'bold ' + (opts.size || 64) + 'px Arial, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  if (opts.glow) { g.shadowColor = opts.glow; g.shadowBlur = 26; }
  g.fillStyle = opts.fg || '#ff2fd6';
  g.fillText(text, w / 2, h / 2 + 2);
  if (opts.sub) {
    g.font = 'bold 30px Arial, sans-serif';
    g.shadowBlur = 10;
    g.fillStyle = opts.subColor || '#ffd166';
    g.fillText(opts.sub, w / 2, h - 26);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
export function hexColor(n) { return n; }

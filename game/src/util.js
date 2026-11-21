// util.js — small math + helper functions shared by every CORAL HEAT module.
// No game logic lives here, only pure helpers so the other files stay readable.
import * as THREE from 'three';

export const TAU = Math.PI * 2;

export function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function damp(current, target, rate, dt) {
  // Frame-rate independent exponential approach.
  return lerp(current, target, 1 - Math.exp(-rate * dt));
}

export function rand(lo = 0, hi = 1) {
  return lo + Math.random() * (hi - lo);
}

export function randi(lo, hi) {
  return Math.floor(rand(lo, hi + 1));
}

export function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function chance(p) {
  return Math.random() < p;
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
  const dx = ax - bx;
  const dz = az - bz;
  return Math.sqrt(dx * dx + dz * dz);
}

export function headingTo(x, z, tx, tz) {
  return Math.atan2(tx - x, tz - z);
}

export function fmtCash(n) {
  return '$' + Math.floor(n).toLocaleString('en-US');
}

export function fmtTime(sec) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return m + ':' + String(s).padStart(2, '0');
}

export function fmtLap(sec) {
  if (!isFinite(sec) || sec <= 0) return '--:--.---';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  const ms = Math.floor((sec % 1) * 1000);
  return m + ':' + String(s).padStart(2, '0') + '.' + String(ms).padStart(3, '0');
}

// Draw a glowing text label on a canvas and return it as a THREE CanvasTexture.
// Used for neon casino signs, street signs and shop fronts.
export function textTexture(lines, opts = {}) {
  const w = opts.w || 512;
  const h = opts.h || 128;
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const g = cv.getContext('2d');
  g.fillStyle = opts.bg || '#0a0618';
  g.fillRect(0, 0, w, h);
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  const font = opts.font || 'bold 64px Arial, sans-serif';
  g.font = font;
  const color = opts.color || '#ff2e88';
  g.shadowColor = color;
  g.shadowBlur = opts.glow || 26;
  g.fillStyle = color;
  const step = h / lines.length;
  lines.forEach((line, i) => {
    g.fillText(line, w / 2, step * (i + 0.5));
  });
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// A tiny seeded random so the city layout is stable between loads.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

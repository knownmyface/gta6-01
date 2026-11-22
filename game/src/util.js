// CORAL HEAT — shared helpers.
// Every module hangs its API off the single Coral namespace so the page can
// load plain classic scripts in order with no build step and no network.
window.Coral = window.Coral || {};

Coral.util = (function () {
  'use strict';

  function clamp(value, low, high) {
    if (value < low) return low;
    if (value > high) return high;
    return value;
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function damp(current, target, lambda, dt) {
    return lerp(current, target, 1 - Math.exp(-lambda * dt));
  }

  function rand(low, high) {
    return low + Math.random() * (high - low);
  }

  function randi(low, high) {
    return Math.floor(rand(low, high + 1));
  }

  function pick(list) {
    return list[Math.floor(Math.random() * list.length)];
  }

  function chance(p) {
    return Math.random() < p;
  }

  function dist2d(ax, az, bx, bz) {
    var dx = ax - bx;
    var dz = az - bz;
    return Math.sqrt(dx * dx + dz * dz);
  }

  function angleDiff(a, b) {
    var d = (a - b) % (Math.PI * 2);
    if (d > Math.PI) d -= Math.PI * 2;
    if (d < -Math.PI) d += Math.PI * 2;
    return d;
  }

  function angleLerp(a, b, t) {
    return a + angleDiff(b, a) * t;
  }

  function el(id) {
    return document.getElementById(id);
  }

  function fmtMoney(n) {
    var s = String(Math.round(n));
    var out = '';
    while (s.length > 3) {
      out = ',' + s.slice(-3) + out;
      s = s.slice(0, -3);
    }
    return '$' + s + out;
  }

  function fmtTime(totalSeconds) {
    var m = Math.floor(totalSeconds / 60);
    var s = Math.floor(totalSeconds % 60);
    return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
  }

  function mph(ms) {
    return Math.abs(ms) * 2.23694;
  }

  function pad2(n) {
    return (n < 10 ? '0' : '') + n;
  }

  function makeRng(seed) {
    var s = seed >>> 0;
    return function () {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }

  function hexColor(h) {
    return new THREE.Color(h);
  }

  function onScreenLabel(text, x, y) {
    var d = document.createElement('div');
    d.className = 'float-label';
    d.textContent = text;
    d.style.left = x + 'px';
    d.style.top = y + 'px';
    document.body.appendChild(d);
    setTimeout(function () { d.remove(); }, 1600);
    return d;
  }

  return {
    clamp: clamp,
    lerp: lerp,
    damp: damp,
    rand: rand,
    randi: randi,
    pick: pick,
    chance: chance,
    dist2d: dist2d,
    angleDiff: angleDiff,
    angleLerp: angleLerp,
    el: el,
    fmtMoney: fmtMoney,
    fmtTime: fmtTime,
    mph: mph,
    pad2: pad2,
    makeRng: makeRng,
    hexColor: hexColor,
    onScreenLabel: onScreenLabel,
  };
})();

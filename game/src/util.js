// CORAL HEAT — shared utilities and the single game state object.
// Every system reads and writes CH.S; no module keeps private copies of
// player, traffic, police or mission state, so the HUD, the missions and
// the screenshot stager always agree about what is happening.
const CH = window.CH || (window.CH = {});

CH.CFG = {
  roadStep: 60, // distance between parallel road centrelines, metres
  roadHalf: 7, // half width of a road
  cityMin: -300, // playable city bounds
  cityMax: 300,
  waterZ: 300, // south of this line is the bay
  bayFar: 430,
  maxSpeed: 52, // m/s, about 116 MPH
  mph: 2.23694, // m/s -> MPH
  saveKey: 'coralheat.save.v1',
};

CH.S = {
  mode: 'menu', // menu | play | paused | over
  seed: 7,
  rng: null,
  scene: null,
  camera: null,
  renderer: null,
  clock: 0,
  frame: 0,
  input: { keys: {}, mouseX: 0, mouseY: 0, mouseDown: false },
  player: null, // created by boot
  traffic: { cars: [], peds: [] },
  police: { cars: [], heli: null, roadblocks: [], spikeSlowUntil: 0 },
  missions: { list: [], idx: 0, banner: '', bannerUntil: 0 },
  race: { active: false, circuit: 0, lap: 1, laps: 3, pos: 1, gate: 0, racers: [], finished: false },
  fx: { particles: [], lights: [], tracers: [] },
  garage: { owned: [], safehouses: [], shops: [] },
  boats: { list: [], policeBoats: [] },
  bikes: { list: [] },
  shot: null, // active screenshot scene name, or null
  shotError: '',
  radio: { station: 0, stations: ['CORAL 87.9 FM', 'NEON 102.4 FM', 'REEF 95.1 FM', 'PALM 88.0 FM'] },
  weapon: { current: 0, names: ['Fists', 'Pistol', 'SMG', 'Shotgun'], wheelOpen: false },
  stats: { shotsFired: 0, carsStolen: 0, racesWon: 0, missionsDone: 0 },
};

// Short alias: the fx bucket (particles, lights, tracers) plus the effect
// functions fight.js attaches to it at load time.
CH.fx = CH.S.fx;

CH.util = (function () {
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function rand(a, b) { const r = CH.S.rng || Math.random; return a + r() * (b - a); }
  function randi(a, b) { return Math.floor(rand(a, b + 1)); }
  function pick(arr) { return arr[Math.floor((CH.S.rng || Math.random)() * arr.length)]; }
  function dist2(ax, az, bx, bz) { const dx = ax - bx, dz = az - bz; return Math.sqrt(dx * dx + dz * dz); }
  function angDiff(a, b) {
    let d = (b - a) % (Math.PI * 2);
    if (d > Math.PI) d -= Math.PI * 2;
    if (d < -Math.PI) d += Math.PI * 2;
    return d;
  }
  function fmtCash(n) { return '$' + Math.round(n).toLocaleString('en-US'); }
  function fmtTime(s) {
    const m = Math.floor(s / 60), ss = Math.floor(s % 60);
    return m + ':' + (ss < 10 ? '0' : '') + ss;
  }
  function el(id) { return document.getElementById(id); }
  function show(id, on) { const e = el(id); if (e) e.style.display = on ? '' : 'none'; }
  function roadLine(v) { return Math.round(v / CH.CFG.roadStep) * CH.CFG.roadStep; }
  function isRoad(x, z) {
    const c = CH.CFG;
    if (x < c.cityMin || x > c.cityMax || z < c.cityMin || z > c.waterZ) return false;
    const fx = Math.abs(x - roadLine(x)), fz = Math.abs(z - roadLine(z));
    return fx <= c.roadHalf + 1 || fz <= c.roadHalf + 1;
  }
  function nearestRoadPoint(x, z) {
    // Snap a point onto the closest road centreline, for spawning cars.
    const c = CH.CFG;
    const rx = roadLine(x), rz = roadLine(z);
    if (Math.abs(x - rx) < Math.abs(z - rz)) return { x: rx, z: clamp(z, c.cityMin, c.waterZ) };
    return { x: clamp(x, c.cityMin, c.cityMax), z: rz };
  }
  return { mulberry32, clamp, lerp, rand, randi, pick, dist2, angDiff, fmtCash, fmtTime, el, show, roadLine, isRoad, nearestRoadPoint };
})();

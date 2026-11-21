// boot.js — Coral Heat entry: renderer, world build, input, camera, main loop.
// Wires every system together: city, driving, walking, police, combat, boats,
// bikes, races, garage, story, HUD, radio, save.
import * as THREE from 'three';
import { clamp, lerp, rand, fmtCash } from './util.js';
import { buildCity } from './coralcity.js';
import { spawnCar, spawnTraffic, spawnParkedCars, updatePlayerCar, updateTraffic, CAR_MODELS } from './drive.js';
import { makePlayerMesh, updateOnFoot, tryEnterVehicle, exitCar, startCarjack, updateCarjack, spawnPedestrians, updatePedestrians } from './walk.js';
import { createWanted, updatePolice, checkBusted } from './cops.js';
import { createArsenal, fireWeapon, updateThugs, spawnPickups, updatePickups } from './fight.js';
import { spawnMarinaBoats, updateBoat, nearestBoat, boardBoat, leaveBoat, spawnBuoys, boatRaceCheckpoints } from './boats.js';
import { spawnStreetBikes, updateBike, nearestBike, mountBike, dismountBike } from './bikes.js';
import { createRaceState, startRace, updateRace, raceStartPoints, CIRCUITS } from './raceway.js';
import { createGarageState, buildShopUI, refreshShopUI, nearestSafehouse, storeCar } from './garage.js';
import { createMissionState, startMission, updateMission, MISSIONS_1_8 } from './story.js';
import { registerMissions9_16, startMissionWithSetup } from './story2.js';
import { createHUD, updateHUD } from './hudkit.js';
import { createSound } from './sound.js';
import { createSave } from './savegame.js';
import { stageShot } from './shots.js';

const params = new URLSearchParams(location.search);
const SHOT = params.get('shot');

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xff8a4a, 180, 720);
const camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.1, 2000);

// Sunset lighting: low warm sun + purple ambient
const sun = new THREE.DirectionalLight(0xffb36b, 2.2);
sun.position.set(-260, 190, -180);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -160; sun.shadow.camera.right = 160;
sun.shadow.camera.top = 160; sun.shadow.camera.bottom = -160;
sun.shadow.camera.far = 800;
scene.add(sun);
scene.add(new THREE.AmbientLight(0x8a6ab0, 0.85));
const hemi = new THREE.HemisphereLight(0xff9a5c, 0x2a2a4a, 0.6);
scene.add(hemi);

// Mission target marker ring
const marker = new THREE.Mesh(
  new THREE.RingGeometry(4, 5.2, 32),
  new THREE.MeshBasicMaterial({ color: 0xffd23c, transparent: true, opacity: 0.85, side: THREE.DoubleSide }),
);
marker.rotation.x = -Math.PI / 2;
marker.position.y = 0.3;
marker.visible = false;
scene.add(marker);

const G = {
  scene, camera, renderer, time: 0, keys: {}, events: [],
  cars: [], peds: [], thugs: [], cops: [], roadblocks: [], pickups: [],
  boats: [], bikes: [], colliders: [], heli: null, ocean: null, ferris: null,
  camYaw: 0, camPitch: 0.32, camDist: 12, camYawOffset: 0,
  started: false, paused: false, dead: false, deadKind: null,
  fx: { flashes: [], wake: [], hitmarks: [], nitro: false },
  marker,
  boatApi: { spawnBuoys, boatRaceCheckpoints },
  player: {
    pos: new THREE.Vector3(6, 1.2, 6), heading: 0, walkPhase: 0,
    onFoot: true, vehicle: null, boat: null, bike: null,
    mesh: null, moving: false, punchT: 0, carjack: null,
    health: 100, armor: 0, cash: 2500, damageFlash: 0,
  },
};
G.wanted = createWanted(G);
G.arsenal = createArsenal();
G.race = createRaceState();
G.garage = createGarageState();
G.missions = createMissionState();
G.hud = createHUD(G);
G.sound = createSound();
G.save = createSave(G);

// Build the world
registerMissions9_16();
buildCity(G);
G.player.mesh = makePlayerMesh();
G.player.mesh.group.position.set(6, 0, 6);
scene.add(G.player.mesh.group);
spawnTraffic(G, 16);
spawnParkedCars(G, 14);
spawnPedestrians(G, 26);
spawnMarinaBoats(G);
spawnStreetBikes(G);
spawnPickups(G);
G.garage.panel = buildShopUI(G);

// restore save if there is one
const saved = G.save.load();
if (saved) {
  document.getElementById('save-note').textContent = 'Save found — cash ' + fmtCash(G.player.cash) + ', mission ' + (G.missions.index + 1) + ' of 16. Progress kept.';
}

// ---------- input ----------
addEventListener('keydown', (e) => {
  G.keys[e.code] = true;
  if (['Space', 'Tab', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault();
  if (e.code === 'KeyE') onEnterKey();
  if (e.code === 'KeyF') onCarjackKey();
  if (e.code === 'KeyR') onRaceKey();
  if (e.code === 'KeyG') onGarageKey();
  if (e.code === 'KeyM') onMissionKey();
  if (e.code === 'KeyP') togglePause();
  if (e.code === 'Tab') { G.sound.nextStation(); }
  if (e.code.startsWith('Digit')) {
    const n = parseInt(e.code.slice(5), 10) - 1;
    if (n >= 0 && n < 4) G.arsenal.switchSlot(n);
  }
  if (e.code === 'KeyX') G.sound.muted = !G.sound.muted;
});
addEventListener('keyup', (e) => { G.keys[e.code] = false; });
addEventListener('mousedown', (e) => {
  if (!G.started || G.paused) return;
  if (e.button === 0) fireWeapon(G);
});
let dragging = false, lastX = 0, lastY = 0;
renderer.domElement.addEventListener('mousedown', (e) => { dragging = true; lastX = e.clientX; lastY = e.clientY; });
addEventListener('mousemove', (e) => {
  if (!dragging) return;
  G.camYawOffset -= (e.clientX - lastX) * 0.005;
  G.camPitch = clamp(G.camPitch + (e.clientY - lastY) * 0.003, 0.08, 0.9);
  lastX = e.clientX; lastY = e.clientY;
});
addEventListener('mouseup', () => { dragging = false; });
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

function onEnterKey() {
  if (!G.started || G.paused || G.dead) return;
  const p = G.player;
  if (p.vehicle) { exitCar(G); return; }
  if (p.bike) { dismountBike(G); return; }
  if (p.boat) { leaveBoat(G); return; }
  const boat = nearestBoat(G);
  if (boat) { boardBoat(G, boat); return; }
  const bike = nearestBike(G);
  if (bike) { mountBike(G, bike); return; }
  tryEnterVehicle(G);
}

function onCarjackKey() {
  if (!G.started || G.paused || G.dead) return;
  const p = G.player;
  if (!p.onFoot || p.carjack) return;
  // find the nearest traffic car with a driver and start the yank sequence
  let best = null, bd = 5;
  for (const car of G.cars) {
    if (!car.traffic) continue;
    const d = Math.hypot(car.x - p.pos.x, car.z - p.pos.z);
    if (d < bd) { bd = d; best = car; }
  }
  if (best) { best.driver = { fleeing: false }; startCarjack(G, best); }
  else G.hud.say('No car close enough to jack — walk up to a moving car', 2);
}

function onRaceKey() {
  if (!G.started || G.paused || G.dead || G.race.active) return;
  const p = G.player;
  if (!p.vehicle) { G.hud.say('You need a car to race — press E to get in one first', 2.5); return; }
  const pts = raceStartPoints();
  let best = null, bd = 18;
  for (const pt of pts) {
    const d = Math.hypot(pt.x - p.pos.x, pt.z - p.pos.z);
    if (d < bd) { bd = d; best = pt; }
  }
  if (best) startRace(G, best.circuit);
  else G.hud.say('No race start nearby — gold gates mark the circuits', 2.5);
}

function onGarageKey() {
  if (!G.started || G.paused || G.dead) return;
  const house = nearestSafehouse(G, 20);
  if (!house) { G.hud.say('No safehouse nearby — garage opens at a owned/buyable house (gold roof = owned)', 2.5); return; }
  const g = G.garage;
  g.shopOpen = !g.shopOpen;
  g.panel.classList.toggle('hidden', !g.shopOpen);
  if (g.shopOpen) { refreshShopUI(G); }
}

function onMissionKey() {
  if (!G.started || G.paused || G.dead) return;
  if (G.missions.active) { G.hud.say('Mission already running — finish it or fail it first', 2); return; }
  const idx = Math.min(G.missions.index, 15);
  if (idx >= 8) startMissionWithSetup(G, idx);
  startMission(G, idx);
}

function togglePause() {
  if (!G.started || G.dead) return;
  G.paused = !G.paused;
  G.hud.paused.classList.toggle('hidden', !G.paused);
}

document.getElementById('play-btn').addEventListener('click', () => {
  G.started = true;
  G.hud.start.classList.add('hidden');
  G.sound.ensure();
  G.sound.startRadio();
  if (!G.missions.active && G.missions.index < 16) {
    if (G.missions.index >= 8) startMissionWithSetup(G, G.missions.index);
    startMission(G, G.missions.index);
  }
  G.hud.say('Welcome to Coral Bay — follow the gold marker', 3.5);
});
document.getElementById('respawn-btn').addEventListener('click', () => {
  const p = G.player;
  p.health = 100; p.armor = 0;
  p.cash = Math.max(0, p.cash - 250);
  G.wanted.level = 0; G.wanted.heat = 0;
  p.pos.set(6, 1.2, 6);
  p.vehicle = null; p.boat = null; p.bike = null;
  p.mesh.group.visible = true;
  p.mesh.group.position.set(6, 0, 6);
  G.dead = false; G.deadKind = null;
  G.hud.dead.classList.add('hidden');
  G.hud.say('Back on your feet — the city is still yours', 2.5);
});

// ---------- camera ----------
function updateCamera(dt) {
  const p = G.player;
  const targetYaw = p.heading + Math.PI + G.camYawOffset;
  G.camYaw = lerp(G.camYaw, targetYaw, 1 - Math.pow(0.001, dt));
  const dist = G.camDist;
  const cx = p.pos.x + Math.sin(G.camYaw) * dist;
  const cz = p.pos.z + Math.cos(G.camYaw) * dist;
  // keep the camera above the street so rooftops never swallow the shot
  const cy = Math.max(7, 4 + Math.sin(G.camPitch) * dist * 0.9);
  camera.position.set(cx, cy, cz);
  camera.lookAt(p.pos.x, 2.2, p.pos.z);
}

// ---------- main loop ----------
const clock = new THREE.Clock();
let saveT = 0;
function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  if (!G.paused) G.time += dt;
  const p = G.player;

  if (G.started && !G.paused && !G.dead) {
    // wanted heat decays over time
    G.wanted.update(dt);
    // movement by mode
    if (p.vehicle) updatePlayerCar(G, dt);
    else if (p.bike) updateBike(G, dt);
    else if (p.boat) updateBoat(G, dt);
    else { updateOnFoot(G, dt); updateCarjack(G, dt); }
    updateTraffic(G, dt);
    updatePedestrians(G, dt);
    updatePolice(G, dt);
    updateThugs(G, dt);
    updatePickups(G, dt);
    updateRace(G, dt);
    updateMission(G, dt);
    // ocean shimmer + ferris wheel turn
    if (G.ocean) G.ocean.position.y = 0.1 + Math.sin(G.time * 0.8) * 0.05;
    if (G.ferris) G.ferris.rotation.z += dt * 0.12;
    // nitro flame marker
    if (G.fx.nitro && p.vehicle) {
      p.vehicle.group.position.y = Math.sin(G.time * 40) * 0.02;
    }
    // damage flash decay
    p.damageFlash = Math.max(0, p.damageFlash - dt * 2);
    // flash cleanup
    for (let i = G.fx.flashes.length - 1; i >= 0; i--) {
      const f = G.fx.flashes[i];
      f.t -= dt;
      if (f.t <= 0) { scene.remove(f.mesh); G.fx.flashes.splice(i, 1); }
    }
    // car wrecked / busted / wasted
    for (const ev of G.events.splice(0)) {
      if (ev === 'car-wrecked') {
        G.hud.say('Your car is wrecked — get out and find another', 3);
        if (p.vehicle) exitCar(G);
      }
    }
    const end = checkBusted(G);
    if (end) {
      G.dead = true; G.deadKind = end;
      document.getElementById('dead-title').textContent = end === 'busted' ? 'BUSTED' : 'WASTED';
      G.hud.dead.classList.remove('hidden');
      G.sound.blip(80, 0.5);
    }
    // autosave every 20 s
    saveT += dt;
    if (saveT > 20) { saveT = 0; G.save.save(); }
    updateHUD(G);
    G.hud.tick(dt);
  }
  updateCamera(dt);
  renderer.render(scene, camera);
}

// expose a tiny debug handle for playtesting
window.__CORAL = G;
animate();

// screenshot staging: ?shot=chase|foot|marina|race
if (SHOT) {
  setTimeout(() => stageShot(G, SHOT), 600);
}

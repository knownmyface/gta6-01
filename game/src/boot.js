// boot.js — CORAL HEAT entry point: renderer + camera, input, the main loop,
// and the wiring that makes every system play together. Loads from index.html.
import * as THREE from 'three';
import { clamp, damp } from './util.js';
import { buildCity } from './coralcity.js';
import { spawnTraffic, spawnPeds, updateTraffic, updatePeds, driveVehicle, makeVehicle } from './drive.js';
import { initPlayer, updateOnFoot, enterVehicle, exitVehicle, spawnParkedCars, nearestStealable } from './walk.js';
import { initCops, updateCops, setWanted } from './cops.js';
import { initFight, updateFight } from './fight.js';
import { spawnMarina, updateBoats, driveBoat, nearestBoat, enterBoat, exitBoat } from './boats.js';
import { spawnBikes, driveBike, nearestBike, enterBike, exitBike } from './bikes.js';
import { initRace, updateRace, quitRace } from './raceway.js';
import { initGarage, atGarageShop, toggleShop, buyUpgrade, buySafehouse } from './garage.js';
import { initStory, updateStory, startMission, currentMission } from './story.js';
import { initStory2, updateStory2, startMission2, currentMission2 } from './story2.js';
import { buildHud, updateHud } from './hudkit.js';
import { initSound } from './sound.js';
import { saveGame, loadGame, hasSave } from './savegame.js';
import { stageShot } from './shots.js';

const W = {
  time: 0,
  keys: new Set(),
  mouseDown: false,
  events: [],
  started: false,
  paused: false,
  gameOver: null,
  camYaw: 0,
  camMode: 'follow',
  objective: 'Press N to start Mission 1 — BACK IN THE BAY',
  raceBanner: '',
  flashTimer: 0,
  flashText: '',
  shot: null,
  shotFxTimer: 0,
  bestLaps: {},
};

window.__game = W;
window.__garageApi = { buyUpgrade, buySafehouse };

function initRenderer() {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = false;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  document.getElementById('game-root').appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 1200);
  camera.position.set(0, 8, 24);
  W.renderer = renderer;
  W.scene = scene;
  W.camera = camera;
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
}

function initInput() {
  window.addEventListener('keydown', (e) => {
    if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
      e.preventDefault();
    }
    W.keys.add(e.code);
    if (e.code === 'KeyN') startNextMission();
    if (e.code === 'KeyR') W.sound?.nextStation();
    if (e.code === 'KeyM') {
      if (W.sound) W.sound.muted = !W.sound.muted;
    }
    if (e.code === 'KeyG' && atGarageShop(W)) toggleShop(W);
    if (e.code === 'Escape') {
      if (W.garage.shopOpen) toggleShop(W);
      W.paused = !W.paused;
    }
  });
  window.addEventListener('keyup', (e) => W.keys.delete(e.code));
  window.addEventListener('mousedown', (e) => {
    if (e.target.closest('#start-screen') || e.target.closest('#shop-panel') || e.target.closest('button')) return;
    W.mouseDown = true;
    W.sound?.ensure();
    W.sound?.startEngine();
    W.sound?.startSiren();
  });
  window.addEventListener('mouseup', () => { W.mouseDown = false; });
  // Drag to orbit the on-foot camera.
  let dragging = false;
  let lastX = 0;
  window.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    W.camYaw -= (e.clientX - lastX) * 0.005;
    lastX = e.clientX;
  });
  window.addEventListener('mousedown', (e) => { dragging = true; lastX = e.clientX; });
  window.addEventListener('mouseup', () => { dragging = false; });
  document.getElementById('play-btn').addEventListener('click', startGame);
}

function startNextMission() {
  if (W.story.active || W.story2.active || W.race.active) return;
  if (W.story.index < 12) {
    startMission(W, W.story.index);
  } else if (W.story2.index < 8) {
    startMission2(W, W.story2.index);
  } else {
    W.hudFlash('ALL 20 MISSIONS DONE — free roam!');
  }
}

function startGame() {
  W.started = true;
  document.getElementById('start-screen').style.display = 'none';
  W.sound?.ensure();
  W.sound?.startEngine();
  W.sound?.startSiren();
  W.sound?.blip();
  if (!W.story.active && W.story.index === 0) {
    W.objective = 'Press N to start Mission 1 — BACK IN THE BAY';
  }
}

W.hudFlash = (text) => {
  W.flashText = text;
  W.flashTimer = 3;
  const el = document.getElementById('hud-flash');
  if (el) el.textContent = text;
};

W.saveGame = () => saveGame(W);

function readDriveInput() {
  const k = W.keys;
  return {
    throttle: (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0) - (k.has('KeyS') || k.has('ArrowDown') ? 0.7 : 0),
    steer: (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0),
    brake: k.has('Space'),
    nitro: k.has('ShiftLeft') || k.has('ShiftRight'),
  };
}

function handleEnterExit(dt) {
  const p = W.player;
  const k = W.keys;
  if (!k.has('KeyE')) return;
  if (p.mode === 'foot') {
    // Carjacking is handled in walk.js (it eats KeyE when a car is near).
    // Bikes and boats are handled here.
    const bike = nearestBike(W);
    if (bike) {
      enterBike(W, bike);
      k.delete('KeyE');
      return;
    }
    const boat = nearestBoat(W);
    if (boat) {
      enterBoat(W, boat);
      k.delete('KeyE');
      return;
    }
    // No vehicle near: the E press is stale, clear it.
    k.delete('KeyE');
  } else {
    // In a vehicle: E steps out.
    if (p.mode === 'car') exitVehicle(W);
    else if (p.mode === 'bike') exitBike(W);
    else if (p.mode === 'boat') exitBoat(W);
    k.delete('KeyE');
  }
}

function updateCamera(dt) {
  const cam = W.camera;
  const p = W.player;
  const v = p.vehicle;
  let targetPos;
  let lookAt;
  if (v) {
    const fx = Math.sin(p.heading);
    const fz = Math.cos(p.heading);
    const back = p.mode === 'boat' ? 16 : 12.5;
    const up = p.mode === 'boat' ? 7 : 6.5;
    targetPos = new THREE.Vector3(p.x - fx * back, up, p.z - fz * back);
    lookAt = new THREE.Vector3(p.x + fx * 10, 1.6, p.z + fz * 10);
  } else {
    // On foot: camera behind the player, orbiting with camYaw.
    const fx = Math.sin(W.camYaw);
    const fz = Math.cos(W.camYaw);
    targetPos = new THREE.Vector3(p.x - fx * 7.5, 4.2, p.z - fz * 7.5);
    lookAt = new THREE.Vector3(p.x + fx * 4, 1.5, p.z + fz * 4);
    // Ease the camera yaw toward the player's heading when not dragging.
    const diff = p.heading - W.camYaw;
    const wrapped = Math.atan2(Math.sin(diff), Math.cos(diff));
    W.camYaw += wrapped * Math.min(1, dt * 1.5);
  }
  cam.position.x = damp(cam.position.x, targetPos.x, 6, dt);
  cam.position.y = damp(cam.position.y, targetPos.y, 6, dt);
  cam.position.z = damp(cam.position.z, targetPos.z, 6, dt);
  // In shot mode the camera must be in place on the very first frame, or
  // the still catches it mid-flight from the spawn view.
  if (W.camSnap) {
    cam.position.copy(targetPos);
    W.camSnap = false;
  }
  cam.lookAt(lookAt);
}

function updatePlayer(dt) {
  const p = W.player;
  if (p.mode === 'foot') {
    updateOnFoot(W, dt);
  } else if (p.mode === 'car') {
    const input = readDriveInput();
    driveVehicle(W, p.vehicle, input, dt);
    p.x = p.vehicle.x;
    p.z = p.vehicle.z;
    p.heading = p.vehicle.heading;
    if (W.race.active && W.race.countdown > 0) p.vehicle.speed = 0;
    W.sound?.updateEngine(p.vehicle.speed, input.throttle > 0);
  } else if (p.mode === 'bike') {
    const input = readDriveInput();
    driveBike(W, p.vehicle, input, dt);
    p.x = p.vehicle.x;
    p.z = p.vehicle.z;
    p.heading = p.vehicle.heading;
    W.sound?.updateEngine(p.vehicle.speed, input.throttle > 0);
  } else if (p.mode === 'boat') {
    const input = readDriveInput();
    driveBoat(W, p.vehicle, input, dt);
    p.x = p.vehicle.x;
    p.z = p.vehicle.z;
    p.heading = p.vehicle.heading;
    W.sound?.updateEngine(p.vehicle.speed * 0.6, input.throttle > 0);
  }
  // Wrecked vehicle explodes and dumps the player out.
  const v = p.vehicle;
  if (v && (v.damage || 0) >= 100) {
    W.fx.explode(p.x, 1, p.z, true);
    if (p.mode === 'car') exitVehicle(W);
    else if (p.mode === 'bike') exitBike(W);
    else if (p.mode === 'boat') exitBoat(W);
    p.health = Math.max(10, p.health - 35);
    p.wanted = Math.min(5, p.wanted + 1);
    W.hudFlash('VEHICLE DESTROYED!');
  }
  // Health regen slowly out of combat.
  if (p.wanted === 0) p.health = Math.min(100, p.health + 2 * dt);
  if (p.health <= 0 && !W.gameOver) {
    W.gameOver = p.wanted > 0 ? 'BUSTED' : 'WASTED';
    W.hudFlash(W.gameOver + ' — respawning…');
    setTimeout(() => {
      p.health = 100;
      p.wanted = 0;
      setWanted(W, 0);
      p.x = 0;
      p.z = 12;
      p.mode = 'foot';
      p.vehicle = null;
      p.mesh.visible = true;
      p.mesh.position.set(0, 0, 12);
      W.gameOver = null;
    }, 1800);
  }
}

let lastSave = 0;
function loop(t) {
  requestAnimationFrame(loop);
  const dt = Math.min(0.05, W.clock.getDelta());
  W.time += dt;
  if (!W.started || W.paused) {
    // Still render the scene behind the start screen.
    W.renderer.render(W.scene, W.camera);
    return;
  }
  // Clouds drift; ocean swells.
  for (const c of W.city.clouds) {
    c.position.x += dt * 1.2;
    if (c.position.x > 340) c.position.x = -340;
  }
  updateTraffic(W, dt);
  updatePeds(W, dt);
  handleEnterExit(dt);
  updatePlayer(dt);
  updateCops(W, dt);
  updateFight(W, dt);
  updateBoats(W, dt);
  updateRace(W, dt);
  updateStory(W, dt);
  updateStory2(W, dt);
  // Chase-shot fire glow: keep the explosion burning for the screenshot.
  if (W.shot === 'chase') {
    W.shotFxTimer -= dt;
    if (W.shotFxTimer <= 0) {
      W.shotFxTimer = 0.9;
      W.fx.burst(-98, 1.2, -64, 'fire', 8);
      W.fx.burst(-98, 2, -64, 'smoke', 5);
    }
  }
  // Radio + siren follow the game.
  W.sound?.radioTick(W.time);
  W.sound?.updateSiren(W.player.wanted, W.time);
  updateCamera(dt);
  updateHud(W);
  // Autosave every 45 seconds.
  if (W.time - lastSave > 45) {
    lastSave = W.time;
    saveGame(W);
  }
  W.renderer.render(W.scene, W.camera);
}

function boot() {
  W.clock = new THREE.Clock();
  initRenderer();
  buildCity(W);
  initPlayer(W);
  initCops(W);
  initFight(W);
  initRace(W);
  initGarage(W);
  initStory(W);
  initStory2(W);
  initSound(W);
  buildHud(W);
  spawnTraffic(W, 26);
  spawnPeds(W, 42);
  spawnParkedCars(W);
  spawnMarina(W);
  spawnBikes(W);
  initInput();
  // Give the player a starter car so the first minutes are driving, not walking.
  const starter = makeVehicle(W, 0xd92828, 0, 18, 0, { topSpeed: 34, name: 'Comet GT', player: false });
  W.parked.push(starter);
  // Restore a previous save if there is one.
  const saved = loadGame(W);
  if (saved) {
    W.hudFlash('SAVE LOADED — welcome back to Coral Bay');
    document.getElementById('save-note').textContent =
      'Save found: ' + saved.cash + ' cash, ' + saved.missions.length + ' missions done.';
  }
  // Screenshot staging (?shot=chase|foot|marina|race).
  const shot = new URLSearchParams(window.location.search).get('shot');
  if (shot) {
    stageShot(W, shot);
  }
  requestAnimationFrame(loop);
}

boot();

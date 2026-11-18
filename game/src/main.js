// CORAL HEAT — main bootstrap and game loop. Wires the city, traffic,
// pedestrians, police, missions, combat, HUD, radio and saves together and
// runs the game in desktop Chrome from static files, no network requests.
import * as THREE from 'three';
import { createRng, clamp } from './rng.js';
import { buildCity, districtAt } from './city.js';
import { Traffic, Police, Roadblocks, driveCar } from './vehicles.js';
import { Player, Pedestrians } from './player.js';
import { MissionManager, MISSIONS } from './missions.js';
import { Combat } from './combat.js';
import { Hud } from './hud.js';
import { RadioAudio } from './audio.js';
import { loadSave, writeSave, clearSave } from './save.js';
import { applyShot } from './shots.js';

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
const SHOT = params.get('shot');
const SEED = parseInt(params.get('seed') || '7', 10) || 7;
// Capture boot errors early: a module that throws mid-evaluation never
// reaches the listener registered at the end of this file.
window.addEventListener('error', (e) => { window.__shotError = String(e.message || e.error); });

const CAR_NAMES = {
  sports: 'COMET GT', sedan: 'BAYSIDE SEDAN', taxi: 'CORAL CAB',
  van: 'HARBOR VAN', truck: 'DOCK HAULER', police: 'CBPD INTERCEPTOR',
};

const canvas = $('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 2000);
camera.position.set(-150, 6, 40);

const rng = createRng(SEED);
const world = buildCity(scene, SEED);
world.scene = scene;
const traffic = new Traffic(scene, createRng(SEED + 11), world.colliders);
const peds = new Pedestrians(scene, createRng(SEED + 23), world.colliders);
const police = new Police(scene, createRng(SEED + 37), world.colliders);
const roadblocks = new Roadblocks(scene);
const player = new Player(scene, createRng(SEED + 51));
const audio = new RadioAudio();
const hud = new Hud();
const combat = new Combat(scene, audio);
world.traffic = traffic;
world.peds = peds;
world.police = police;
world.playerCars = [];

const state = {
  mode: 'menu', // menu | playing | paused | busted
  cameraYaw: 0,
  cameraPitch: 0.32,
  cameraDist: 10,
  dragging: false,
  aimHeading: 0,
  shotFrames: 0,
  shotStart: performance.now(),
  saveTimer: 0,
  bestWanted: 0,
};

function toast(title, body) { hud.toast(title, body); }

const missions = new MissionManager(scene, createRng(SEED + 71), world.beacon, {
  onToast: toast,
  onObjective: (t) => hud.setObjective(t),
  onMissionStart: (m) => {
    hud.setMission(m, missions.done, missions.earned);
    audio.missionJingle();
  },
  onComplete: (m, cash) => {
    toast(`MISSION COMPLETE — ${m.title}`, `+$${m.reward.toLocaleString()}  •  cash $${cash.toLocaleString()}`);
    audio.missionJingle();
    saveGame();
  },
  onFail: (reason) => { toast('MISSION FAILED', reason); audio.blip(220); },
  setWanted: (n) => { player.wanted = n; player.wantedTimer = 0; },
});
missions.world = world;

combat.onBusted = (cause) => {
  const fine = Math.min(500, Math.floor(player.cash * 0.15));
  player.cash -= fine;
  player.health = 100;
  player.wanted = 0;
  police.clear();
  roadblocks.clear();
  if (player.inCar) player.exitCar();
  player.x = -160; player.z = 20; player.heading = Math.PI / 2;
  player.mesh.position.set(player.x, 0, player.z);
  $('bustedText').textContent = `${cause} Bail posted ($${fine}) — back on the Strip.`;
  state.mode = 'busted';
  $('bustedScreen').classList.remove('hidden');
  saveGame();
};

// --- input ---
const keys = {};
window.addEventListener('keydown', (e) => {
  keys[e.code] = true;
  if (e.code === 'Escape' && state.mode === 'playing') pauseGame();
  else if (e.code === 'Escape' && state.mode === 'paused') resumeGame();
  if (e.code === 'KeyM') toggleMute();
  if (e.code === 'KeyR') cycleRadio();
  if (e.code === 'Digit1') setStation(0);
  if (e.code === 'Digit2') setStation(1);
  if (e.code === 'Digit3') setStation(2);
  if (e.code === 'KeyF') tryEnterExit();
  if (e.code === 'KeyE') trySteal();
  if (e.code === 'Enter' && state.mode === 'menu') startGame(false);
  if (['Space', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault();
});
window.addEventListener('keyup', (e) => { keys[e.code] = false; });
canvas.addEventListener('mousedown', (e) => {
  state.dragging = true;
  if (state.mode === 'playing' && !player.inCar && e.button === 0) shoot();
});
window.addEventListener('mouseup', () => { state.dragging = false; });
window.addEventListener('mousemove', (e) => {
  if (!state.dragging) return;
  state.cameraYaw -= e.movementX * 0.004;
  state.cameraPitch = clamp(state.cameraPitch + e.movementY * 0.003, 0.08, 1.1);
  if (!player.inCar) player.heading -= e.movementX * 0.004;
});
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

function toggleMute() {
  audio.setMuted(!audio.muted);
  hud.setRadio(audio.currentStation());
  toast(audio.muted ? 'RADIO MUTED' : 'RADIO ON', audio.currentStation().name);
}
function cycleRadio() { setStation(audio.station + 1); }
function setStation(i) {
  const st = audio.setStation(i);
  hud.setRadio(st);
  toast(st.name, st.track);
}

function tryEnterExit() {
  if (state.mode !== 'playing') return;
  if (player.inCar) { player.exitCar(); audio.blip(440); return; }
  // own parked car first
  let best = null, bd = 16;
  for (const c of world.playerCars) {
    const d = (c.x - player.x) ** 2 + (c.z - player.z) ** 2;
    if (d < bd) { bd = d; best = c; }
  }
  if (best) { player.enterCar(best); audio.blip(660); }
}

function trySteal() {
  if (state.mode !== 'playing' || player.inCar) return;
  const car = traffic.nearest(player.x, player.z, 5);
  if (!car) { toast('NO CAR NEARBY', 'Walk up to a traffic car and press E.'); return; }
  traffic.remove(car);
  peds.spawnDriver(car.x + 2, car.z + 2, car.heading + Math.PI / 2);
  world.playerCars.push(car);
  player.enterCar(car);
  player.addWanted(1, 'carjacking');
  audio.stealJingle();
  toast('CAR STOLEN', `${CAR_NAMES[car.type] || 'CAR'} is yours — the cops noticed. +1 wanted star.`);
  if (missions.active?.def.type === 'steal') hud.setObjective('Stolen! Now deliver it to the garage');
}

function shoot() {
  const targets = combat.buildTargets(player, missions, police, peds);
  const hit = combat.playerShoot(player, player.heading + state.cameraYaw * 0.15, targets);
  if (hit) peds.scare(player.x, player.z, 20);
}

// --- screens ---
function fillMissionList() {
  const save = loadSave();
  const idx = save?.missionIndex ?? 0;
  $('missionList').innerHTML = MISSIONS.map((m, i) =>
    `<div class="${i < idx ? 'done' : i === idx ? 'next' : ''}">${i < idx ? '✓' : i === idx ? '▶' : '·'} ${m.id}. ${m.title} — $${m.reward.toLocaleString()}</div>`).join('');
}

function startGame(fromContinue) {
  audio.unlock();
  const save = loadSave();
  $('startScreen').classList.add('hidden');
  state.mode = 'playing';
  if (fromContinue && save) {
    player.cash = save.cash ?? 1250;
    missions.restore({ index: save.missionIndex ?? 0, done: save.missionIndex ?? 0, earned: save.earned ?? 0 });
    state.bestWanted = save.bestWanted ?? 0;
  } else {
    player.cash = 1250;
  }
  traffic.spawn(14, player.pos);
  peds.spawn(22, player.pos);
  missions.startMission(missions.index);
  hud.setCash(player.cash);
  hud.setHealth(player.health);
  hud.setRadio(audio.currentStation());
  saveGame();
}

function pauseGame() {
  state.mode = 'paused';
  $('pauseScreen').classList.remove('hidden');
  saveGame();
}
function resumeGame() {
  state.mode = 'playing';
  $('pauseScreen').classList.add('hidden');
  audio.unlock();
}

$('startBtn').addEventListener('click', () => startGame(false));
$('continueBtn').addEventListener('click', () => startGame(true));
$('resumeBtn').addEventListener('click', resumeGame);
$('restartBtn').addEventListener('click', () => {
  clearSave();
  location.reload();
});
$('bustedBtn').addEventListener('click', () => {
  $('bustedScreen').classList.add('hidden');
  state.mode = 'playing';
  missions.startMission(missions.index);
});

function saveGame() {
  writeSave({
    cash: player.cash,
    missionIndex: missions.index,
    missionsDone: missions.done,
    earned: missions.earned,
    station: audio.station,
    muted: audio.muted,
    bestWanted: state.bestWanted,
  });
}

// --- camera ---
function updateCamera(dt) {
  if (state.cinematic) { state.cinematic(); return; }
  const p = player.pos;
  const heading = player.inCar ? player.car.heading : player.heading;
  const yaw = heading + state.cameraYaw;
  const dist = player.inCar ? 11 : 8;
  const height = player.inCar ? 4.4 : 3.6;
  const tx = p.x - Math.sin(yaw) * dist;
  const tz = p.z - Math.cos(yaw) * dist;
  const k = 1 - Math.pow(0.0001, dt);
  camera.position.x += (tx - camera.position.x) * k;
  camera.position.y += (height - camera.position.y) * k;
  camera.position.z += (tz - camera.position.z) * k;
  camera.lookAt(p.x + Math.sin(heading) * 6, player.inCar ? 1.6 : 1.4, p.z + Math.cos(heading) * 6);
}

// --- HUD refresh ---
function updateHud() {
  const p = player.pos;
  hud.setCash(player.cash);
  hud.setWanted(player.wanted);
  hud.setHealth(player.health);
  hud.setDistrict(districtAt(p.x, p.z));
  const mph = (player.inCar ? player.car.speed : player.speed) * 2.24;
  hud.setSpeed(mph, player.inCar ? (CAR_NAMES[player.car.type] || 'CAR') : 'ON FOOT');
  hud.setWeapon(player.inCar ? '🚗 Driving — F exit • Space brake • Shift boost' : '🔫 Pistol • ∞ ammo  •  F enter car • E steal');
  hud.drawMinimap(world, player, missions);
  state.bestWanted = Math.max(state.bestWanted, player.wanted);
}

// --- main loop ---
const clock = new THREE.Clock();
let framesRendered = 0;

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  const playing = state.mode === 'playing';

  if (playing) {
    // input -> player
    if (player.inCar) {
      const car = player.car;
      const throttle = (keys.KeyW || keys.ArrowUp ? 1 : 0) + (keys.KeyS || keys.ArrowDown ? -0.7 : 0) + (state.shotInput?.throttle ?? 0);
      const steer = (keys.KeyA || keys.ArrowLeft ? 1 : 0) - (keys.KeyD || keys.ArrowRight ? 1 : 0) + (state.shotInput?.steer ?? 0);
      const boost = keys.ShiftLeft || keys.ShiftRight ? 1.35 : 1;
      const prevMax = car.maxSpeed;
      car.maxSpeed = prevMax * boost;
      driveCar(car, dt, { throttle: clamp(throttle, -1, 1), steer: clamp(steer, -1, 1), brake: !!keys.Space }, world.colliders, [...traffic.cars, ...police.cars, ...world.playerCars]);
      car.maxSpeed = prevMax;
      if (car.crashed && state.crashCooldown <= 0) { audio.crash(); state.crashCooldown = 0.5; }
      state.crashCooldown = Math.max(0, (state.crashCooldown ?? 0) - dt);
      const block = roadblocks.hitTest(car.x, car.z);
      if (block) { car.speed *= 0.3; player.addWanted(0); audio.crash(); }
    } else {
      player.onFootMove(dt, {
        forward: !!(keys.KeyW || keys.ArrowUp),
        back: !!(keys.KeyS || keys.ArrowDown),
        left: !!(keys.KeyA || keys.ArrowLeft),
        right: !!(keys.KeyD || keys.ArrowRight),
        run: !!(keys.ShiftLeft || keys.ShiftRight),
      }, world.colliders);
    }

    traffic.update(dt, player);
    peds.update(dt);
    police.update(dt, player, player.wanted, [...traffic.cars, ...world.playerCars]);
    roadblocks.placeAhead(player, player.wanted);
    missions.update(dt, player, world);
    combat.update(dt, player, missions, police, peds);
    player.decayWanted(dt);
    audio.setEngine(player.inCar ? player.car.speed * 2.24 : 0, player.inCar);
    audio.setSiren(player.wanted);

    // world animation: ocean shimmer, Ferris wheel, sun-side clouds none
    world.animated.ocean.offset.x += dt * 0.008;
    world.animated.ocean.offset.y += dt * 0.003;
    if (world.animated.wheel) world.animated.wheel.rotation.z += dt * 0.12;

    state.saveTimer += dt;
    if (state.saveTimer > 10) { state.saveTimer = 0; saveGame(); }
    updateHud();
  }

  updateCamera(dt);
  renderer.render(scene, camera);
  framesRendered += 1;

  // screenshot mode: signal readiness after the scene has settled
  if (SHOT && state.mode === 'playing' && !window.__shotReady) {
    if (framesRendered >= 12 && performance.now() - state.shotStart > 2500) {
      window.__shotReady = true;
    }
  }
}

// --- boot ---
fillMissionList();
{
  const save = loadSave();
  if (save && (save.missionIndex ?? 0) > 0) {
    $('continueBtn').classList.remove('hidden');
    $('continueNum').textContent = (save.missionIndex ?? 0) + 1;
  }
  hud.setRadio(audio.currentStation());
  hud.setMission(MISSIONS[0], 0, 0);
  hud.setCash(1250);
}

if (SHOT) {
  // screenshot mode: straight into a staged, playing scene — no menus, no audio
  $('startScreen').classList.add('hidden');
  state.mode = 'playing';
  traffic.spawn(10, player.pos);
  peds.spawn(16, player.pos);
  const ctx = {
    player, missions, hud, audio, camera,
    world, input: null, cameraMode: 'follow', cinematic: null,
  };
  if (applyShot(SHOT, ctx)) {
    state.cinematic = ctx.cinematic || null;
    state.shotInput = ctx.input || null;
    if (ctx.input) state.shotInput = ctx.input;
    const m = missions.current();
    if (m) hud.setMission(m, missions.done, missions.earned);
    hud.setCash(player.cash);
    hud.setHealth(player.health);
    hud.setWanted(player.wanted);
  } else {
    window.__shotError = `unknown shot: ${SHOT}`;
  }
}

window.__game = { player, missions, traffic, police, peds, state, hud };
animate();

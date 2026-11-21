// boot.js — entry point. Builds the renderer/scene, wires every system,
// runs the game loop, handles input + camera, and stages screenshots when
// ?shot=cover|marina|foot|race is present. Camera sits directly behind the
// player; no buildings ever spawn on roads (city layout keeps them clear).
import * as THREE from "../vendor/three/three.module.min.js";
import { $, clamp, lerp, lerpAngle } from "./util.js";
import { SoundEngine } from "./sound.js";
import { loadSave, writeSave } from "./savegame.js";
import { buildCity, tickCity, CITY } from "./coralcity.js";
import { spawnPlayerCar, spawnTraffic, updateTraffic, updatePlayerCar, nearestStealableCar, jackCar } from "./drive.js";
import { spawnPlayerOnFoot, updateOnFoot, spawnPedestrians, updatePedestrians } from "./walk.js";
import { setWanted, updatePolice, deployRoadblock, clearRoadblock, checkSpikes, spawnHelicopter } from "./cops.js";
import { initFight, updateExplosions, shoot, cycleWeapon, toggleWeaponWheel, currentWeapon, WEAPONS } from "./fight.js";
import { spawnBike, updateBike } from "./bikes.js";
import { spawnBoat, updateBoat, spawnPoliceBoat, updatePoliceBoats, clearPoliceBoats } from "./boats.js";
import { buildShops, nearestShop, openShop, closeShop, openGarage } from "./garage.js";
import { startRace, updateRace, endRace, CIRCUITS } from "./raceway.js";
import { initStory, updateStory, flagJacked, flagBought, resetMissionFlags } from "./story.js";
import { initStory2, advanceToStory2, updateStory2 } from "./story2.js";
import { Hud } from "./hudkit.js";
import { stageShot } from "./shots.js";

window.__errors = [];
window.addEventListener("error", (e) => window.__errors.push(String(e.message || e.error)));
window.addEventListener("unhandledrejection", (e) => window.__errors.push("rejection: " + String(e.reason)));

const params = new URLSearchParams(window.location.search);
const SHOT = params.get("shot") || "";
const AUTO = params.get("autoplay") === "1" || SHOT !== "";

const G = {
  player: { mode: "car", pos: new THREE.Vector3(30, 0, 20), heading: Math.PI, speed: 0, wanted: 0, moving: false },
  wanted: 0,
  displaySpeed: 0,
  cameraYaw: Math.PI,
  cameraPitch: 0.32,
  mouseYaw: 0,
  mousePitch: 0,
  shotMode: false,
  paused: false,
  started: false,
  shakeAmt: 0,
  coolTimer: 0,
  traffic: [],
  peds: [],
  police: [],
  policeBoats: [],
  heli: null,
  roadblock: null,
  race: null,
  shopOpen: null,
  save: loadSave(),
};
window.__CORAL = G;

function buildWorld() {
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = false;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  const app = $("app");
  if (app) app.appendChild(renderer.domElement);
  G.renderer = renderer;
  G.scene = new THREE.Scene();
  G.scene.background = new THREE.Color(0x1c2a5e);
  G.camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 1600);
  G.camera.position.set(30, 4, 32);
  G.clock = new THREE.Clock();
  G.sound = new SoundEngine();
  buildCity(G);
  G.hud = new Hud(G);
  initFight(G);
  buildShops(G);
  // API handles other systems call through G (keeps imports acyclic).
  G.setWanted = (l) => setWanted(G, l);
  G.deployRoadblock = (gg, d) => deployRoadblock(gg, d);
  G.clearRoadblock = () => clearRoadblock(G);
  G.spawnPoliceBoat = (gg, x, z) => spawnPoliceBoat(gg, x, z);
  G.clearPoliceBoats = (gg) => clearPoliceBoats(gg);
  G.spawnBike = (gg, id, x, z, h) => spawnBike(gg, id, x, z, h);
  G.spawnBoat = (gg, id, x, z, h) => spawnBoat(gg, id, x, z, h);
  G.driveApi = { spawnPlayerCar: (gg, id, x, z, h) => spawnPlayerCar(gg, id, x, z, h) };
  G.advanceToStory2 = () => advanceToStory2(G);
  G.saveGame = () => writeSave(G.save);
  G.toast = (t) => G.hud.toast(t);
  G.shake = (a) => { G.shakeAmt = Math.max(G.shakeAmt || 0, a); };
  G.flagJacked = () => flagJacked(G);
  G.flagBought = () => flagBought(G);
  // World population.
  spawnPlayerCar(G, "sunset-gt", 30, 20, Math.PI);
  spawnPlayerOnFoot(G, 28, 24, Math.PI);
  if (G.playerMesh) G.playerMesh.visible = false;
  G.player.mode = "car";
  G.player.pos.set(30, 0, 20);
  G.player.heading = Math.PI;
  spawnTraffic(G, 26);
  spawnPedestrians(G, 42);
  // Parked bikes + a boat at the marina for the player to find.
  const bike = spawnBike(G, "coast-125", -140, -158, Math.PI / 2);
  G.playerBike = bike;
  const boat = spawnBoat(G, "harbor-skiff", -60, -232, 0);
  G.playerBoat = boat;
  // Story: resume at the saved mission; story2 if past mission 16.
  initStory(G);
  initStory2(G);
  if ((G.save.mission || 1) > 16) {
    G.missions = G.missions2;
    G.missionIndex = Math.min(5, (G.save.mission || 17) - 17);
    G.story2Active = true;
    const m = G.missions[G.missionIndex];
    if (m) {
      if (G.city && G.city.beacon) G.city.beacon.position.set(m.target.x, 13, m.target.z);
      G.hud.setMission(m);
    }
  }
  G.hud.setCash(G.save.cash);
  G.hud.setWanted(0);
  G.hud.setWeapon(currentWeapon(G));
  G.hud.setRadio(G.sound.radioName());
  if (!G.started) G.hud.showStart(G.save);
  window.addEventListener("resize", () => {
    G.camera.aspect = window.innerWidth / window.innerHeight;
    G.camera.updateProjectionMatrix();
    G.renderer.setSize(window.innerWidth, window.innerHeight);
  });
}

const input = { forward: false, back: false, left: false, right: false, brake: false, sprint: false };
const KEYMAP = {
  KeyW: "forward", ArrowUp: "forward",
  KeyS: "back", ArrowDown: "back",
  KeyA: "left", ArrowLeft: "left",
  KeyD: "right", ArrowRight: "right",
  Space: "brake", ShiftLeft: "sprint", ShiftRight: "sprint",
};

function bindInput() {
  window.addEventListener("keydown", (e) => {
    if (e.repeat) return;
    const k = KEYMAP[e.code];
    if (k) { input[k] = true; e.preventDefault(); }
    if (e.code === "KeyE") onInteract();
    if (e.code === "KeyF") onJack();
    if (e.code === "KeyQ") toggleWeaponWheel(G, !G.hud.wheelVisible);
    if (e.code === "KeyR") {
      G.sound.ensure();
      G.hud.setRadio(G.sound.nextRadio());
    }
    if (e.code === "KeyM") toggleRaceSelect();
    if (e.code === "Digit1" || e.code === "Digit2" || e.code === "Digit3" || e.code === "Digit4") {
      const idx = Number(e.code.slice(-1)) - 1;
      const ownedIds = (G.save.weapons || ["fists"]);
      const avail = WEAPONS.filter((w) => ownedIds.includes(w.id));
      if (avail[idx]) {
        G.weaponIndex = WEAPONS.indexOf(avail[idx]);
        G.hud.setWeapon(avail[idx]);
      }
    }
    if (e.code === "Escape") {
      G.paused = !G.paused;
      G.hud.showPause(G.paused);
    }
    if (e.code === "KeyP") {
      G.sound.ensure();
      G.sound.setMuted(!G.sound.muted);
    }
  });
  window.addEventListener("keyup", (e) => {
    const k = KEYMAP[e.code];
    if (k) input[k] = false;
  });
  window.addEventListener("mousedown", (e) => {
    if (!G.started) return;
    G.sound.ensure();
    if (e.button === 0) shoot(G);
    G._dragging = true;
    G._dragX = e.clientX;
    G._dragY = e.clientY;
  });
  window.addEventListener("mousemove", (e) => {
    if (!G._dragging) return;
    G.mouseYaw -= (e.clientX - G._dragX) * 0.004;
    G.mousePitch = clamp(G.mousePitch + (e.clientY - G._dragY) * 0.003, -0.15, 0.45);
    G._dragX = e.clientX;
    G._dragY = e.clientY;
  });
  window.addEventListener("mouseup", () => { G._dragging = false; });
  const playBtn = $("play-btn");
  if (playBtn) playBtn.addEventListener("click", startGame);
}

function startGame() {
  if (G.started) return;
  G.started = true;
  G.sound.ensure();
  G.sound.startRadio(0);
  G.hud.setRadio(G.sound.radioName());
  G.hud.hideStart();
  G.hud.banner("Welcome to Coral Bay — Mission 1: Welcome to Coral Bay");
}

function onInteract() {
  if (!G.started && !AUTO) return;
  if (G.shopOpen) { closeShop(G); return; }
  const shop = nearestShop(G, 9);
  if (shop) {
    openShop(G, shop);
    G.flagBought();
    return;
  }
  // Safehouse: open the garage.
  for (const sh of (G.city.safehouses || [])) {
    const d = Math.hypot(sh.pos.x - G.player.pos.x, sh.pos.z - G.player.pos.z);
    if (d < 9) { openGarage(G); return; }
  }
  // Enter / exit vehicle.
  if (G.player.mode === "car" || G.player.mode === "bike" || G.player.mode === "boat") {
    const v = G.playerCar || G.playerBike || G.playerBoat;
    if (v) {
      G.player.mode = "foot";
      G.player.pos.set(v.x + 2.5, 0, v.z + 2.5);
      if (G.playerMesh) {
        G.playerMesh.visible = true;
        G.playerMesh.position.set(G.player.pos.x, 0, G.player.pos.z);
      }
      G.displaySpeed = 0;
    }
  } else if (G.player.mode === "foot") {
    const car = G.playerCar;
    if (car) {
      const d = Math.hypot(car.x - G.player.pos.x, car.z - G.player.pos.z);
      if (d < 5) {
        G.player.mode = "car";
        if (G.playerMesh) G.playerMesh.visible = false;
        return;
      }
    }
    if (G.playerBike) {
      const d = Math.hypot(G.playerBike.x - G.player.pos.x, G.playerBike.z - G.player.pos.z);
      if (d < 4) { G.player.mode = "bike"; if (G.playerMesh) G.playerMesh.visible = false; return; }
    }
    if (G.playerBoat) {
      const d = Math.hypot(G.playerBoat.x - G.player.pos.x, G.playerBoat.z - G.player.pos.z);
      if (d < 6 && G.player.pos.z < -190) { G.player.mode = "boat"; if (G.playerMesh) G.playerMesh.visible = false; }
    }
  }
}

function onJack() {
  if (G.player.mode !== "foot") return;
  const target = nearestStealableCar(G, 6);
  if (target) {
    if (jackCar(G, target)) {
      G.flagJacked();
      if (G.hud) G.hud.banner("CARJACKED — Bay PD responding");
    }
  }
}

function toggleRaceSelect() {
  const panel = $("race-select");
  if (!panel) return;
  if (G.race) { endRace(G); G.toast("Race abandoned"); return; }
  if (panel.style.display === "block") { panel.style.display = "none"; return; }
  panel.style.display = "block";
}

function buildRaceSelect() {
  const list = $("race-list");
  if (!list) return;
  list.innerHTML = "";
  for (const c of CIRCUITS) {
    const btn = document.createElement("button");
    const best = (G.save.bestLap || {})[c.id];
    btn.textContent = c.name + " — " + c.laps + " laps" + (best ? " • best " + best.toFixed(1) + "s" : "");
    btn.onclick = () => {
      const panel = $("race-select");
      if (panel) panel.style.display = "none";
      if (G.player.mode !== "car") {
        G.toast("Get in a car first — races are for drivers");
        return;
      }
      startRace(G, c.id);
    };
    list.appendChild(btn);
  }
  const close = document.createElement("button");
  close.textContent = "Close (M)";
  close.onclick = () => { const p = $("race-select"); if (p) p.style.display = "none"; };
  list.appendChild(close);
}

function updateCamera(dt) {
  const cam = G.camera;
  const target = G.player.pos;
  const yaw = G.player.heading + G.mouseYaw;
  const pitch = G.cameraPitch + G.mousePitch;
  let dist = 9.5;
  let height = 3.6;
  if (G.player.mode === "foot") { dist = 6.5; height = 3.0; }
  if (G.player.mode === "boat") { dist = 13; height = 5.5; }
  const cx = target.x - Math.sin(yaw) * dist;
  const cz = target.z - Math.cos(yaw) * dist;
  const cy = height + pitch * 8;
  cam.position.x = lerp(cam.position.x, cx, clamp(dt * 5, 0, 1));
  cam.position.y = lerp(cam.position.y, cy, clamp(dt * 5, 0, 1));
  cam.position.z = lerp(cam.position.z, cz, clamp(dt * 5, 0, 1));
  // Camera shake from explosions, decaying fast.
  if (G.shakeAmt > 0.01) {
    cam.position.x += (Math.random() - 0.5) * G.shakeAmt;
    cam.position.y += (Math.random() - 0.5) * G.shakeAmt * 0.6;
    G.shakeAmt = lerp(G.shakeAmt, 0, clamp(dt * 5, 0, 1));
  }
  cam.lookAt(target.x + Math.sin(yaw) * 8, 1.6, target.z + Math.cos(yaw) * 8);
  // Slowly re-centre the mouse orbit behind the vehicle (never in shot mode).
  if (!G.shotMode) {
    G.mouseYaw = lerp(G.mouseYaw, 0, clamp(dt * 0.7, 0, 1));
    G.mousePitch = lerp(G.mousePitch, 0, clamp(dt * 0.7, 0, 1));
  }
}

function wantedDecay(dt) {
  if ((G.wanted || 0) === 0) return;
  const near = (G.police || []).some((p) => Math.hypot(p.x - G.player.pos.x, p.z - G.player.pos.z) < 70);
  if (!near) {
    G.coolTimer += dt;
    if (G.coolTimer > 18) {
      G.coolTimer = 0;
      G.setWanted(G.wanted - 1);
      if (G.wanted === 0 && G.toast) G.toast("You lost them — heat is off");
    }
  } else {
    G.coolTimer = 0;
  }
}

function loop() {
  requestAnimationFrame(loop);
  const dt = Math.min(G.clock.getDelta(), 0.05);
  const t = G.clock.elapsedTime;
  if (G.paused) {
    G.renderer.render(G.scene, G.camera);
    return;
  }
  if (!G.shotMode && G.started) {
    if (G.player.mode === "car") updatePlayerCar(G, dt, input);
    else if (G.player.mode === "foot") updateOnFoot(G, dt, input);
    else if (G.player.mode === "bike") updateBike(G, dt, input);
    else if (G.player.mode === "boat") updateBoat(G, dt, input);
    updateTraffic(G, dt);
    updatePedestrians(G, dt);
    updatePolice(G, dt);
    updatePoliceBoats(G, dt);
    checkSpikes(G);
    updateRace(G, dt);
    updateStory(G, dt);
    updateStory2(G, dt);
    wantedDecay(dt);
    // Wrecked car: explode and respawn at the marina loft.
    if (G.playerCar && (G.playerCar.damage || 0) >= 100) {
      G.fx.explosion(G.playerCar.x, 1, G.playerCar.z);
      G.playerCar.damage = 0;
      G.playerCar.speed = 0;
      G.playerCar.x = -150;
      G.playerCar.z = -140;
      G.playerCar.heading = 0;
      G.save.cash = Math.max(0, (G.save.cash || 0) - 500);
      G.hud.setCash(G.save.cash);
      G.toast("Wrecked! Towed to the Marina Loft — $500");
      G.setWanted(0);
    }
  }
  if (G.shotMode && G.coverFx && G.fx) {
    G._fxTimer = (G._fxTimer || 0) + dt;
    if (G._fxTimer > 0.7) {
      G._fxTimer = 0;
      G.fx.explosion(G.coverFx.x, 1, G.coverFx.z);
      G.fx.burst(G.coverFx.x, 2, G.coverFx.z, "fire", 24, 11);
    }
  }
  tickCity(G, dt, t);
  updateExplosions(G, dt);
  updateCamera(dt);
  // HUD refresh.
  G.hud.setSpeed(G.displaySpeed);
  G.hud.setDamage(G.playerCar ? G.playerCar.damage || 0 : 0);
  G.hud.drawMinimap();
  G.renderer.render(G.scene, G.camera);
}

try {
  buildWorld();
  bindInput();
  buildRaceSelect();
  if (AUTO) {
    G.started = true;
    G.hud.hideStart();
  }
  loop();
  if (SHOT) {
    // Stage after the world has had a couple of frames to settle.
    window.setTimeout(() => {
      try {
        stageShot(G, SHOT);
      } catch (e) {
        window.__errors.push("stage: " + String(e && e.message));
        window.__shotReady = true;
      }
    }, 900);
  }
  window.__booted = true;
} catch (e) {
  window.__errors.push("boot: " + String(e && e.message));
  window.__booted = false;
}

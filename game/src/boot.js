// Coral Heat — boot: renderer, input, camera, main loop, game state glue.
// Fresh write, round 7.
import * as THREE from 'three';
import { clamp, rand } from './util.js';
import { buildCity } from './coralcity.js';
import { PlayerCar, Traffic, CAR_MODELS } from './drive.js';
import { Walker, Pedestrians } from './walk.js';
import { Police } from './cops.js';
import { Particles, Combat } from './fight.js';
import { Boats } from './boats.js';
import { Bikes } from './bikes.js';
import { Raceway, CIRCUITS } from './raceway.js';
import { Garage } from './garage.js';
import { MissionManager } from './story.js';
import { MissionsPart2 } from './story2.js';
import { Hud } from './hudkit.js';
import { Sound } from './sound.js';
import { SaveGame } from './savegame.js';
import { stageScene, stateSummary } from './shots.js';

const G = {
  time: 0,
  timeOfDay: 18 * 3600 + 42 * 60,
  started: false,
  paused: false,
  inCar: false,
  shopOpen: false,
  camMode: 'chase',
  camFar: false,
  player: { cash: 2500, health: 100, missionsDone: 0, kills: 0, storyComplete: false },
  input: { forward: false, back: false, left: false, right: false, brake: false, sprint: false },
  stageHold: null,
  stagedScene: null,
  camYaw: 0,
};

export function playerPos() {
  if (G.inCar) return { x: G.playerCar.x, z: G.playerCar.z };
  if (G.boats.active) return { x: G.boats.active.x, z: G.boats.active.z };
  if (G.bikes.active) return { x: G.bikes.active.x, z: G.bikes.active.z };
  return { x: G.walker.x, z: G.walker.z };
}
export function playerHeading() {
  if (G.inCar) return G.playerCar.heading;
  if (G.boats.active) return G.boats.active.heading;
  if (G.bikes.active) return G.bikes.active.heading;
  return G.walker.heading;
}
G.playerPos = playerPos;
G.playerHeading = playerHeading;
G.setInCar = (v) => { G.inCar = v; G.walker.mesh.visible = !v && !G.boats.active && !G.bikes.active; };

function init() {
  const container = document.getElementById('game');
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(innerWidth, innerHeight);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  container.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.1, 2000);
  camera.position.set(0, 8, 60);
  G.renderer = renderer; G.scene = scene; G.camera = camera;

  G.city = buildCity(scene);
  G.playerCar = new PlayerCar(scene, CAR_MODELS[0]);
  G.playerCar.reset(0, 40, Math.PI);
  G.traffic = new Traffic(scene, 26);
  G.walker = new Walker(scene);
  G.walker.place(0, 44, 0);
  G.walker.mesh.visible = false;
  G.peds = new Pedestrians(scene, 46);
  G.police = new Police(scene);
  G.particles = new Particles(scene);
  G.combat = new Combat(scene, G.particles);
  G.boats = new Boats(scene);
  G.bikes = new Bikes(scene);
  G.raceway = new Raceway(scene);
  G.racewayCircuits = CIRCUITS;
  G.garage = new Garage(scene);
  G.missions = new MissionManager(scene, G);
  G.missions2 = new MissionsPart2(scene, G);
  G.sound = new Sound();
  G.save = new SaveGame(G);
  G.hud = new Hud(G);
  G.hud.build();
  G.save.load();
  G.hud.update(G, 0);

  // ---- input ----
  const keyMap = { KeyW: 'forward', ArrowUp: 'forward', KeyS: 'back', ArrowDown: 'back', KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right', Space: 'brake', ShiftLeft: 'sprint', ShiftRight: 'sprint' };
  addEventListener('keydown', (ev) => {
    const k = keyMap[ev.code];
    if (k) { G.input[k] = true; ev.preventDefault(); }
    if (ev.repeat) return;
    if (ev.code === 'KeyE') enterExit();
    if (ev.code === 'KeyF') carjack();
    if (ev.code === 'KeyQ') G.hud.showWheel();
    if (ev.code === 'KeyR') { const s = G.sound.nextStation(); G.hud.toast('RADIO — ' + s.name + ': ' + s.track, '#7dd3fc'); }
    if (ev.code === 'KeyG') toggleShop();
    if (ev.code === 'KeyM') startMissionKey();
    if (ev.code === 'KeyP') togglePause();
    if (ev.code === 'KeyC') { G.camFar = !G.camFar; }
    if (ev.code === 'Digit1') G.combat.select(0);
    if (ev.code === 'Digit2') G.combat.select(1);
    if (ev.code === 'Digit3') G.combat.select(2);
    if (ev.code === 'Digit4') G.combat.select(3);
    if (ev.code === 'Digit5') G.combat.select(4);
    if (ev.code === 'Digit6') G.combat.select(5);
    if (ev.code === 'KeyH') G.hud.toast('WASD drive • E enter • F carjack • Q wheel • CLICK shoot • SHIFT nitro • R radio • G garage • M mission', '#ffffff');
  });
  addEventListener('keyup', (ev) => {
    const k = keyMap[ev.code];
    if (k) G.input[k] = false;
    if (ev.code === 'KeyQ') G.hud.hideWheel();
  });
  addEventListener('mousedown', (ev) => {
    if (!G.started || G.paused || G.shopOpen) return;
    if (ev.target.closest('.hud .overlay, .wheel, button')) return;
    const pos = playerPos();
    G.combat.shoot(G, pos, playerHeading());
  });
  addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  });

  // ---- actions ----
  function enterExit() {
    if (!G.started || G.paused) return;
    if (G.inCar) {
      const c = G.playerCar;
      G.setInCar(false);
      G.walker.place(c.x - Math.cos(c.heading) * 3, c.z + Math.sin(c.heading) * 3, c.heading);
      G.hud.toast('ON FOOT — press E near a car, boat or bike', '#ffffff');
      return;
    }
    if (G.boats.active) {
      const b = G.boats.leave();
      G.walker.place(b.x, b.z - 8, b.heading);
      G.setInCar(false);
      return;
    }
    if (G.bikes.active) {
      const b = G.bikes.leave();
      G.walker.place(b.x + 2, b.z, b.heading);
      G.setInCar(false);
      return;
    }
    const w = G.walker;
    const boat = G.boats.nearest(w.x, w.z, 7);
    if (boat) {
      G.boats.board(boat);
      G.walker.mesh.visible = false;
      G.hud.toast('BOARDING ' + boat.model.name + ' — WASD to sail', '#4ecdc4');
      G.missions.onBoatReached?.();
      return;
    }
    const bike = G.bikes.nearest(w.x, w.z, 5);
    if (bike) {
      G.bikes.board(bike);
      G.walker.mesh.visible = false;
      G.hud.toast('RIDING ' + bike.model.name + ' — SHIFT for wheelie', '#ff2fd6');
      return;
    }
    const car = G.traffic.nearest(w.x, w.z, 7);
    if (car) {
      const cx = car.axis === 'x' ? car.along : car.lane;
      const cz = car.axis === 'x' ? car.lane : car.along;
      G.traffic.remove(car);
      G.playerCar.reset(cx, cz, car.dir > 0 ? (car.axis === 'x' ? Math.PI / 2 : 0) : (car.axis === 'x' ? -Math.PI / 2 : Math.PI));
      G.playerCar.speed = 8;
      G.setInCar(true);
      G.hud.toast('STOLE A CAR — the owner is calling the cops!', '#ff8844');
      G.police.addHeat(12);
      G.missions.onSteal();
      return;
    }
    G.hud.toast('No car, boat or bike nearby — walk to one', '#ffffff');
  }
  function carjack() {
    if (!G.started || G.paused || G.inCar) return;
    const w = G.walker;
    const car = G.traffic.nearest(w.x, w.z, 6);
    if (!car) { G.hud.toast('No moving car in reach — stand by a slow car and press F', '#ffffff'); return; }
    const cx = car.axis === 'x' ? car.along : car.lane;
    const cz = car.axis === 'x' ? car.lane : car.along;
    G.traffic.remove(car);
    G.playerCar.reset(cx, cz, car.dir > 0 ? (car.axis === 'x' ? Math.PI / 2 : 0) : (car.axis === 'x' ? -Math.PI / 2 : Math.PI));
    G.playerCar.speed = 10;
    G.setInCar(true);
    G.police.addHeat(18);
    G.hud.toast('CARJACKED! Driver ran off — wanted level up', '#ff4444');
    G.missions.onCarjacked();
  }
  function toggleShop() {
    if (!G.started || G.paused) return;
    if (G.shopOpen) G.hud.closeShop();
    else {
      const near = G.garage.nearestSafehouse(G.walker.x, G.walker.z, 12) || G.garage.nearestSafehouse(G.playerCar.x, G.playerCar.z, 12);
      G.hud.openShop();
      if (near) G.hud.toast('Near ' + near.name + ' — buy it or store a car', '#7CFC00');
    }
  }
  function startMissionKey() {
    if (!G.started) return;
    if (G.missions.active || G.missions2.active) { G.hud.toast('A mission is already running', '#ffffff'); return; }
    if (G.missions.index < 12) G.missions.startCurrent();
    else if (G.missions2.current) G.missions2.startCurrent();
    else G.hud.toast('All 20 missions complete — free roam!', '#7CFC00');
  }
  function togglePause(force) {
    G.paused = force !== undefined ? force : !G.paused;
    G.hud.els.pauseScreen.style.display = G.paused ? 'flex' : 'none';
  }
  G.togglePause = togglePause;
  G.startGame = () => {
    G.started = true;
    G.sound.ensure();
    G.hud.els.startScreen.style.display = 'none';
    if (!G.missions.active && !G.missions2.active && (G.missions.index < 12 || G.missions2.index < 8)) {
      if (G.missions.index < 12) G.missions.startCurrent();
      else G.missions2.startCurrent();
    }
    G.hud.toast('Welcome to Coral Bay — press M for the next mission', '#ffd166');
  };

  // screenshot staging (only when ?scene= is present)
  const qs = new URLSearchParams(location.search);
  if (qs.get('scene')) {
    stageScene(G, qs.get('scene'));
  }

  window.__CH = G;
  window.__CH.state = () => stateSummary(G);

  // ---- main loop ----
  const clock = new THREE.Clock();
  let camPos = new THREE.Vector3(0, 8, 60);
  let camLook = new THREE.Vector3(0, 2, 0);
  function frame() {
    requestAnimationFrame(frame);
    const dt = Math.min(clock.getDelta(), 0.05);
    if (G.started && !G.paused) {
      G.time += dt;
      G.timeOfDay = (18 * 3600 + 42 * 60 + G.time * 12) % 86400;
      const input = { ...G.input };
      if (G.stageHold?.forward) input.forward = true;
      const pos = playerPos();
      // movement
      if (G.inCar) {
        G.playerCar.update(dt, input, G.city, input.sprint);
        // staged shots: keep the chase at speed (headless runs slow)
        if (G.stageHold && G.playerCar.speed < 52) G.playerCar.speed = 52;
        if (G.playerCar.exploded) {
          G.particles.spawnExplosion(G.playerCar.x, 1, G.playerCar.z, 2);
          G.sound.explosion();
          G.player.health = Math.max(10, G.player.health - 25);
          G.playerCar.reset(rand(-40, 40), rand(0, 80), Math.PI);
          G.playerCar.exploded = false;
          G.hud.toast('YOUR CAR EXPLODED — respawned in Downtown', '#ff4444');
        }
      } else if (G.boats.active) {
        G.boats.update(dt, input, G.time);
        if (G.stageHold && Math.abs(G.boats.active.speed) < 10) G.boats.active.speed = 10;
      } else if (G.bikes.active) {
        G.bikes.update(dt, input, G.city);
      } else {
        G.walker.update(dt, input, G.city, G.camYaw);
      }
      G.traffic.update(dt, playerPos());
      G.peds.update(dt, G.police.wanted > 0 ? playerPos() : null);
      G.police.update(dt, G, G.time);
      // staged cover: keep a roadblock ahead of the chase at all times
      if (G.stagedScene === 'chase' && G.police.roadblocks.length === 0) {
        const pp = playerPos();
        G.police.deployRoadblock(pp.x, pp.z, playerHeading());
      }
      G.combat.update(dt);
      G.particles.update(dt);
      G.raceway.update(dt, G, G.time);
      G.garage.update(dt, G.time);
      G.missions.update(dt);
      G.missions2.update(dt);
      G.sound.update(dt, G.inCar ? G.playerCar.mph : 0, G.police.wanted);
      // slow health regen
      G.player.health = Math.min(100, G.player.health + dt * 1.2);
      // camera follow
      const p = playerPos();
      const h = playerHeading();
      const dist = G.camFar ? 16 : 8.5;
      const height = G.camFar ? 6.5 : 3.6;
      const tx = p.x - Math.sin(h) * dist;
      const tz = p.z - Math.cos(h) * dist;
      camPos.lerp(new THREE.Vector3(tx, height, tz), Math.min(1, dt * 5));
      camLook.lerp(new THREE.Vector3(p.x + Math.sin(h) * 6, 1.6, p.z + Math.cos(h) * 6), Math.min(1, dt * 7));
      camera.position.copy(camPos);
      camera.lookAt(camLook);
      G.camYaw = Math.atan2(camera.position.x - p.x, camera.position.z - p.z);
      G.hud.update(G, dt);
    }
    renderer.render(scene, camera);
  }
  frame();
}

init();

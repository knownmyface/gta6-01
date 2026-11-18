// Screenshot staging for CORAL HEAT v2.2: ?shot=<name>&seed=<n> teleports the
// game into a composed, fully-playing scene and drives a cinematic camera,
// so every screenshot is a real render of the game's own code — never edited
// or faked. v2 staging is denser than v1: closer/lower cameras, buildings on
// both sides, more traffic and peds, more police, and a VISIBLE WEAPON in
// every shot (HUD weapon widget while driving, viewmodel + muzzle flash on
// foot, staged flash in the foot shot).
//   chase   — cover: 5-star chase down a downtown avenue into the sunset,
//             3 police cars, helicopter close, roadblock ahead, sports car
//             big in frame, full HUD, mission 7
//   foot    — carjacking: Mara on foot beside a red sports car, pistol in
//             her hand, muzzle flash staged, driver fleeing
//   marina  — beachfront drive past the Coral Wheel and the boats at sunset
//   mission — on foot at the Docks, rifle viewmodel + muzzle flash, rivals
//             down, police closing in
import * as THREE from 'three';
import { buildCarMesh } from './vehicles.js';

function givePlayerCar(ctx, type, color, x, z, heading) {
  const mesh = buildCarMesh(type, color);
  ctx.world.scene.add(mesh);
  const car = {
    mesh, type, x, z, heading,
    speed: 0, maxSpeed: type === 'sports' ? 55 : 42, accel: 26, crashed: false, dead: false,
  };
  mesh.position.set(x, 0, z);
  mesh.rotation.y = heading;
  ctx.player.enterCar(car);
  ctx.world.playerCars.push(car);
  return car;
}

function stagePolice(ctx, positions) {
  for (const [x, z, heading] of positions) {
    const car = ctx.world.police.spawnCarNear(ctx.player.pos.x, ctx.player.pos.z);
    car.x = x; car.z = z; car.heading = heading; car.speed = 30;
    car.mesh.position.set(x, 0, z);
    car.mesh.rotation.y = heading;
  }
}

// Place traffic cars by hand for a shot: Traffic.spawn scatters cars across
// the whole city, so a bus can land right behind the player car and fill the
// cinematic camera. Staged cars sit only AHEAD of the player, in the lanes
// the camera actually sees. specs: [type, color, x, z, heading, speed].
function stageTraffic(ctx, specs) {
  for (const [type, color, x, z, heading, speed] of specs) {
    const mesh = buildCarMesh(type, color);
    ctx.world.scene.add(mesh);
    const car = {
      mesh, type, x, z, heading,
      speed: speed ?? 10, maxSpeed: 14, accel: 8, crashed: false, dead: false,
    };
    mesh.position.set(x, 0, z);
    mesh.rotation.y = heading;
    ctx.world.traffic.cars.push(car);
  }
}

// Chase camera behind the player car, low and slightly to the right so the
// car, the road ahead and the police behind all read in one frame.
function chaseCam(ctx, side, height, dist, lookY = 2.2) {
  const car = ctx.player.car;
  const h = car.heading;
  const bx = Math.sin(h), bz = Math.cos(h);
  const rx = Math.cos(h), rz = -Math.sin(h);
  const cam = ctx.camera;
  cam.position.set(
    car.x - bx * dist + rx * side,
    height,
    car.z - bz * dist + rz * side,
  );
  cam.lookAt(car.x + bx * 14, lookY, car.z + bz * 14);
}

// Pin the police helicopter into the frame: over the road ahead of the
// player, high enough to read against the sky gap between the building rows.
// v2.1: the v2 placement (28 ahead, 22 to the side) put it behind the
// Downtown towers — occluded, and dark navy on a red sky besides. Now it
// sits nearly centred over the road, white against the sunset.
function frameHeli(ctx, ahead, side, alt) {
  const heli = ctx.world.police.heli;
  if (!heli) return;
  const c = ctx.player.car;
  const bx = Math.sin(c.heading), bz = Math.cos(c.heading);
  const rx = Math.cos(c.heading), rz = -Math.sin(c.heading);
  const hx = c.x + bx * ahead + rx * side;
  const hz = c.z + bz * ahead + rz * side;
  heli.mesh.position.set(hx, alt, hz);
  heli.mesh.rotation.y = Math.atan2(c.x - hx, c.z - hz);
  // v2.1: fit the searchlight beam to the staged altitude — narrow at the
  // heli, wide at the ground, exactly reaching the road (the v2 cone was
  // upside down and 42 long at 18 altitude, a lampshade over the whole frame)
  const cone = heli.mesh.userData.cone;
  if (cone) {
    cone.scale.set(0.55, alt / 42, 0.55);
    cone.position.y = -alt / 2;
  }
  const spot = heli.mesh.userData.spot;
  if (spot) {
    spot.scale.setScalar(0.6);
    spot.position.set(0, -(alt - 0.5), 0);
  }
}

// Mara's muzzle world position, for staged flashes.
function muzzlePos(ctx) {
  const m = new THREE.Vector3();
  if (ctx.player.muzzle) ctx.player.muzzle.getWorldPosition(m);
  else m.set(ctx.player.x, 1.4, ctx.player.z);
  return m;
}

const SHOTS = {
  chase(ctx) {
    ctx.missions.startMission(6); // Marina Getaway (mission 7), wanted 4
    ctx.player.addWanted(1);      // -> 5 stars
    // West down the z=0 avenue through Downtown into the sunset: buildings
    // on BOTH sides, neon, traffic and police ahead where the car will be
    // when the shutter fires (~95 units west of the start).
    const car = givePlayerCar(ctx, 'sports', 0xe8232e, 120, 0, -Math.PI / 2);
    car.speed = 38;
    // traffic staged AHEAD of the car only (westbound lane moving away,
    // eastbound lane head-on, a bus far ahead) — nothing behind the camera
    stageTraffic(ctx, [
      ['sedan', 0x3a6a9a, 10, -2.2, -Math.PI / 2, 11],
      ['taxi', 0xffd23e, -15, -2.2, -Math.PI / 2, 10],
      ['van', 0x8a8a8a, -40, -2.2, -Math.PI / 2, 9],
      ['bus', 0xf0ead8, -58, -2.2, -Math.PI / 2, 9],
      ['sedan', 0xd83a2e, 20, 2.2, Math.PI / 2, 12],
      ['sports', 0x37b6ff, -8, 2.2, Math.PI / 2, 13],
      ['sedan', 0x7a9a3a, -32, 2.2, Math.PI / 2, 11],
      ['truck', 0x9a7a3a, 55, 40, Math.PI, 10],
    ]);
    stagePolice(ctx, [[10, -5, -Math.PI / 2], [-2, 5, -Math.PI / 2], [38, 0, -Math.PI / 2]]);
    ctx.world.peds.spawn(16, { x: 40, z: 0 });
    ctx.input = { throttle: 1, steer: 0, brake: false };
    ctx.cameraMode = 'cinematic';
    ctx.cinematic = () => {
      // dead-centre behind the car, higher and further back than v2's first
      // pass: a side offset put a glass building face right against the lens
      chaseCam(ctx, 0, 4.6, 11, 4);
      // v2.1: helicopter over the road, in the sky gap — unmistakable
      frameHeli(ctx, 26, -3, 16);
    };
    ctx.hud.setObjective('MISSION 7 — MARINA GETAWAY: outrun the 5-star chase');
  },

  foot(ctx) {
    ctx.missions.startMission(1); // Hot Wheels (mission 2): steal a car
    ctx.player.addWanted(1);
    ctx.player.x = -157; ctx.player.z = 34; ctx.player.heading = Math.PI * 0.75;
    ctx.player.mesh.position.set(ctx.player.x, 0, ctx.player.z);
    ctx.player.mesh.rotation.y = ctx.player.heading;
    const mesh = buildCarMesh('sports', 0xe8232e);
    ctx.world.scene.add(mesh);
    const car = { mesh, type: 'sports', x: -160, z: 30, heading: Math.PI, speed: 0, maxSpeed: 55, accel: 26, crashed: false, dead: false };
    mesh.position.set(-160, 0, 30);
    mesh.rotation.y = Math.PI;
    ctx.world.playerCars.push(car);
    ctx.world.peds.spawnDriver(-164, 26, Math.PI * 0.5);
    ctx.world.traffic.spawn(10, { x: -160, z: 30 });
    ctx.world.peds.spawn(14, { x: -160, z: 30 });
    // Mara's pistol is already in her right hand; stage a persistent muzzle
    // flash toward the fleeing driver so the weapon reads in the still.
    const m = muzzlePos(ctx);
    ctx.combat.stageFlash(m, { x: -164, y: 1.2, z: 26 });
    ctx.input = null;
    ctx.cameraMode = 'cinematic';
    ctx.cinematic = () => {
      // close 3/4 view: Mara beside the red Comet, driver fleeing, sunset behind
      const cam = ctx.camera;
      cam.position.set(-150, 2.4, 41);
      cam.lookAt(-159, 1.2, 31);
    };
    ctx.hud.setObjective('MISSION 2 — HOT WHEELS: steal the red Comet (E)');
  },

  marina(ctx) {
    ctx.missions.startMission(0); // First Fare (mission 1)
    ctx.player.addWanted(1);
    // South down the Strip so the Coral Wheel and the boats are big in frame
    // ahead of the car when the shutter fires.
    const car = givePlayerCar(ctx, 'sports', 0x37b6ff, -160, 60, 0);
    car.speed = 30;
    // traffic staged AHEAD down the Strip only: northbound lane head-on,
    // southbound lane moving away, a bus far ahead — the road behind the
    // camera stays clear so the shot is never a bus roof
    stageTraffic(ctx, [
      ['sedan', 0xd83a2e, -162.2, 100, Math.PI, 11],
      ['taxi', 0xffd23e, -162.2, 130, Math.PI, 12],
      ['sports', 0xe8232e, -162.2, 160, Math.PI, 13],
      ['bus', 0x37b6ff, -162.2, 185, Math.PI, 9],
      ['sedan', 0x7a9a3a, -157.8, 125, 0, 10],
      ['van', 0x8a8a8a, -157.8, 155, 0, 9],
      ['truck', 0x9a7a3a, -120, 120, Math.PI / 2, 10],
      ['sedan', 0x3a6a9a, -120, 160, -Math.PI / 2, 11],
    ]);
    ctx.world.peds.spawn(16, { x: -160, z: 100 });
    ctx.input = { throttle: 1, steer: 0, brake: false };
    ctx.cameraMode = 'cinematic';
    ctx.cinematic = () => chaseCam(ctx, 3, 4.2, 10, 4);
    ctx.hud.setObjective('MISSION 1 — FIRST FARE: drive to the Marina');
  },

  mission(ctx) {
    ctx.missions.startMission(4); // Loud Night (mission 5): shootout at the Docks
    ctx.player.addWanted(1);
    // Mara faces south toward the rivals at (0, 160); rifle equipped so the
    // viewmodel fills the bottom-right of the frame.
    ctx.arsenal.owned.add('rifle');
    ctx.arsenal.select('rifle');
    ctx.player.setWeapon('rifle');
    ctx.viewmodel.setWeapon('rifle');
    ctx.viewmodel.fire();
    ctx.player.x = 2; ctx.player.z = 138; ctx.player.heading = 0;
    ctx.player.mesh.position.set(2, 0, 138);
    ctx.player.mesh.rotation.y = 0;
    // one rival already down, the rest up — the fight is mid-way
    const first = ctx.missions.hostiles[0];
    if (first) { first.dead = true; first.mesh.rotation.x = Math.PI / 2; first.mesh.position.y = 0.3; ctx.missions.active.killed = 1; }
    // stage a persistent muzzle flash + tracer from Mara toward a rival
    const m = muzzlePos(ctx);
    const rival = ctx.missions.hostiles.find((h) => !h.dead);
    if (rival) ctx.combat.stageFlash(m, { x: rival.x, y: 1.3, z: rival.z }, 1.4);
    // the beacon would block the fight — hide it for this still
    ctx.missions.beacon.visible = false;
    // police car closing in from behind the fight, on the same road
    stagePolice(ctx, [[0, 172, Math.PI]]);
    ctx.world.traffic.spawn(8, { x: 0, z: 140 });
    ctx.world.peds.spawn(12, { x: 0, z: 140 });
    ctx.input = null;
    ctx.cameraMode = 'cinematic';
    ctx.cinematic = () => {
      // over Mara's shoulder: her, the rivals ahead, the police car closing in
      const cam = ctx.camera;
      cam.position.set(2, 3.0, 128);
      cam.lookAt(2, 1.3, 165);
      // v2.1: re-fire the viewmodel flash every frame — a one-off flash fired
      // at staging is long gone by the shutter, which is why v2's rifle had
      // no flash and read as a dark blob
      ctx.viewmodel.fire();
    };
    ctx.hud.setObjective('MISSION 5 — LOUD NIGHT: 1/4 rivals down');
  },
};

export function applyShot(name, ctx) {
  const shot = SHOTS[name];
  if (!shot) return false;
  shot(ctx);
  return true;
}

export const SHOT_NAMES = Object.keys(SHOTS);

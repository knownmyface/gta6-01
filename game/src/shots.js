// Screenshot staging for CORAL HEAT: ?shot=<name>&seed=<n> teleports the game
// into a composed, fully-playing scene and drives a cinematic camera, so every
// screenshot is a real render of the game's own code — never edited or faked.
//   chase   — cover: 5-star chase down Coral Strip, 2 police cars, helicopter,
//             roadblock ahead, sports car at speed, full HUD, mission 7
//   foot    — carjacking: Mara on foot beside a red sports car, driver fleeing
//   marina  — beachfront drive past the Coral Wheel and the boats at sunset
//   mission — on foot at the Docks, rivals down, police closing in
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

// Pin the police helicopter into the frame: ahead of the player, high enough
// to read against the sky, its searchlight pool landing by the player's car.
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
  heli.mesh.userData.spot.position.set(0, -(alt - 0.5), 0);
}

const SHOTS = {
  chase(ctx) {
    ctx.missions.startMission(6); // Marina Getaway (mission 7), wanted 4
    ctx.player.addWanted(1);      // -> 5 stars
    // West along the northern road, straight into the sunset: sun, palms,
    // beach and ocean all ahead; police flank ahead of where the car will be
    // when the shutter fires (~40 units along the road).
    const car = givePlayerCar(ctx, 'sports', 0xe8232e, 100, -160, -Math.PI / 2);
    car.speed = 38;
    ctx.world.traffic.spawn(8, { x: 60, z: -160 });
    stagePolice(ctx, [[40, -166, -Math.PI / 2], [28, -154, -Math.PI / 2]]);
    ctx.world.peds.spawn(8, { x: 60, z: -160 });
    ctx.input = { throttle: 1, steer: 0, brake: false };
    ctx.cameraMode = 'cinematic';
    ctx.cinematic = () => {
      chaseCam(ctx, 3.5, 4.4, 11, 5);
      frameHeli(ctx, 48, -26, 24);
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
    ctx.world.traffic.spawn(8, { x: -160, z: 30 });
    ctx.world.peds.spawn(10, { x: -160, z: 30 });
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
    // Start close to the Marina so the Coral Wheel and the boats are big
    // in frame ahead of the car when the shutter fires.
    const car = givePlayerCar(ctx, 'sports', 0x37b6ff, -160, 60, 0);
    car.speed = 30;
    ctx.world.traffic.spawn(8, { x: -160, z: 100 });
    ctx.world.peds.spawn(10, { x: -160, z: 100 });
    ctx.input = { throttle: 1, steer: 0, brake: false };
    ctx.cameraMode = 'cinematic';
    ctx.cinematic = () => chaseCam(ctx, 4, 4.8, 12, 4.5);
    ctx.hud.setObjective('MISSION 1 — FIRST FARE: drive to the Marina');
  },

  mission(ctx) {
    ctx.missions.startMission(4); // Loud Night (mission 5): shootout at the Docks
    ctx.player.addWanted(1);
    // Mara faces south toward the rivals at (0, 160); camera over her shoulder
    // down the open road — clear of the buildings on either side.
    ctx.player.x = 2; ctx.player.z = 138; ctx.player.heading = 0;
    ctx.player.mesh.position.set(2, 0, 138);
    ctx.player.mesh.rotation.y = 0;
    // one rival already down, the rest up — the fight is mid-way
    const first = ctx.missions.hostiles[0];
    if (first) { first.dead = true; first.mesh.rotation.x = Math.PI / 2; first.mesh.position.y = 0.3; ctx.missions.active.killed = 1; }
    // the beacon would block the fight — hide it for this still
    ctx.missions.beacon.visible = false;
    // police car closing in from behind the fight, on the same road
    stagePolice(ctx, [[0, 172, Math.PI]]);
    ctx.world.traffic.spawn(6, { x: 0, z: 140 });
    ctx.world.peds.spawn(8, { x: 0, z: 140 });
    ctx.input = null;
    ctx.cameraMode = 'cinematic';
    ctx.cinematic = () => {
      // over Mara's shoulder: her, the rivals ahead, the police car closing in
      const cam = ctx.camera;
      cam.position.set(2, 3.4, 124);
      cam.lookAt(2, 1.4, 165);
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

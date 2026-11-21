// Coral Heat — boats: the marina's moored fleet, the speedboat underway,
// drivable boats, and police boats that pursue on the water.
import * as THREE from 'three';
import { clamp, rand, pick } from './util.js';

export const BOAT_MODELS = [
  { name: 'Coral Runner', color: 0xe83a2e, top: 30, accel: 14 },
  { name: 'Marina Cruiser', color: 0xf2f2f2, top: 24, accel: 11 },
  { name: 'Sunset Yacht', color: 0xffd75a, top: 19, accel: 8 },
];

export function makeBoatMesh(color, kind = 'speedboat') {
  const g = new THREE.Group();
  const hullMat = new THREE.MeshLambertMaterial({ color });
  const deckMat = new THREE.MeshLambertMaterial({ color: 0xf2ede2 });
  if (kind === 'yacht') {
    const hull = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.0, 9.5), hullMat);
    hull.position.y = 0.6;
    g.add(hull);
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.4, 4.5), deckMat);
    cabin.position.set(0, 1.7, -0.5);
    g.add(cabin);
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 5, 6), new THREE.MeshLambertMaterial({ color: 0x8a6a42 }));
    mast.position.set(0, 3.4, 1.5);
    g.add(mast);
  } else {
    const hull = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.8, 6.4), hullMat);
    hull.position.y = 0.55;
    g.add(hull);
    const bow = new THREE.Mesh(new THREE.ConeGeometry(1.1, 2.2, 4), hullMat);
    bow.rotation.x = Math.PI / 2;
    bow.rotation.y = Math.PI / 4;
    bow.position.set(0, 0.55, 4.2);
    bow.scale.set(1, 1, 0.6);
    g.add(bow);
    const deck = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.35, 3.4), deckMat);
    deck.position.set(0, 1.05, -0.8);
    g.add(deck);
    const windshield = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.7, 0.2), new THREE.MeshLambertMaterial({ color: 0x182430 }));
    windshield.position.set(0, 1.4, 0.9);
    windshield.rotation.x = -0.35;
    g.add(windshield);
    const engine = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.9, 0.6), new THREE.MeshLambertMaterial({ color: 0x222222 }));
    engine.position.set(0, 0.9, -3.3);
    g.add(engine);
  }
  // wake foam strip behind the hull
  const wake = new THREE.Mesh(
    new THREE.PlaneGeometry(2.6, 4),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.4 })
  );
  wake.rotation.x = -Math.PI / 2;
  wake.position.set(0, 0.12, -4.6);
  wake.visible = false;
  g.add(wake);
  g.userData.wake = wake;
  return g;
}

export function buildMarinaBoats(G) {
  // moored boats along the marina-front, in slips beside the boulevard
  const slips = [
    { x: -274, z: -120, kind: 'yacht', color: 0xf2f2f2 },
    { x: -273, z: -80, kind: 'speedboat', color: 0x2e6fd9 },
    { x: -276, z: -40, kind: 'speedboat', color: 0xe83a2e },
    { x: -274, z: 0, kind: 'yacht', color: 0xffd75a },
    { x: -275, z: 80, kind: 'speedboat', color: 0x2ed9a8 },
    { x: -273, z: 120, kind: 'speedboat', color: 0x7a4ad9 },
    { x: -274, z: 160, kind: 'yacht', color: 0xe8e8e8 },
    { x: -273, z: 200, kind: 'speedboat', color: 0xff8a1e },
    { x: -278, z: -180, kind: 'speedboat', color: 0xc96f4a },
    { x: -278, z: 240, kind: 'speedboat', color: 0x3a6fd9 },
  ];
  for (const s of slips) {
    const mesh = makeBoatMesh(s.color, s.kind);
    mesh.position.set(s.x, 0.35, s.z);
    mesh.rotation.y = rand(-0.15, 0.15);
    G.scene.add(mesh);
    G.boats.push({ mesh, pos: mesh.position, heading: mesh.rotation.y, speed: 0, moored: true, kind: s.kind });
  }
  // one speedboat UNDERWAY in the water, cruising parallel to the marina road
  const runner = makeBoatMesh(0xff8a1e, 'speedboat');
  runner.position.set(-310, 0.35, 60);
  G.scene.add(runner);
  G.boats.push({
    mesh: runner, pos: runner.position, heading: 0, speed: 16,
    moored: false, kind: 'speedboat', patrol: { z0: -220, z1: 220, x: -310 },
  });
  const runner2 = makeBoatMesh(0x2e6fd9, 'speedboat');
  runner2.position.set(-340, 0.35, -140);
  G.scene.add(runner2);
  G.boats.push({
    mesh: runner2, pos: runner2.position, heading: Math.PI, speed: 13,
    moored: false, kind: 'speedboat', patrol: { z0: -220, z1: 220, x: -340 },
  });
}

export function createPlayerBoat(G, modelIndex = 0) {
  const model = BOAT_MODELS[modelIndex];
  const mesh = makeBoatMesh(model.color, modelIndex === 2 ? 'yacht' : 'speedboat');
  const boat = {
    kind: 'boat',
    model,
    mesh,
    pos: mesh.position,
    heading: 0,
    speed: 0,
  };
  mesh.position.set(-310, 0.35, 30);
  G.scene.add(mesh);
  G.player.boat = boat;
  G.player.mode = 'boat';
  G.player.pos.copy(boat.pos);
  G.player.heading = 0;
  G.player.speed = 0;
  return boat;
}

export function updateBoats(G, dt) {
  for (const b of G.boats) {
    if (b.moored) {
      // gentle bob at the mooring
      b.mesh.position.y = 0.35 + Math.sin(G.time * 1.1 + b.pos.z * 0.05) * 0.12;
      b.mesh.rotation.z = Math.sin(G.time * 0.9 + b.pos.z) * 0.02;
      continue;
    }
    if (b.patrol) {
      b.pos.z += Math.sin(b.heading) * 0 + Math.cos(b.heading) * b.speed * dt;
      if (b.pos.z > b.patrol.z1 || b.pos.z < b.patrol.z0) {
        b.heading += Math.PI;
      }
      b.mesh.position.y = 0.35 + Math.sin(G.time * 1.6) * 0.15;
      b.mesh.position.copy(b.pos);
      b.mesh.rotation.y = b.heading;
      b.mesh.userData.wake.visible = true;
    }
  }
  // player boat handling
  const boat = G.player.boat;
  if (!boat || G.player.mode !== 'boat') return;
  const k = G.keys;
  const top = boat.model.top;
  let throttle = 0;
  if (k['KeyW'] || k['ArrowUp']) throttle = 1;
  if (k['KeyS'] || k['ArrowDown']) throttle = -0.5;
  const target = throttle * top;
  const rate = throttle !== 0 ? boat.model.accel : 8;
  if (boat.speed < target) boat.speed = Math.min(target, boat.speed + rate * dt);
  else boat.speed = Math.max(target, boat.speed - rate * 1.3 * dt);
  const steerInput = (k['KeyA'] || k['ArrowLeft'] ? 1 : 0) - (k['KeyD'] || k['ArrowRight'] ? 1 : 0);
  if (Math.abs(boat.speed) > 0.5) {
    boat.heading += steerInput * 0.9 * (boat.speed / top) * dt;
  }
  boat.pos.x += Math.sin(boat.heading) * boat.speed * dt;
  boat.pos.z += Math.cos(boat.heading) * boat.speed * dt;
  // boats stay in the water: west of the beach, inside the bay
  boat.pos.x = clamp(boat.pos.x, -430, -266);
  boat.pos.z = clamp(boat.pos.z, -330, 330);
  boat.mesh.position.set(boat.pos.x, 0.35 + Math.sin(G.time * 1.6) * 0.12, boat.pos.z);
  boat.mesh.rotation.y = boat.heading;
  boat.mesh.rotation.z = -steerInput * 0.06;
  boat.mesh.userData.wake.visible = Math.abs(boat.speed) > 4;
  G.player.pos.copy(boat.pos);
  G.player.heading = boat.heading;
  G.player.speed = boat.speed;
}

export function boardBoat(G) {
  // step from the pier / beach into the nearest moored boat
  let best = null;
  let bestD = 12;
  for (const b of G.boats) {
    if (!b.moored) continue;
    const d = Math.hypot(b.pos.x - G.player.pos.x, b.pos.z - G.player.pos.z);
    if (d < bestD) {
      bestD = d;
      best = b;
    }
  }
  if (!best) return false;
  G.boats.splice(G.boats.indexOf(best), 1);
  G.player.boat = {
    kind: 'boat',
    model: BOAT_MODELS[0],
    mesh: best.mesh,
    pos: best.pos,
    heading: best.heading,
    speed: 0,
  };
  G.player.mode = 'boat';
  G.player.footMesh.visible = false;
  if (G.hud) G.hud.toast('Boat taken — the marina is yours');
  return true;
}

export function leaveBoat(G) {
  const boat = G.player.boat;
  if (!boat) return;
  G.player.mode = 'foot';
  G.player.pos.set(-250, 0, boat.pos.z);
  G.player.speed = 0;
  G.player.footMesh.visible = true;
  G.player.footMesh.position.copy(G.player.pos);
  G.boats.push({ mesh: boat.mesh, pos: boat.pos, heading: boat.heading, speed: 0, moored: true, kind: 'speedboat' });
  G.player.boat = null;
}

// --- police boats: fast interceptors that pursue on the water ---
export function makePoliceBoatMesh() {
  const g = makeBoatMesh(0x1a2a3a, 'speedboat');
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.3, 4.5), new THREE.MeshLambertMaterial({ color: 0xf2f2f2 }));
  stripe.position.set(0, 0.8, 0);
  g.add(stripe);
  const red = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.3, 0.4), new THREE.MeshBasicMaterial({ color: 0xff2020 }));
  red.position.set(-0.4, 1.5, 0.5);
  g.add(red);
  const blue = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.3, 0.4), new THREE.MeshBasicMaterial({ color: 0x2040ff }));
  blue.position.set(0.4, 1.5, 0.5);
  g.add(blue);
  g.userData.redLight = red;
  g.userData.blueLight = blue;
  return g;
}

export function spawnPoliceBoat(G) {
  const mesh = makePoliceBoatMesh();
  const pb = {
    mesh, pos: mesh.position, heading: 0, speed: 0,
    sirenPhase: rand(0, 1), health: 100,
  };
  const a = rand(0, Math.PI * 2);
  pb.pos.set(
    clamp(G.player.pos.x + Math.sin(a) * 45, -420, -270),
    0.35,
    clamp(G.player.pos.z + Math.cos(a) * 45, -320, 320)
  );
  G.scene.add(mesh);
  G.policeBoats.push(pb);
  return pb;
}

export function updatePoliceBoats(G, dt) {
  const want = G.player.wanted;
  const onWater = G.player.mode === 'boat';
  const targetCount = onWater && want > 0
    ? Math.min(1 + want, 4)
    : (G.preservePoliceBoats ? G.policeBoats.length : 0);
  while (G.policeBoats.length < targetCount) spawnPoliceBoat(G);
  while (G.policeBoats.length > targetCount) {
    const pb = G.policeBoats.pop();
    G.scene.remove(pb.mesh);
  }
  for (const pb of G.policeBoats) {
    const dx = G.player.pos.x - pb.pos.x;
    const dz = G.player.pos.z - pb.pos.z;
    const dist = Math.hypot(dx, dz) || 1;
    const wantHeading = Math.atan2(dx, dz);
    let dh = wantHeading - pb.heading;
    while (dh > Math.PI) dh -= Math.PI * 2;
    while (dh < -Math.PI) dh += Math.PI * 2;
    pb.heading += clamp(dh, -1.8 * dt, 1.8 * dt);
    const top = 33;
    const desired = dist > 12 ? top : top * 0.6;
    pb.speed += clamp(desired - pb.speed, -20 * dt, 16 * dt);
    pb.pos.x += Math.sin(pb.heading) * pb.speed * dt;
    pb.pos.z += Math.cos(pb.heading) * pb.speed * dt;
    pb.pos.x = clamp(pb.pos.x, -430, -266);
    pb.pos.z = clamp(pb.pos.z, -330, 330);
    pb.mesh.position.set(pb.pos.x, 0.35 + Math.sin(G.time * 1.6 + pb.pos.x) * 0.12, pb.pos.z);
    pb.mesh.rotation.y = pb.heading;
    pb.mesh.userData.wake.visible = pb.speed > 5;
    pb.sirenPhase += dt * 6;
    const on = Math.sin(pb.sirenPhase) > 0;
    pb.mesh.userData.redLight.material.color.setHex(on ? 0xff2020 : 0x551010);
    pb.mesh.userData.blueLight.material.color.setHex(on ? 0x101055 : 0x2040ff);
    // a police boat alongside slows the player's boat
    if (dist < 7 && G.player.mode === 'boat' && G.player.boat) {
      G.player.boat.speed *= 0.94;
    }
  }
}

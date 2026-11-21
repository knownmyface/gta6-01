// Coral Heat — the law: wanted level, police cruisers, roadblocks with
// spike strips, and the police helicopter with a visible searchlight beam.
// Wanted stays synced to the player object at all times.
import * as THREE from 'three';
import { clamp, rand, pick } from './util.js';
import { makeVehicleMesh } from './drive.js';

export function setWanted(G, level, reason) {
  const n = clamp(Math.round(level), 0, 5);
  if (n === G.player.wanted) return;
  G.player.wanted = n;
  G.wanted = n; // mirror kept in sync for the HUD + shots
  if (G.hud) G.hud.setStars(n);
  if (n >= 3 && !G.heli) spawnHelicopter(G);
  if (n === 0 && G.heli) {
    G.scene.remove(G.heli.group);
    G.heli = null;
  }
  if (reason && G.hud) G.hud.toast('WANTED ' + '★'.repeat(n) + ' — ' + reason);
}

export function makePoliceMesh() {
  const g = makeVehicleMesh(0x1a1a1a, 'car');
  const white = new THREE.MeshLambertMaterial({ color: 0xf2f2f2 });
  const door = new THREE.Mesh(new THREE.BoxGeometry(2.04, 0.3, 1.6), white);
  door.position.set(0, 0.72, 0);
  g.add(door);
  // light bar: red + blue flashers
  const bar = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.16, 0.4), new THREE.MeshLambertMaterial({ color: 0x222222 }));
  bar.position.set(0, 1.62, -0.2);
  g.add(bar);
  const red = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.18, 0.42), new THREE.MeshBasicMaterial({ color: 0xff2020 }));
  red.position.set(-0.3, 1.62, -0.2);
  g.add(red);
  const blue = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.18, 0.42), new THREE.MeshBasicMaterial({ color: 0x2040ff }));
  blue.position.set(0.3, 1.62, -0.2);
  g.add(blue);
  g.userData.redLight = red;
  g.userData.blueLight = blue;
  return g;
}

export function spawnCop(G, nearPlayer = true) {
  const mesh = makePoliceMesh();
  const cop = {
    mesh, pos: mesh.position, heading: 0, speed: 0,
    ram: 0, sirenPhase: rand(0, 1),
  };
  if (nearPlayer) {
    const a = rand(0, Math.PI * 2);
    const d = rand(30, 55);
    cop.pos.set(
      clamp(G.player.pos.x + Math.sin(a) * d, -240, 295),
      0,
      clamp(G.player.pos.z + Math.cos(a) * d, -295, 295)
    );
  } else {
    cop.pos.set(rand(-200, 250), 0, rand(-250, 250));
  }
  G.scene.add(mesh);
  G.cops.push(cop);
  return cop;
}

export function updateCops(G, dt) {
  const want = G.player.wanted;
  const targetCount = want === 0 ? 0 : Math.min(2 + want, 7);
  while (G.cops.length < targetCount) spawnCop(G, true);
  while (G.cops.length > targetCount) {
    const c = G.cops.pop();
    G.scene.remove(c.mesh);
  }
  const px = G.player.pos.x;
  const pz = G.player.pos.z;
  const pSpeed = Math.abs(G.player.speed);
  for (const c of G.cops) {
    const dx = px - c.pos.x;
    const dz = pz - c.pos.z;
    const dist = Math.hypot(dx, dz) || 1;
    const wantHeading = Math.atan2(dx, dz);
    let dh = wantHeading - c.heading;
    while (dh > Math.PI) dh -= Math.PI * 2;
    while (dh < -Math.PI) dh += Math.PI * 2;
    c.heading += clamp(dh, -2.4 * dt, 2.4 * dt);
    // cruisers are fast but slightly slower than a tuned sports car
    const top = 46 + want * 2.5;
    const desired = dist > 10 ? top : top * 0.55;
    c.speed += clamp(desired - c.speed, -30 * dt, 22 * dt);
    c.pos.x += Math.sin(c.heading) * c.speed * dt;
    c.pos.z += Math.cos(c.heading) * c.speed * dt;
    // ram the player when close
    if (dist < 5.5 && G.player.mode === 'car' && G.player.car) {
      G.player.car.speed *= 0.92;
      G.player.car.health = Math.max(0, G.player.car.health - 2.5 * dt);
      c.speed *= 0.85;
    }
    c.mesh.position.copy(c.pos);
    c.mesh.rotation.y = c.heading;
    // flashing light bar
    c.sirenPhase += dt * 6;
    const on = Math.sin(c.sirenPhase) > 0;
    c.mesh.userData.redLight.material.color.setHex(on ? 0xff2020 : 0x551010);
    c.mesh.userData.blueLight.material.color.setHex(on ? 0x101055 : 0x2040ff);
  }
  // wanted decays slowly when the player hides at low speed with no cops near
  if (want > 0 && pSpeed < 3 && G.player.mode !== 'car') {
    G.wantedTimer = (G.wantedTimer || 0) + dt;
    if (G.wantedTimer > 14) {
      G.wantedTimer = 0;
      setWanted(G, want - 1, 'you slipped away');
    }
  } else {
    G.wantedTimer = 0;
  }
}

// --- helicopter: low orbit, starts AHEAD of the player so it reads in frame ---
export function spawnHelicopter(G) {
  if (G.heli) return G.heli;
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color: 0x1a2a3a });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.6, 5.2), bodyMat);
  group.add(body);
  const glass = new THREE.Mesh(new THREE.BoxGeometry(2.0, 1.0, 1.6), new THREE.MeshLambertMaterial({ color: 0x9ad9ff }));
  glass.position.set(0, 0.3, 1.9);
  group.add(glass);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 4.4), bodyMat);
  tail.position.set(0, 0.4, -4.4);
  group.add(tail);
  const rotorMat = new THREE.MeshBasicMaterial({ color: 0x222222 });
  const rotor = new THREE.Mesh(new THREE.BoxGeometry(11, 0.08, 0.5), rotorMat);
  rotor.position.y = 1.3;
  group.add(rotor);
  const tailRotor = new THREE.Mesh(new THREE.BoxGeometry(0.1, 2.2, 0.4), rotorMat);
  tailRotor.position.set(0, 0.5, -6.4);
  group.add(tailRotor);
  const skidMat = new THREE.MeshLambertMaterial({ color: 0x333333 });
  for (const sx of [-1.1, 1.1]) {
    const skid = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.18, 4.6), skidMat);
    skid.position.set(sx, -1.1, 0.3);
    group.add(skid);
  }
  // searchlight: bright cone aimed down at the player + a glow disc on the ground
  const beamGeo = new THREE.ConeGeometry(3.4, 30, 12, 1, true);
  const beamMat = new THREE.MeshBasicMaterial({
    color: 0xfff6c9, transparent: true, opacity: 0.14,
    side: THREE.DoubleSide, depthWrite: false,
  });
  const beam = new THREE.Mesh(beamGeo, beamMat);
  beam.position.y = -15;
  beam.rotation.x = Math.PI; // wide end down, hanging straight under the heli
  group.add(beam);
  const spot = new THREE.Mesh(
    new THREE.CircleGeometry(6.5, 20),
    new THREE.MeshBasicMaterial({ color: 0xfff6c9, transparent: true, opacity: 0.5, depthWrite: false })
  );
  spot.rotation.x = -Math.PI / 2;
  spot.position.y = -33;
  group.add(spot);
  const light = new THREE.PointLight(0xfff2b0, 2.2, 60);
  light.position.y = -4;
  group.add(light);
  G.scene.add(group);
  // start AHEAD of the player, low, so it is in the cover frame immediately
  const fx = Math.sin(G.player.heading);
  const fz = Math.cos(G.player.heading);
  G.heli = {
    group, rotor, beam, spot,
    angle: 0,
    height: 15,
    radius: 26,
    pos: group.position,
  };
  group.position.set(
    G.player.pos.x + fx * 26,
    26,
    G.player.pos.z + fz * 26
  );
  return G.heli;
}

export function updateHelicopter(G, dt) {
  const h = G.heli;
  if (!h) return;
  h.angle += dt * 0.55;
  const px = G.player.pos.x;
  const pz = G.player.pos.z;
  // low orbit, biased ahead of the player's direction of travel
  const fx = Math.sin(G.player.heading);
  const fz = Math.cos(G.player.heading);
  const tx = px + fx * 16 + Math.sin(h.angle) * h.radius;
  const tz = pz + fz * 16 + Math.cos(h.angle) * h.radius;
  h.group.position.x += (tx - h.group.position.x) * Math.min(1, dt * 2.2);
  h.group.position.z += (tz - h.group.position.z) * Math.min(1, dt * 2.2);
  h.group.position.y = h.height + Math.sin(G.time * 0.8) * 1.5;
  h.group.rotation.y = Math.atan2(px - h.group.position.x, pz - h.group.position.z);
  h.rotor.rotation.y += dt * 22;
  // the beam hangs straight down from the heli; the light pool stays on the player
  const dx = px - h.group.position.x;
  const dz = pz - h.group.position.z;
  h.spot.position.set(dx, -h.group.position.y + 0.4, dz);
  h.spot.position.y = -h.group.position.y + 0.4;
}

// --- roadblocks with spike strips deployed ahead of the player ---
export function deployRoadblock(G) {
  const fx = Math.sin(G.player.heading);
  const fz = Math.cos(G.player.heading);
  const bx = G.player.pos.x + fx * 55;
  const bz = G.player.pos.z + fz * 55;
  const group = new THREE.Group();
  const barrierMat = new THREE.MeshLambertMaterial({ color: 0xff6a1e });
  const stripeMat = new THREE.MeshLambertMaterial({ color: 0xf2f2f2 });
  for (let i = -1; i <= 1; i++) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(3.4, 1.1, 0.5), i === 0 ? stripeMat : barrierMat);
    bar.position.set(i * 3.8, 0.55, 0);
    group.add(bar);
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.5, 0.9), barrierMat);
    leg.position.set(i * 3.8, 0.25, 0);
    group.add(leg);
  }
  // spike strip: dark strip with metal teeth, laid across the road
  const strip = new THREE.Mesh(new THREE.BoxGeometry(11, 0.18, 1.2), new THREE.MeshLambertMaterial({ color: 0x222222 }));
  strip.position.set(0, 0.12, 4);
  group.add(strip);
  const spikeMat = new THREE.MeshBasicMaterial({ color: 0xd9d9d9 });
  for (let i = -5; i <= 5; i++) {
    const spike = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.5, 4), spikeMat);
    spike.position.set(i * 1.0, 0.4, 4);
    group.add(spike);
  }
  const cop = makePoliceMesh();
  cop.position.set(7, 0, 2);
  cop.rotation.y = Math.PI / 2;
  group.add(cop);
  group.position.set(bx, 0, bz);
  group.rotation.y = G.player.heading + Math.PI / 2;
  G.scene.add(group);
  const rb = { group, pos: group.position, armed: true, life: 26 };
  G.roadblocks.push(rb);
  return rb;
}

export function updateRoadblocks(G, dt) {
  // deploy a new roadblock ahead when the chase is hot and none is near
  if (G.player.wanted >= 3 && G.player.mode === 'car') {
    G.roadblockTimer = (G.roadblockTimer || 0) - dt;
    const near = G.roadblocks.some((rb) => Math.hypot(rb.pos.x - G.player.pos.x, rb.pos.z - G.player.pos.z) < 70);
    if (G.roadblockTimer <= 0 && !near) {
      deployRoadblock(G);
      G.roadblockTimer = 16;
    }
  }
  for (let i = G.roadblocks.length - 1; i >= 0; i--) {
    const rb = G.roadblocks[i];
    rb.life -= dt;
    const d = Math.hypot(rb.pos.x - G.player.pos.x, rb.pos.z - G.player.pos.z);
    if (rb.armed && d < 6 && G.player.mode === 'car' && G.player.car) {
      // spike strip shreds the tires: hard slowdown + damage
      G.player.car.speed *= 0.35;
      G.player.car.health = Math.max(0, G.player.car.health - 18);
      rb.armed = false;
      if (G.hud) G.hud.toast('SPIKE STRIP! Tires shredded — speed killed');
      if (G.sfx) G.sfx('spike');
    }
    if (rb.life <= 0) {
      G.scene.remove(rb.group);
      G.roadblocks.splice(i, 1);
    }
  }
}

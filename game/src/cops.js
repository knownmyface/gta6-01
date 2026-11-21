// cops.js — the wanted system: Bay Patrol police cars that chase and ram,
// a police helicopter with a visible searchlight beam at 3+ stars, and
// roadblock units with deployable spike strips at 4+ stars.
import * as THREE from 'three';
import { rand, pick, clamp, damp, angleLerp, angleDiff, dist2, chance } from './util.js';
import { makeCarMesh } from './drive.js';
import { collides, resolveCollision, clampToCity } from './coralcity.js';

const COP_COLOR = 0x101418;
const LIGHTBAR_RED = 0xff2222;
const LIGHTBAR_BLUE = 0x2266ff;

export function makeCopMesh() {
  const g = makeCarMesh(COP_COLOR);
  // Light bar.
  const bar = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.18, 0.5),
    new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.4 }));
  bar.position.set(0, 1.52, -0.25);
  g.add(bar);
  const red = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.2, 0.52),
    new THREE.MeshBasicMaterial({ color: LIGHTBAR_RED }));
  red.position.set(-0.33, 1.55, -0.25);
  g.add(red);
  const blue = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.2, 0.52),
    new THREE.MeshBasicMaterial({ color: LIGHTBAR_BLUE }));
  blue.position.set(0.33, 1.55, -0.25);
  g.add(blue);
  g.userData.red = red;
  g.userData.blue = blue;
  // "BAY PATROL" door decal via a white stripe.
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.3, 2.4),
    new THREE.MeshBasicMaterial({ color: 0xffffff }));
  stripe.position.set(-1.02, 0.75, 0);
  g.add(stripe);
  const stripe2 = stripe.clone();
  stripe2.position.x = 1.02;
  g.add(stripe2);
  return g;
}

export function initCops(W) {
  W.cops = [];
  W.wanted = 0;
  W.wantedHeat = 0; // decays over time when the player hides
  W.roadblocks = [];
  W.heli = null;
  W.copTimer = 0;
  W.blockTimer = 0;
}

function spawnCop(W) {
  const p = W.player;
  const a = rand(0, Math.PI * 2);
  const d = rand(55, 80);
  const x = clamp(p.x + Math.sin(a) * d, -205, 205);
  const z = clamp(p.z + Math.cos(a) * d, -205, 215);
  const mesh = makeCopMesh();
  mesh.position.set(x, 0, z);
  W.scene.add(mesh);
  const cop = {
    mesh, x, z, heading: rand(0, Math.PI * 2),
    speed: 0, topSpeed: 30 + W.wanted * 1.6,
    sirenPhase: rand(0, 1),
  };
  W.cops.push(cop);
  return cop;
}

export function makeHelicopter(W) {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x101418, roughness: 0.4, metalness: 0.5 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.4, 5.2), bodyMat);
  g.add(body);
  const glass = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.9, 1.6),
    new THREE.MeshStandardMaterial({ color: 0x9fd8ff, roughness: 0.15, metalness: 0.6 }));
  glass.position.set(0, 0.15, 2.0);
  g.add(glass);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 4.4), bodyMat);
  tail.position.set(0, 0.35, -4.4);
  g.add(tail);
  const rotor = new THREE.Mesh(new THREE.BoxGeometry(9.5, 0.08, 0.6),
    new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.5 }));
  rotor.position.y = 1.05;
  g.add(rotor);
  const tailRotor = new THREE.Mesh(new THREE.BoxGeometry(0.08, 2.2, 0.5),
    new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.5 }));
  tailRotor.position.set(0.35, 0.5, -6.4);
  g.add(tailRotor);
  // Searchlight: a real spotlight + a visible translucent beam cone.
  const spot = new THREE.SpotLight(0xfff6c0, 900, 160, 0.32, 0.45, 1.2);
  spot.position.set(0, -0.6, 0.5);
  g.add(spot);
  const beamGeo = new THREE.ConeGeometry(5, 26, 20, 1, true);
  const beamMat = new THREE.MeshBasicMaterial({
    color: 0xfff2a8, transparent: true, opacity: 0.12,
    side: THREE.DoubleSide, depthWrite: false,
  });
  const beam = new THREE.Mesh(beamGeo, beamMat);
  // Cone apex up at the heli, base down on the ground: narrow at the source,
  // wide where it hits the street.
  beam.position.set(0, -13, 0.5);
  g.add(beam);
  // Light pool on the ground.
  const pool = new THREE.Mesh(new THREE.CircleGeometry(5.5, 24),
    new THREE.MeshBasicMaterial({ color: 0xfff2a8, transparent: true, opacity: 0.18, depthWrite: false }));
  pool.rotation.x = -Math.PI / 2;
  pool.position.y = 0.12;
  g.add(pool);
  g.userData.rotor = rotor;
  g.userData.spot = spot;
  g.userData.beam = beam;
  g.userData.pool = pool;
  // Aim the spotlight at the ground below the heli.
  spot.target.position.set(0, -60, 0.5);
  g.add(spot.target);
  W.scene.add(g);
  return { mesh: g, x: W.player.x, z: W.player.z - 30, y: 22, hoverPhase: 0 };
}

function spawnRoadblock(W) {
  const p = W.player;
  // Deploy ahead of the player's heading, on the road they are driving down.
  const ahead = 34;
  const bx = p.x + Math.sin(p.heading) * ahead;
  const bz = p.z + Math.cos(p.heading) * ahead;
  const group = new THREE.Group();
  const cars = [];
  for (const side of [-1, 1]) {
    const mesh = makeCopMesh();
    const ox = Math.cos(p.heading) * side * 5;
    const oz = -Math.sin(p.heading) * side * 5;
    mesh.position.set(bx + ox, 0, bz + oz);
    mesh.rotation.y = p.heading + Math.PI;
    group.add(mesh);
    cars.push(mesh);
  }
  // Spike strip across the road: dark strip + rows of steel spikes.
  const strip = new THREE.Group();
  const base = new THREE.Mesh(new THREE.BoxGeometry(11, 0.18, 1.1),
    new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.6, metalness: 0.7 }));
  strip.add(base);
  const spikeGeo = new THREE.ConeGeometry(0.14, 0.55, 4);
  const spikeMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, roughness: 0.3, metalness: 0.9 });
  for (let i = -5; i <= 5; i++) {
    const s = new THREE.Mesh(spikeGeo, spikeMat);
    s.position.set(i * 0.95, 0.3, 0);
    s.rotation.z = 0.5;
    strip.add(s);
  }
  strip.position.set(bx, 0.1, bz);
  strip.rotation.y = p.heading; // long axis across the road
  group.add(strip);
  // Warning cones.
  const coneMat = new THREE.MeshStandardMaterial({ color: 0xff7a1a, roughness: 0.8 });
  for (let i = -2; i <= 2; i++) {
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.9, 8), coneMat);
    cone.position.set(bx + Math.cos(p.heading) * i * 3, 0.45, bz - Math.sin(p.heading) * i * 3);
    group.add(cone);
  }
  group.position.set(0, 0, 0);
  W.scene.add(group);
  const block = { group, x: bx, z: bz, heading: p.heading, cars, strip, life: 26, hit: false };
  W.roadblocks.push(block);
  W.hudFlash('ROADBLOCK AHEAD — SPIKE STRIP!');
  return block;
}

export function setWanted(W, level) {
  W.wanted = clamp(level, 0, 5);
  W.player.wanted = W.wanted;
}

export function updateCops(W, dt) {
  const p = W.player;
  W.wanted = p.wanted;
  // Wanted decays slowly when the player is not committing crimes.
  if (W.wanted > 0) {
    W.wantedHeat += dt;
    if (W.wantedHeat > 26) {
      W.wantedHeat = 0;
      setWanted(W, W.wanted - 1);
      if (W.wanted === 0) W.hudFlash('YOU LOST THE COPS');
    }
  }
  // Spawn police up to the wanted level's cap.
  const wantCount = W.wanted === 0 ? 0 : Math.min(2 + W.wanted, 7);
  W.copTimer -= dt;
  if (W.cops.length < wantCount && W.copTimer <= 0) {
    spawnCop(W);
    W.copTimer = 1.6;
  }
  // Despawn extra cops when wanted falls.
  while (W.cops.length > wantCount) {
    const c = W.cops.pop();
    W.scene.remove(c.mesh);
  }

  for (const c of W.cops) {
    // Chase steering: aim at the player, ram when close.
    const targetHeading = Math.atan2(p.x - c.x, p.z - c.z);
    c.heading = angleLerp(c.heading, targetHeading, 1 - Math.exp(-2.2 * dt));
    const d = dist2(c.x, c.z, p.x, p.z);
    const targetSpeed = d > 10 ? c.topSpeed : c.topSpeed * 0.7;
    c.speed = damp(c.speed, targetSpeed, 1.4, dt);
    const nx = c.x + Math.sin(c.heading) * c.speed * dt;
    const nz = c.z + Math.cos(c.heading) * c.speed * dt;
    const pos = { x: clamp(nx, -210, 210), z: clamp(nz, -210, 220) };
    resolveCollision(W, pos, 1.6);
    c.x = pos.x;
    c.z = pos.z;
    c.mesh.position.set(c.x, 0, c.z);
    c.mesh.rotation.y = c.heading;
    // Flashing light bar.
    c.sirenPhase += dt * 6;
    const on = Math.sin(c.sirenPhase) > 0;
    c.mesh.userData.red.material.color.setHex(on ? 0xff2222 : 0x551111);
    c.mesh.userData.blue.material.color.setHex(on ? 0x111155 : 0x2266ff);
    // Ram the player: bump their vehicle and add damage.
    if (d < 3.4 && p.vehicle) {
      p.vehicle.damage = Math.min(100, p.vehicle.damage + 14 * dt);
      p.vehicle.speed *= 0.985;
      if (chance(dt * 0.5)) W.events.push({ type: 'rammed' });
    }
    if (d < 2.2 && p.mode === 'foot') {
      p.health = Math.max(0, p.health - 12 * dt);
      if (p.health <= 0) W.gameOver = 'BUSTED';
    }
  }

  // Helicopter at 3+ stars.
  if (W.wanted >= 3 && !W.heli) {
    W.heli = makeHelicopter(W);
    W.hudFlash('AIR ONE OVERHEAD — HELICOPTER CHASE');
  }
  if (W.wanted < 3 && W.heli) {
    W.scene.remove(W.heli.mesh);
    W.heli = null;
  }
  if (W.heli) {
    const h = W.heli;
    h.hoverPhase += dt;
    const tx = p.x + Math.sin(h.hoverPhase * 0.7) * 6;
    const tz = p.z + Math.cos(h.hoverPhase * 0.5) * 6 - 8;
    h.x = damp(h.x, tx, 1.2, dt);
    h.z = damp(h.z, tz, 1.2, dt);
    h.y = 22 + Math.sin(h.hoverPhase * 1.3) * 1.5;
    h.mesh.position.set(h.x, h.y, h.z);
    h.mesh.rotation.y = Math.atan2(p.x - h.x, p.z - h.z);
    h.mesh.userData.rotor.rotation.y += dt * 28;
    // The beam + pool track the player on the ground.
    const dx = p.x - h.x;
    const dz = p.z - h.z;
    h.mesh.userData.beam.position.x = dx * 0.5;
    h.mesh.userData.beam.position.z = dz * 0.5 + 0.5;
    h.mesh.userData.beam.rotation.z = Math.atan2(dx, h.y) * 0.5;
    h.mesh.userData.pool.position.set(dx, -h.y + 0.15, dz + 0.5);
  }

  // Roadblocks at 4+ stars, one at a time, ahead of the player.
  W.blockTimer -= dt;
  if (W.wanted >= 4 && W.roadblocks.length === 0 && W.blockTimer <= 0 && p.vehicle) {
    spawnRoadblock(W);
    W.blockTimer = 20;
  }
  for (let i = W.roadblocks.length - 1; i >= 0; i--) {
    const b = W.roadblocks[i];
    b.life -= dt;
    // Spike strip hit: shreds tires, big speed loss + damage.
    if (!b.hit && p.vehicle && dist2(p.x, p.z, b.x, b.z) < 6) {
      b.hit = true;
      p.vehicle.speed *= 0.35;
      p.vehicle.damage = Math.min(100, p.vehicle.damage + 30);
      W.hudFlash('SPIKE STRIP! TIRES SHREDDED');
      W.events.push({ type: 'spikes' });
      W.fx?.burst(p.x, 1, p.z, 'smoke', 14);
    }
    if (b.life <= 0) {
      W.scene.remove(b.group);
      W.roadblocks.splice(i, 1);
    }
  }
}

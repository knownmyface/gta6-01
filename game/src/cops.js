// cops.js — wanted level, Bay PD pursuit cars, the Air One helicopter with
// a visible searchlight beam, and roadblock units with spike strips that
// deploy ahead of the player. Wanted level is synced to the player object.
import * as THREE from "../vendor/three/three.module.min.js";
import { clamp, lerp, lerpAngle, rand, pick, angleDiff, dist2d } from "./util.js";
import { makeCarMesh } from "./drive.js";

export function setWanted(G, level) {
  G.wanted = clamp(Math.round(level), 0, 5);
  G.player.wanted = G.wanted;
  if (G.sound) G.sound.siren(G.wanted >= 2);
  if (G.hud) G.hud.setWanted(G.wanted);
  syncPoliceCount(G);
}

function wantedTargetCount(level) {
  return [0, 1, 2, 3, 4, 5][level] || 0;
}

function syncPoliceCount(G) {
  const want = wantedTargetCount(G.wanted || 0);
  const have = (G.police || []).length;
  if (want > have) {
    for (let i = have; i < want; i++) spawnPoliceCar(G);
  } else if (want < have) {
    const drop = (G.police || []).splice(want);
    for (const p of drop) G.scene.remove(p.mesh);
  }
  if (G.wanted >= 3 && !G.heli) spawnHelicopter(G);
  if (G.wanted < 3 && G.heli) {
    G.scene.remove(G.heli.group);
    G.heli = null;
  }
}

export function spawnPoliceCar(G, nearX, nearZ) {
  const px = nearX !== undefined ? nearX : G.player.pos.x;
  const pz = nearZ !== undefined ? nearZ : G.player.pos.z;
  const a = rand(0, Math.PI * 2);
  const r = rand(28, 48);
  const x = clamp(px + Math.sin(a) * r, -320, 320);
  const z = clamp(pz + Math.cos(a) * r, -190, 320);
  const mesh = makeCarMesh(0x1a2a44, { police: true });
  mesh.position.set(x, 0, z);
  G.scene.add(mesh);
  const car = {
    mesh, x, z, heading: rand(0, Math.PI * 2),
    speed: 0, top: 52 + (G.wanted || 1) * 2.5,
    sirenPhase: rand(0, 1),
  };
  G.police = G.police || [];
  G.police.push(car);
  return car;
}

export function spawnHelicopter(G) {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x223344, metalness: 0.5, roughness: 0.4 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.4, 5.2), bodyMat);
  group.add(body);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 4.6), bodyMat);
  tail.position.set(0, 0.3, -4.2);
  group.add(tail);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.2, 1.6, 1.2), bodyMat);
  fin.position.set(0, 0.8, -6.2);
  group.add(fin);
  const glass = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.8, 1.6),
    new THREE.MeshStandardMaterial({ color: 0x9fd8ff, metalness: 0.9, roughness: 0.1 }));
  glass.position.set(0, 0.2, 2.0);
  group.add(glass);
  const rotorMat = new THREE.MeshBasicMaterial({ color: 0x111111 });
  const rotor = new THREE.Mesh(new THREE.BoxGeometry(11, 0.08, 0.5), rotorMat);
  rotor.position.y = 1.1;
  group.add(rotor);
  const rotor2 = rotor.clone();
  rotor2.rotation.y = Math.PI / 2;
  group.add(rotor2);
  const skidMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
  for (const s of [-1, 1]) {
    const skid = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 4.4), skidMat);
    skid.position.set(s * 1.1, -0.95, 0);
    group.add(skid);
  }
  // Searchlight: spotlight + a visible translucent cone beam.
  const spot = new THREE.SpotLight(0xfff6c8, 350, 120, 0.32, 0.45, 1.2);
  spot.position.set(0, -0.6, 1.2);
  group.add(spot);
  const beamGeo = new THREE.ConeGeometry(4.5, 30, 16, 1, true);
  const beamMat = new THREE.MeshBasicMaterial({
    color: 0xfff2b0, transparent: true, opacity: 0.16,
    side: THREE.DoubleSide, depthWrite: false,
  });
  const beam = new THREE.Mesh(beamGeo, beamMat);
  beam.position.set(0, -15, 1.2);
  beam.rotation.x = Math.PI;
  group.add(beam);
  const pool = new THREE.Mesh(new THREE.CircleGeometry(4.5, 20),
    new THREE.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0.22, depthWrite: false }));
  pool.rotation.x = -Math.PI / 2;
  pool.position.y = 0.12;
  G.scene.add(pool);
  group.position.set(G.player.pos.x + 20, 42, G.player.pos.z + 30);
  G.scene.add(group);
  G.heli = {
    group, rotor, rotor2, spot, beam, pool,
    angle: rand(0, Math.PI * 2),
    height: 26,
    orbitR: 26,
  };
  // Aim the spotlight at the player; the target must be in the scene graph.
  spot.target = pool;
  return G.heli;
}

export function updatePolice(G, dt) {
  const px = G.player.pos.x;
  const pz = G.player.pos.z;
  for (const p of G.police || []) {
    const d = dist2d(p.x, p.z, px, pz);
    const want = Math.atan2(px - p.x, pz - p.z);
    // Chase, but wobble so they do not stack perfectly on the player.
    const wobble = Math.sin(performance.now() / 700 + p.sirenPhase * 9) * 0.35;
    p.heading = lerpAngle(p.heading, want + wobble, clamp(dt * 2.2, 0, 1));
    const cruise = d > 60 ? p.top : d > 18 ? p.top * 0.75 : p.top * 0.35;
    p.speed = lerp(p.speed, cruise, clamp(dt * 1.4, 0, 1));
    p.x += Math.sin(p.heading) * p.speed * dt;
    p.z += Math.cos(p.heading) * p.speed * dt;
    p.x = clamp(p.x, -330, 330);
    p.z = clamp(p.z, -198, 330);
    p.mesh.position.set(p.x, 0, p.z);
    p.mesh.rotation.y = p.heading;
    // Ramming: touching the player car hard bumps wanted heat + damage.
    if (d < 4.2 && G.player.mode === "car" && G.playerCar) {
      G.playerCar.damage = Math.min(100, (G.playerCar.damage || 0) + dt * 9);
      if (G.playerCar.speed > 8) G.playerCar.speed *= 1 - dt * 0.35;
    }
    // Flashing light bar: alternate the two bar halves.
    const bars = p.mesh.children.filter((c) => c.geometry && c.geometry.type === "BoxGeometry" && c.position.y > 1.4);
    const phase = Math.floor(performance.now() / 280 + p.sirenPhase * 2) % 2;
    for (let i = 0; i < bars.length; i++) {
      bars[i].material.color.setHex(i % 2 === phase ? 0xffffff : (i % 2 === 0 ? 0x2244ff : 0xff2222));
    }
  }
  // Helicopter: low orbit, staying ahead of the player's heading.
  const heli = G.heli;
  if (heli) {
    heli.angle += dt * 0.55;
    const aheadX = px + Math.sin(G.player.heading) * 18;
    const aheadZ = pz + Math.cos(G.player.heading) * 18;
    const hx = aheadX + Math.sin(heli.angle) * heli.orbitR;
    const hz = aheadZ + Math.cos(heli.angle) * heli.orbitR;
    heli.group.position.set(hx, heli.height + Math.sin(performance.now() / 900) * 1.5, hz);
    heli.group.rotation.y = Math.atan2(px - hx, pz - hz);
    heli.rotor.rotation.y += dt * 22;
    heli.rotor2.rotation.y += dt * 22;
    // Searchlight pool tracks the player.
    heli.pool.position.set(px, 0.12, pz);
    heli.beam.lookAt(px, 0, pz);
    heli.spot.target = heli.pool;
  }
}

// Roadblock: two PD cars angled across the road + barrier + spike strip,
// placed a fixed distance ahead of the player on their current heading.
export function deployRoadblock(G, aheadDist) {
  clearRoadblock(G);
  const px = G.player.pos.x;
  const pz = G.player.pos.z;
  const h = G.player.heading;
  const bx = px + Math.sin(h) * (aheadDist || 55);
  const bz = pz + Math.cos(h) * (aheadDist || 55);
  const group = new THREE.Group();
  const cars = [];
  for (const s of [-1, 1]) {
    const mesh = makeCarMesh(0x1a2a44, { police: true });
    const ox = Math.cos(h) * s * 3.4;
    const oz = -Math.sin(h) * s * 3.4;
    mesh.position.set(bx + ox, 0, bz + oz);
    mesh.rotation.y = h + Math.PI / 2 + (s > 0 ? 0.35 : -0.35);
    group.add(mesh);
    cars.push(mesh);
  }
  const barrierMat = new THREE.MeshStandardMaterial({ color: 0xff7a1a, roughness: 0.6 });
  for (const s of [-1, 1]) {
    const barrier = new THREE.Mesh(new THREE.BoxGeometry(3.4, 1.0, 0.5), barrierMat);
    const ox = Math.cos(h) * s * 1.1;
    const oz = -Math.sin(h) * s * 1.1;
    barrier.position.set(bx + ox, 0.5, bz + oz);
    barrier.rotation.y = h + Math.PI / 2;
    group.add(barrier);
  }
  // Spike strip: dark mat with bright spikes across the lane.
  const strip = new THREE.Group();
  const mat = new THREE.Mesh(new THREE.BoxGeometry(7.5, 0.08, 1.1),
    new THREE.MeshStandardMaterial({ color: 0x151515 }));
  mat.position.y = 0.06;
  strip.add(mat);
  const spikeMat = new THREE.MeshStandardMaterial({ color: 0xd8d8d8, metalness: 0.9, roughness: 0.25 });
  for (let i = 0; i < 9; i++) {
    const spike = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.55, 5), spikeMat);
    spike.position.set(-3.4 + i * 0.85, 0.3, 0);
    strip.add(spike);
  }
  strip.position.set(bx - Math.sin(h) * 7, 0, bz - Math.cos(h) * 7);
  strip.rotation.y = h;
  group.add(strip);
  G.scene.add(group);
  G.roadblock = { group, cars, x: bx, z: bz, strip };
  return G.roadblock;
}

export function clearRoadblock(G) {
  if (G.roadblock) {
    G.scene.remove(G.roadblock.group);
    G.roadblock = null;
  }
}

// Driving over the strip at speed pops tires: hard slow + damage.
export function checkSpikes(G) {
  const rb = G.roadblock;
  if (!rb || G.player.mode !== "car" || !G.playerCar) return;
  const d = dist2d(G.player.pos.x, G.player.pos.z, rb.strip.position.x, rb.strip.position.z);
  if (d < 4.5 && Math.abs(G.playerCar.speed) > 6) {
    G.playerCar.speed *= 0.35;
    G.playerCar.damage = Math.min(100, (G.playerCar.damage || 0) + 22);
    if (G.toast) G.toast("Spike strip! Tires blown — get clear");
    if (G.fx) G.fx.burst(G.player.pos.x, 1, G.player.pos.z, "smoke");
    clearRoadblock(G);
  }
}

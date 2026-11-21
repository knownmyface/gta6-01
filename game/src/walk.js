// walk.js — on-foot player character + wandering pedestrians.
// Camera sits directly behind the player (playtest fix from earlier rounds).
import * as THREE from "../vendor/three/three.module.min.js";
import { clamp, lerp, lerpAngle, rand, pick, dist2d } from "./util.js";

const PED_SHIRTS = [0xe8e8e8, 0xff8a5a, 0x5ac2ff, 0xffd23c, 0x9a6bff, 0x3ac27a, 0xff5a7a];
const PED_PANTS = [0x2a3550, 0x3a3a3a, 0x5a3a2a, 0x24402e];

export function makePersonMesh(shirt, pants, skin) {
  const g = new THREE.Group();
  const skinMat = new THREE.MeshLambertMaterial({ color: skin || 0xd9a066 });
  const shirtMat = new THREE.MeshLambertMaterial({ color: shirt });
  const pantsMat = new THREE.MeshLambertMaterial({ color: pants });
  const legs = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.85, 0.3), pantsMat);
  legs.position.y = 0.43;
  g.add(legs);
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.75, 0.34), shirtMat);
  torso.position.y = 1.22;
  g.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 10, 8), skinMat);
  head.position.y = 1.82;
  g.add(head);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.27, 10, 6, 0, Math.PI * 2, 0, 1.1),
    new THREE.MeshLambertMaterial({ color: 0x223344 }));
  cap.position.y = 1.88;
  g.add(cap);
  const armMat = shirtMat;
  for (const s of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.7, 0.18), armMat);
    arm.position.set(s * 0.4, 1.2, 0);
    g.add(arm);
  }
  return g;
}

export function spawnPlayerOnFoot(G, x, z, heading) {
  const mesh = makePersonMesh(0xff5a2a, 0x2a3550, 0xc98a5a);
  // Player wears a coral jacket so the camera can always find them.
  mesh.position.set(x, 0, z);
  mesh.rotation.y = heading;
  G.scene.add(mesh);
  G.playerMesh = mesh;
  G.player.mode = "foot";
  G.player.pos.set(x, 0, z);
  G.player.heading = heading;
  G.player.speed = 0;
  return mesh;
}

export function updateOnFoot(G, dt, input) {
  if (G.player.mode !== "foot") return;
  const p = G.player;
  const camYaw = G.cameraYaw || 0;
  let mx = 0;
  let mz = 0;
  if (input.forward) { mx += -Math.sin(camYaw); mz += -Math.cos(camYaw); }
  if (input.back) { mx += Math.sin(camYaw); mz += Math.cos(camYaw); }
  if (input.left) { mx += -Math.cos(camYaw); mz += Math.sin(camYaw); }
  if (input.right) { mx += Math.cos(camYaw); mz += -Math.sin(camYaw); }
  const len = Math.sqrt(mx * mx + mz * mz);
  const sprint = input.sprint ? 1.7 : 1;
  const speed = 6.5 * sprint;
  if (len > 0.01) {
    mx /= len;
    mz /= len;
    p.pos.x += mx * speed * dt;
    p.pos.z += mz * speed * dt;
    const want = Math.atan2(mx, mz);
    p.heading = lerpAngle(p.heading, want, clamp(dt * 10, 0, 1));
    p.speed = speed;
    p.moving = true;
  } else {
    p.speed = 0;
    p.moving = false;
  }
  p.pos.x = clamp(p.pos.x, -330, 330);
  p.pos.z = clamp(p.pos.z, -198, 330);
  if (G.playerMesh) {
    G.playerMesh.position.set(p.pos.x, 0, p.pos.z);
    G.playerMesh.rotation.y = p.heading;
    // Walk bob + arm swing illusion via torso tilt.
    const t = performance.now() / 1000;
    G.playerMesh.position.y = p.moving ? Math.abs(Math.sin(t * 9)) * 0.07 : 0;
    G.playerMesh.rotation.z = p.moving ? Math.sin(t * 9) * 0.04 : 0;
  }
  G.displaySpeed = p.moving ? speed * 2.2 : 0;
}

export function spawnPedestrians(G, count) {
  G.peds = G.peds || [];
  for (let i = 0; i < count; i++) {
    const mesh = makePersonMesh(pick(PED_SHIRTS), pick(PED_PANTS), pick([0xd9a066, 0x8a5a30, 0xf0c8a0, 0x6b4423]));
    const x = rand(-300, 300);
    const z = rand(-160, 300);
    mesh.position.set(x, 0, z);
    G.scene.add(mesh);
    G.peds.push({
      mesh, x, z,
      heading: rand(0, Math.PI * 2),
      speed: rand(1.2, 2.4),
      targetX: x, targetZ: z,
      wait: rand(0, 4),
    });
  }
  return G.peds;
}

export function updatePedestrians(G, dt) {
  if (!G.peds) return;
  for (const ped of G.peds) {
    if (ped.wait > 0) {
      ped.wait -= dt;
      continue;
    }
    const d = dist2d(ped.x, ped.z, ped.targetX, ped.targetZ);
    if (d < 2) {
      // New stroll target: nearby sidewalk-ish spot.
      ped.targetX = clamp(ped.x + rand(-45, 45), -320, 320);
      ped.targetZ = clamp(ped.z + rand(-45, 45), -175, 320);
      ped.wait = rand(0, 3);
      continue;
    }
    const want = Math.atan2(ped.targetX - ped.x, ped.targetZ - ped.z);
    ped.heading = lerpAngle(ped.heading, want, clamp(dt * 4, 0, 1));
    ped.x += Math.sin(ped.heading) * ped.speed * dt;
    ped.z += Math.cos(ped.heading) * ped.speed * dt;
    ped.mesh.position.set(ped.x, 0, ped.z);
    ped.mesh.rotation.y = ped.heading;
    const t = performance.now() / 1000 + ped.x;
    ped.mesh.position.y = Math.abs(Math.sin(t * 7)) * 0.05;
  }
}

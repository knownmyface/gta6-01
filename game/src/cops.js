// CORAL HEAT — wanted level, police chases, helicopter, roadblocks (v2.9, fresh).
import * as THREE from 'three';
import { clamp, rand, pick, angDiff, dist2d } from './util.js';
import { createCar, removeCar, stepCar } from './drive.js';

export function setupCops(G) {
  G.cops = {
    wanted: 0,
    heat: 0,
    heli: null,
    roadblocks: [],
    addWanted(n) {
      const before = this.wanted;
      this.wanted = clamp(this.wanted + n, 0, 5);
      if (this.wanted > before) {
        G.hud.toast(this.wanted >= 3 ? 'WANTED LEVEL ' + this.wanted + ' — helicopter inbound!' : 'Wanted level ' + this.wanted);
        G.audio?.siren(this.wanted);
      }
      G.hud.setWanted(this.wanted);
    },
    clearWanted() {
      this.wanted = 0;
      this.heat = 0;
      G.hud.setWanted(0);
    },
  };
  G.player.wanted = 0;
}

function makeHeliMesh() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.4, 4.6), new THREE.MeshLambertMaterial({ color: 0x1c2a44 }));
  g.add(body);
  const glass = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.9, 1.4), new THREE.MeshLambertMaterial({ color: 0x9fd8e8, emissive: 0x224455, emissiveIntensity: 0.5 }));
  glass.position.set(0, 0.2, -1.8);
  g.add(glass);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 4.2), new THREE.MeshLambertMaterial({ color: 0x1c2a44 }));
  tail.position.set(0, 0.4, 4.0);
  g.add(tail);
  const rotor = new THREE.Mesh(new THREE.BoxGeometry(9, 0.12, 0.5), new THREE.MeshLambertMaterial({ color: 0x222222 }));
  rotor.position.y = 1.1;
  g.add(rotor);
  g.userData.rotor = rotor;
  const tailRotor = new THREE.Mesh(new THREE.BoxGeometry(0.1, 2.2, 0.4), new THREE.MeshLambertMaterial({ color: 0x222222 }));
  tailRotor.position.set(0.4, 0.6, 5.8);
  g.add(tailRotor);
  // searchlight cone
  const beam = new THREE.Mesh(
    new THREE.ConeGeometry(4.5, 22, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false })
  );
  beam.position.y = -11;
  beam.rotation.x = Math.PI;
  g.add(beam);
  const spot = new THREE.Mesh(new THREE.CircleGeometry(4.2, 16), new THREE.MeshBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0.35, depthWrite: false }));
  spot.rotation.x = -Math.PI / 2;
  spot.position.y = -21;
  g.add(spot);
  g.userData.spot = spot;
  return g;
}

function spawnPoliceCar(G) {
  const p = G.player;
  const a = rand(0, Math.PI * 2);
  const x = clamp(p.x + Math.cos(a) * 55, -320, 280);
  const z = clamp(p.z + Math.sin(a) * 55, -320, 320);
  const car = createCar(G, x, z, rand(0, Math.PI * 2), 0x111111, 'police');
  car.isPolice = true;
  car.top = 50;
  G.copsList.push(car);
  return car;
}

function spawnRoadblock(G) {
  const p = G.player;
  const heading = p.car ? p.car.heading : p.heading;
  const bx = p.x - Math.sin(heading) * 46;
  const bz = p.z - Math.cos(heading) * 46;
  const group = new THREE.Group();
  for (let i = -1; i <= 1; i++) {
    const car = createCar(G, bx + Math.cos(heading) * i * 7, bz - Math.sin(heading) * i * 7, heading + Math.PI / 2, 0x111111, 'police');
    car.isPolice = true;
    car.isRoadblock = true;
    group.add(car.mesh);
    G.scene.remove(car.mesh);
    G.scene.add(car.mesh);
    G.copsList.push(car);
  }
  const barrier = new THREE.Mesh(
    new THREE.BoxGeometry(14, 1.1, 0.5),
    new THREE.MeshLambertMaterial({ color: 0xff5a2a, emissive: 0x661100, emissiveIntensity: 0.6 })
  );
  barrier.position.set(bx, 0.6, bz);
  barrier.rotation.y = heading;
  G.scene.add(barrier);
  const rb = { x: bx, z: bz, mesh: barrier, cars: [], t: 0 };
  G.cops.roadblocks.push(rb);
  G.hud.toast('ROADBLOCK AHEAD — smash through or turn off!');
  G.audio?.alarm();
}

export function updateCops(G, dt) {
  const cops = G.cops;
  const p = G.player;
  cops.wanted = Math.max(0, Math.min(5, cops.wanted));
  p.wanted = cops.wanted;
  // heat decays slowly when the player stays out of sight (low speed, no crime)
  if (cops.wanted > 0) {
    cops.heat += dt;
    if (cops.heat > 26) { cops.wanted = Math.max(0, cops.wanted - 1); cops.heat = 0; G.hud.setWanted(cops.wanted); }
  }
  // --- police cars ---------------------------------------------------------
  const wantCount = cops.wanted >= 5 ? 5 : cops.wanted >= 3 ? 4 : cops.wanted >= 1 ? cops.wanted + 1 : 0;
  const active = G.copsList.filter((c) => c.isPolice && !c.isRoadblock);
  while (active.length < wantCount && cops.wanted > 0) {
    active.push(spawnPoliceCar(G));
  }
  for (const car of [...active]) {
    const d = dist2d(car.x, car.z, p.x, p.z);
    if (d > 260) { removeCar(G, car); const i = G.copsList.indexOf(car); if (i >= 0) G.copsList.splice(i, 1); continue; }
    // chase: steer toward the player, ram when close
    const want = Math.atan2(-(p.x - car.x), -(p.z - car.z));
    const steer = clamp(angDiff(car.heading, want) * 1.8, -1, 1);
    let throttle = 0.9;
    if (d < 7) throttle = 1;
    stepCar(G, car, { throttle, steer, brake: false, nitro: false }, dt);
    if (d < 3.4 && Math.abs(car.speed) > 6) {
      // ram damage
      if (p.mode === 'car' && p.car) {
        p.car.health -= 6 * dt * 10;
        G.audio?.thud();
        if (p.car.health <= 0) {
          G.hud.toast('Your car is wrecked! Bail out!');
          p.car.health = 100;
        }
      } else if (p.mode === 'foot') {
        p.health -= 12 * dt * 10;
        if (p.health <= 0) busted(G);
      }
    }
  }
  // --- helicopter ----------------------------------------------------------
  if (cops.wanted >= 3 && !cops.heli) {
    const mesh = makeHeliMesh();
    mesh.position.set(p.x + 30, 46, p.z - 30);
    G.scene.add(mesh);
    cops.heli = { mesh, angle: 0 };
    G.hud.toast('POLICE HELICOPTER overhead — lose them in the tunnels!');
  }
  if (cops.heli) {
    if (cops.wanted < 3) {
      G.scene.remove(cops.heli.mesh);
      cops.heli = null;
    } else {
      const h = cops.heli;
      h.angle += dt * 0.55;
      // hover ahead of the player, slightly to the side, so the heli stays in the chase frame
      const ph = p.car ? p.car.heading : p.heading;
      const tx = p.x - Math.sin(ph) * 30 + Math.cos(ph) * 10;
      const tz = p.z - Math.cos(ph) * 30 - Math.sin(ph) * 10;
      h.mesh.position.x += (tx - h.mesh.position.x) * dt * 1.4;
      h.mesh.position.z += (tz - h.mesh.position.z) * dt * 1.4;
      h.mesh.position.y = 18 + Math.sin(G.time * 1.3) * 1.5;
      h.mesh.rotation.y = Math.atan2(-(p.x - h.mesh.position.x), -(p.z - h.mesh.position.z));
      h.mesh.userData.rotor.rotation.y += dt * 22;
      h.mesh.userData.spot.position.set(p.x - h.mesh.position.x, -21, p.z - h.mesh.position.z);
      // heli keeps the heat up
      cops.heat = Math.max(0, cops.heat - dt * 0.4);
    }
  }
  // --- roadblocks ----------------------------------------------------------
  if (cops.wanted >= 4 && cops.roadblocks.length === 0 && p.mode === 'car') {
    spawnRoadblock(G);
  }
  for (const rb of [...cops.roadblocks]) {
    rb.t += dt;
    if (rb.t > 40 || cops.wanted < 4) {
      G.scene.remove(rb.mesh);
      G.cops.roadblocks.splice(G.cops.roadblocks.indexOf(rb), 1);
    }
  }
}

function busted(G) {
  G.player.health = 100;
  G.player.cash = Math.max(0, G.player.cash - 250);
  G.cops.clearWanted();
  G.hud.toast('BUSTED! You lost $250 and woke up at the hospital');
  G.player.x = -35; G.player.z = -105;
  if (G.player.mode !== 'foot') {
    const car = G.player.car; if (car) { car.isPlayer = false; }
    G.player.car = null; G.player.mode = 'foot';
    G.player.mesh.visible = true;
  }
  G.player.mesh.position.set(G.player.x, 0, G.player.z);
}

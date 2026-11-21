// Coral Heat — wanted level, police cars, helicopter + searchlight, roadblocks
// with spike strips. Fresh write, round 7.
import * as THREE from 'three';
import { clamp, rand, pick, angleLerp } from './util.js';
import { makeCarMesh } from './drive.js';
import { collideCircle } from './coralcity.js';

export const WANTED_LABELS = ['CLEAN', 'HEAT 1', 'HEAT 2', 'HEAT 3', 'HEAT 4', 'HEAT 5'];

export class Police {
  constructor(scene) {
    this.scene = scene;
    this.cars = [];
    this.roadblocks = [];
    this.heli = null;
    this.heliLight = null;
    this.heliPool = null;
    this.wanted = 0;
    this.heat = 0;          // 0..100, decays
    this.spawnTimer = 0;
    this.blockTimer = 0;
  }
  setWanted(n, G) {
    this.wanted = clamp(n, 0, 5);
    if (this.wanted > 0) this.heat = 100;
    if (G) G.hud?.toast('WANTED LEVEL ' + this.wanted + ' — ' + WANTED_LABELS[this.wanted], '#ff4444');
  }
  addHeat(n) {
    this.heat = clamp(this.heat + n, 0, 100);
    const w = this.heat > 85 ? 5 : this.heat > 65 ? 4 : this.heat > 45 ? 3 : this.heat > 22 ? 2 : this.heat > 6 ? 1 : 0;
    if (w !== this.wanted) this.wanted = w;
  }
  spawnCar(x, z) {
    const mesh = makeCarMesh(THREE, 0x111111, { police: true });
    this.scene.add(mesh);
    const car = { mesh, x, z, heading: 0, speed: 0, ram: 0 };
    this.cars.push(car);
    return car;
  }
  spawnHeli() {
    if (this.heli) return;
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(3.4, 1.6, 7.5), new THREE.MeshLambertMaterial({ color: 0x3a3a5e, emissive: 0x222244 }));
    body.position.y = 0; g.add(body);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(3.44, 0.5, 7.5), new THREE.MeshBasicMaterial({ color: 0xf5f5f5 }));
    stripe.position.y = -0.3; g.add(stripe);
    const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff2222 }));
    beacon.position.set(0, 1.1, -3.4); g.add(beacon);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 6), new THREE.MeshLambertMaterial({ color: 0x1a1a2e }));
    tail.position.set(0, 0.4, -6); g.add(tail);
    const glass = new THREE.Mesh(new THREE.BoxGeometry(2.8, 1.1, 2.4), new THREE.MeshLambertMaterial({ color: 0x7dd3fc, emissive: 0x225577 }));
    glass.position.set(0, 0.2, 2.6); g.add(glass);
    const rotor = new THREE.Mesh(new THREE.BoxGeometry(13, 0.12, 0.7), new THREE.MeshLambertMaterial({ color: 0x222222 }));
    rotor.position.y = 1.3; g.add(rotor);
    const tailRotor = new THREE.Mesh(new THREE.BoxGeometry(0.12, 3.4, 0.7), new THREE.MeshLambertMaterial({ color: 0x222222 }));
    tailRotor.position.set(0.5, 0.6, -8.6); g.add(tailRotor);
    // searchlight beam: translucent cone pointing down
    const beamGeo = new THREE.ConeGeometry(7, 46, 16, 1, true);
    const beamMat = new THREE.MeshBasicMaterial({ color: 0xfff6c0, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false });
    const beam = new THREE.Mesh(beamGeo, beamMat);
    beam.position.y = -24; beam.rotation.x = Math.PI;
    g.add(beam);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.7, 8, 6), new THREE.MeshBasicMaterial({ color: 0xfff6c0 }));
    lamp.position.set(0, -1, 2.8); g.add(lamp);
    const pool = new THREE.Mesh(new THREE.CircleGeometry(6.5, 20), new THREE.MeshBasicMaterial({ color: 0xfff6c0, transparent: true, opacity: 0.14, depthWrite: false }));
    pool.rotation.x = -Math.PI / 2;
    this.scene.add(pool);
    this.scene.add(g);
    this.heli = { group: g, rotor, beam, x: 0, z: 0, y: 52, heading: 0 };
    this.heliPool = pool;
  }
  removeHeli() {
    if (!this.heli) return;
    this.scene.remove(this.heli.group);
    this.scene.remove(this.heliPool);
    this.heli = null; this.heliPool = null;
  }
  deployRoadblock(px, pz, heading) {
    // two police cars + spike strip across the road ahead of the player
    const ahead = 46;
    const bx = px + Math.sin(heading) * ahead;
    const bz = pz + Math.cos(heading) * ahead;
    const g = new THREE.Group();
    const cars = [];
    for (const off of [-5.5, 5.5]) {
      const m = makeCarMesh(THREE, 0x111111, { police: true });
      const cx = bx + Math.cos(heading) * off;
      const cz = bz - Math.sin(heading) * off;
      m.position.set(cx, 0, cz);
      m.rotation.y = heading + Math.PI;
      this.scene.add(m);
      cars.push(m);
    }
    // spike strip: dark mat + metal spikes
    const strip = new THREE.Mesh(new THREE.BoxGeometry(11, 0.24, 1.6), new THREE.MeshLambertMaterial({ color: 0x222222 }));
    strip.position.set(bx, 0.12, bz);
    strip.rotation.y = heading;
    this.scene.add(strip);
    const spikeMat = new THREE.MeshBasicMaterial({ color: 0xd7d7d7 });
    for (let i = -5; i <= 5; i++) {
      const s = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.8, 4), spikeMat);
      s.position.set(bx + Math.cos(heading) * i, 0.6, bz - Math.sin(heading) * i);
      this.scene.add(s);
      g.add(s);
    }
    const block = { x: bx, z: bz, heading, cars, strip, spikes: g, life: 40 };
    this.roadblocks.push(block);
    return block;
  }
  clearRoadblocks() {
    for (const b of this.roadblocks) {
      for (const m of b.cars) this.scene.remove(m);
      this.scene.remove(b.strip);
      this.scene.remove(b.spikes);
    }
    this.roadblocks = [];
  }
  update(dt, G, t) {
    const player = G.playerPos();
    if (!player) return;
    // heat decay when hidden
    if (this.wanted > 0) {
      this.heat -= dt * (G.inCar ? 1.2 : 2.2);
      if (this.heat <= 0) { this.wanted = 0; this.heat = 0; }
    }
    // police cars: keep count = wanted + 1 (cap 6)
    const wantCars = this.wanted === 0 ? 0 : Math.min(6, this.wanted + 1);
    this.spawnTimer -= dt;
    if (this.cars.length < wantCars && this.spawnTimer <= 0) {
      this.spawnTimer = 1.4;
      const a = rand(0, Math.PI * 2);
      this.spawnCar(player.x + Math.sin(a) * 60, player.z + Math.cos(a) * 60);
    }
    if (this.cars.length > wantCars) {
      const c = this.cars.pop();
      this.scene.remove(c.mesh);
    }
    // chase AI
    for (const c of this.cars) {
      const dx = player.x - c.x, dz = player.z - c.z;
      const d = Math.hypot(dx, dz);
      const target = Math.atan2(dx, dz);
      c.heading = angleLerp(c.heading, target, Math.min(1, dt * 2.4));
      const top = 34 + this.wanted * 2.5;
      c.speed = clamp(c.speed + (d > 10 ? 26 : -30) * dt, 0, top);
      const nx = c.x + Math.sin(c.heading) * c.speed * dt;
      const nz = c.z + Math.cos(c.heading) * c.speed * dt;
      const hit = collideCircle(G.city, nx, nz, 2.1);
      c.x = hit.x; c.z = hit.z;
      c.mesh.position.set(c.x, 0, c.z);
      c.mesh.rotation.y = c.heading;
      const spin = c.speed * dt * 2.4;
      for (const w of c.mesh.userData.wheels) w.rotation.x += spin;
      // flashing light bar
      const bar = c.mesh.userData.lightBar;
      if (bar) bar.visible = Math.floor(t * 6) % 2 === 0;
      // ram damage
      if (d < 3.4 && G.inCar) {
        G.playerCar.damage = Math.min(100, G.playerCar.damage + 14 * dt);
        G.playerCar.speed *= 0.985;
      }
    }
    // helicopter at wanted >= 3
    if (this.wanted >= 3 && !this.heli) this.spawnHeli();
    if (this.wanted < 3 && this.heli) this.removeHeli();
    if (this.heli) {
      const h = this.heli;
      h.x = player.x + Math.sin(t * 0.35) * 12;
      h.z = player.z - 30 + Math.cos(t * 0.35) * 8;
      h.y = 22 + Math.sin(t * 0.8) * 2;
      h.heading = Math.atan2(player.x - h.x, player.z - h.z);
      h.group.position.set(h.x, h.y, h.z);
      h.group.rotation.y = h.heading;
      h.rotor.rotation.y += dt * 22;
      this.heliPool.position.set(player.x, 0.08, player.z);
      const s = 1 + Math.sin(t * 3) * 0.06;
      this.heliPool.scale.set(s, s, 1);
    }
    // roadblocks at wanted >= 4, every ~18s
    this.blockTimer -= dt;
    if (this.wanted >= 4 && this.blockTimer <= 0 && this.roadblocks.length < 2) {
      this.blockTimer = 18;
      this.deployRoadblock(player.x, player.z, G.playerHeading());
      G.hud?.toast('ROADBLOCK AHEAD — SPIKE STRIPS DEPLOYED', '#ff8844');
    }
    // spike strip hits
    for (const b of this.roadblocks) {
      b.life -= dt;
      if (Math.hypot(player.x - b.x, player.z - b.z) < 7 && G.inCar) {
        G.playerCar.spiked = 3;
        G.playerCar.damage = Math.min(100, G.playerCar.damage + 8);
        G.hud?.toast('SPIKE STRIP! TIRES SHREDDED', '#ff4444');
        // consume the block so it only hits once
        b.life = 0;
      }
    }
    for (const b of [...this.roadblocks]) {
      if (b.life <= 0) {
        for (const m of b.cars) this.scene.remove(m);
        this.scene.remove(b.strip);
        this.scene.remove(b.spikes);
        this.roadblocks = this.roadblocks.filter((r) => r !== b);
      }
    }
  }
}

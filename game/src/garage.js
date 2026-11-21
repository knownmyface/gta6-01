// Coral Heat — garage + property: 3 buyable safehouses, car storage slots,
// upgrade shop (engine / tires / armor / nitro). Fresh write, round 7.
import * as THREE from 'three';
import { clamp } from './util.js';

export const SAFEHOUSES = [
  { id: 'shack', name: 'Palm Court Shack', price: 5000, x: -78, z: 78, color: 0x86efac, slots: 1, desc: 'One car slot, quiet street, save point.' },
  { id: 'marina', name: 'Marina Loft', price: 25000, x: 78, z: 182, color: 0x4ecdc4, slots: 2, desc: 'Two car slots, boat dock, marina view.' },
  { id: 'penthouse', name: 'Coral Crown Penthouse', price: 80000, x: 196, z: -104, color: 0xffd166, slots: 4, desc: 'Four car slots, casino views, full garage.' },
];

export const UPGRADES = [
  { id: 'engine', name: 'ENGINE', levels: [4000, 9000, 18000], desc: '+12% top speed / level' },
  { id: 'tires', name: 'TIRES', levels: [2500, 6000, 12000], desc: '+15% grip / level' },
  { id: 'armor', name: 'ARMOR', levels: [3500, 8000, 15000], desc: '-25% crash damage / level' },
  { id: 'nitro', name: 'NITRO', levels: [5000, 11000, 20000], desc: '+16 MPH boost, bigger tank / level' },
];

export class Garage {
  constructor(scene) {
    this.scene = scene;
    this.owned = {};        // safehouse id -> true
    this.stored = {};       // safehouse id -> [model names]
    this.markers = [];
    for (const sh of SAFEHOUSES) {
      // glowing marker pillar + sign
      const pillar = new THREE.Mesh(
        new THREE.CylinderGeometry(2.2, 2.2, 22, 12, 1, true),
        new THREE.MeshBasicMaterial({ color: sh.color, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false })
      );
      pillar.position.set(sh.x, 11, sh.z);
      scene.add(pillar);
      const pad = new THREE.Mesh(new THREE.BoxGeometry(10, 0.3, 10), new THREE.MeshLambertMaterial({ color: sh.color }));
      pad.position.set(sh.x, 0.15, sh.z);
      scene.add(pad);
      this.markers.push({ sh, pillar, pad });
    }
  }
  nearestSafehouse(x, z, maxD = 9) {
    let best = null, bd = maxD * maxD;
    for (const m of this.markers) {
      const d = (m.sh.x - x) ** 2 + (m.sh.z - z) ** 2;
      if (d < bd) { bd = d; best = m.sh; }
    }
    return best;
  }
  buySafehouse(G, sh) {
    if (this.owned[sh.id]) return { ok: false, msg: 'Already yours.' };
    if (G.player.cash < sh.price) return { ok: false, msg: 'Need $' + sh.price.toLocaleString('en-US') + ' — you have $' + Math.floor(G.player.cash).toLocaleString('en-US') };
    G.player.cash -= sh.price;
    this.owned[sh.id] = true;
    this.stored[sh.id] = [];
    G.hud?.toast('SAFEHOUSE BOUGHT — ' + sh.name, '#7CFC00');
    G.save?.save();
    return { ok: true, msg: sh.name + ' is yours. ' + sh.slots + ' car slots.' };
  }
  storeCar(G, sh) {
    if (!this.owned[sh.id]) return { ok: false, msg: 'Buy this safehouse first.' };
    const slots = this.stored[sh.id] || [];
    if (slots.length >= sh.slots) return { ok: false, msg: 'Garage full (' + sh.slots + ' slots).' };
    slots.push(G.playerCar.model.name);
    this.stored[sh.id] = slots;
    G.hud?.toast('STORED ' + G.playerCar.model.name + ' at ' + sh.name, '#7CFC00');
    return { ok: true, msg: 'Stored. ' + slots.length + '/' + sh.slots + ' slots used.' };
  }
  buyUpgrade(G, up) {
    const lvl = G.playerCar.upgrades[up.id] || 0;
    if (lvl >= up.levels.length) return { ok: false, msg: up.name + ' is MAXED.' };
    const price = up.levels[lvl];
    if (G.player.cash < price) return { ok: false, msg: 'Need $' + price.toLocaleString('en-US') + ' for ' + up.name + ' Lv' + (lvl + 1) };
    G.player.cash -= price;
    G.playerCar.upgrades[up.id] = lvl + 1;
    if (up.id === 'armor') G.playerCar.damage = Math.max(0, G.playerCar.damage - 30);
    G.hud?.toast(up.name + ' → Lv' + (lvl + 1) + ' INSTALLED', '#7CFC00');
    G.save?.save();
    return { ok: true, msg: up.name + ' Lv' + (lvl + 1) + ' installed. ' + up.desc };
  }
  update(dt, t) {
    for (const m of this.markers) {
      m.pillar.material.opacity = 0.2 + Math.sin(t * 2 + m.sh.x) * 0.08;
      m.pillar.rotation.y += dt * 0.4;
    }
  }
}

// Coral Heat — story missions 13-20: races, bikes, garage, and the 4-part
// casino-heist finale (recon, getaway driver, vault, escape by boat).
// Fresh write, round 7.
import * as THREE from 'three';

export const MISSIONS_13_20 = [
  { id: 13, title: 'BIKE LIFE', giver: 'Drex', desc: 'Ride a motorcycle to the Palm Sprint start line.', type: 'bike', target: [-52, 0], reward: 3500, hint: 'Find a bike on the street, press E, then ride.' },
  { id: 14, title: 'PALM SPRINT', giver: 'Drex', desc: 'Win the Palm Sprint circuit on a bike.', type: 'race', target: [-52, 0], circuit: 'Palm Sprint', reward: 5000, hint: 'Win it. Bikes are quick off the line.' },
  { id: 15, title: 'HOME BASE', giver: 'Lena', desc: 'Buy any safehouse — a place to store your cars.', type: 'buyhouse', target: [-78, 78], reward: 2500, hint: 'Stand in a glowing marker and press G.' },
  { id: 16, title: 'TUNED UP', giver: 'Lena', desc: 'Buy any garage upgrade for your car.', type: 'upgrade', target: [78, 130], reward: 3000, hint: 'Garage shop: press G near the garage marker.' },
  { id: 17, title: 'HEIST: RECON', giver: 'The Fixer', desc: 'Case the Coral Crown Casino. Reach the neon district without raising heat.', type: 'stealth', target: [150, -150], reward: 5000, hint: 'Stay clean. No crimes on the way in.' },
  { id: 18, title: 'HEIST: GETAWAY DRIVER', giver: 'The Fixer', desc: 'Win the Casino Loop race — prove you can drive the getaway.', type: 'race', target: [104, -104], circuit: 'Casino Loop', reward: 6000, hint: 'Win the Casino Loop.' },
  { id: 19, title: 'HEIST: THE VAULT', giver: 'The Fixer', desc: 'Enter the Coral Crown Casino and crack the vault. Get inside!', type: 'vault', target: [150, -136], reward: 15000, hint: 'Walk through the casino doors.' },
  { id: 20, title: 'HEIST: ESCAPE BY BOAT', giver: 'The Fixer', desc: 'Five stars. Escape to the marina and leave by boat — the finale.', type: 'escape', target: [0, 265], reward: 25000, hint: 'Boat at the dock. Do not get caught.' },
];

export class MissionsPart2 {
  constructor(scene, G) {
    this.scene = scene;
    this.G = G;
    this.defs = MISSIONS_13_20;
    this.index = 0;   // 0-based within part 2 (mission 13 == index 0)
    this.active = null;
    this.vaultTimer = 0;
    this.beacon = null;
  }
  get current() { return this.defs[this.index] || null; }
  // called by part 1 when it finishes mission 12
  syncIndex(part1Index) {
    if (part1Index >= 12 && this.index === 0 && !this.active) {
      setTimeout(() => this.startCurrent(), 1200);
    }
  }
  get globalIndex() { return 12 + this.index; }
  get isActive() { return !!this.active; }

  makeBeacon(x, z, color = 0xff2fd6) {
    this.clearBeacon();
    const pillar = new THREE.Mesh(
      new THREE.CylinderGeometry(3, 3, 60, 12, 1, true),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.3, side: THREE.DoubleSide, depthWrite: false })
    );
    pillar.position.set(x, 30, z);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(4, 0.4, 8, 24), new THREE.MeshBasicMaterial({ color }));
    ring.rotation.x = Math.PI / 2;
    ring.position.set(x, 0.3, z);
    this.scene.add(pillar); this.scene.add(ring);
    this.beacon = { pillar, ring, x, z };
  }
  clearBeacon() {
    if (!this.beacon) return;
    this.scene.remove(this.beacon.pillar);
    this.scene.remove(this.beacon.ring);
    this.beacon = null;
  }

  startCurrent() {
    const def = this.current;
    if (!def) return null;
    this.active = { def, startedAt: this.G.time };
    if (def.target) this.makeBeacon(def.target[0], def.target[1]);
    if (def.type === 'race') {
      const c = this.G.racewayCircuits.find((x) => x.name === def.circuit);
      if (c) this.G.raceway.startRace(c, this.G);
    }
    if (def.type === 'vault') this.vaultTimer = 12;
    if (def.type === 'escape') this.G.police.setWanted(5, this.G);
    this.G.hud?.banner('MISSION ' + def.id + ' — ' + def.title, def.giver + ': ' + def.desc);
    this.G.hud?.toast('NEW MISSION: ' + def.title, '#ff2fd6');
    this.G.sound?.beep(520);
    return this.active;
  }

  complete() {
    const def = this.active.def;
    this.G.player.cash += def.reward;
    this.G.player.missionsDone = (this.G.player.missionsDone || 0) + 1;
    this.G.hud?.banner('MISSION COMPLETE', def.title + ' • +$' + def.reward.toLocaleString('en-US'));
    this.G.hud?.toast('+$' + def.reward.toLocaleString('en-US') + ' — ' + def.title, '#7CFC00');
    this.G.sound?.fanfare(true);
    this.G.save?.save();
    this.active = null;
    this.clearBeacon();
    this.index++;
    if (this.current) setTimeout(() => this.startCurrent(), 2500);
    else {
      this.G.hud?.banner('CORAL HEAT — STORY COMPLETE', '20/20 missions. The casino is yours. Free roam!');
      this.G.player.storyComplete = true;
    }
  }
  fail(reason) {
    this.G.hud?.banner('MISSION FAILED', reason || '');
    this.G.hud?.toast('Mission failed — try again (M)', '#ff4444');
    this.active = null;
    this.clearBeacon();
    if (this.G.raceway.active) this.G.raceway.abort();
  }

  onRaceFinished(circuit, win) {
    if (this.active && this.active.def.type === 'race' && win) this.complete();
  }
  onHouseBought() {
    if (this.active && this.active.def.type === 'buyhouse') this.complete();
  }
  onUpgradeBought() {
    if (this.active && this.active.def.type === 'upgrade') this.complete();
  }

  update(dt) {
    if (!this.active) return;
    const def = this.active.def;
    const p = this.G.playerPos();
    if (!p) return;
    if (this.beacon) {
      this.beacon.pillar.rotation.y += dt;
      const s = 1 + Math.sin(this.G.time * 4) * 0.12;
      this.beacon.ring.scale.set(s, s, s);
    }
    switch (def.type) {
      case 'bike': {
        if (this.G.bikes.active && def.target && Math.hypot(p.x - def.target[0], p.z - def.target[1]) < 9) this.complete();
        break;
      }
      case 'buyhouse':
      case 'upgrade': {
        // completion happens via garage callbacks; beacon just guides
        if (def.target && Math.hypot(p.x - def.target[0], p.z - def.target[1]) < 10) {
          this.G.hud?.hint('Press G here to open the garage / property menu');
        }
        break;
      }
      case 'stealth': {
        if (def.target && Math.hypot(p.x - def.target[0], p.z - def.target[1]) < 10) {
          if (this.G.police.wanted > 0) { this.fail('Spotted! Wanted level rose.'); return; }
          this.complete();
        }
        break;
      }
      case 'vault': {
        // stand inside the casino doorway zone on foot to crack the vault
        const d = def.target ? Math.hypot(p.x - def.target[0], p.z - def.target[1]) : 999;
        if (d < 8 && !this.G.inCar) {
          this.vaultTimer -= dt;
          this.G.hud?.hint('CRACKING THE VAULT… ' + Math.ceil(this.vaultTimer) + 's — STAY INSIDE');
          if (this.vaultTimer <= 0) {
            this.G.player.cash += 5000;
            this.G.police.setWanted(5, this.G);
            this.complete();
          }
        }
        break;
      }
      case 'escape': {
        if (this.G.boats.active && def.target && Math.hypot(p.x - def.target[0], p.z - def.target[1]) < 14) {
          if (this.G.police.wanted === 5) this.complete();
        }
        break;
      }
      default: break;
    }
  }
}

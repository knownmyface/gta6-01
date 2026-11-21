// Coral Heat — story missions 1-12: the rise of Maya "Reef" Santos in Coral Bay.
// Fresh write, round 7.
import * as THREE from 'three';

export const MISSIONS_1_12 = [
  { id: 1, title: 'FIRST LIGHT', giver: 'Tomas', desc: 'Drive to the marina and meet Tomas at the docks.', type: 'goto', target: [0, 205], reward: 500, hint: 'Follow the beacon. WASD to drive.' },
  { id: 2, title: 'WHEELS UP', giver: 'Tomas', desc: 'Steal the Coral GT parked on Marina Row. Press E near it.', type: 'steal', target: [0, 156], reward: 800, hint: 'Walk up to a parked car and press E.' },
  { id: 3, title: 'DELIVERY RUN', giver: 'Lena', desc: 'Deliver the package to the Palm Court shack before the timer runs out.', type: 'timed', target: [-78, 78], reward: 1200, time: 75, hint: 'Drive fast — the clock is ticking.' },
  { id: 4, title: 'HEAT CHECK', giver: 'Lena', desc: 'Lose the cops. Get your wanted level back to zero.', type: 'loseheat', target: null, reward: 1500, hint: 'Hide in the alleys or outrun them.' },
  { id: 5, title: 'CARJACK 101', giver: 'Drex', desc: 'Carjack a moving car on the street. Press F next to a driver.', type: 'carjack', target: [52, 52], reward: 1500, hint: 'Stand by a slow car and press F.' },
  { id: 6, title: 'THE COLLECTOR', giver: 'Drex', desc: 'Collect 3 cash drops scattered around Coral Bay.', type: 'collect', target: [104, -52], reward: 2000, count: 3, hint: 'Drive through the glowing cash markers.' },
  { id: 7, title: 'BOAT PEOPLE', giver: 'Tomas', desc: 'Take a boat from the marina and reach the far buoy.', type: 'boat', target: [104, 265], reward: 2000, hint: 'Press E near a moored boat, then sail south.' },
  { id: 8, title: 'FIVE STAR NIGHT', giver: 'Lena', desc: 'Survive a 3-star wanted level for 60 seconds.', type: 'survive', target: null, reward: 2500, time: 60, hint: 'Cause chaos, then keep moving.' },
  { id: 9, title: 'THE DROP', giver: 'Drex', desc: 'Reach the drop point at the beach without being spotted — stay at wanted 0.', type: 'stealth', target: [-208, 156], reward: 2500, hint: 'Drive clean. No crimes on the way.' },
  { id: 10, title: 'REPO RUN', giver: 'Lena', desc: 'Bring the Reef Cruiser from the north lot back to the garage.', type: 'goto', target: [78, 130], reward: 3000, hint: 'Any car will do — just get there.' },
  { id: 11, title: 'ROADBLOCK BREAKER', giver: 'Drex', desc: 'Smash through a police roadblock at 4 stars.', type: 'roadblock', target: [104, -104], reward: 3500, hint: 'Get to 4 stars, then hit the spikes at full speed.' },
  { id: 12, title: 'QUEEN OF THE BAY', giver: 'Tomas', desc: 'Win a street race on the Marina Mile circuit.', type: 'race', target: [0, 156], circuit: 'Marina Mile', reward: 4000, hint: 'Talk to the race starter at the gate.' },
];

export class MissionManager {
  constructor(scene, G) {
    this.scene = scene;
    this.G = G;
    this.defs = MISSIONS_1_12;
    this.index = 0;          // next mission to start (0-based)
    this.active = null;
    this.beacon = null;
    this.pickups = [];
    this.timer = 0;
    this.collected = 0;
    this.surviveTimer = 0;
  }
  get current() { return this.defs[this.index] || null; }
  get completedCount() { return this.index; }

  makeBeacon(x, z, color = 0xffd166) {
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
  clearPickups() {
    for (const p of this.pickups) this.scene.remove(p.mesh);
    this.pickups = [];
  }
  spawnPickups(n, spots) {
    this.clearPickups();
    for (let i = 0; i < n; i++) {
      const [px, pz] = spots[i % spots.length];
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.4, 0.6), new THREE.MeshBasicMaterial({ color: 0x7CFC00 }));
      mesh.position.set(px, 1.2, pz);
      this.scene.add(mesh);
      this.pickups.push({ mesh, x: px, z: pz, taken: false });
    }
  }

  startCurrent() {
    const def = this.current;
    if (!def) return null;
    this.active = { def, startedAt: this.G.time, collected: 0 };
    this.collected = 0;
    this.timer = def.time || 0;
    this.surviveTimer = 0;
    if (def.target) this.makeBeacon(def.target[0], def.target[1]);
    if (def.type === 'collect') {
      this.spawnPickups(def.count, [[104, -52], [-104, 104], [156, 52], [-156, -104]]);
    }
    if (def.type === 'survive') {
      this.G.police.setWanted(3, this.G);
      this.surviveTimer = def.time;
    }
    if (def.type === 'roadblock') {
      this.G.police.setWanted(4, this.G);
    }
    if (def.type === 'race') {
      const c = this.G.raceway.CIRCUITS?.find?.((x) => x.name === def.circuit) || this.G.racewayCircuits.find((x) => x.name === def.circuit);
      if (c) this.G.raceway.startRace(c, this.G);
    }
    this.G.hud?.banner('MISSION ' + def.id + ' — ' + def.title, def.giver + ': ' + def.desc);
    this.G.hud?.toast('NEW MISSION: ' + def.title, '#ffd166');
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
    this.clearPickups();
    this.index++;
    this.G.missions2?.syncIndex?.(this.index);
    if (this.current) setTimeout(() => this.startCurrent(), 2500);
    else this.G.hud?.banner('STORY COMPLETE', 'You own Coral Bay. Free roam!');
  }
  fail(reason) {
    const def = this.active?.def;
    this.G.hud?.banner('MISSION FAILED', reason || (def ? def.title : ''));
    this.G.hud?.toast('Mission failed — try again (M)', '#ff4444');
    this.active = null;
    this.clearBeacon();
    this.clearPickups();
    if (this.G.raceway.active) this.G.raceway.abort();
  }

  onRaceFinished(circuit, win) {
    if (this.active && this.active.def.type === 'race' && win) this.complete();
  }
  onCarjacked() {
    if (this.active && this.active.def.type === 'carjack') this.complete();
  }
  onSteal() {
    if (this.active && this.active.def.type === 'steal') this.complete();
  }
  onBoatReached() {
    if (this.active && this.active.def.type === 'boat') this.complete();
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
    for (const pk of this.pickups) pk.mesh.rotation.y += dt * 2;
    switch (def.type) {
      case 'goto':
      case 'timed':
      case 'stealth':
      case 'roadblock': {
        if (def.target && Math.hypot(p.x - def.target[0], p.z - def.target[1]) < 9) {
          if (def.type === 'stealth' && this.G.police.wanted > 0) { this.fail('Spotted! Wanted level rose.'); return; }
          if (def.type === 'roadblock' && this.G.police.roadblocks.length === 0 && this.G.police.wanted < 4) { break; }
          this.complete();
        }
        if (def.type === 'timed') {
          this.timer -= dt;
          if (this.timer <= 0) this.fail('Out of time.');
        }
        break;
      }
      case 'loseheat': {
        if (this.G.police.wanted === 0) this.complete();
        break;
      }
      case 'collect': {
        for (const pk of this.pickups) {
          if (!pk.taken && Math.hypot(p.x - pk.x, p.z - pk.z) < 4) {
            pk.taken = true;
            this.scene.remove(pk.mesh);
            this.active.collected++;
            this.G.player.cash += 150;
            this.G.hud?.toast('CASH DROP ' + this.active.collected + '/' + def.count + ' +$150', '#7CFC00');
          }
        }
        if (this.active.collected >= def.count) this.complete();
        break;
      }
      case 'boat': {
        if (this.G.boats.active && Math.hypot(p.x - def.target[0], p.z - def.target[1]) < 12) this.complete();
        break;
      }
      case 'survive': {
        this.surviveTimer -= dt;
        if (this.G.police.wanted < 3) { this.fail('Wanted level dropped below 3.'); return; }
        if (this.surviveTimer <= 0) this.complete();
        break;
      }
      default: break;
    }
  }
}

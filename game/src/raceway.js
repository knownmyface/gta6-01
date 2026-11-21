// Coral Heat — street races: 5 circuits, checkpoint gates, countdown, rival AI,
// lap + best-lap timing, race HUD, cash rewards. Fresh write, round 7.
import * as THREE from 'three';
import { clamp, rand, fmtLap } from './util.js';
import { makeCarMesh } from './drive.js';

export const CIRCUITS = [
  { name: 'Marina Mile', laps: 2, reward: 1200, gates: [[0, 156], [104, 156], [104, 52], [0, 52], [-104, 52], [-104, 156]] },
  { name: 'Casino Loop', laps: 2, reward: 2000, gates: [[104, -104], [208, -104], [208, -208], [104, -208], [104, -104]] },
  { name: 'Palm Sprint', laps: 3, reward: 1500, gates: [[-52, 0], [-52, -104], [52, -104], [52, 0], [-52, 0]] },
  { name: 'Beachfront Dash', laps: 2, reward: 1800, gates: [[-208, 104], [-208, -104], [-104, -104], [-104, 104], [-208, 104]] },
  { name: 'Coral Grand Prix', laps: 3, reward: 4000, gates: [[0, 208], [156, 208], [156, -156], [-156, -156], [-156, 208], [0, 208]] },
];

export class Raceway {
  constructor(scene) {
    this.scene = scene;
    this.active = null;
    this.bestLaps = {};   // circuit name -> seconds
    this.gateMeshes = [];
    this.rivals = [];
  }
  clearGates() {
    for (const m of this.gateMeshes) this.scene.remove(m);
    this.gateMeshes = [];
  }
  clearRivals() {
    for (const r of this.rivals) this.scene.remove(r.mesh);
    this.rivals = [];
  }
  startRace(circuit, G) {
    this.active = {
      circuit, gateIndex: 0, lap: 1, lapStart: 0, raceStart: 0,
      countdown: 3.2, state: 'countdown', position: 4, finished: false,
      totalTime: 0,
    };
    this.clearGates();
    for (const [gx, gz] of circuit.gates) {
      const gate = new THREE.Mesh(
        new THREE.TorusGeometry(6, 0.5, 8, 24),
        new THREE.MeshBasicMaterial({ color: 0x00e5ff })
      );
      gate.position.set(gx, 3.5, gz);
      gate.rotation.y = Math.PI / 2;
      this.scene.add(gate);
      this.gateMeshes.push(gate);
    }
    // 3 rival AI drivers start just behind the player
    this.clearRivals();
    const colors = [0xff2222, 0x22ff66, 0xffd166];
    const px = G.playerCar.x, pz = G.playerCar.z;
    for (let i = 0; i < 3; i++) {
      const mesh = makeCarMesh(THREE, colors[i]);
      this.scene.add(mesh);
      this.rivals.push({
        mesh, x: px - 6 - i * 2, z: pz - 8 - i * 3, heading: G.playerCar.heading,
        speed: 0, gateIndex: 0, lap: 1, top: rand(30, 40), wobble: rand(0, 6),
      });
    }
    G.playerCar.reset(px, pz, G.playerCar.heading);
    G.hud?.toast('RACE: ' + circuit.name + ' — ' + circuit.laps + ' LAPS', '#00e5ff');
    G.hud?.banner('RACE START — ' + circuit.name.toUpperCase(), circuit.laps + ' LAPS • BEAT THE RIVALS');
    return this.active;
  }
  abort() {
    this.active = null;
    this.clearGates();
    this.clearRivals();
  }
  update(dt, G, t) {
    const r = this.active;
    if (!r) return;
    // pulse gate rings
    for (let i = 0; i < this.gateMeshes.length; i++) {
      const m = this.gateMeshes[i];
      m.material.color.setHex(i === r.gateIndex ? 0x00e5ff : 0x335566);
      m.rotation.z += dt * 0.8;
      const s = i === r.gateIndex ? 1 + Math.sin(t * 5) * 0.08 : 1;
      m.scale.set(s, s, s);
    }
    if (r.state === 'countdown') {
      r.countdown -= dt;
      if (r.countdown <= 0) {
        r.state = 'racing';
        r.raceStart = t;
        r.lapStart = t;
        G.hud?.banner('GO!', 'FIRST THROUGH THE GATES WINS');
        G.sound?.beep(880);
      }
      return;
    }
    if (r.state !== 'racing') return;
    r.totalTime = t - r.raceStart;
    // player gate progress
    const gates = r.circuit.gates;
    const [gx, gz] = gates[r.gateIndex];
    if (Math.hypot(G.playerCar.x - gx, G.playerCar.z - gz) < 10) {
      r.gateIndex++;
      G.sound?.beep(660);
      if (r.gateIndex >= gates.length) {
        r.gateIndex = 0;
        const lapTime = t - r.lapStart;
        r.lapStart = t;
        const prev = this.bestLaps[r.circuit.name];
        if (!prev || lapTime < prev) {
          this.bestLaps[r.circuit.name] = lapTime;
          G.hud?.toast('NEW BEST LAP ' + fmtLap(lapTime), '#7CFC00');
        }
        r.lap++;
        if (r.lap > r.circuit.laps) {
          this.finish(G);
          return;
        }
        G.hud?.toast('LAP ' + r.lap + '/' + r.circuit.laps, '#00e5ff');
      }
    }
    // rival AI: steer to next gate, rubber-band a little
    for (const rv of this.rivals) {
      const [rx, rz] = gates[rv.gateIndex];
      const dx = rx - rv.x, dz = rz - rv.z;
      const d = Math.hypot(dx, dz);
      const target = Math.atan2(dx, dz);
      let diff = target - rv.heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      rv.heading += clamp(diff, -1.6 * dt, 1.6 * dt);
      const playerAhead = G.playerCar.x !== undefined;
      const rubber = playerAhead ? clamp((r.totalTime * 0.4 - rv.lap * 20) * 0.02, -3, 3) : 0;
      rv.speed = clamp(rv.speed + 18 * dt, 0, rv.top + rubber);
      rv.x += Math.sin(rv.heading) * rv.speed * dt;
      rv.z += Math.cos(rv.heading) * rv.speed * dt;
      if (d < 11) {
        rv.gateIndex++;
        if (rv.gateIndex >= gates.length) { rv.gateIndex = 0; rv.lap++; }
      }
      rv.mesh.position.set(rv.x, 0, rv.z);
      rv.mesh.rotation.y = rv.heading;
      const spin = rv.speed * dt * 2.4;
      for (const w of rv.mesh.userData.wheels) w.rotation.x += spin;
    }
    // live position: player lap/gate vs rivals
    let pos = 1;
    for (const rv of this.rivals) {
      const rvScore = rv.lap * 100 + rv.gateIndex;
      const plScore = r.lap * 100 + r.gateIndex;
      if (rvScore > plScore) pos++;
    }
    r.position = pos;
  }
  finish(G) {
    const r = this.active;
    r.state = 'finished';
    r.finished = true;
    const win = r.position === 1;
    const payout = win ? r.circuit.reward : Math.floor(r.circuit.reward * 0.25);
    G.player.cash += payout;
    G.hud?.banner(win ? 'RACE WON!' : 'RACE OVER — P' + r.position,
      'TIME ' + fmtLap(r.totalTime) + ' • +$' + payout.toLocaleString('en-US'));
    G.hud?.toast((win ? '1ST PLACE! +$' : 'P' + r.position + ' +$') + payout.toLocaleString('en-US'), win ? '#ffd166' : '#ffffff');
    G.sound?.fanfare(win);
    G.missions?.onRaceFinished?.(r.circuit, win);
    setTimeout(() => { if (this.active === r) this.abort(); }, 2500);
  }
}

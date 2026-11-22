// CORAL HEAT — street races: 5 circuits around Port Coral.
// Each circuit is a loop of gates on the road grid. Position is computed
// against a rival ghost car; lap times, best lap and the live position are
// shown on the HUD while a race runs.
Coral.raceway = (function () {
  'use strict';
  var U = Coral.util;

  function loopGates(cx, cz, rx, rz, n) {
    var gates = [];
    for (var i = 0; i < n; i++) {
      var a = (i / n) * Math.PI * 2;
      gates.push({ x: cx + Math.sin(a) * rx, z: cz + Math.cos(a) * rz });
    }
    return gates;
  }

  var CIRCUITS = [
    {
      id: 0, name: 'Midnight Strip', laps: 3,
      start: { x: 0, z: -186 }, gates: loopGates(0, -93, 150, 93, 8),
    },
    {
      id: 1, name: 'Casino Loop', laps: 3,
      start: { x: 186, z: 62 }, gates: loopGates(155, 62, 120, 60, 8),
    },
    {
      id: 2, name: 'Marina Sprint', laps: 2,
      start: { x: -124, z: 186 }, gates: loopGates(-62, 120, 130, 66, 7),
    },
    {
      id: 3, name: 'Plaza Grand Prix', laps: 3,
      start: { x: -62, z: 0 }, gates: loopGates(0, 0, 150, 150, 10),
    },
    {
      id: 4, name: 'Sunset Boulevard', laps: 2,
      start: { x: -186, z: -186 }, gates: loopGates(-93, -93, 140, 140, 9),
    },
  ];

  var gateMeshes = [];
  var active = null;
  var rival = null;
  var lastResult = null;
  var lastRace = null;

  function buildGateMeshes(state) {
    if (gateMeshes.length) return;
    var postMat = new THREE.MeshStandardMaterial({ color: 0xffd23d, emissive: 0xaa8811, emissiveIntensity: 0.6 });
    var topMat = new THREE.MeshBasicMaterial({ color: 0x2fd8c8 });
    for (var i = 0; i < 12; i++) {
      var g = new THREE.Group();
      var l = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 6.5, 8), postMat);
      l.position.set(-4.5, 3.25, 0);
      g.add(l);
      var r = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 6.5, 8), postMat);
      r.position.set(4.5, 3.25, 0);
      g.add(r);
      var top = new THREE.Mesh(new THREE.BoxGeometry(9.6, 0.7, 0.7), topMat);
      top.position.set(0, 6.6, 0);
      g.add(top);
      g.visible = false;
      state.scene.add(g);
      gateMeshes.push(g);
    }
  }

  function showGate(state, gate, idx) {
    buildGateMeshes(state);
    for (var i = 0; i < gateMeshes.length; i++) gateMeshes[i].visible = false;
    var mesh = gateMeshes[idx % gateMeshes.length];
    mesh.visible = true;
    mesh.position.set(gate.x, 0, gate.z);
    var next = active.circuit.gates[(active.gateIdx + 1) % active.circuit.gates.length];
    mesh.rotation.y = Math.atan2(next.x - gate.x, next.z - gate.z);
  }

  function hideGates() {
    for (var i = 0; i < gateMeshes.length; i++) gateMeshes[i].visible = false;
  }

  function startRace(state, circuitId) {
    var circuit = CIRCUITS[circuitId];
    if (!circuit) return false;
    if (!state.player.car) {
      if (state.hud) state.hud.showToast('You need a car to race — press E near one');
      return false;
    }
    buildGateMeshes(state);
    // Rival ghost car: a fast traffic car that follows the gates.
    if (rival) state.scene.remove(rival.mesh);
    rival = Coral.drive.makeCar(state, circuit.start.x + 6, circuit.start.z + 6, 0, 0, 'civil');
    rival.driver = 'rival';
    rival.speed = 0;
    active = {
      circuit: circuit, gateIdx: 0, lap: 1,
      lapStart: state.time || 0, raceStart: state.time || 0,
      bestLap: null, lastLap: null, position: 2,
      rivalGate: 0, rivalLap: 1, countdown: 3,
    };
    state.player.x = circuit.start.x;
    state.player.z = circuit.start.z;
    state.player.car.x = circuit.start.x;
    state.player.car.z = circuit.start.z;
    state.player.car.heading = Math.PI / 2;
    state.player.car.speed = 0;
    showGate(state, circuit.gates[0], 0);
    if (state.hud) {
      state.hud.showToast('RACE — ' + circuit.name + ' · ' + circuit.laps + ' laps');
      state.hud.showRace(circuit, 2, 1);
    }
    if (state.sound) state.sound.countdown();
    return true;
  }

  function quitRace(state, reason) {
    if (!active) return;
    active = null;
    hideGates();
    if (rival) { state.scene.remove(rival.mesh); rival = null; }
    if (state.hud) state.hud.hideRace();
    if (reason && state.hud) state.hud.showToast(reason);
  }

  function finishRace(state, won) {
    var circuit = active.circuit;
    var total = (state.time || 0) - active.raceStart;
    lastResult = won ? 'win' : 'lose';
    lastRace = circuit.id;
    var prize = won ? 1200 + circuit.laps * 400 : 150;
    state.player.cash += prize;
    if (state.hud) {
      state.hud.showToast(won
        ? 'RACE WON — ' + circuit.name + ' · ' + U.fmtTime(total) + ' · +' + U.fmtMoney(prize)
        : 'RACE LOST — ' + circuit.name + ' · +' + U.fmtMoney(prize));
      state.hud.updateCash();
    }
    if (state.sound) state.sound.win();
    state.bestLaps = state.bestLaps || {};
    if (active.bestLap && (!state.bestLaps[circuit.id] || active.bestLap < state.bestLaps[circuit.id])) {
      state.bestLaps[circuit.id] = active.bestLap;
    }
    quitRace(state, '');
  }

  function update(state, dt) {
    if (!active) return;
    var p = state.player;
    if (!p.car) { quitRace(state, 'Race abandoned — you left the car'); return; }
    if (active.countdown > 0) {
      active.countdown -= dt;
      if (active.countdown <= 0 && state.hud) state.hud.showToast('GO!');
      // Hold the car at the line during the countdown.
      p.car.speed = 0;
      return;
    }
    var gate = active.circuit.gates[active.gateIdx];
    var d = U.dist2d(p.x, p.z, gate.x, gate.z);
    if (d < 10) {
      active.gateIdx++;
      if (active.gateIdx >= active.circuit.gates.length) {
        active.gateIdx = 0;
        var lapTime = (state.time || 0) - active.lapStart;
        active.lastLap = lapTime;
        if (!active.bestLap || lapTime < active.bestLap) active.bestLap = lapTime;
        active.lap++;
        active.lapStart = state.time || 0;
        if (state.hud) state.hud.showToast('Lap ' + Math.min(active.lap, active.circuit.laps) +
          '/' + active.circuit.laps + ' · ' + U.fmtTime(lapTime));
        if (active.lap > active.circuit.laps) {
          finishRace(state, active.position === 1);
          return;
        }
      }
      showGate(state, active.circuit.gates[active.gateIdx], active.gateIdx);
    }
    // Rival follows the gates at a steady pace, slightly slower than a
    // good player, so position flips as the player drives well or badly.
    if (rival) {
      var rg = active.circuit.gates[active.rivalGate];
      var rd = U.dist2d(rival.x, rival.z, rg.x, rg.z);
      var desired = Math.atan2(rg.x - rival.x, rg.z - rival.z);
      rival.heading = U.angleLerp(rival.heading, desired, 1 - Math.exp(-3 * dt));
      rival.speed = U.damp(rival.speed, 26, 0.8, dt);
      rival.x += Math.sin(rival.heading) * rival.speed * dt;
      rival.z += Math.cos(rival.heading) * rival.speed * dt;
      rival.mesh.position.set(rival.x, 0, rival.z);
      rival.mesh.rotation.y = rival.heading;
      if (rd < 10) {
        active.rivalGate++;
        if (active.rivalGate >= active.circuit.gates.length) {
          active.rivalGate = 0;
          active.rivalLap++;
          if (active.rivalLap > active.circuit.laps && active.lap <= active.circuit.laps) {
            finishRace(state, false);
            return;
          }
        }
      }
      // Position: whoever is further along the circuit leads.
      var myProg = (active.lap - 1) * active.circuit.gates.length + active.gateIdx;
      var rvProg = (active.rivalLap - 1) * active.circuit.gates.length + active.rivalGate;
      active.position = myProg >= rvProg ? 1 : 2;
    }
    if (state.hud) {
      state.hud.showRace(active.circuit, active.position, active.lap, active.bestLap, active.lastLap);
    }
    // Leaving the circuit area abandons the race.
    if (Math.abs(p.x) > 300 || Math.abs(p.z) > 300) {
      quitRace(state, 'Race abandoned — you left Port Coral');
    }
  }

  function isRacing() { return !!active; }

  return {
    CIRCUITS: CIRCUITS,
    startRace: startRace,
    quitRace: quitRace,
    update: update,
    isRacing: isRacing,
    get lastResult() { return lastResult; },
    get lastRace() { return lastRace; },
    get active() { return active; },
  };
})();

// CORAL HEAT — driving: player car physics, traffic, carjacking.
// Cars are built from boxes (body, cabin, wheels, lights) so every vehicle
// is procedural. Traffic follows the road grid; the player car has arcade
// handling with drift, handbrake and damage smoke.
Coral.drive = (function () {
  'use strict';
  var U = Coral.util;

  var CAR_COLORS = [0xd83a3a, 0x3a7ad8, 0xf2d23d, 0x2fd88a, 0xe8e8e8, 0x222226, 0xff7a2f, 0xb03ad8];
  var CAR_NAMES = ['Coral Comet', 'Marina GT', 'Sunset Coupe', 'Palm Runner', 'Bay Cruiser', 'Neon Phantom', 'Dune Racer', 'Harbor LX'];

  function buildCarMesh(color, kind) {
    var g = new THREE.Group();
    var bodyMat = new THREE.MeshStandardMaterial({ color: color, roughness: 0.35, metalness: 0.6 });
    var glassMat = new THREE.MeshStandardMaterial({ color: 0x101828, roughness: 0.15, metalness: 0.8 });
    var darkMat = new THREE.MeshStandardMaterial({ color: 0x16161c, roughness: 0.9 });
    var body = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.72, 4.6), bodyMat);
    body.position.y = 0.62;
    g.add(body);
    var cabin = new THREE.Mesh(new THREE.BoxGeometry(1.85, 0.62, 2.3), glassMat);
    cabin.position.set(0, 1.22, -0.25);
    g.add(cabin);
    var hood = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.22, 1.1), bodyMat);
    hood.position.set(0, 0.98, 1.75);
    g.add(hood);
    var wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.34, 12);
    wheelGeo.rotateZ(Math.PI / 2);
    var wheels = [];
    var spots = [[-1.0, 1.5], [1.0, 1.5], [-1.0, -1.5], [1.0, -1.5]];
    for (var i = 0; i < 4; i++) {
      var w = new THREE.Mesh(wheelGeo, darkMat);
      w.position.set(spots[i][0], 0.42, spots[i][1]);
      g.add(w);
      wheels.push(w);
    }
    var lightMat = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
    var tailMat = new THREE.MeshBasicMaterial({ color: 0xff2a2a });
    var hl = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.18, 0.12), lightMat);
    hl.position.set(0, 0.72, 2.34);
    g.add(hl);
    var tl = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.18, 0.12), tailMat);
    tl.position.set(0, 0.72, -2.34);
    g.add(tl);
    if (kind === 'taxi') {
      var sign = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.3, 0.5),
        new THREE.MeshBasicMaterial({ color: 0xf2d23d }));
      sign.position.set(0, 1.7, -0.25);
      g.add(sign);
    }
    if (kind === 'cop') {
      var bar = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.18, 0.5),
        new THREE.MeshBasicMaterial({ color: 0xff2a2a }));
      bar.position.set(0, 1.62, -0.25);
      g.add(bar);
    }
    g.userData.wheels = wheels;
    return g;
  }

  function makeCar(state, x, z, heading, colorIdx, kind) {
    var idx = colorIdx === undefined ? U.randi(0, CAR_COLORS.length - 1) : colorIdx;
    var mesh = buildCarMesh(CAR_COLORS[idx], kind || 'civil');
    mesh.position.set(x, 0, z);
    mesh.rotation.y = heading;
    state.scene.add(mesh);
    var car = {
      mesh: mesh,
      x: x, z: z, heading: heading,
      speed: 0,           // m/s forward
      steer: 0,
      health: 100,
      name: CAR_NAMES[idx],
      colorIdx: idx,
      kind: kind || 'civil',
      driver: null,       // 'player' | 'traffic' | 'cop' | null (parked)
      smoke: 0,
      stuckT: 0,
    };
    return car;
  }

  function spawnTraffic(state, count) {
    state.traffic = state.traffic || [];
    for (var i = 0; i < count; i++) {
      var gx = U.randi(-4, 4) * 62 + U.rand(-3, 3);
      var gz = U.randi(-4, 4) * 62 + U.rand(-3, 3);
      var alongX = U.chance(0.5);
      var heading = alongX ? (U.chance(0.5) ? 0 : Math.PI) : (U.chance(0.5) ? Math.PI / 2 : -Math.PI / 2);
      var car = makeCar(state, gx, gz, heading, undefined, U.chance(0.06) ? 'taxi' : 'civil');
      car.driver = 'traffic';
      car.speed = U.rand(7, 13);
      car.cruise = car.speed;
      car.lane = U.rand(-3.2, 3.2);
      state.traffic.push(car);
    }
    return state.traffic;
  }

  function spawnParked(state, count) {
    state.parked = state.parked || [];
    for (var i = 0; i < count; i++) {
      var gx = U.randi(-4, 4) * 62;
      var gz = U.randi(-4, 4) * 62;
      var side = U.pick([[1, 0], [-1, 0], [0, 1], [0, -1]]);
      var x = gx + side[0] * 9.5 + U.rand(-2, 2);
      var z = gz + side[1] * 9.5 + U.rand(-2, 2);
      var heading = side[0] !== 0 ? Math.PI / 2 : 0;
      if (Math.abs(x) > 300 || Math.abs(z) > 180) continue;
      var car = makeCar(state, x, z, heading);
      car.driver = null;
      state.parked.push(car);
    }
    return state.parked;
  }

  function nearestStealable(state, maxDist) {
    var px = state.player.x, pz = state.player.z;
    var best = null, bestD = maxDist;
    var lists = [state.parked || [], state.traffic || []];
    for (var l = 0; l < lists.length; l++) {
      for (var i = 0; i < lists[l].length; i++) {
        var c = lists[l][i];
        if (c.driver === 'player') continue;
        var d = U.dist2d(px, pz, c.x, c.z);
        if (d < bestD) { bestD = d; best = c; }
      }
    }
    return best;
  }

  function enterCar(state, car) {
    if (car.driver === 'traffic') {
      // Pull the driver out: the NPC flees on foot.
      car.driver = null;
      if (state.onCarjack) state.onCarjack(car);
    }
    var pi = state.parked.indexOf(car);
    if (pi >= 0) state.parked.splice(pi, 1);
    var ti = (state.traffic || []).indexOf(car);
    if (ti >= 0) state.traffic.splice(ti, 1);
    car.driver = 'player';
    state.player.car = car;
    state.player.onFoot = false;
    state.player.mesh.visible = false;
    if (state.hud) state.hud.showToast('Now driving — ' + car.name);
    if (state.sound) state.sound.door();
  }

  function exitCar(state) {
    var car = state.player.car;
    if (!car) return;
    car.driver = null;
    car.speed = 0;
    state.parked.push(car);
    state.player.car = null;
    state.player.onFoot = true;
    var px = car.x + Math.sin(car.heading + Math.PI / 2) * 2.4;
    var pz = car.z + Math.cos(car.heading + Math.PI / 2) * 2.4;
    state.player.x = px;
    state.player.z = pz;
    state.player.mesh.visible = true;
    state.player.mesh.position.set(px, 0, pz);
  }

  function updatePlayerCar(state, dt) {
    var car = state.player.car;
    if (!car) return;
    var k = state.keys;
    var accel = 0;
    if (k['KeyW'] || k['ArrowUp']) accel += 1;
    if (k['KeyS'] || k['ArrowDown']) accel -= 0.75;
    var targetSteer = 0;
    if (k['KeyA'] || k['ArrowLeft']) targetSteer += 1;
    if (k['KeyD'] || k['ArrowRight']) targetSteer -= 1;
    car.steer = U.damp(car.steer, targetSteer, 9, dt);
    var top = 52; // ~116 MPH
    var handbrake = k['Space'] ? 1 : 0;
    if (accel > 0) car.speed += 16 * accel * dt * (1 - car.speed / top);
    else if (accel < 0) car.speed += 22 * accel * dt;
    else if (!state.shotMode) car.speed = U.damp(car.speed, 0, 0.7, dt);
    if (handbrake) {
      car.speed = U.damp(car.speed, 0, 3.2, dt);
      car.heading += car.steer * 1.9 * dt * U.clamp(car.speed / 12, -1, 1);
    }
    var grip = 1 - 0.25 * Math.abs(car.steer) * U.clamp(Math.abs(car.speed) / top, 0, 1);
    car.speed *= (1 - 0.12 * (1 - grip) * dt);
    car.heading += car.steer * 1.55 * dt * U.clamp(car.speed / 14, -1, 1) * (car.speed < 0 ? -1 : 1);
    var nx = car.x + Math.sin(car.heading) * car.speed * dt;
    var nz = car.z + Math.cos(car.heading) * car.speed * dt;
    var hit = Coral.city.hitsCollider(nx, nz, 2.2);
    if (hit) {
      car.speed *= -0.25;
      car.health -= Math.abs(car.speed) * 0.4 + 4;
      if (state.fight) state.fight.spark(state, nx, nz, 6);
      nx = car.x; nz = car.z;
      if (state.sound) state.sound.thud();
    }
    nx = U.clamp(nx, -305, 305);
    nz = U.clamp(nz, -305, 305);
    car.x = nx; car.z = nz;
    car.mesh.position.set(nx, 0, nz);
    car.mesh.rotation.y = car.heading;
    car.mesh.rotation.z = -car.steer * 0.06 * U.clamp(car.speed / 20, -1, 1);
    var wheels = car.mesh.userData.wheels || [];
    for (var i = 0; i < wheels.length; i++) wheels[i].rotation.x += car.speed * dt * 2.4;
    if (car.health < 45 && !car.smoke) car.smoke = 1;
    if (car.health <= 0) {
      if (state.fight) state.fight.explode(state, car.x, car.z, 1.4);
      car.health = 100;
      car.speed = 0;
      if (state.hud) state.hud.showToast('Your car is wrecked — find another ride');
    }
    state.player.x = car.x;
    state.player.z = car.z;
    state.player.heading = car.heading;
    state.player.speed = car.speed;
  }

  function updateTraffic(state, dt) {
    var list = state.traffic || [];
    for (var i = list.length - 1; i >= 0; i--) {
      var c = list[i];
      c.speed = U.damp(c.speed, c.cruise || 10, 0.8, dt);
      var nx = c.x + Math.sin(c.heading) * c.speed * dt;
      var nz = c.z + Math.cos(c.heading) * c.speed * dt;
      // Stay on the grid: at an intersection, sometimes turn.
      var nearCross = Math.abs(((nx % 62) + 62) % 62) < 4 || Math.abs(((nz % 62) + 62) % 62) < 4;
      if (nearCross && U.chance(dt * 0.5)) {
        c.heading += U.pick([-Math.PI / 2, Math.PI / 2]);
      }
      if (Math.abs(nx) > 300 || Math.abs(nz) > 300) {
        // Wrap around the far edge so traffic never runs dry.
        c.x = -c.x * 0.95; c.z = -c.z * 0.95;
      } else {
        c.x = nx; c.z = nz;
      }
      // Simple separation from the player car.
      if (state.player.car) {
        var d = U.dist2d(c.x, c.z, state.player.x, state.player.z);
        if (d < 5 && Math.abs(c.speed) > 2) {
          c.speed *= 0.5;
          if (d < 3.2) {
            c.speed = 0;
            c.stuckT += dt;
            if (c.stuckT > 2) { c.heading += Math.PI / 2; c.stuckT = 0; }
          }
        }
      }
      c.mesh.position.set(c.x, 0, c.z);
      c.mesh.rotation.y = c.heading;
      var wheels = c.mesh.userData.wheels || [];
      for (var w = 0; w < wheels.length; w++) wheels[w].rotation.x += c.speed * dt * 2.4;
    }
  }

  return {
    makeCar: makeCar,
    buildCarMesh: buildCarMesh,
    spawnTraffic: spawnTraffic,
    spawnParked: spawnParked,
    nearestStealable: nearestStealable,
    enterCar: enterCar,
    exitCar: exitCar,
    updatePlayerCar: updatePlayerCar,
    updateTraffic: updateTraffic,
    CAR_NAMES: CAR_NAMES,
  };
})();

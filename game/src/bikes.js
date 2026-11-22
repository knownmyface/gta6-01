// CORAL HEAT — motorcycles: 3 models with lean, wheelie and quick handling.
// Bikes are faster off the line than cars but throw the rider on a hard hit.
Coral.bikes = (function () {
  'use strict';
  var U = Coral.util;

  var MODELS = [
    { id: 'scooter', name: 'Bay Scooter 125', top: 34, accel: 14, lean: 0.35 },
    { id: 'sport', name: 'Coral R1 Sport', top: 58, accel: 22, lean: 0.55 },
    { id: 'cruiser', name: 'Sunset Cruiser 900', top: 46, accel: 17, lean: 0.42 },
  ];

  function buildBikeMesh(color, modelId) {
    var g = new THREE.Group();
    var bodyMat = new THREE.MeshStandardMaterial({ color: color, roughness: 0.35, metalness: 0.6 });
    var darkMat = new THREE.MeshStandardMaterial({ color: 0x16161c, roughness: 0.85 });
    var chromeMat = new THREE.MeshStandardMaterial({ color: 0xc8ccd4, roughness: 0.2, metalness: 0.9 });
    var tank = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.5, 1.15), bodyMat);
    tank.position.set(0, 0.85, 0.1);
    g.add(tank);
    var seat = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.18, 0.95), darkMat);
    seat.position.set(0, 0.88, -0.75);
    g.add(seat);
    var fender = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.14, 0.7), bodyMat);
    fender.position.set(0, 0.95, 1.05);
    g.add(fender);
    if (modelId === 'sport') {
      var fairing = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.7, 0.6), bodyMat);
      fairing.position.set(0, 0.95, 1.05);
      fairing.rotation.x = -0.25;
      g.add(fairing);
    }
    if (modelId === 'cruiser') {
      var bars = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.0, 6), chromeMat);
      bars.rotation.z = Math.PI / 2;
      bars.position.set(0, 1.15, 0.85);
      g.add(bars);
    }
    var wheelGeo = new THREE.TorusGeometry(0.36, 0.11, 8, 16);
    var wF = new THREE.Mesh(wheelGeo, darkMat);
    wF.position.set(0, 0.36, 1.15);
    g.add(wF);
    var wR = new THREE.Mesh(wheelGeo, darkMat);
    wR.position.set(0, 0.36, -0.95);
    g.add(wR);
    var lamp = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.16, 0.1),
      new THREE.MeshBasicMaterial({ color: 0xfff2b0 }));
    lamp.position.set(0, 0.95, 1.42);
    g.add(lamp);
    g.userData.wheels = [wF, wR];
    return g;
  }

  function spawnBikes(state) {
    state.bikes = state.bikes || [];
    var spots = [
      { x: 62, z: -124, model: 0 }, { x: -124, z: 62, model: 1 },
      { x: 186, z: 124, model: 2 }, { x: -62, z: -62, model: 1 },
      { x: 0, z: 186, model: 0 },
    ];
    var colors = [0x2fd8c8, 0xd83a3a, 0xf2d23d, 0x3a7ad8, 0xe8e8e8];
    for (var i = 0; i < spots.length; i++) {
      var s = spots[i];
      var mesh = buildBikeMesh(colors[i], MODELS[s.model].id);
      mesh.position.set(s.x, 0, s.z);
      mesh.rotation.y = U.rand(0, Math.PI * 2);
      state.scene.add(mesh);
      state.bikes.push({
        mesh: mesh, x: s.x, z: s.z, heading: mesh.rotation.y,
        speed: 0, model: MODELS[s.model], ridden: false,
      });
    }
    return state.bikes;
  }

  function nearestBike(state, maxDist) {
    var best = null, bestD = maxDist;
    var list = state.bikes || [];
    for (var i = 0; i < list.length; i++) {
      if (list[i].ridden) continue;
      var d = U.dist2d(state.player.x, state.player.z, list[i].x, list[i].z);
      if (d < bestD) { bestD = d; best = list[i]; }
    }
    return best;
  }

  function mountBike(state, bike) {
    bike.ridden = true;
    state.player.bike = bike;
    state.player.onFoot = false;
    state.player.mesh.visible = false;
    // Rider sits on the bike: keep the player mesh hidden, the bike carries us.
    if (state.hud) state.hud.showToast('Riding — ' + bike.model.name);
    if (state.sound) state.sound.door();
  }

  function dismountBike(state) {
    var bike = state.player.bike;
    if (!bike) return;
    bike.ridden = false;
    bike.speed = 0;
    state.player.bike = null;
    state.player.onFoot = true;
    state.player.x = bike.x + 1.5;
    state.player.z = bike.z + 1.5;
    state.player.mesh.visible = true;
    state.player.mesh.position.set(state.player.x, 0, state.player.z);
  }

  function updateBike(state, dt) {
    var bike = state.player.bike;
    if (!bike) return;
    var k = state.keys;
    var accel = 0;
    if (k['KeyW'] || k['ArrowUp']) accel += 1;
    if (k['KeyS'] || k['ArrowDown']) accel -= 0.6;
    var targetSteer = 0;
    if (k['KeyA'] || k['ArrowLeft']) targetSteer += 1;
    if (k['KeyD'] || k['ArrowRight']) targetSteer -= 1;
    var m = bike.model;
    bike.speed += m.accel * accel * dt * (1 - Math.max(0, bike.speed) / m.top);
    if (accel === 0) bike.speed = U.damp(bike.speed, 0, 1.1, dt);
    if (k['Space']) bike.speed = U.damp(bike.speed, 0, 4, dt);
    bike.heading += targetSteer * 2.1 * dt * U.clamp(bike.speed / 12, -1, 1);
    var nx = bike.x + Math.sin(bike.heading) * bike.speed * dt;
    var nz = bike.z + Math.cos(bike.heading) * bike.speed * dt;
    var hit = Coral.city.hitsCollider(nx, nz, 1.1);
    if (hit) {
      // A hard hit throws the rider off.
      if (Math.abs(bike.speed) > 14) {
        if (state.hud) state.hud.showToast('You came off the bike!');
        state.player.health -= 12;
        dismountBike(state);
        if (state.fight) state.fight.spark(state, nx, nz, 8);
        return;
      }
      bike.speed *= -0.2;
      nx = bike.x; nz = bike.z;
    }
    bike.x = U.clamp(nx, -305, 305);
    bike.z = U.clamp(nz, -305, 305);
    bike.mesh.position.set(bike.x, 0, bike.z);
    bike.mesh.rotation.y = bike.heading;
    // Lean into the turn; slight wheelie under hard acceleration.
    bike.mesh.rotation.z = -targetSteer * m.lean * U.clamp(bike.speed / 20, 0, 1);
    bike.mesh.rotation.x = accel > 0 && bike.speed > 8 ? -0.06 : 0;
    var wheels = bike.mesh.userData.wheels || [];
    for (var i = 0; i < wheels.length; i++) wheels[i].rotation.y += bike.speed * dt * 2.6;
    state.player.x = bike.x;
    state.player.z = bike.z;
    state.player.heading = bike.heading;
    state.player.speed = bike.speed;
  }

  return {
    MODELS: MODELS,
    spawnBikes: spawnBikes,
    nearestBike: nearestBike,
    mountBike: mountBike,
    dismountBike: dismountBike,
    updateBike: updateBike,
  };
})();

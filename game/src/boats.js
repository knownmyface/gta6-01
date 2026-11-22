// CORAL HEAT — boats: marina, speedboat physics, police boats.
// The south strip of the city is water (z > 200). Boats bob, carve wakes and
// outrun police boats in missions 21–22. Boarding works like entering a car.
Coral.boats = (function () {
  'use strict';
  var U = Coral.util;

  var BOAT_COLORS = [0xf2f2f2, 0xffd23d, 0x2fe8ff, 0xff5a3d];

  function buildBoatMesh(color, isPolice) {
    var g = new THREE.Group();
    var hullMat = new THREE.MeshStandardMaterial({
      color: isPolice ? 0x1a2a44 : color, roughness: 0.35, metalness: 0.4,
    });
    var hull = new THREE.Mesh(new THREE.BoxGeometry(3.0, 1.0, 8.5), hullMat);
    hull.position.y = 0.5;
    g.add(hull);
    var bow = new THREE.Mesh(new THREE.ConeGeometry(1.5, 2.6, 4), hullMat);
    bow.rotation.x = Math.PI / 2;
    bow.rotation.y = Math.PI / 4;
    bow.scale.set(1, 1, 0.6);
    bow.position.set(0, 0.5, 5.4);
    g.add(bow);
    var cabin = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.1, 3.0),
      new THREE.MeshStandardMaterial({ color: 0x223344, roughness: 0.3, metalness: 0.5 }));
    cabin.position.set(0, 1.5, -0.6);
    g.add(cabin);
    var stripe = new THREE.Mesh(new THREE.BoxGeometry(3.05, 0.22, 8.5),
      new THREE.MeshBasicMaterial({ color: isPolice ? 0xff2a2a : 0xffd23d }));
    stripe.position.y = 0.95;
    g.add(stripe);
    if (isPolice) {
      var bar = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.2, 0.5),
        new THREE.MeshBasicMaterial({ color: 0x2f6aff }));
      bar.position.set(0, 2.2, -0.6);
      g.add(bar);
      g.userData.strobe = bar;
    }
    // Wake: a fading foam plane trailing the stern.
    var wake = new THREE.Mesh(new THREE.PlaneGeometry(4.5, 9),
      new THREE.MeshBasicMaterial({ color: 0xd8f2ff, transparent: true, opacity: 0, depthWrite: false }));
    wake.rotation.x = -Math.PI / 2;
    wake.position.set(0, 0.25, -6.5);
    g.add(wake);
    g.userData.wake = wake;
    return g;
  }

  function makeBoat(state, x, z, heading, colorIdx, isPolice) {
    var mesh = buildBoatMesh(BOAT_COLORS[colorIdx || 0], !!isPolice);
    mesh.position.set(x, 0.3, z);
    mesh.rotation.y = heading;
    state.scene.add(mesh);
    var boat = {
      mesh: mesh, x: x, z: z, heading: heading,
      speed: 0, police: !!isPolice, bobPhase: U.rand(0, 6),
      driver: null,
    };
    return boat;
  }

  function spawnMarinaBoats(state) {
    state.boatsList = state.boatsList || [];
    var spots = [
      { x: -95, z: 255 }, { x: -73, z: 255 }, { x: -51, z: 255 },
      { x: -29, z: 255 }, { x: -7, z: 255 }, { x: 15, z: 255 },
      { x: 120, z: 260 }, { x: 180, z: 265 },
    ];
    for (var i = 0; i < spots.length; i++) {
      var b = makeBoat(state, spots[i].x, spots[i].z, U.rand(-0.2, 0.2), i % BOAT_COLORS.length, false);
      state.boatsList.push(b);
    }
    return state.boatsList;
  }

  function stageGetawayBoat(state) {
    // Mission 21/22: a fast boat waits at the pier, engine running.
    var list = state.boatsList || [];
    for (var i = 0; i < list.length; i++) {
      if (list[i].getaway) return list[i];
    }
    var boat = makeBoat(state, -40, 250, Math.PI, 1, false);
    boat.getaway = true;
    boat.top = 44;
    state.boatsList.push(boat);
    if (state.hud) state.hud.showToast('Getaway boat ready at the pier');
    return boat;
  }

  function nearestBoat(state, maxDist) {
    var best = null, bestD = maxDist;
    var list = state.boatsList || [];
    for (var i = 0; i < list.length; i++) {
      if (list[i].driver === 'player') continue;
      var d = U.dist2d(state.player.x, state.player.z, list[i].x, list[i].z);
      if (d < bestD) { bestD = d; best = list[i]; }
    }
    return best;
  }

  function boardBoat(state, boat) {
    boat.driver = 'player';
    state.player.boat = boat;
    state.player.onFoot = false;
    state.player.mesh.visible = false;
    if (state.hud) state.hud.showToast('Aboard — open the throttle (W)');
    if (state.sound) state.sound.door();
  }

  function leaveBoat(state) {
    var boat = state.player.boat;
    if (!boat) return;
    boat.driver = null;
    boat.speed = 0;
    state.player.boat = null;
    state.player.onFoot = true;
    // Step onto the pier, not into the water.
    state.player.x = boat.x;
    state.player.z = Math.min(boat.z, 238);
    state.player.mesh.visible = true;
    state.player.mesh.position.set(state.player.x, 0, state.player.z);
  }

  function playerInBoat(state) {
    return !!state.player.boat;
  }

  function spawnPoliceBoats(state, count) {
    state.policeBoats = state.policeBoats || [];
    for (var i = 0; i < count; i++) {
      var b = makeBoat(state,
        U.rand(-200, 200), U.rand(300, 360), U.rand(0, Math.PI * 2), 0, true);
      b.driver = 'police';
      state.policeBoats.push(b);
    }
    return state.policeBoats;
  }

  function updateBoats(state, dt, t) {
    var list = state.boatsList || [];
    for (var i = 0; i < list.length; i++) {
      var b = list[i];
      if (b.driver === 'player') continue;
      // Moored boats bob gently.
      b.mesh.position.y = 0.3 + Math.sin(t * 0.8 + b.bobPhase) * 0.14;
      b.mesh.rotation.z = Math.sin(t * 0.6 + b.bobPhase) * 0.015;
      if (b.mesh.userData.wake) b.mesh.userData.wake.material.opacity = 0;
    }
    // Player boat physics.
    var pb = state.player.boat;
    if (pb) {
      var k = state.keys;
      var accel = 0;
      if (k['KeyW'] || k['ArrowUp']) accel += 1;
      if (k['KeyS'] || k['ArrowDown']) accel -= 0.5;
      var steer = 0;
      if (k['KeyA'] || k['ArrowLeft']) steer += 1;
      if (k['KeyD'] || k['ArrowRight']) steer -= 1;
      var top = pb.top || 34;
      pb.speed += 12 * accel * dt * (1 - Math.max(0, pb.speed) / top);
      if (accel === 0 && !state.shotMode) pb.speed = U.damp(pb.speed, 0, 0.8, dt);
      pb.heading += steer * 1.4 * dt * U.clamp(pb.speed / 12, -1, 1);
      pb.x += Math.sin(pb.heading) * pb.speed * dt;
      pb.z += Math.cos(pb.heading) * pb.speed * dt;
      // Stay on the water: push back onto the marina strip.
      if (pb.z < 200) { pb.z = 200; pb.speed *= 0.6; }
      pb.x = U.clamp(pb.x, -430, 430);
      pb.z = U.clamp(pb.z, 200, 460);
      pb.mesh.position.set(pb.x, 0.3 + Math.sin(t * 1.4) * 0.12, pb.z);
      pb.mesh.rotation.y = pb.heading;
      pb.mesh.rotation.z = -steer * 0.1 * U.clamp(pb.speed / 20, 0, 1);
      if (pb.mesh.userData.wake) {
        pb.mesh.userData.wake.material.opacity = U.clamp(Math.abs(pb.speed) / 30, 0, 0.55);
      }
      state.player.x = pb.x;
      state.player.z = pb.z;
      state.player.heading = pb.heading;
      state.player.speed = pb.speed;
      // Spray at speed.
      if (Math.abs(pb.speed) > 20 && U.chance(dt * 20)) {
        if (state.fight) state.fight.burst(state, pb.x, 0.6, pb.z - 4, 0xd8f2ff, 3, 3, 2, 0.7, 0.8);
      }
    }
    // Police boats chase the player boat.
    var pbs = state.policeBoats || [];
    for (var j = pbs.length - 1; j >= 0; j--) {
      var cop = pbs[j];
      var want = state.player.wanted;
      if (want < 2 || !state.player.boat) {
        // No pursuit: drift off and despawn.
        cop.x += Math.sin(cop.heading) * 6 * dt;
        cop.z += Math.cos(cop.heading) * 6 * dt;
        if (U.dist2d(cop.x, cop.z, state.player.x, state.player.z) > 260) {
          state.scene.remove(cop.mesh);
          pbs.splice(j, 1);
        }
        continue;
      }
      var desired = Math.atan2(state.player.x - cop.x, state.player.z - cop.z);
      cop.heading = U.angleLerp(cop.heading, desired, 1 - Math.exp(-2 * dt));
      cop.speed = U.damp(cop.speed, 30 + want, 0.8, dt);
      cop.x += Math.sin(cop.heading) * cop.speed * dt;
      cop.z += Math.cos(cop.heading) * cop.speed * dt;
      cop.mesh.position.set(cop.x, 0.3, cop.z);
      cop.mesh.rotation.y = cop.heading;
      if (cop.mesh.userData.strobe) {
        cop.mesh.userData.strobe.material.color.setHex(
          Math.floor(t * 6) % 2 === 0 ? 0xff2a2a : 0x2f6aff);
      }
      if (cop.mesh.userData.wake) {
        cop.mesh.userData.wake.material.opacity = 0.4;
      }
      // A police boat alongside bumps the player boat.
      if (U.dist2d(cop.x, cop.z, state.player.x, state.player.z) < 5 && pb) {
        pb.speed *= 0.97;
      }
    }
    // Keep 2 police boats on the water while the player is wanted there.
    if (state.player.boat && state.player.wanted >= 2 && pbs.length < 2) {
      spawnPoliceBoats(state, 1);
    }
  }

  return {
    makeBoat: makeBoat,
    spawnMarinaBoats: spawnMarinaBoats,
    stageGetawayBoat: stageGetawayBoat,
    nearestBoat: nearestBoat,
    boardBoat: boardBoat,
    leaveBoat: leaveBoat,
    playerInBoat: playerInBoat,
    spawnPoliceBoats: spawnPoliceBoats,
    updateBoats: updateBoats,
  };
})();

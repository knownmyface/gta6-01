// CORAL HEAT — police: wanted level, patrol cars, helicopter, roadblocks.
// Wanted is synced to the player object every tick (a fix learned from
// earlier rounds). The helicopter orbits LOW and AHEAD of the player so its
// searchlight beam is visible in frame, and roadblocks deploy spike strips
// ahead of the player's direction of travel.
Coral.cops = (function () {
  'use strict';
  var U = Coral.util;

  var MAX_COPS = 6;

  function setWanted(state, level, reason) {
    level = U.clamp(Math.round(level), 0, 5);
    var before = state.player.wanted;
    state.player.wanted = level;
    if (level > before && state.hud) {
      state.hud.showToast('WANTED — ' + level + ' star' + (level > 1 ? 's' : '') +
        (reason ? ' · ' + reason : ''));
      if (state.sound) state.sound.siren(level);
    }
    if (level === 0 && before > 0 && state.hud) {
      state.hud.showToast('You lost the heat — for now');
    }
  }

  function addHeat(state, amount, reason) {
    setWanted(state, state.player.wanted + amount, reason);
  }

  function decayWanted(state, dt) {
    var p = state.player;
    if (p.wanted <= 0) return;
    var nearCop = false;
    var cops = state.cops || [];
    for (var i = 0; i < cops.length; i++) {
      if (U.dist2d(cops[i].x, cops[i].z, p.x, p.z) < 45) { nearCop = true; break; }
    }
    if (state.heli && U.dist2d(state.heli.x, state.heli.z, p.x, p.z) < 60) nearCop = true;
    if (!nearCop) {
      state.heatTimer = (state.heatTimer || 0) + dt;
      if (state.heatTimer > 14) {
        setWanted(state, p.wanted - 1, '');
        state.heatTimer = 0;
      }
    } else {
      state.heatTimer = 0;
    }
  }

  function buildCopCar(state) {
    var car = Coral.drive.makeCar(state, 0, 0, 0, 5, 'cop');
    car.driver = 'cop';
    car.cruise = 30;
    // Light bar strobes.
    var strobe = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.2, 0.45),
      new THREE.MeshBasicMaterial({ color: 0x2f6aff }));
    strobe.position.set(0, 1.62, -0.25);
    car.mesh.add(strobe);
    car.strobe = strobe;
    car.strobeT = 0;
    return car;
  }

  function buildHeli(state) {
    var g = new THREE.Group();
    var bodyMat = new THREE.MeshStandardMaterial({ color: 0x1a2a44, roughness: 0.4, metalness: 0.5 });
    var body = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.6, 5.2), bodyMat);
    g.add(body);
    var glass = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.9, 1.6),
      new THREE.MeshStandardMaterial({ color: 0x9ad8ff, roughness: 0.15, metalness: 0.7 }));
    glass.position.set(0, 0.25, 2.0);
    g.add(glass);
    var tail = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 4.6), bodyMat);
    tail.position.set(0, 0.35, -4.2);
    g.add(tail);
    var rotor = new THREE.Mesh(new THREE.BoxGeometry(9.5, 0.08, 0.5),
      new THREE.MeshStandardMaterial({ color: 0x222226, roughness: 0.6 }));
    rotor.position.y = 1.15;
    g.add(rotor);
    var rotor2 = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.08, 9.5),
      new THREE.MeshStandardMaterial({ color: 0x222226, roughness: 0.6 }));
    rotor2.position.y = 1.15;
    g.add(rotor2);
    // Searchlight: a visible cone + a spotlight aimed at the player.
    var beamGeo = new THREE.ConeGeometry(3.2, 26, 16, 1, true);
    var beamMat = new THREE.MeshBasicMaterial({
      color: 0xfff2b0, transparent: true, opacity: 0.32,
      side: THREE.DoubleSide, depthWrite: false,
    });
    var beam = new THREE.Mesh(beamGeo, beamMat);
    beam.position.y = -13;
    beam.rotation.x = Math.PI;
    g.add(beam);
    var spot = new THREE.SpotLight(0xfff2b0, 220, 90, 0.32, 0.45, 1.2);
    spot.position.set(0, -1, 0);
    g.add(spot);
    g.add(spot.target);
    var pool = new THREE.Mesh(new THREE.CircleGeometry(5.5, 20),
      new THREE.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0.3, depthWrite: false }));
    pool.rotation.x = -Math.PI / 2;
    pool.position.y = 0.15;
    state.scene.add(pool);
    state.scene.add(g);
    var heli = {
      mesh: g, rotor: rotor, rotor2: rotor2, beam: beam, spot: spot, pool: pool,
      x: 0, z: 0, y: 34, orbitA: 0, orbitR: 19,
    };
    state.heli = heli;
    return heli;
  }

  function buildRoadblock(state, x, z, heading) {
    var g = new THREE.Group();
    var stripeMat = new THREE.MeshStandardMaterial({ color: 0xff5a3d, roughness: 0.7 });
    var whiteMat = new THREE.MeshStandardMaterial({ color: 0xe8e8e8, roughness: 0.7 });
    for (var i = -1; i <= 1; i++) {
      var bar = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.8, 0.5),
        i % 2 === 0 ? stripeMat : whiteMat);
      bar.position.set(i * 3.6, 0.6, 0);
      g.add(bar);
      var leg = new THREE.Mesh(new THREE.BoxGeometry(0.3, 1.2, 0.3), whiteMat);
      leg.position.set(i * 3.6, 0.6, 0.5);
      g.add(leg);
    }
    // Spike strip on the road in front of the barrier.
    var spikes = new THREE.Group();
    var spikeMat = new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.9, roughness: 0.3 });
    for (var s = -4; s <= 4; s++) {
      var spike = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.6, 5), spikeMat);
      spike.position.set(s * 0.8, 0.3, 0);
      spikes.add(spike);
    }
    spikes.position.set(0, 0, 3.2);
    g.add(spikes);
    var blink = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 6),
      new THREE.MeshBasicMaterial({ color: 0xff2a2a }));
    blink.position.set(0, 2.0, 0);
    g.add(blink);
    g.position.set(x, 0, z);
    g.rotation.y = heading;
    state.scene.add(g);
    return { mesh: g, x: x, z: z, heading: heading, blink: blink, blinkT: 0, spikes: spikes };
  }

  function deployRoadblock(state) {
    var p = state.player;
    var dir = p.car ? p.car.heading : p.heading;
    var ahead = 34;
    var bx = p.x + Math.sin(dir) * ahead;
    var bz = p.z + Math.cos(dir) * ahead;
    // Snap the block onto the nearest road so it never sits inside a tower.
    var near = Coral.city.nearestRoadPoint(bx, bz);
    if (near.road) {
      if (near.road.along === 'z') bx = near.road.x;
      else bz = near.road.z;
    }
    bx = U.clamp(bx, -290, 290);
    bz = U.clamp(bz, -290, 290);
    var block = buildRoadblock(state, bx, bz, dir + Math.PI / 2);
    state.roadblocks = state.roadblocks || [];
    state.roadblocks.push(block);
    // Two cop cars parked at the block.
    for (var i = -1; i <= 1; i += 2) {
      var cop = buildCopCar(state);
      var ox = bx + Math.cos(dir + Math.PI / 2) * i * 7;
      var oz = bz + Math.sin(dir + Math.PI / 2) * i * 7;
      cop.x = ox; cop.z = oz;
      cop.heading = dir + Math.PI;
      cop.mesh.position.set(ox, 0, oz);
      cop.mesh.rotation.y = cop.heading;
      cop.parked = true;
      state.cops = state.cops || [];
      state.cops.push(cop);
    }
    if (state.hud) state.hud.showToast('ROADBLOCK AHEAD — spike strips deployed');
    return block;
  }

  function ensureForce(state) {
    var want = state.player.wanted;
    state.cops = state.cops || [];
    var target = want === 0 ? 0 : Math.min(MAX_COPS, 1 + want);
    while (state.cops.length < target) {
      var cop = buildCopCar(state);
      var a = U.rand(0, Math.PI * 2);
      var r = U.rand(38, 60);
      cop.x = U.clamp(state.player.x + Math.sin(a) * r, -295, 295);
      cop.z = U.clamp(state.player.z + Math.cos(a) * r, -295, 295);
      cop.mesh.position.set(cop.x, 0, cop.z);
      state.cops.push(cop);
    }
    if (want >= 3 && !state.heli) buildHeli(state);
    if (want < 3 && state.heli) {
      state.scene.remove(state.heli.mesh);
      state.scene.remove(state.heli.pool);
      state.heli = null;
    }
    if (want >= 4 && (!state.roadblocks || state.roadblocks.length === 0)) {
      state.blockTimer = (state.blockTimer || 0) + 1;
      if (state.blockTimer > 2) deployRoadblock(state);
    }
  }

  function updateCops(state, dt, t) {
    ensureForce(state);
    var p = state.player;
    var cops = state.cops || [];
    var want = p.wanted;
    for (var i = cops.length - 1; i >= 0; i--) {
      var cop = cops[i];
      cop.strobeT = (cop.strobeT || 0) + dt;
      if (cop.strobe) {
        cop.strobe.material.color.setHex(Math.floor(cop.strobeT * 6) % 2 === 0 ? 0xff2a2a : 0x2f6aff);
      }
      if (want === 0) {
        // Heat gone: cops drive off and despawn.
        cop.speed = U.damp(cop.speed || 0, 16, 1, dt);
        cop.x += Math.sin(cop.heading) * cop.speed * dt;
        cop.z += Math.cos(cop.heading) * cop.speed * dt;
        if (U.dist2d(cop.x, cop.z, p.x, p.z) > 130) {
          state.scene.remove(cop.mesh);
          cops.splice(i, 1);
        }
        cop.mesh.position.set(cop.x, 0, cop.z);
        cop.mesh.rotation.y = cop.heading;
        continue;
      }
      if (cop.parked) continue;
      // Chase: steer toward the player, faster at higher wanted levels.
      var desired = Math.atan2(p.x - cop.x, p.z - cop.z);
      cop.heading = U.angleLerp(cop.heading, desired, 1 - Math.exp(-2.4 * dt));
      var top = 24 + want * 3.4;
      cop.speed = U.damp(cop.speed || 0, top, 0.9, dt);
      var nx = cop.x + Math.sin(cop.heading) * cop.speed * dt;
      var nz = cop.z + Math.cos(cop.heading) * cop.speed * dt;
      if (!Coral.city.hitsCollider(nx, nz, 2.2)) { cop.x = nx; cop.z = nz; }
      else { cop.heading += 0.6 * dt * 8; cop.speed *= 0.6; }
      cop.mesh.position.set(cop.x, 0, cop.z);
      cop.mesh.rotation.y = cop.heading;
      // Ram: touching the player car damages it and adds heat.
      var d = U.dist2d(cop.x, cop.z, p.x, p.z);
      if (d < 3.4 && p.car) {
        p.car.health -= 14 * dt * 4;
        p.car.speed *= 0.92;
        if (state.fight) state.fight.spark(state, p.x, p.z, 4);
      }
      if (d < 2.2 && p.onFoot) {
        // Busted when cornered on foot at low speed.
        if (state.busted) state.busted(state);
      }
    }
    // Helicopter: low orbit, biased AHEAD of the player so the beam leads.
    if (state.heli) {
      var h = state.heli;
      h.orbitA += dt * 0.55;
      var lead = p.car ? 12 : 4;
      var cx = p.x + Math.sin(p.heading || 0) * lead;
      var cz = p.z + Math.cos(p.heading || 0) * lead;
      h.x = cx + Math.cos(h.orbitA) * h.orbitR;
      h.z = cz + Math.sin(h.orbitA) * h.orbitR;
      h.y = 18 + Math.sin(t * 0.5) * 1.5;
      h.mesh.position.set(h.x, h.y, h.z);
      h.mesh.rotation.y = Math.atan2(p.x - h.x, p.z - h.z);
      h.rotor.rotation.y += dt * 22;
      h.rotor2.rotation.y += dt * 22;
      // Beam + spotlight track the player; the pool follows on the ground.
      var dx = p.x - h.x, dy = 0 - h.y, dz = p.z - h.z;
      var len = Math.sqrt(dx * dx + dy * dy + dz * dz);
      h.beam.lookAt(p.x, 0, p.z);
      h.beam.rotateX(Math.PI / 2);
      h.spot.target.position.set(p.x, 0, p.z);
      h.pool.position.set(p.x, 0.15, p.z);
      var poolScale = 1 + 0.15 * Math.sin(t * 3);
      h.pool.scale.setScalar(poolScale);
      h.pool.material.opacity = 0.24 + 0.08 * Math.sin(t * 3);
    }
    // Roadblock blinkers.
    var blocks = state.roadblocks || [];
    for (var b = 0; b < blocks.length; b++) {
      blocks[b].blinkT += dt;
      blocks[b].blink.material.color.setHex(
        Math.floor(blocks[b].blinkT * 4) % 2 === 0 ? 0xff2a2a : 0xffd23d);
      // Spike strips pop the player's tyres.
      if (p.car) {
        var bd = U.dist2d(p.x, p.z, blocks[b].x, blocks[b].z);
        if (bd < 5 && !blocks[b].tripped) {
          blocks[b].tripped = true;
          p.car.speed *= 0.35;
          p.car.health -= 18;
          if (state.hud) state.hud.showToast('SPIKE STRIP — tyres blown!');
          if (state.sound) state.sound.thud();
        }
      }
    }
  }

  function clearForce(state) {
    var cops = state.cops || [];
    for (var i = 0; i < cops.length; i++) state.scene.remove(cops[i].mesh);
    state.cops = [];
    if (state.heli) {
      state.scene.remove(state.heli.mesh);
      state.scene.remove(state.heli.pool);
      state.heli = null;
    }
    var blocks = state.roadblocks || [];
    for (var j = 0; j < blocks.length; j++) state.scene.remove(blocks[j].mesh);
    state.roadblocks = [];
  }

  return {
    setWanted: setWanted,
    addHeat: addHeat,
    decayWanted: decayWanted,
    deployRoadblock: deployRoadblock,
    buildHeli: buildHeli,
    updateCops: updateCops,
    clearForce: clearForce,
    ensureForce: ensureForce,
    MAX_COPS: MAX_COPS,
  };
})();

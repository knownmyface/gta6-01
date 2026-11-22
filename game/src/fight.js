// CORAL HEAT — combat, weapon wheel, explosions, fire + smoke.
// Particles are pooled meshes (no per-frame allocation in the hot loop):
// a burst spawns, rises, fades and is reused.
Coral.fight = (function () {
  'use strict';
  var U = Coral.util;

  var WEAPONS = [
    { id: 'fists', name: 'Fists', damage: 12, range: 2.4, rate: 0.45, ammo: Infinity, icon: '✊' },
    { id: 'pistol', name: 'P9 Pistol', damage: 26, range: 55, rate: 0.28, ammo: 120, icon: '🔫' },
    { id: 'smg', name: 'Coral SMG', damage: 16, range: 48, rate: 0.09, ammo: 240, icon: '🔫' },
    { id: 'shotgun', name: 'Harbor 12', damage: 70, range: 22, rate: 0.9, ammo: 48, icon: '💥' },
    { id: 'rifle', name: 'Sunset Rifle', damage: 46, range: 90, rate: 0.14, ammo: 150, icon: '🎯' },
    { id: 'molotov', name: 'Molotov', damage: 60, range: 26, rate: 1.1, ammo: 12, icon: '🔥' },
  ];

  var particles = [];
  var tracers = [];

  function ensurePool(state) {
    if (particles.length) return;
    for (var i = 0; i < 260; i++) {
      var m = new THREE.Mesh(
        new THREE.SphereGeometry(0.32, 6, 5),
        new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0 })
      );
      m.visible = false;
      state.scene.add(m);
      particles.push({ mesh: m, life: 0, max: 1, vx: 0, vy: 0, vz: 0, grow: 1 });
    }
  }

  function burst(state, x, y, z, color, count, speed, up, life, size) {
    ensurePool(state);
    var spawned = 0;
    for (var i = 0; i < particles.length && spawned < count; i++) {
      var p = particles[i];
      if (p.life > 0) continue;
      p.life = life * U.rand(0.6, 1.3);
      p.max = p.life;
      var a = U.rand(0, Math.PI * 2);
      var r = U.rand(0.3, 1) * speed;
      p.vx = Math.cos(a) * r;
      p.vz = Math.sin(a) * r;
      p.vy = U.rand(0.2, 1) * up;
      p.grow = size * U.rand(0.7, 1.5);
      p.mesh.visible = true;
      p.mesh.position.set(x, y, z);
      p.mesh.material.color.setHex(color);
      p.mesh.material.opacity = 0.95;
      p.mesh.scale.setScalar(p.grow);
      spawned++;
    }
  }

  function updateParticles(state, dt) {
    for (var i = 0; i < particles.length; i++) {
      var p = particles[i];
      if (p.life <= 0) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.mesh.visible = false;
        p.mesh.material.opacity = 0;
        continue;
      }
      p.vy -= 3.5 * dt;
      p.mesh.position.x += p.vx * dt;
      p.mesh.position.y += p.vy * dt;
      p.mesh.position.z += p.vz * dt;
      if (p.mesh.position.y < 0.1) { p.mesh.position.y = 0.1; p.vy = 0; }
      var f = p.life / p.max;
      p.mesh.material.opacity = f * 0.9;
      p.mesh.scale.setScalar(p.grow * (1.6 - f * 0.6));
    }
    // Tracer lines fade fast.
    for (var j = tracers.length - 1; j >= 0; j--) {
      var tr = tracers[j];
      tr.life -= dt;
      tr.mesh.material.opacity = Math.max(0, tr.life * 4);
      if (tr.life <= 0) {
        state.scene.remove(tr.mesh);
        tracers.splice(j, 1);
      }
    }
  }

  function explode(state, x, z, scale) {
    scale = scale || 1;
    burst(state, x, 1.2, z, 0xff7a2f, 46, 9 * scale, 7, 1.1, 1.6 * scale);
    burst(state, x, 1.6, z, 0xffd23d, 30, 6 * scale, 9, 0.8, 1.2 * scale);
    burst(state, x, 2.2, z, 0x555555, 26, 4 * scale, 5, 2.4, 2.2 * scale);
    burst(state, x, 0.6, z, 0xff2a2a, 20, 12 * scale, 4, 0.6, 1.0 * scale);
    // A brief ground flash so the blast reads on the screenshot.
    var flash = new THREE.PointLight(0xff8a3d, 320, 42, 1.7);
    flash.position.set(x, 3, z);
    state.scene.add(flash);
    setTimeout(function () { state.scene.remove(flash); }, 450);
    if (state.sound) state.sound.boom();
    if (state.shake) state.shake(0.55 * scale);
  }

  function spark(state, x, z, count) {
    burst(state, x, 1.0, z, 0xffd23d, count || 8, 5, 3, 0.5, 0.7);
  }

  function smoke(state, x, y, z, count) {
    burst(state, x, y, z, 0x777777, count || 10, 1.6, 2.2, 2.8, 2.4);
  }

  function muzzle(state, x, y, z) {
    burst(state, x, y, z, 0xfff2b0, 5, 3, 1, 0.16, 0.6);
  }

  function punch(state) {
    var p = state.player;
    var fx = p.x + Math.sin(p.heading) * 1.8;
    var fz = p.z + Math.cos(p.heading) * 1.8;
    // Hit a nearby pedestrian: they fall and the heat rises.
    var peds = state.peds || [];
    for (var i = 0; i < peds.length; i++) {
      if (U.dist2d(peds[i].x, peds[i].z, fx, fz) < 2.2) {
        peds[i].mesh.rotation.x = -Math.PI / 2;
        peds[i].mesh.position.y = 0.3;
        peds[i].pauseT = 6;
        Coral.cops.addHeat(state, 1, 'assault');
        if (state.hud) state.hud.showToast('You knocked a pedestrian down — the cops saw that');
        break;
      }
    }
    if (state.sound) state.sound.swing();
  }

  function currentWeapon(state) {
    return WEAPONS[state.weaponIdx || 0];
  }

  function cycleWeapon(state, dir) {
    var n = WEAPONS.length;
    state.weaponIdx = ((state.weaponIdx || 0) + dir + n) % n;
    var w = currentWeapon(state);
    if (state.hud) state.hud.showToast(w.name + ' equipped');
    if (state.hud) state.hud.updateWeapon(w);
  }

  function fire(state) {
    var p = state.player;
    var w = currentWeapon(state);
    var now = state.time || 0;
    if (state.lastShot && now - state.lastShot < w.rate) return;
    if (w.ammo !== Infinity) {
      state.ammo = state.ammo || {};
      if ((state.ammo[w.id] === undefined ? w.ammo : state.ammo[w.id]) <= 0) {
        if (state.hud) state.hud.showToast(w.name + ' — out of ammo, visit Marina Arms');
        return;
      }
      state.ammo[w.id] = (state.ammo[w.id] === undefined ? w.ammo : state.ammo[w.id]) - 1;
    }
    state.lastShot = now;
    var ox = p.x, oy = p.y + 1.5, oz = p.z;
    var dirX = Math.sin(p.heading), dirZ = Math.cos(p.heading);
    if (p.car) { oy = 1.4; }
    muzzle(state, ox + dirX * 1.2, oy, oz + dirZ * 1.2);
    if (w.id === 'molotov') {
      var tx = ox + dirX * 18, tz = oz + dirZ * 18;
      setTimeout(function () { explode(state, tx, tz, 1.1); }, 650);
      Coral.cops.addHeat(state, 1, 'arson');
    } else {
      // Tracer to the hit point.
      var hitX = ox + dirX * w.range, hitZ = oz + dirZ * w.range;
      var geo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(ox + dirX, oy, oz + dirZ),
        new THREE.Vector3(hitX, oy, hitZ),
      ]);
      var line = new THREE.Line(geo, new THREE.LineBasicMaterial({
        color: 0xfff2b0, transparent: true, opacity: 0.9,
      }));
      state.scene.add(line);
      tracers.push({ mesh: line, life: 0.14 });
      // Cops and cars near the line take damage.
      var cops = state.cops || [];
      for (var i = 0; i < cops.length; i++) {
        if (U.dist2d(cops[i].x, cops[i].z, ox + dirX * 12, oz + dirZ * 12) < 4) {
          cops[i].health = (cops[i].health || 100) - w.damage;
          spark(state, cops[i].x, 1, cops[i].z, 8);
          if (cops[i].health <= 0) {
            explode(state, cops[i].x, cops[i].z, 1.2);
            state.scene.remove(cops[i].mesh);
            cops.splice(i, 1);
            state.player.cash += 50;
          }
          break;
        }
      }
    }
    if (state.sound) state.sound.shot(w.id);
    if (state.hud) state.hud.updateWeapon(w);
    if (p.onFoot && !p.car) Coral.cops.addHeat(state, 0, '');
  }

  function openWeaponWheel(state) {
    state.wheelOpen = true;
    if (state.hud) state.hud.showWheel(WEAPONS, state.weaponIdx || 0);
  }

  function closeWeaponWheel(state, pickIdx) {
    state.wheelOpen = false;
    if (typeof pickIdx === 'number') {
      state.weaponIdx = pickIdx;
      if (state.hud) state.hud.updateWeapon(currentWeapon(state));
    }
    if (state.hud) state.hud.hideWheel();
  }

  return {
    WEAPONS: WEAPONS,
    burst: burst,
    updateParticles: updateParticles,
    explode: explode,
    spark: spark,
    smoke: smoke,
    muzzle: muzzle,
    punch: punch,
    currentWeapon: currentWeapon,
    cycleWeapon: cycleWeapon,
    fire: fire,
    openWeaponWheel: openWeaponWheel,
    closeWeaponWheel: closeWeaponWheel,
  };
})();

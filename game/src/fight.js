// CORAL HEAT — combat and effects. A four-slot weapon wheel (Fists, Pistol,
// SMG, Shotgun), hitscan shooting from the camera centre with a tracer and
// muzzle flash, and a pooled particle system for explosions: fire glow,
// smoke and flying debris. Gunfire and hurting a cop raise the wanted level.
CH.fight = (function () {
  const U = CH.util;
  const WEAPONS = [
    { name: 'Fists', damage: 12, rate: 0.45, range: 3, auto: false },
    { name: 'Pistol', damage: 26, rate: 0.32, range: 70, auto: false },
    { name: 'SMG', damage: 14, rate: 0.09, range: 55, auto: true },
    { name: 'Shotgun', damage: 60, rate: 0.85, range: 26, auto: false },
  ];
  let lastShotAt = 0, flashAt = 0;

  function shoot() {
    const S = CH.S, p = S.player;
    if (S.mode !== 'play' || S.weapon.wheelOpen) return;
    const w = WEAPONS[S.weapon.current];
    if (S.clock - lastShotAt < w.rate) return;
    lastShotAt = S.clock;
    S.stats.shotsFired++;
    CH.sound.shot();
    flashAt = S.clock + 0.06;
    const cam = S.camera;
    const ox = cam.position.x, oy = cam.position.y, oz = cam.position.z;
    const dir = new THREE.Vector3();
    cam.getWorldDirection(dir);
    // Find the nearest hittable thing inside a narrow cone of the aim.
    let best = null, bd = w.range;
    function consider(x, y, z, obj) {
      const dx = x - ox, dy = y - oy, dz = z - oz;
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (d > bd || d < 0.5) return;
      const dot = (dx * dir.x + dy * dir.y + dz * dir.z) / d;
      if (dot > 0.985) { bd = d; best = obj; }
    }
    for (const ped of S.traffic.peds) if (!ped.dead) consider(ped.x, 1.2, ped.z, { kind: 'ped', ref: ped });
    for (const car of S.traffic.cars) if (!car.dead && !car.isPlayer) consider(car.x, 1, car.z, { kind: 'car', ref: car });
    for (const c of S.police.cars) if (!c.dead) consider(c.x, 1, c.z, { kind: 'cop', ref: c });
    const hitX = ox + dir.x * bd, hitY = oy + dir.y * bd, hitZ = oz + dir.z * bd;
    tracer(ox, oy - 0.3, oz, hitX, hitY, hitZ);
    if (best) {
      if (best.kind === 'ped') {
        best.ref.dead = true;
        best.ref.mesh.visible = false;
        CH.cops.addWanted(1);
      } else if (best.kind === 'cop') {
        best.ref.dead = true;
        best.ref.mesh.visible = false;
        CH.cops.addWanted(2);
        explode(best.ref.x, 1, best.ref.z, 0.8);
      } else if (best.kind === 'car') {
        best.ref.dead = true;
        explode(best.ref.x, 1, best.ref.z, 1.4);
        CH.cops.addWanted(1);
      }
    }
    // Fists: a short-range swing with no tracer.
    if (S.weapon.current === 0) {
      const near = S.traffic.peds.find((pd) => !pd.dead && U.dist2(pd.x, pd.z, p.x, p.z) < 3);
      if (near) { near.dead = true; near.mesh.visible = false; CH.cops.addWanted(1); }
    }
  }

  function tracer(x1, y1, z1, x2, y2, z2) {
    const S = CH.S;
    const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(x1, y1, z1), new THREE.Vector3(x2, y2, z2)]);
    const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0.9 }));
    S.scene.add(line);
    S.fx.tracers.push({ line, until: S.clock + 0.09 });
  }

  function explode(x, y, z, scale) {
    const S = CH.S;
    scale = scale || 1;
    // Fire glow light that burns out fast.
    const light = new THREE.PointLight(0xff7722, 3.2, 34 * scale);
    light.position.set(x, y + 2, z);
    S.scene.add(light);
    S.fx.lights.push({ light, until: S.clock + 0.55, base: 3.2 });
    const mat = new THREE.MeshBasicMaterial({ color: 0xffa030 });
    const smokeMat = new THREE.MeshBasicMaterial({ color: 0x555555, transparent: true, opacity: 0.75 });
    for (let i = 0; i < 16; i++) {
      const m = new THREE.Mesh(new THREE.SphereGeometry(U.rand(0.3, 0.7) * scale, 6, 5), i % 3 === 0 ? smokeMat : mat);
      m.position.set(x + U.rand(-1, 1), y + U.rand(0, 1.5), z + U.rand(-1, 1));
      S.scene.add(m);
      S.fx.particles.push({
        mesh: m, vx: U.rand(-7, 7) * scale, vy: U.rand(2, 10) * scale, vz: U.rand(-7, 7) * scale,
        until: S.clock + U.rand(0.5, 1.3), smoke: i % 3 === 0, grow: i % 3 === 0 ? 1.6 : 0,
      });
    }
    CH.sound.explosion();
  }

  function wake(x, z) {
    const S = CH.S;
    const m = new THREE.Mesh(
      new THREE.CircleGeometry(U.rand(0.5, 0.9), 10),
      new THREE.MeshBasicMaterial({ color: 0xdff4ff, transparent: true, opacity: 0.35 })
    );
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, 0.15, z);
    S.scene.add(m);
    S.fx.particles.push({ mesh: m, vx: 0, vy: 0, vz: 0, until: S.clock + 1.1, smoke: true, grow: 1.4, flat: true });
  }
  function sparks(x, z) {
    const S = CH.S;
    for (let i = 0; i < 6; i++) {
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 5), new THREE.MeshBasicMaterial({ color: 0xffd23e }));
      m.position.set(x, 1, z);
      S.scene.add(m);
      S.fx.particles.push({ mesh: m, vx: U.rand(-5, 5), vy: U.rand(1, 5), vz: U.rand(-5, 5), until: S.clock + 0.4, smoke: false, grow: 0 });
    }
  }

  function update(dt) {
    const S = CH.S;
    for (let i = S.fx.particles.length - 1; i >= 0; i--) {
      const pt = S.fx.particles[i];
      if (S.clock > pt.until) { S.scene.remove(pt.mesh); S.fx.particles.splice(i, 1); continue; }
      pt.mesh.position.x += pt.vx * dt;
      pt.mesh.position.y += (pt.vy || 0) * dt;
      pt.mesh.position.z += pt.vz * dt;
      if (pt.smoke && !pt.flat) pt.vy += 2.2 * dt; // smoke rises
      if (pt.grow) pt.mesh.scale.multiplyScalar(1 + pt.grow * dt);
      if (!pt.smoke && pt.mesh.position.y < 0.1) pt.mesh.position.y = 0.1;
      pt.mesh.material.opacity = pt.smoke ? Math.max(0, (pt.until - S.clock) * 0.7) : 1;
    }
    for (let i = S.fx.lights.length - 1; i >= 0; i--) {
      const L = S.fx.lights[i];
      if (S.clock > L.until) { S.scene.remove(L.light); S.fx.lights.splice(i, 1); continue; }
      L.light.intensity = L.base * ((L.until - S.clock) / 0.55);
    }
    for (let i = S.fx.tracers.length - 1; i >= 0; i--) {
      if (S.clock > S.fx.tracers[i].until) { S.scene.remove(S.fx.tracers[i].line); S.fx.tracers.splice(i, 1); }
    }
    // Muzzle flash: a brief warm point light at the camera.
    if (S.clock < flashAt && !S.fx._flash) {
      const f = new THREE.PointLight(0xffc46b, 1.4, 12);
      f.position.copy(S.camera.position);
      S.scene.add(f); S.fx._flash = f;
    } else if (S.clock >= flashAt && S.fx._flash) {
      S.scene.remove(S.fx._flash); S.fx._flash = null;
    }
  }

  function openWheel(on) {
    CH.S.weapon.wheelOpen = on;
    CH.hud.renderWheel();
  }
  function selectWeapon(i) {
    if (i >= 0 && i < WEAPONS.length) {
      CH.S.weapon.current = i;
      CH.hud.renderWheel();
      CH.hud.toast('WEAPON: ' + WEAPONS[i].name.toUpperCase());
    }
  }

  // Boats and cops call these through the shared fx bucket.
  CH.fx.wake = wake;
  CH.fx.sparks = sparks;
  CH.fx.explode = explode;

  return { WEAPONS, shoot, explode, wake, sparks, update, openWheel, selectWeapon };
})();

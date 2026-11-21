// CORAL HEAT — on foot. The player walks the city with WASD, the camera
// rides directly behind, and pedestrians wander the sidewalks. The player
// mesh is a simple two-tone figure; what matters is that it reads clearly
// at screenshot distance and never clips through a building.
CH.walk = (function () {
  const U = CH.util;

  function makePersonMesh(shirt, pants, skin) {
    const g = new THREE.Group();
    const mat = (c) => new THREE.MeshLambertMaterial({ color: c });
    const legs = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.75, 0.3), mat(pants));
    legs.position.y = 0.38; g.add(legs);
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.8, 0.36), mat(shirt));
    torso.position.y = 1.15; g.add(torso);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 8), mat(skin));
    head.position.y = 1.8; g.add(head);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.14, 0.5), mat(0x22304a));
    cap.position.y = 2.0; g.add(cap);
    g.userData = { legs, torso, head };
    return g;
  }

  function makePlayer() {
    const mesh = makePersonMesh(0xff5a3c, 0x2a3550, 0xe8b98a);
    // A coral-red jacket so the player is findable in a crowd.
    mesh.userData.torso.material = new THREE.MeshLambertMaterial({ color: 0xff5a3c });
    return mesh;
  }

  function update(dt) {
    const S = CH.S, p = S.player;
    if (!p || p.inCar || p.inBoat) return;
    const k = S.input.keys;
    let fx = 0, fz = 0;
    if (k.KeyW) fz += 1;
    if (k.KeyS) fz -= 1;
    if (k.KeyA) fx -= 1;
    if (k.KeyD) fx += 1;
    // Mouse steers the heading; WASD moves relative to it.
    p.heading += (S.input.mouseDX || 0) * 0.0032;
    S.input.mouseDX = 0;
    const moving = fx !== 0 || fz !== 0;
    const run = k.ShiftLeft || k.ShiftRight;
    const speed = moving ? (run ? 7.5 : 4.2) : 0;
    const sin = Math.sin(p.heading), cos = Math.cos(p.heading);
    const mx = (sin * fz + cos * fx) * speed * dt;
    const mz = (cos * fz - sin * fx) * speed * dt;
    const hit = CH.city.collide(p.x + mx, p.z + mz, 0.7);
    p.x = U.clamp(hit.x, CH.CFG.cityMin, CH.CFG.cityMax);
    p.z = U.clamp(hit.z, CH.CFG.cityMin, CH.CFG.waterZ - 1);
    p.speed = speed;
    p.moving = moving;
    // Walk bob + facing.
    const m = p.mesh;
    if (m) {
      m.visible = true;
      m.position.set(p.x, Math.abs(Math.sin(S.clock * 11)) * 0.06, p.z);
      m.rotation.y = p.heading;
      m.userData.legs.rotation.x = moving ? Math.sin(S.clock * 11) * 0.55 : 0;
      m.userData.torso.rotation.x = moving ? 0.08 : 0;
    }
  }

  function spawnPeds(scene, count) {
    const S = CH.S;
    const shirts = [0x3a7bd5, 0xe8b13c, 0x7a3cd5, 0x3cd5a0, 0xd53c5a, 0xdddddd, 0x2a2a2a];
    for (let i = 0; i < count; i++) {
      const x = U.rand(-280, 280), z = U.rand(-280, 280);
      const mesh = makePersonMesh(U.pick(shirts), 0x2a2f3a, U.pick([0xe8b98a, 0xc98a5a, 0x8a5a3a, 0xf0c8a0]));
      mesh.position.set(x, 0, z);
      scene.add(mesh);
      S.traffic.peds.push({
        x, z, heading: U.rand(0, Math.PI * 2), speed: U.rand(0.8, 1.6),
        mesh, turnAt: 0, dead: false, scared: false,
      });
    }
  }

  function updatePeds(dt) {
    const S = CH.S;
    for (const ped of S.traffic.peds) {
      if (ped.dead) continue;
      // Flee from gunfire or a speeding car nearby.
      const pd = U.dist2(ped.x, ped.z, S.player.x, S.player.z);
      if (S.player.inCar && S.player.speed > 8 && pd < 9) ped.scared = true;
      if (ped.scared) {
        ped.heading = Math.atan2(ped.x - S.player.x, ped.z - S.player.z);
        ped.speed = 3.4;
        if (pd > 30) ped.scared = false;
      } else if (S.clock > ped.turnAt) {
        ped.heading += U.rand(-1.2, 1.2);
        ped.turnAt = S.clock + U.rand(2, 6);
      }
      const nx = ped.x + Math.sin(ped.heading) * ped.speed * dt;
      const nz = ped.z + Math.cos(ped.heading) * ped.speed * dt;
      const hit = CH.city.collide(nx, nz, 0.6);
      ped.x = U.clamp(hit.x, CH.CFG.cityMin, CH.CFG.cityMax);
      ped.z = U.clamp(hit.z, CH.CFG.cityMin, CH.CFG.waterZ - 1);
      ped.mesh.position.set(ped.x, Math.abs(Math.sin(S.clock * 9 + ped.heading * 7)) * 0.05, ped.z);
      ped.mesh.rotation.y = ped.heading;
      ped.mesh.userData.legs.rotation.x = Math.sin(S.clock * 9 + ped.heading * 7) * 0.5;
    }
  }

  return { makePlayer, makePersonMesh, update, spawnPeds, updatePeds };
})();

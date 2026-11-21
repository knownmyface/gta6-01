// CORAL HEAT — the city: Coral Bay, a sunset coastal marina city.
// A 60 m road grid, block interiors filled with lit-window towers, a neon
// casino district in the north-west, a marina-front boulevard and pier on
// the bay to the south, palms, a gradient sky with sun glare and drifting
// clouds. Nothing sits on a road: buildings are inset from every centreline.
CH.city = (function () {
  const U = CH.util;
  const buildings = []; // {minX,maxX,minZ,maxZ} collision boxes
  let water = null, clouds = [], sunGlow = null, casinoLights = [];
  const CASINO = { x0: -270, x1: -60, z0: -270, z1: -60 };
  const PIER = { x: 0, z0: 300, z1: 372 };

  function canvasTexture(w, h, draw) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c);
    return t;
  }
  function facadeTexture(base, lit) {
    return canvasTexture(128, 256, (g, w, h) => {
      g.fillStyle = base; g.fillRect(0, 0, w, h);
      for (let y = 10; y < h - 12; y += 22) {
        for (let x = 10; x < w - 12; x += 20) {
          const on = Math.random() < 0.55;
          g.fillStyle = on ? lit : '#20242e';
          g.fillRect(x, y, 12, 14);
        }
      }
    });
  }
  function neonTexture(text, color, bg) {
    return canvasTexture(512, 128, (g, w, h) => {
      g.fillStyle = bg; g.fillRect(0, 0, w, h);
      g.font = 'bold 64px Arial, sans-serif';
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.shadowColor = color; g.shadowBlur = 26;
      g.fillStyle = color;
      g.fillText(text, w / 2, h / 2);
      g.shadowBlur = 6; g.fillStyle = '#ffffff';
      g.fillText(text, w / 2, h / 2);
    });
  }
  function roadTexture() {
    return canvasTexture(128, 128, (g, w, h) => {
      g.fillStyle = '#33363d'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#f5d76e'; g.fillRect(w / 2 - 2, 8, 4, 44);
      g.fillStyle = '#f5d76e'; g.fillRect(w / 2 - 2, 72, 4, 44);
      g.fillStyle = '#3d4048';
      for (let i = 0; i < 40; i++) g.fillRect(Math.random() * w, Math.random() * h, 3, 2);
    });
  }

  function build(scene) {
    const S = CH.S;
    S.rng = U.mulberry32(S.seed);
    // --- lights & sky -----------------------------------------------------
    scene.background = new THREE.Color(0x2e4a6b);
    scene.fog = new THREE.Fog(0xd98a4e, 180, 720);
    const hemi = new THREE.HemisphereLight(0xffd9a0, 0x2a3a4a, 0.85);
    scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xffb36b, 1.6);
    sun.position.set(-180, 140, -260);
    scene.add(sun);
    // Sky dome: gradient shell, sunset orange low, dusk blue high.
    const skyGeo = new THREE.SphereGeometry(760, 24, 14);
    const skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: { top: { value: new THREE.Color(0x27365e) }, mid: { value: new THREE.Color(0xe07b39) }, low: { value: new THREE.Color(0xffc27a) } },
      vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'varying vec3 vP; uniform vec3 top; uniform vec3 mid; uniform vec3 low; void main(){ float h = normalize(vP).y; vec3 c = h > 0.12 ? mix(mid, top, smoothstep(0.12, 0.65, h)) : mix(low, mid, smoothstep(-0.08, 0.12, h)); gl_FragColor = vec4(c, 1.0); }',
    });
    scene.add(new THREE.Mesh(skyGeo, skyMat));
    // Sun disc + glare, low over the bay so the cover shot glows.
    const sunDisc = new THREE.Mesh(
      new THREE.CircleGeometry(34, 32),
      new THREE.MeshBasicMaterial({ color: 0xffdf8a, fog: false })
    );
    sunDisc.position.set(-260, 96, -640); sunDisc.lookAt(0, 60, 0);
    scene.add(sunDisc);
    sunGlow = new THREE.Mesh(
      new THREE.CircleGeometry(90, 32),
      new THREE.MeshBasicMaterial({ color: 0xff9a4d, transparent: true, opacity: 0.28, fog: false })
    );
    sunGlow.position.set(-260, 96, -645); sunGlow.lookAt(0, 60, 0);
    scene.add(sunGlow);
    // Clouds: flat translucent puffs drifting slowly.
    const cloudMat = new THREE.MeshBasicMaterial({ color: 0xffd9b0, transparent: true, opacity: 0.55, fog: false });
    for (let i = 0; i < 14; i++) {
      const g = new THREE.Group();
      for (let j = 0; j < 3; j++) {
        const s = new THREE.Mesh(new THREE.SphereGeometry(U.rand(14, 26), 8, 6), cloudMat);
        s.scale.y = 0.35; s.position.set(j * 18 - 18, U.rand(-2, 2), U.rand(-6, 6));
        g.add(s);
      }
      g.position.set(U.rand(-500, 500), U.rand(120, 190), U.rand(-550, 200));
      scene.add(g); clouds.push(g);
    }

    // --- ground, roads, beach, water --------------------------------------
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(900, 900),
      new THREE.MeshLambertMaterial({ color: 0x4a5244 })
    );
    ground.rotation.x = -Math.PI / 2; ground.position.set(0, -0.1, 40);
    scene.add(ground);
    const rt = roadTexture(); rt.wrapS = rt.wrapT = THREE.RepeatWrapping;
    const roadMat = new THREE.MeshLambertMaterial({ map: rt });
    const C = CH.CFG;
    for (let v = C.cityMin; v <= C.cityMax; v += C.roadStep) {
      const rx = new THREE.Mesh(new THREE.PlaneGeometry(C.cityMax - C.cityMin + 14, 14), roadMat.clone());
      rx.material.map = rt.clone(); rx.material.map.repeat.set(11, 1); rx.material.map.needsUpdate = true;
      rx.rotation.x = -Math.PI / 2; rx.position.set(0, 0, v); scene.add(rx);
      const rz = new THREE.Mesh(new THREE.PlaneGeometry(14, C.waterZ - C.cityMin + 14), roadMat.clone());
      rz.material.map = rt.clone(); rz.material.map.repeat.set(1, 11); rz.material.map.needsUpdate = true;
      rz.rotation.x = -Math.PI / 2; rz.position.set(v, 0, (C.waterZ + C.cityMin) / 2); scene.add(rz);
    }
    // Marina-front boulevard + sand strip.
    const beach = new THREE.Mesh(new THREE.PlaneGeometry(700, 30), new THREE.MeshLambertMaterial({ color: 0xc9a86a }));
    beach.rotation.x = -Math.PI / 2; beach.position.set(0, 0.02, 285); scene.add(beach);
    water = new THREE.Mesh(
      new THREE.PlaneGeometry(860, 160),
      new THREE.MeshLambertMaterial({ color: 0x1e6f8e, transparent: true, opacity: 0.92 })
    );
    water.rotation.x = -Math.PI / 2; water.position.set(0, 0.05, 380);
    scene.add(water);
    // The pier: planks out into the bay, moored boats alongside.
    const pierMat = new THREE.MeshLambertMaterial({ color: 0x7a5c38 });
    const pier = new THREE.Mesh(new THREE.BoxGeometry(16, 1.2, 76), pierMat);
    pier.position.set(PIER.x, 0.6, (PIER.z0 + PIER.z1) / 2); scene.add(pier);
    buildings.push({ minX: PIER.x - 8, maxX: PIER.x + 8, minZ: PIER.z0, maxZ: PIER.z1, pier: true });
    for (let i = 0; i < 5; i++) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 4, 6), pierMat);
      post.position.set(PIER.x + (i % 2 ? 8 : -8), 1.5, PIER.z0 + 8 + i * 14);
      scene.add(post);
    }

    // --- buildings ---------------------------------------------------------
    const boxGeo = new THREE.BoxGeometry(1, 1, 1);
    const facades = [
      facadeTexture('#5a4a52', '#ffd27a'),
      facadeTexture('#46586a', '#ffe9a8'),
      facadeTexture('#6a5a44', '#ffb36b'),
      facadeTexture('#3e4a5a', '#9fd8ff'),
    ];
    const roofMat = new THREE.MeshLambertMaterial({ color: 0x2c2f36 });
    const casinoNames = ['CORAL PALMS', 'NEON REEF', 'SUNSET STRIP', 'REEF HOTEL', 'PALM COURT'];
    const neonColors = ['#ff2d95', '#22e6ff', '#ffd23e', '#7CFC66', '#ff7a1a'];
    let neonIdx = 0;
    for (let bx = C.cityMin; bx < C.cityMax; bx += C.roadStep) {
      for (let bz = C.cityMin; bz < C.waterZ - C.roadStep; bz += C.roadStep) {
        // The casino block is reserved for the big casino building below.
        if (bx === -180 && bz === -180) continue;
        const inCasino = bx >= CASINO.x0 && bx < CASINO.x1 && bz >= CASINO.z0 && bz < CASINO.z1;
        const n = inCasino ? 2 : (S.rng() < 0.6 ? 2 : 1);
        for (let k = 0; k < n; k++) {
          const w = U.rand(15, 22), d = U.rand(15, 22);
          const h = inCasino ? U.rand(26, 58) : U.rand(9, 30);
          const cx = bx + C.roadStep / 2 + (k === 0 ? -10 : 10) + U.rand(-3, 3);
          const cz = bz + C.roadStep / 2 + (k === 0 ? -10 : 10) + U.rand(-3, 3);
          const mat = new THREE.MeshLambertMaterial({ map: facades[Math.floor(S.rng() * facades.length)] });
          const b = new THREE.Mesh(boxGeo, mat);
          b.scale.set(w, h, d);
          b.position.set(cx, h / 2, cz);
          scene.add(b);
          const roof = new THREE.Mesh(boxGeo, roofMat);
          roof.scale.set(w + 0.6, 0.8, d + 0.6); roof.position.set(cx, h + 0.4, cz);
          scene.add(roof);
          buildings.push({ minX: cx - w / 2, maxX: cx + w / 2, minZ: cz - d / 2, maxZ: cz + d / 2 });
          if (inCasino && neonIdx < casinoNames.length) {
            const name = casinoNames[neonIdx];
            const color = neonColors[neonIdx % neonColors.length];
            neonIdx++;
            // Neon faces the street to the SOUTH, so a driver heading north
            // into the district reads it head-on.
            const sign = new THREE.Mesh(
              new THREE.PlaneGeometry(30, 7.5),
              new THREE.MeshBasicMaterial({ map: neonTexture(name, color, '#12081f'), transparent: false })
            );
            sign.position.set(cx, h * 0.82, cz + d / 2 + 0.3);
            scene.add(sign);
            const glow = new THREE.PointLight(new THREE.Color(color), 0.9, 70);
            glow.position.set(cx, h * 0.8, cz + d / 2 + 6);
            scene.add(glow); casinoLights.push(glow);
            // Lit ground-floor windows: a warm strip along the base.
            const strip = new THREE.Mesh(
              new THREE.PlaneGeometry(w * 0.9, 3),
              new THREE.MeshBasicMaterial({ color: 0xffc46b })
            );
            strip.position.set(cx, 2.2, cz + d / 2 + 0.2);
            scene.add(strip);
          }
        }
      }
    }
    // The enterable casino building: wide, low, gold-trimmed, set back off
    // the x=-180 boulevard inside its own block (never across a road).
    const casino = new THREE.Mesh(boxGeo, new THREE.MeshLambertMaterial({ map: facades[1] }));
    casino.scale.set(44, 18, 30); casino.position.set(-150, 9, -150); scene.add(casino);
    buildings.push({ minX: -172, maxX: -128, minZ: -165, maxZ: -135 });
    const casinoSign = new THREE.Mesh(
      new THREE.PlaneGeometry(40, 10),
      new THREE.MeshBasicMaterial({ map: neonTexture('CORAL PALMS CASINO', '#ff2d95', '#160a24') })
    );
    casinoSign.position.set(-150, 15, -134.7);
    scene.add(casinoSign);

    // --- palms along the boulevard and the casino strip --------------------
    const trunkMat = new THREE.MeshLambertMaterial({ color: 0x6b4a2a });
    const frondMat = new THREE.MeshLambertMaterial({ color: 0x2f7a3d, side: THREE.DoubleSide });
    function palm(x, z) {
      const g = new THREE.Group();
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.55, 7, 6), trunkMat);
      trunk.position.y = 3.5; trunk.rotation.z = 0.08; g.add(trunk);
      // One flattened cone reads as the frond canopy at street distance.
      const canopy = new THREE.Mesh(new THREE.ConeGeometry(2.7, 1.6, 7), frondMat);
      canopy.position.y = 7.2; canopy.scale.y = 0.55; g.add(canopy);
      g.position.set(x, 0, z); scene.add(g);
    }
    for (let x = -280; x <= 280; x += 40) { palm(x + 9, 292); palm(x - 9, 292); }
    for (let z = -260; z <= -80; z += 45) { palm(-172, z); palm(-248, z); }

    // --- streetlights ------------------------------------------------------
    const poleMat = new THREE.MeshLambertMaterial({ color: 0x22242a });
    const lampMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
    for (let v = -240; v <= 240; v += 60) {
      for (const [x, z] of [[v, -8], [v, 8]]) {
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 6, 6), poleMat);
        pole.position.set(x, 3, z); scene.add(pole);
        const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 6), lampMat);
        lamp.position.set(x, 6.2, z); scene.add(lamp);
      }
    }
  }

  function collide(x, z, r) {
    // Push a circle out of every building AABB it overlaps. Returns a fresh
    // {x, z}; the pier counts as solid, the water does not.
    let nx = x, nz = z;
    for (let i = 0; i < buildings.length; i++) {
      const b = buildings[i];
      if (nx + r < b.minX || nx - r > b.maxX || nz + r < b.minZ || nz - r > b.maxZ) continue;
      const dxl = nx + r - b.minX, dxr = b.maxX - (nx - r);
      const dzl = nz + r - b.minZ, dzr = b.maxZ - (nz - r);
      const m = Math.min(dxl, dxr, dzl, dzr);
      if (m === dxl) nx = b.minX - r;
      else if (m === dxr) nx = b.maxX + r;
      else if (m === dzl) nz = b.minZ - r;
      else nz = b.maxZ + r;
    }
    return { x: nx, z: nz };
  }
  function update(dt) {
    for (let i = 0; i < clouds.length; i++) {
      clouds[i].position.x += dt * 1.5;
      if (clouds[i].position.x > 560) clouds[i].position.x = -560;
    }
    if (water) water.position.y = 0.05 + Math.sin(CH.S.clock * 0.7) * 0.08;
    for (let i = 0; i < casinoLights.length; i++) {
      casinoLights[i].intensity = 0.75 + Math.sin(CH.S.clock * 3 + i * 1.7) * 0.25;
    }
  }
  return { build, collide, buildings, CASINO, PIER, update };
})();

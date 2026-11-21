// Coral Heat — Coral Bay city builder: sunset coastal marina city, neon casino
// district, beach, marina, palms, sky with sun + clouds. Fresh write, round 7.
import * as THREE from 'three';
import { rand, randi, pick, textTexture } from './util.js';

export const CITY = {
  half: 260,          // playable ground half-size
  roadStep: 52,       // grid spacing
  roadHalf: 7,        // half road width
  marinaZ: 205,       // marina / water line (south)
  casino: { x: 150, z: -150 }, // neon casino district centre
  beachX: -250,       // ocean / beach line (west)
};

const PALETTE = [0xff8c5a, 0xffb36b, 0x7dd3fc, 0xf472b6, 0xfde68a, 0x93c5fd, 0xfca5a5, 0x86efac];

export function buildCity(scene) {
  const colliders = [];   // {x,z,hx,hz} AABBs for buildings
  const buildings = [];
  const palms = [];
  const signs = [];
  const boatsMoored = [];

  // --- ground: warm sand/asphalt base ---
  const groundMat = new THREE.MeshLambertMaterial({ color: 0x8a7a5e });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(620, 620), groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, 0, 20);
  scene.add(ground);

  // grass park patches
  const grassMat = new THREE.MeshLambertMaterial({ color: 0x3f7d4a });
  for (const [gx, gz, gw, gd] of [[-78, 26, 34, 34], [26, 130, 40, 30], [-130, -78, 30, 40], [130, 78, 36, 30]]) {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(gw, gd), grassMat);
    p.rotation.x = -Math.PI / 2; p.position.set(gx, 0.02, gz);
    scene.add(p);
  }

  // --- roads: grid strips + centre dashes ---
  const roadMat = new THREE.MeshLambertMaterial({ color: 0x2b2f38 });
  const dashMat = new THREE.MeshBasicMaterial({ color: 0xf8d34a });
  const roadMeshes = [];
  for (let i = -4; i <= 4; i++) {
    const c = i * CITY.roadStep;
    const v = new THREE.Mesh(new THREE.PlaneGeometry(CITY.roadHalf * 2, 540), roadMat);
    v.rotation.x = -Math.PI / 2; v.position.set(c, 0.03, 0);
    scene.add(v); roadMeshes.push(v);
    const h = new THREE.Mesh(new THREE.PlaneGeometry(540, CITY.roadHalf * 2), roadMat);
    h.rotation.x = -Math.PI / 2; h.position.set(0, 0.03, c);
    scene.add(h); roadMeshes.push(h);
    for (let d = -240; d <= 240; d += 24) {
      const dash = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 5), dashMat);
      dash.rotation.x = -Math.PI / 2; dash.position.set(c, 0.05, d);
      scene.add(dash);
    }
  }

  // --- ocean (west) + marina water (south) ---
  const waterMat = new THREE.MeshLambertMaterial({ color: 0x1d6f8e, transparent: true, opacity: 0.92 });
  const ocean = new THREE.Mesh(new THREE.PlaneGeometry(120, 620), waterMat);
  ocean.rotation.x = -Math.PI / 2; ocean.position.set(-310, 0.04, 20);
  scene.add(ocean);
  const marinaWater = new THREE.Mesh(new THREE.PlaneGeometry(620, 90), waterMat);
  marinaWater.rotation.x = -Math.PI / 2; marinaWater.position.set(0, 0.04, 265);
  scene.add(marinaWater);
  // beach strip
  const sandMat = new THREE.MeshLambertMaterial({ color: 0xe8cf9a });
  const beach = new THREE.Mesh(new THREE.PlaneGeometry(36, 620), sandMat);
  beach.rotation.x = -Math.PI / 2; beach.position.set(-262, 0.05, 20);
  scene.add(beach);

  // --- buildings: fill blocks between roads ---
  const winMat = new THREE.MeshBasicMaterial({ color: 0xffd166 });
  const winMatCool = new THREE.MeshBasicMaterial({ color: 0x7dd3fc });
  const neonMats = [
    new THREE.MeshBasicMaterial({ color: 0xff2fd6 }),
    new THREE.MeshBasicMaterial({ color: 0x00e5ff }),
    new THREE.MeshBasicMaterial({ color: 0xffd166 }),
    new THREE.MeshBasicMaterial({ color: 0x7CFC00 }),
  ];
  function addBuilding(x, z, w, d, h, opts = {}) {
    const col = opts.color ?? pick(PALETTE);
    const mat = new THREE.MeshLambertMaterial({ color: col, emissive: opts.emissive ?? 0x000000, emissiveIntensity: opts.glow ? 0.55 : 0 });
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    b.position.set(x, h / 2, z);
    scene.add(b);
    buildings.push(b);
    colliders.push({ x, z, hx: w / 2 + 0.4, hz: d / 2 + 0.4 });
    // lit windows: small emissive planes on the faces
    const rows = Math.max(1, Math.floor(h / 7));
    const cols = Math.max(1, Math.floor(w / 6));
    const wm = Math.random() < 0.5 ? winMat : winMatCool;
    for (let r = 0; r < rows; r++) {
      for (let cI = 0; cI < cols; cI++) {
        if (Math.random() < 0.45) continue;
        const win = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 2.6), wm);
        win.position.set(x - w / 2 + 3 + cI * 6, 4 + r * 7, z + d / 2 + 0.06);
        scene.add(win);
      }
    }
    // roof neon trim on tall buildings
    if (h > 26 && Math.random() < 0.7) {
      const trim = new THREE.Mesh(new THREE.BoxGeometry(w + 0.6, 0.5, d + 0.6), pick(neonMats));
      trim.position.set(x, h + 0.3, z);
      scene.add(trim);
    }
    return b;
  }
  for (let gx = -4; gx <= 4; gx++) {
    for (let gz = -4; gz <= 4; gz++) {
      const bx = gx * CITY.roadStep + 26;
      const bz = gz * CITY.roadStep + 26;
      if (bz > 170) continue;              // marina strip, no buildings
      if (bx < -235) continue;             // beach strip
      if (gx >= 2 && gz <= -2) continue;   // casino district handled below
      if (Math.random() < 0.18) continue;  // empty lots / parks
      const n = randi(1, 2);
      for (let k = 0; k < n; k++) {
        const ox = k === 0 ? -8 : 9, oz = k === 0 ? -8 : 9;
        addBuilding(bx + ox, bz + oz, rand(12, 18), rand(12, 18), rand(10, 42));
      }
    }
  }

  // --- NEON CASINO DISTRICT (north-east): lit signage, casino towers ---
  const casinoDefs = [
    { name: 'CORAL CROWN', sub: 'CASINO • HOTEL', x: 150, z: -150, w: 46, h: 52, fg: '#ff2fd6', glow: '#ff2fd6' },
    { name: 'NEON PALMS', sub: 'SLOTS • POKER', x: 196, z: -150, w: 34, h: 34, fg: '#00e5ff', glow: '#00e5ff' },
    { name: 'GOLDEN REEF', sub: 'HIGH ROLLER', x: 150, z: -104, w: 38, h: 40, fg: '#ffd166', glow: '#ffb703' },
  ];
  const casinoBuildings = [];
  for (const cd of casinoDefs) {
    const b = addBuilding(cd.x, cd.z, cd.w, 26, cd.h, { color: 0x2a1a3a, emissive: 0x1a0b2e, glow: true });
    casinoBuildings.push(b);
    const tex = textTexture(THREE, cd.name, { fg: cd.fg, glow: cd.glow, sub: cd.sub, w: 1024, h: 220, size: 92 });
    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(cd.w + 6, 9),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide })
    );
    sign.position.set(cd.x, 14, cd.z + 14);
    scene.add(sign); signs.push(sign);
    // neon base strip
    const strip = new THREE.Mesh(new THREE.BoxGeometry(cd.w + 2, 1.2, 1), pick(neonMats));
    strip.position.set(cd.x, 2, cd.z + 13.6);
    scene.add(strip);
    // entrance canopy + door glow
    const canopy = new THREE.Mesh(new THREE.BoxGeometry(16, 1, 8), new THREE.MeshLambertMaterial({ color: 0x111111 }));
    canopy.position.set(cd.x, 5, cd.z + 16);
    scene.add(canopy);
    const door = new THREE.Mesh(new THREE.PlaneGeometry(8, 5), new THREE.MeshBasicMaterial({ color: 0xffe9a8 }));
    door.position.set(cd.x, 2.6, cd.z + 13.7);
    scene.add(door);
  }
  // casino plaza: extra palms + light poles
  const plazaMat = new THREE.MeshLambertMaterial({ color: 0x4a3b5e });
  const plaza = new THREE.Mesh(new THREE.PlaneGeometry(120, 90), plazaMat);
  plaza.rotation.x = -Math.PI / 2; plaza.position.set(168, 0.06, -128);
  scene.add(plaza);

  // --- palms along roads + beach ---
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x7a5230 });
  const leafMat = new THREE.MeshLambertMaterial({ color: 0x2f8f4e, side: THREE.DoubleSide });
  function addPalm(x, z, s = 1) {
    const g = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.35 * s, 0.55 * s, 9 * s, 6), trunkMat);
    trunk.position.y = 4.5 * s; trunk.rotation.z = rand(-0.08, 0.08);
    g.add(trunk);
    for (let i = 0; i < 6; i++) {
      const leaf = new THREE.Mesh(new THREE.ConeGeometry(1.6 * s, 5 * s, 4), leafMat);
      leaf.position.y = 9.4 * s;
      leaf.rotation.z = Math.PI / 2.4;
      leaf.rotation.y = (i / 6) * Math.PI * 2;
      leaf.position.x = Math.cos((i / 6) * Math.PI * 2) * 1.8 * s;
      leaf.position.z = Math.sin((i / 6) * Math.PI * 2) * 1.8 * s;
      g.add(leaf);
    }
    g.position.set(x, 0, z);
    scene.add(g); palms.push(g);
    return g;
  }
  for (let i = -4; i <= 4; i++) {
    for (const dz of [-236, -184, -132, -80, -28, 24, 76, 128, 180]) {
      if (Math.random() < 0.35) addPalm(i * CITY.roadStep + 11, dz, rand(0.85, 1.25));
    }
  }
  for (let i = 0; i < 26; i++) addPalm(rand(-268, -246), rand(-260, 260), rand(0.9, 1.4));
  for (let i = 0; i < 10; i++) addPalm(rand(120, 210), rand(-170, -90), rand(0.9, 1.2));

  // --- marina: docks + moored boats ---
  const dockMat = new THREE.MeshLambertMaterial({ color: 0x8a6a42 });
  for (const dx of [-104, 0, 104]) {
    const dock = new THREE.Mesh(new THREE.BoxGeometry(8, 1, 46), dockMat);
    dock.position.set(dx, 0.5, 222);
    scene.add(dock);
    colliders.push({ x: dx, z: 222, hx: 4.4, hz: 23.4 });
  }
  const hullCols = [0xf8f8f8, 0xff6b6b, 0x4ecdc4, 0xffd166, 0x7dd3fc];
  for (let i = 0; i < 9; i++) {
    const bx = -130 + i * 32 + rand(-4, 4);
    const g = new THREE.Group();
    const hull = new THREE.Mesh(new THREE.BoxGeometry(6, 2.4, 15), new THREE.MeshLambertMaterial({ color: pick(hullCols) }));
    hull.position.y = 0.8; g.add(hull);
    const cab = new THREE.Mesh(new THREE.BoxGeometry(4, 2.2, 6), new THREE.MeshLambertMaterial({ color: 0x223344 }));
    cab.position.set(0, 3, -1); g.add(cab);
    g.position.set(bx, 0, 238 + rand(-6, 6));
    g.rotation.y = rand(-0.15, 0.15);
    scene.add(g); boatsMoored.push(g);
  }

  // --- streetlights ---
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x333333 });
  const bulbMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
  for (let i = -4; i <= 4; i++) {
    for (const dz of [-208, -104, 0, 104]) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 7, 6), poleMat);
      pole.position.set(i * CITY.roadStep - 9, 3.5, dz);
      scene.add(pole);
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.7, 8, 6), bulbMat);
      bulb.position.set(i * CITY.roadStep - 9, 7.2, dz);
      scene.add(bulb);
    }
  }

  // --- SKY: sunset gradient dome + sun + clouds ---
  const skyGeo = new THREE.SphereGeometry(900, 24, 16);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      top: { value: new THREE.Color(0x2a1a5e) },
      mid: { value: new THREE.Color(0xff6b4a) },
      low: { value: new THREE.Color(0xffb36b) },
    },
    vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `varying vec3 vP; uniform vec3 top; uniform vec3 mid; uniform vec3 low;
      void main(){ float h = normalize(vP).y; vec3 c = h > 0.25 ? mix(mid, top, smoothstep(0.25, 0.9, h)) : mix(low, mid, smoothstep(-0.05, 0.25, h));
      gl_FragColor = vec4(c, 1.0); }`,
  });
  const sky = new THREE.Mesh(skyGeo, skyMat);
  scene.add(sky);
  // sun disc + glare
  const sun = new THREE.Mesh(new THREE.CircleGeometry(34, 32), new THREE.MeshBasicMaterial({ color: 0xffdf80, fog: false }));
  sun.position.set(-420, 150, -620); sun.lookAt(0, 40, 0);
  scene.add(sun);
  const glare = new THREE.Mesh(new THREE.CircleGeometry(70, 32), new THREE.MeshBasicMaterial({ color: 0xff9a3d, transparent: true, opacity: 0.28, fog: false }));
  glare.position.set(-420, 150, -618); glare.lookAt(0, 40, 0);
  scene.add(glare);
  // clouds: flattened white blobs
  const cloudMat = new THREE.MeshLambertMaterial({ color: 0xffd9c2, transparent: true, opacity: 0.75 });
  const clouds = [];
  for (let i = 0; i < 14; i++) {
    const cg = new THREE.Group();
    for (let k = 0; k < 4; k++) {
      const puff = new THREE.Mesh(new THREE.SphereGeometry(rand(14, 26), 8, 6), cloudMat);
      puff.scale.y = 0.32;
      puff.position.set(k * rand(16, 24) - 30, rand(-2, 2), rand(-8, 8));
      cg.add(puff);
    }
    cg.position.set(rand(-500, 500), rand(120, 220), rand(-600, -200));
    scene.add(cg); clouds.push(cg);
  }

  // fog + lights
  scene.fog = new THREE.Fog(0xe8905a, 220, 780);
  const sunLight = new THREE.DirectionalLight(0xffb36b, 1.5);
  sunLight.position.set(-180, 220, -260);
  scene.add(sunLight);
  scene.add(new THREE.AmbientLight(0x8a6bb0, 0.85));
  const hemi = new THREE.HemisphereLight(0xff9a6b, 0x2a2a44, 0.6);
  scene.add(hemi);

  return { colliders, buildings, palms, signs, boatsMoored, casinoBuildings, clouds, sun, roadMeshes };
}

// Simple AABB push-out for cars / player against buildings.
export function collideCircle(city, x, z, r) {
  let nx = x, nz = z;
  for (const c of city.colliders) {
    const dx = nx - c.x, dz = nz - c.z;
    const px = c.hx + r - Math.abs(dx);
    const pz = c.hz + r - Math.abs(dz);
    if (px > 0 && pz > 0) {
      if (px < pz) nx = c.x + Math.sign(dx || 1) * (c.hx + r);
      else nz = c.z + Math.sign(dz || 1) * (c.hz + r);
    }
  }
  nx = Math.max(-258, Math.min(258, nx));
  nz = Math.max(-258, Math.min(258, nz));
  return { x: nx, z: nz };
}

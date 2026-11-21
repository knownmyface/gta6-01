// coralcity.js — builds Coral Bay: the sunset coastal marina city.
// Ground, road grid, buildings, palms, beach + ocean, marina docks, the neon
// casino district, street props and the sunset sky. Also owns the collision
// boxes and the named places (casino, marina, safehouses, race start) the
// missions, garage and races navigate to.
import * as THREE from 'three';
import { rand, randi, pick, chance, mulberry32, textTexture, clamp } from './util.js';

export const GRID = { step: 52, half: 6, min: -208, max: 208 };

// Named places other systems navigate to (x, z on the ground plane).
export const PLACES = {
  casino: { x: -78, z: -104, name: 'CORAL CROWN CASINO' },
  casinoDoor: { x: -78, z: -84, name: 'CASINO ENTRANCE' },
  marina: { x: 176, z: 60, name: 'CORAL BAY MARINA' },
  marinaDock: { x: 196, z: 60, name: 'MARINA DOCK' },
  beach: { x: 0, z: 196, name: 'CORAL BEACH' },
  raceStart: { x: 0, z: 0, name: 'MARINA ROW START' },
  garageBay: { x: 52, z: -52, name: 'SUNSET GARAGE' },
  safehouse1: { x: -104, z: 52, name: 'PALM COURT APT' },
  safehouse2: { x: 104, z: -104, name: 'HARBOUR LOFT' },
  safehouse3: { x: -156, z: -156, name: 'CROWN PENTHOUSE' },
  bikeShop: { x: 104, z: 104, name: 'REEF RIDERS' },
  pier: { x: 176, z: 130, name: 'CORAL PIER' },
};

const BUILDING_COLORS = [0x8a7f8d, 0x9c8f7a, 0x7d8aa0, 0xa08b7d, 0x6f7d8a, 0xb09a80];
const NEON_SIGNS = [
  { text: ['CORAL CROWN', 'CASINO'], color: '#ff2e88', sub: 'SLOTS • TABLES • HEIST' },
  { text: ['NEON PALMS'], color: '#22e6ff', sub: 'COCKTAILS • ROOFTOP' },
  { text: ['LUCKY REEF'], color: '#ffd23e', sub: '24H • JACKPOT' },
  { text: ['GOLDEN ANCHOR'], color: '#ff7a1a', sub: 'HOTEL • SPA' },
  { text: ['VELVET TIDE'], color: '#c86bff', sub: 'CLUB • LIVE MUSIC' },
];

function windowTexture(litRatio, rng, w = 20, h = 20) {
  const cv = document.createElement('canvas');
  cv.width = 128;
  cv.height = 256;
  const g = cv.getContext('2d');
  g.fillStyle = '#20242e';
  g.fillRect(0, 0, 128, 256);
  for (let y = 8; y < 248; y += 16) {
    for (let x = 8; x < 120; x += 16) {
      const lit = rng() < litRatio;
      g.fillStyle = lit ? pick(['#ffd98a', '#ffe9b0', '#9fd8ff', '#ffb36b']) : '#141821';
      g.fillRect(x, y, 10, 11);
    }
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  // Repeat the window grid so windows stay small on big facades.
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(Math.max(1, Math.round(w / 7)), Math.max(1, Math.round(h / 7)));
  return tex;
}

function makePalm(rng) {
  const g = new THREE.Group();
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x7a5230, roughness: 1 });
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.38, 7, 6), trunkMat);
  trunk.position.y = 3.5;
  trunk.rotation.z = rand(-0.08, 0.08);
  g.add(trunk);
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x2f7d3a, roughness: 0.9, side: THREE.DoubleSide });
  for (let i = 0; i < 7; i++) {
    const leaf = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 1.1), leafMat);
    const a = (i / 7) * Math.PI * 2;
    leaf.position.set(Math.cos(a) * 1.4, 7 + Math.sin(i * 1.7) * 0.3, Math.sin(a) * 1.4);
    leaf.rotation.set(Math.sin(a) * 0.9 - 0.4, 0, Math.cos(a) * 0.9 + 0.4);
    leaf.rotation.y = -a;
    g.add(leaf);
  }
  const nuts = new THREE.Mesh(new THREE.SphereGeometry(0.35, 6, 5),
    new THREE.MeshStandardMaterial({ color: 0x6b4a1f, roughness: 1 }));
  nuts.position.y = 6.8;
  g.add(nuts);
  return g;
}

function makeBuilding(rng, w, d, h, opts = {}) {
  const g = new THREE.Group();
  const winTex = windowTexture(opts.lit ?? 0.45, rng, w, h);
  const bodyMat = new THREE.MeshStandardMaterial({
    color: opts.color ?? pick(BUILDING_COLORS),
    roughness: 0.85,
    emissive: 0xffffff,
    emissiveMap: winTex,
    emissiveIntensity: opts.litGlow ?? 0.55,
  });
  const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), bodyMat);
  body.position.y = h / 2;
  g.add(body);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(w + 0.6, 0.5, d + 0.6),
    new THREE.MeshStandardMaterial({ color: 0x3a3340, roughness: 1 }));
  roof.position.y = h + 0.25;
  g.add(roof);
  if (opts.neon) {
    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(w * 0.9, Math.min(9, h * 0.32)),
      new THREE.MeshBasicMaterial({ map: textTexture(opts.neon.text, { color: opts.neon.color, w: 512, h: 160 }), transparent: false })
    );
    sign.position.set(0, h * 0.82, d / 2 + 0.15);
    g.add(sign);
    const glow = new THREE.PointLight(new THREE.Color(opts.neon.color), 60, 60, 1.8);
    glow.position.set(0, h * 0.8, d / 2 + 4);
    g.add(glow);
  }
  if (opts.strip) {
    const strip = new THREE.Mesh(new THREE.BoxGeometry(w + 0.2, 0.5, 0.3),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(opts.neon?.color || '#ff2e88') }));
    strip.position.set(0, 1.2, d / 2 + 0.12);
    g.add(strip);
  }
  return g;
}

function makeSky(scene) {
  // Sunset gradient as the scene background.
  const cv = document.createElement('canvas');
  cv.width = 16;
  cv.height = 512;
  const g = cv.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0, '#2b1a5e');
  grad.addColorStop(0.35, '#7a2d7a');
  grad.addColorStop(0.6, '#e85d3d');
  grad.addColorStop(0.78, '#ff9e4f');
  grad.addColorStop(1, '#ffd98a');
  g.fillStyle = grad;
  g.fillRect(0, 0, 16, 512);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  scene.background = tex;
  scene.fog = new THREE.Fog(0xd97a4e, 180, 520);

  // Low sun disc + glare sprite.
  const sun = new THREE.Mesh(new THREE.CircleGeometry(26, 32),
    new THREE.MeshBasicMaterial({ color: 0xffe9a8, fog: false }));
  sun.position.set(-260, 52, -380);
  sun.lookAt(0, 20, 0);
  scene.add(sun);
  const glare = new THREE.Mesh(new THREE.CircleGeometry(60, 32),
    new THREE.MeshBasicMaterial({ color: 0xffb36b, transparent: true, opacity: 0.22, fog: false }));
  glare.position.set(-260, 52, -381);
  glare.lookAt(0, 20, 0);
  scene.add(glare);

  // Puffy sunset clouds drifting slowly.
  const cloudMat = new THREE.MeshStandardMaterial({ color: 0xffc9a8, transparent: true, opacity: 0.75, roughness: 1 });
  const clouds = [];
  for (let i = 0; i < 16; i++) {
    const c = new THREE.Group();
    const puffs = randi(3, 5);
    for (let j = 0; j < puffs; j++) {
      const p = new THREE.Mesh(new THREE.SphereGeometry(rand(6, 14), 8, 6), cloudMat);
      p.position.set(j * rand(7, 11) - puffs * 4, rand(-1, 2), rand(-4, 4));
      p.scale.y = 0.45;
      c.add(p);
    }
    c.position.set(rand(-320, 320), rand(70, 130), rand(-340, 60));
    scene.add(c);
    clouds.push(c);
  }
  return { sun, glare, clouds };
}

export function buildCity(W) {
  const scene = W.scene;
  const rng = mulberry32(20261121);
  const city = { colliders: [], clouds: [], ocean: null, casinoSigns: [] };
  W.city = city;

  // --- lights ---------------------------------------------------------------
  const hemi = new THREE.HemisphereLight(0xffc9a0, 0x2a1e3a, 0.85);
  scene.add(hemi);
  const sunLight = new THREE.DirectionalLight(0xffb36b, 2.0);
  sunLight.position.set(-180, 120, -120);
  scene.add(sunLight);
  const amb = new THREE.AmbientLight(0x604a80, 0.5);
  scene.add(amb);

  // --- ground, beach, ocean --------------------------------------------------
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(640, 640),
    new THREE.MeshStandardMaterial({ color: 0x8a7a5e, roughness: 1 }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, 0, 0);
  scene.add(ground);

  const ocean = new THREE.Mesh(new THREE.PlaneGeometry(640, 220),
    new THREE.MeshStandardMaterial({ color: 0x2a7ab0, roughness: 0.3, metalness: 0.15, emissive: 0x0a2a44, emissiveIntensity: 0.6 }));
  ocean.rotation.x = -Math.PI / 2;
  ocean.position.set(0, 0.4, 330);
  scene.add(ocean);
  city.ocean = ocean;

  const beach = new THREE.Mesh(new THREE.PlaneGeometry(640, 46),
    new THREE.MeshStandardMaterial({ color: 0xe8cf9a, roughness: 1 }));
  beach.rotation.x = -Math.PI / 2;
  beach.position.set(0, 0.15, 205);
  scene.add(beach);

  // East water (marina bay) beyond x = 208.
  const bay = new THREE.Mesh(new THREE.PlaneGeometry(120, 480),
    new THREE.MeshStandardMaterial({ color: 0x2a7ab0, roughness: 0.3, metalness: 0.15, emissive: 0x0a2a44, emissiveIntensity: 0.6 }));
  bay.rotation.x = -Math.PI / 2;
  bay.position.set(268, 0.4, 0);
  scene.add(bay);

  // --- road grid ---------------------------------------------------------------
  const roadMat = new THREE.MeshStandardMaterial({ color: 0x2c2c34, roughness: 0.95 });
  const lineMat = new THREE.MeshBasicMaterial({ color: 0xffd23e });
  const crossMat = new THREE.MeshBasicMaterial({ color: 0xe8e8e8 });
  for (let c = GRID.min; c <= GRID.max; c += GRID.step) {
    const v = new THREE.Mesh(new THREE.PlaneGeometry(GRID.half * 2, GRID.max * 2 + 24), roadMat);
    v.rotation.x = -Math.PI / 2;
    v.position.set(c, 0.06, 0);
    scene.add(v);
    const h = new THREE.Mesh(new THREE.PlaneGeometry(GRID.max * 2 + 24, GRID.half * 2), roadMat);
    h.rotation.x = -Math.PI / 2;
    h.position.set(0, 0.06, c);
    scene.add(h);
    // Centre dashes.
    for (let t = GRID.min; t <= GRID.max; t += 16) {
      const d1 = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 5), lineMat);
      d1.rotation.x = -Math.PI / 2;
      d1.position.set(c, 0.09, t);
      scene.add(d1);
      const d2 = new THREE.Mesh(new THREE.PlaneGeometry(5, 0.5), lineMat);
      d2.rotation.x = -Math.PI / 2;
      d2.position.set(t, 0.09, c);
      scene.add(d2);
    }
  }

  // --- buildings ---------------------------------------------------------------
  const casinoBlock = (bx, bz) => bx >= -130 && bx <= -26 && bz >= -156 && bz <= -52;
  for (let ix = 0; ix < 8; ix++) {
    for (let iz = 0; iz < 8; iz++) {
      const bx = GRID.min + GRID.step / 2 + ix * GRID.step;
      const bz = GRID.min + GRID.step / 2 + iz * GRID.step;
      if (bx > 150) continue; // marina water side
      if (bz > 170) continue; // beach
      if (casinoBlock(bx, bz)) continue; // handled below
      const downtown = Math.abs(bx) < 80 && Math.abs(bz) < 80;
      const count = downtown ? randi(2, 4) : randi(1, 2);
      for (let k = 0; k < count; k++) {
        const w = rand(14, 24);
        const d = rand(14, 24);
        const h = downtown ? rand(18, 46) : rand(9, 26);
        const ox = (k % 2 === 0 ? -1 : 1) * rand(4, 10);
        const oz = (k < 2 ? -1 : 1) * rand(4, 10);
        const b = makeBuilding(rng, w, d, h, { lit: downtown ? 0.6 : 0.4 });
        b.position.set(bx + ox, 0, bz + oz);
        scene.add(b);
        city.colliders.push({ x: bx + ox, z: bz + oz, hx: w / 2 + 0.4, hz: d / 2 + 0.4 });
      }
    }
  }

  // --- neon casino district ------------------------------------------------------
  const casinoSpots = [
    { x: -78, z: -104, w: 34, d: 26, h: 30, sign: NEON_SIGNS[0], main: true },
    { x: -117, z: -104, w: 20, d: 20, h: 18, sign: NEON_SIGNS[1] },
    { x: -39, z: -104, w: 20, d: 20, h: 22, sign: NEON_SIGNS[2] },
    { x: -78, z: -143, w: 24, d: 20, h: 26, sign: NEON_SIGNS[3] },
    { x: -117, z: -143, w: 18, d: 18, h: 14, sign: NEON_SIGNS[4] },
  ];
  for (const s of casinoSpots) {
    const b = makeBuilding(rng, s.w, s.d, s.h, {
      lit: 0.85, litGlow: 0.9, neon: s.sign, strip: true,
      color: s.main ? 0x3a2a55 : 0x4a3550,
    });
    b.position.set(s.x, 0, s.z);
    // Face the signs toward the street (south, +z).
    if (!s.main) b.rotation.y = 0;
    scene.add(b);
    city.colliders.push({ x: s.x, z: s.z, hx: s.w / 2 + 0.4, hz: s.d / 2 + 0.4 });
    city.casinoSigns.push(s);
  }
  // Casino entrance canopy + glowing doorway marker.
  const canopy = new THREE.Mesh(new THREE.BoxGeometry(16, 1, 8),
    new THREE.MeshStandardMaterial({ color: 0xff2e88, emissive: 0xff2e88, emissiveIntensity: 0.7 }));
  canopy.position.set(PLACES.casinoDoor.x, 5.5, PLACES.casinoDoor.z - 2);
  scene.add(canopy);
  const doorGlow = new THREE.Mesh(new THREE.PlaneGeometry(7, 9),
    new THREE.MeshBasicMaterial({ color: 0xffd23e }));
  doorGlow.position.set(PLACES.casinoDoor.x, 4.5, PLACES.casinoDoor.z + 0.2);
  scene.add(doorGlow);
  const casinoLight = new THREE.PointLight(0xff2e88, 120, 90, 1.6);
  casinoLight.position.set(PLACES.casinoDoor.x, 8, PLACES.casinoDoor.z + 8);
  scene.add(casinoLight);

  // --- palms ---------------------------------------------------------------------
  for (let i = 0; i < 90; i++) {
    const onRoad = chance(0.6);
    let x, z;
    if (onRoad) {
      const c = pick([GRID.min, GRID.min + GRID.step, GRID.min + 2 * GRID.step, GRID.min + 3 * GRID.step,
        GRID.min + 4 * GRID.step, GRID.min + 5 * GRID.step, GRID.min + 6 * GRID.step, GRID.min + 7 * GRID.step, GRID.max]);
      x = c + pick([-8.5, 8.5]);
      z = rand(GRID.min, GRID.max);
    } else {
      x = rand(-200, 200);
      z = rand(176, 208); // beach row
    }
    const p = makePalm(rng);
    p.position.set(x, 0, z);
    p.rotation.y = rand(0, Math.PI * 2);
    scene.add(p);
  }

  // --- marina docks + moored boats -------------------------------------------------
  const dockMat = new THREE.MeshStandardMaterial({ color: 0x6b4a2f, roughness: 1 });
  for (let d = 0; d < 4; d++) {
    const dock = new THREE.Mesh(new THREE.BoxGeometry(4, 1, 46), dockMat);
    dock.position.set(188 + d * 0, 0.8, 20 + d * 36);
    scene.add(dock);
    const posts = new THREE.Mesh(new THREE.BoxGeometry(30, 1, 3), dockMat);
    posts.position.set(196, 0.8, 20 + d * 36 - 22);
    scene.add(posts);
  }
  const pier = new THREE.Mesh(new THREE.BoxGeometry(6, 1, 70), dockMat);
  pier.position.set(176, 0.8, 130);
  scene.add(pier);

  // --- streetlights ------------------------------------------------------------------
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x222226, roughness: 0.6, metalness: 0.6 });
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
  for (let c = GRID.min; c <= GRID.max; c += GRID.step) {
    for (let t = GRID.min + 26; t <= GRID.max; t += GRID.step) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 7, 6), poleMat);
      pole.position.set(c + 7.5, 3.5, t);
      scene.add(pole);
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 6), lampMat);
      lamp.position.set(c + 7.5, 7.1, t);
      scene.add(lamp);
    }
  }

  // --- sky, sun, clouds ----------------------------------------------------------------
  const sky = makeSky(scene);
  city.clouds = sky.clouds;
  city.sun = sky.sun;

  return city;
}

// AABB collision test against every building. Returns true when blocked.
export function collides(W, x, z, r = 1.2) {
  for (const c of W.city.colliders) {
    if (Math.abs(x - c.x) < c.hx + r && Math.abs(z - c.z) < c.hz + r) return true;
  }
  return false;
}

// Push a point out of any building AABB it overlaps (cheap slide for cars/peds).
export function resolveCollision(W, p, r = 1.2) {
  for (const c of W.city.colliders) {
    const dx = p.x - c.x;
    const dz = p.z - c.z;
    const px = c.hx + r - Math.abs(dx);
    const pz = c.hz + r - Math.abs(dz);
    if (px > 0 && pz > 0) {
      if (px < pz) p.x = c.x + Math.sign(dx || 1) * (c.hx + r);
      else p.z = c.z + Math.sign(dz || 1) * (c.hz + r);
    }
  }
}

export function clampToCity(x, z) {
  return {
    x: clamp(x, -215, 215),
    z: clamp(z, -215, 225),
  };
}

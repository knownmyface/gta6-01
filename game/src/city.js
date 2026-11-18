// Coral Bay — the sunset marina city of CORAL HEAT, v2.4.
// Rewritten from scratch for the v2.4 re-record: same city, same seeded
// layout, same textures, same collisions, different code. The seeded stream
// is the contract: every rng() call happens in the same order as v2.3, so
// the same seed deals the same buildings, palms, props and boats. Unseeded
// Math.random() speckle only ever varies texture grain, never layout.
// Every surface is a canvas texture painted at runtime; no image files.
import * as THREE from 'three';
import { createRng, pick, range, rangeInt, chance, clamp } from './rng.js';

// The road grid: avenues every 40 units from -160 to 160.
export const ROAD_STEP = 40;
export const ROAD_COORDS = [-160, -120, -80, -40, 0, 40, 80, 120, 160];
export const CITY_MIN = -180;
export const CITY_MAX = 180;
export const BEACH_X = -180;
export const OCEAN_X = -245;

// District rectangles, first match wins (checked in this order).
const DISTRICT_TABLE = [
  ['CORAL STRIP', -260, -120, -260, 260],
  ['THE DOCKS', -120, 40, 120, 260],
  ['OLD TOWN', -120, 40, -260, -80],
  ['PALM HEIGHTS', 40, 260, -260, 40],
  ['SUNSET POINT', -260, -120, 120, 260],
  ['MARINA', -260, 60, 120, 260],
  ['DOWNTOWN', -120, 260, -80, 120],
];

export function districtAt(x, z) {
  const hit = DISTRICT_TABLE.find((d) => x >= d[1] && x < d[2] && z >= d[3] && z < d[4]);
  return hit ? hit[0] : 'CORAL BAY';
}

// ---------------------------------------------------------------------------
// Canvas textures: paint at runtime, wrap as THREE.CanvasTexture.
// ---------------------------------------------------------------------------

function paintCanvas(width, height, painter, repeatXY) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  painter(canvas.getContext('2d'), width, height);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  if (repeatXY) {
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeatXY[0], repeatXY[1]);
  }
  return tex;
}

// Random grain: small translucent squares scattered over a surface.
function dust(g, w, h, count, palette, dot) {
  let i = 0;
  while (i < count) {
    g.fillStyle = palette[Math.floor(Math.random() * palette.length)];
    g.globalAlpha = 0.12 + Math.random() * 0.25;
    const s = (dot || 2) * (0.5 + Math.random());
    g.fillRect(Math.random() * w, Math.random() * h, s, s);
    i += 1;
  }
  g.globalAlpha = 1;
}

function asphaltPaint(g, w, h) {
  g.fillStyle = '#26262e';
  g.fillRect(0, 0, w, h);
  dust(g, w, h, 900, ['#33333c', '#1b1b22', '#3a3a44', '#101014'], 2);
  // Dark patches where the road was dug up and filled.
  let p = 0;
  while (p < 4) {
    g.fillStyle = 'rgba(12,12,16,0.55)';
    g.fillRect(Math.random() * 90, Math.random() * 220, 20 + Math.random() * 30, 12 + Math.random() * 22);
    p += 1;
  }
  // Cracks: wandering polylines.
  g.strokeStyle = 'rgba(10,10,14,0.8)';
  g.lineWidth = 1.2;
  for (let c = 0; c < 5; c++) {
    g.beginPath();
    let x = Math.random() * w;
    let y = Math.random() * h;
    g.moveTo(x, y);
    for (let j = 0; j < 5; j++) {
      x += (Math.random() - 0.5) * 26;
      y += Math.random() * 22;
      g.lineTo(x, y);
    }
    g.stroke();
  }
  // Tyre wear: two darker bands where wheels run.
  g.fillStyle = 'rgba(8,8,10,0.28)';
  g.fillRect(26, 0, 22, h);
  g.fillRect(80, 0, 22, h);
}

function sidewalkPaint(g, w, h) {
  g.fillStyle = '#8a8578';
  g.fillRect(0, 0, w, h);
  dust(g, w, h, 260, ['#7a7568', '#9a9588', '#6a6558'], 2);
  g.strokeStyle = 'rgba(60,55,45,0.65)';
  g.lineWidth = 2;
  for (let i = 0; i <= 4; i++) {
    g.beginPath(); g.moveTo(i * 32, 0); g.lineTo(i * 32, h); g.stroke();
    g.beginPath(); g.moveTo(0, i * 32); g.lineTo(w, i * 32); g.stroke();
  }
  // Stains.
  for (let i = 0; i < 6; i++) {
    g.fillStyle = 'rgba(50,45,35,0.25)';
    g.beginPath();
    g.arc(Math.random() * w, Math.random() * h, 4 + Math.random() * 9, 0, Math.PI * 2);
    g.fill();
  }
}

function sandPaint(g, w, h) {
  g.fillStyle = '#e8c98a';
  g.fillRect(0, 0, w, h);
  dust(g, w, h, 700, ['#d8b878', '#f8e0a8', '#c9a86a'], 2);
  g.strokeStyle = 'rgba(180,150,90,0.5)';
  g.lineWidth = 1;
  for (let i = 0; i < 8; i++) {
    g.beginPath();
    g.moveTo(Math.random() * w, Math.random() * h);
    g.lineTo(Math.random() * w, Math.random() * h);
    g.stroke();
  }
}

function grassPaint(g, w, h) {
  g.fillStyle = '#4a7a3a';
  g.fillRect(0, 0, w, h);
  dust(g, w, h, 500, ['#3a6a2a', '#5a8a4a', '#6a9a3a'], 2);
}

// Brick or concrete facade with a dense lit-window grid. The grid is the
// same 12-by-15 cell walk as v2.3 (y step 10, x step 8) so the seeded
// stream deals the same windows in the same order.
function facadePaint(rng, hue, brick) {
  return paintCanvas(128, 128, (g, w, h) => {
    g.fillStyle = hue;
    g.fillRect(0, 0, w, h);
    if (brick) {
      g.strokeStyle = 'rgba(0,0,0,0.28)';
      g.lineWidth = 1;
      for (let y = 0; y < h; y += 8) {
        g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke();
        for (let x = (y / 8 % 2) * 12; x < w; x += 24) {
          g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + 8); g.stroke();
        }
      }
    } else {
      g.fillStyle = 'rgba(0,0,0,0.14)';
      for (let y = 0; y < h; y += 16) g.fillRect(0, y, w, 2);
      dust(g, w, h, 160, ['rgba(0,0,0,0.2)', 'rgba(255,255,255,0.12)'], 2);
    }
    // Windows: dense grid, so any slice of a close face still shows some.
    let y = 4;
    while (y < 124) {
      let x = 4;
      while (x < 124) {
        const lit = rng() < 0.42;
        g.fillStyle = lit ? (rng() < 0.7 ? '#ffd98a' : '#9fd8ff') : '#20242e';
        g.fillRect(x, y, 4, 6);
        x += 8;
      }
      y += 10;
    }
  }, [2, 2]);
}

// Glass tower: dark teal gradient, dense mostly-lit windows, mullions.
// Drawn from its own seeded stream so the city layout stays put.
function glassPaint(rng) {
  return paintCanvas(128, 128, (g, w, h) => {
    const grad = g.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#2a4a6a');
    grad.addColorStop(0.6, '#1a3248');
    grad.addColorStop(1, '#0e1e30');
    g.fillStyle = grad;
    g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(0,0,0,0.35)';
    for (let y = 0; y < h; y += 16) g.fillRect(0, y, w, 2);
    let y = 4;
    while (y < h - 4) {
      let x = 4;
      while (x < w - 4) {
        const lit = rng() < 0.55;
        g.fillStyle = lit ? (rng() < 0.75 ? '#ffd98a' : '#ffb347') : '#0a141e';
        g.fillRect(x, y, 5, 6);
        x += 9;
      }
      y += 10;
    }
    g.fillStyle = 'rgba(200,225,255,0.55)';
    for (let x = 0; x < w; x += 9) g.fillRect(x, 0, 1.5, h);
  }, [2, 4]);
}

// Ground-floor storefront: sign band, sunset-glass panes, door, awning.
function storefrontPaint(signText, signColor, awningColor) {
  return paintCanvas(256, 128, (g, w, h) => {
    g.fillStyle = '#2a2a30';
    g.fillRect(0, 0, w, h);
    g.fillStyle = signColor;
    g.fillRect(0, 0, w, 26);
    g.fillStyle = '#111';
    g.font = 'bold 20px sans-serif';
    g.textAlign = 'center';
    g.fillText(signText, w / 2, 19);
    for (let x = 8; x < w - 8; x += 62) {
      const grad = g.createLinearGradient(x, 30, x + 54, 96);
      grad.addColorStop(0, '#3a5a7a');
      grad.addColorStop(0.5, '#ff9a3d');
      grad.addColorStop(1, '#2a3a4a');
      g.fillStyle = grad;
      g.fillRect(x, 34, 54, 58);
      g.fillStyle = 'rgba(255,255,255,0.25)';
      g.fillRect(x + 6, 38, 10, 50);
    }
    g.fillStyle = '#1a1a22';
    g.fillRect(w / 2 - 14, 60, 28, 36);
    for (let x = 0; x < w; x += 16) {
      g.fillStyle = (x / 16) % 2 === 0 ? awningColor : '#f0ead8';
      g.fillRect(x, 28, 16, 10);
    }
  });
}

// Neon sign: glowing text on a dark plate.
function neonPaint(text, color) {
  return paintCanvas(256, 64, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.fillStyle = 'rgba(10,8,18,0.9)';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = color;
    g.lineWidth = 3;
    g.strokeRect(3, 3, w - 6, h - 6);
    g.font = 'bold 30px sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.shadowColor = color;
    g.shadowBlur = 14;
    g.fillStyle = color;
    g.fillText(text, w / 2, h / 2 + 1);
  });
}

function billboardPaint(lines, bg, fg) {
  return paintCanvas(256, 128, (g, w, h) => {
    g.fillStyle = bg;
    g.fillRect(0, 0, w, h);
    g.fillStyle = fg;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = 'bold 26px sans-serif';
    lines.forEach((ln, i) => g.fillText(ln, w / 2, 34 + i * 36));
    g.strokeStyle = fg;
    g.lineWidth = 4;
    g.strokeRect(4, 4, w - 8, h - 8);
  });
}

// One palm: leaning trunk, seven drooping fronds, a nut cluster.
function growPalm(rng, trunkMat, frondMat) {
  const tree = new THREE.Group();
  const h = range(rng, 5, 8);
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.32, h, 6), trunkMat);
  trunk.position.y = h / 2;
  trunk.rotation.z = range(rng, -0.08, 0.08);
  tree.add(trunk);
  const crown = new THREE.Group();
  crown.position.y = h;
  const step = (Math.PI * 2) / 7;
  for (let k = 0; k < 7; k++) {
    const a = k * step;
    const frond = new THREE.Mesh(new THREE.ConeGeometry(0.55, 3.4, 4), frondMat);
    frond.scale.set(1, 1, 0.22);
    frond.position.set(Math.cos(a) * 1.1, 0.25, Math.sin(a) * 1.1);
    frond.rotation.set(Math.sin(a) * 1.15, 0, -Math.cos(a) * 1.15);
    crown.add(frond);
  }
  const nuts = new THREE.Mesh(
    new THREE.SphereGeometry(0.32, 6, 5),
    new THREE.MeshStandardMaterial({ color: 0x8a6a2f, roughness: 0.9 }),
  );
  nuts.position.y = -0.2;
  crown.add(nuts);
  tree.add(crown);
  return tree;
}

const SHOP_SIGNS = [
  { text: 'TACOS', color: '#ff7a18', awning: '#ff2e63' },
  { text: 'HOTEL CORAL', color: '#37b6ff', awning: '#37b6ff' },
  { text: 'BAR 24H', color: '#ff2e63', awning: '#ffb347' },
  { text: 'PIZZA', color: '#ffd23e', awning: '#ff2e63' },
  { text: 'LIQUOR', color: '#7dff9a', awning: '#7dff9a' },
  { text: 'GUNSMITH', color: '#ff5a5a', awning: '#3a3e48' },
  { text: 'CASINO', color: '#ff9a3d', awning: '#ff9a3d' },
  { text: 'DONUTS', color: '#ff7ad9', awning: '#ff7ad9' },
];

// ---------------------------------------------------------------------------
// buildCity: stage the whole city, in draw order.
// ---------------------------------------------------------------------------

export function buildCity(scene, seed) {
  const rng = createRng(seed);
  const colliders = [];
  const animated = { ocean: null, wheel: null, wheelLights: [], lights: [], clouds: [] };

  // Sky dome: purple top, red middle, orange low — sunset gradient.
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      top: { value: new THREE.Color(0x2b1b4d) },
      mid: { value: new THREE.Color(0xd94f4f) },
      low: { value: new THREE.Color(0xff9a3d) },
    },
    vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `varying vec3 vP; uniform vec3 top; uniform vec3 mid; uniform vec3 low;
      void main(){ float h = normalize(vP).y; vec3 c = h > 0.25 ? mix(mid, top, smoothstep(0.25, 0.75, h)) : mix(low, mid, smoothstep(-0.05, 0.25, h));
      gl_FragColor = vec4(c, 1.0); }`,
  });
  scene.add(new THREE.Mesh(new THREE.SphereGeometry(900, 24, 16), skyMat));

  // Sun disc + glow, low over the ocean to the west-northwest.
  const sunDisc = new THREE.Mesh(
    new THREE.CircleGeometry(46, 32),
    new THREE.MeshBasicMaterial({ color: 0xffd27a, fog: false }),
  );
  sunDisc.position.set(-820, 130, -140);
  sunDisc.lookAt(0, 40, 0);
  scene.add(sunDisc);
  const sunGlow = new THREE.Mesh(
    new THREE.CircleGeometry(120, 32),
    new THREE.MeshBasicMaterial({ color: 0xff8a3d, transparent: true, opacity: 0.28, fog: false }),
  );
  sunGlow.position.set(-825, 130, -140);
  sunGlow.lookAt(0, 40, 0);
  scene.add(sunGlow);

  // Drifting clouds: soft white blobs high up.
  const cloudTex = paintCanvas(128, 64, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    for (let i = 0; i < 14; i++) {
      const x = 20 + Math.random() * (w - 40);
      const y = 22 + Math.random() * 20;
      const r = 10 + Math.random() * 16;
      const grad = g.createRadialGradient(x, y, 1, x, y, r);
      grad.addColorStop(0, 'rgba(255,235,220,0.85)');
      grad.addColorStop(1, 'rgba(255,235,220,0)');
      g.fillStyle = grad;
      g.beginPath();
      g.arc(x, y, r, 0, Math.PI * 2);
      g.fill();
    }
  });
  for (let i = 0; i < 9; i++) {
    const cloud = new THREE.Mesh(
      new THREE.PlaneGeometry(range(rng, 90, 170), range(rng, 28, 48)),
      new THREE.MeshBasicMaterial({ map: cloudTex, transparent: true, depthWrite: false, fog: false }),
    );
    cloud.position.set(range(rng, -500, 300), range(rng, 130, 220), range(rng, -420, 420));
    cloud.lookAt(0, cloud.position.y, 0);
    scene.add(cloud);
    animated.clouds.push(cloud);
  }

  // Lights: warm sunset key, softer fill, purple-ish hemisphere.
  const keyLight = new THREE.DirectionalLight(0xffb36b, 2.4);
  keyLight.position.set(-300, 180, -60);
  scene.add(keyLight);
  const fillLight = new THREE.DirectionalLight(0xff9a6a, 1.2);
  fillLight.position.set(300, 120, -80);
  scene.add(fillLight);
  scene.add(new THREE.HemisphereLight(0x8a5a8a, 0x3a2a1a, 1.45));
  scene.fog = new THREE.Fog(0xe0703f, 260, 820);

  // Ground: city slab, sand strip, ocean.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(560, 560),
    new THREE.MeshStandardMaterial({ color: 0x3d3a44, roughness: 1 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.x = 20;
  scene.add(ground);

  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(80, 560),
    new THREE.MeshStandardMaterial({ map: paintCanvas(128, 128, sandPaint, [4, 24]), roughness: 1 }),
  );
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(-220, 0.05, 0);
  scene.add(sand);

  const oceanCanvas = document.createElement('canvas');
  oceanCanvas.width = 256;
  oceanCanvas.height = 256;
  const og = oceanCanvas.getContext('2d');
  og.fillStyle = '#274b7a';
  og.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 90; i++) {
    og.strokeStyle = rng() < 0.5 ? 'rgba(255,170,90,0.35)' : 'rgba(255,255,255,0.18)';
    og.lineWidth = 1 + rng() * 2;
    const y = rng() * 256;
    og.beginPath();
    og.moveTo(rng() * 256, y);
    og.lineTo(rng() * 256 + 40, y + range(rng, -4, 4));
    og.stroke();
  }
  const oceanTex = new THREE.CanvasTexture(oceanCanvas);
  oceanTex.wrapS = THREE.RepeatWrapping;
  oceanTex.wrapT = THREE.RepeatWrapping;
  oceanTex.repeat.set(6, 6);
  oceanTex.colorSpace = THREE.SRGBColorSpace;
  const ocean = new THREE.Mesh(
    new THREE.PlaneGeometry(400, 700),
    new THREE.MeshStandardMaterial({ map: oceanTex, roughness: 0.35, metalness: 0.25 }),
  );
  ocean.rotation.x = -Math.PI / 2;
  ocean.position.set(-440, 0.02, 0);
  scene.add(ocean);
  animated.ocean = oceanTex;

  // Roads: textured asphalt, centre dashes, crosswalks, tiled sidewalks.
  const asphaltTex = paintCanvas(128, 256, asphaltPaint, [1, 24]);
  const asphalt = new THREE.MeshStandardMaterial({ map: asphaltTex, roughness: 0.95 });
  const dashMat = new THREE.MeshBasicMaterial({ color: 0xd8c25a });
  const walkMat = new THREE.MeshStandardMaterial({ map: paintCanvas(128, 128, sidewalkPaint, [1, 32]), roughness: 1 });
  const roadGeoNS = new THREE.PlaneGeometry(9, 400);
  const roadGeoEW = new THREE.PlaneGeometry(400, 9);
  const dashGeo = new THREE.PlaneGeometry(0.5, 3);
  const crossMat = new THREE.MeshBasicMaterial({ color: 0xe8e8e0 });
  const crossGeo = new THREE.PlaneGeometry(1.1, 3.4);
  for (const c of ROAD_COORDS) {
    const ns = new THREE.Mesh(roadGeoNS, asphalt);
    ns.rotation.x = -Math.PI / 2;
    ns.position.set(c, 0.06, 0);
    scene.add(ns);
    const ew = new THREE.Mesh(roadGeoEW, asphalt);
    ew.rotation.x = -Math.PI / 2;
    ew.position.set(0, 0.06, c);
    scene.add(ew);
    for (let z = -180; z <= 180; z += 14) {
      const d = new THREE.Mesh(dashGeo, dashMat);
      d.rotation.x = -Math.PI / 2;
      d.position.set(c, 0.09, z);
      scene.add(d);
      const d2 = new THREE.Mesh(dashGeo, dashMat);
      d2.rotation.x = -Math.PI / 2;
      d2.rotation.z = Math.PI / 2;
      d2.position.set(z, 0.09, c);
      scene.add(d2);
    }
    for (const c2 of ROAD_COORDS) {
      if ((c + c2) % 80 !== 0) continue;
      for (let i = -3; i <= 3; i++) {
        const cw = new THREE.Mesh(crossGeo, crossMat);
        cw.rotation.x = -Math.PI / 2;
        cw.position.set(c + i * 1.2, 0.08, c2 + 5.6);
        scene.add(cw);
      }
    }
  }
  const walkGeoNS = new THREE.PlaneGeometry(2.4, 400);
  const walkGeoEW = new THREE.PlaneGeometry(400, 2.4);
  for (const c of ROAD_COORDS) {
    for (const off of [-5.8, 5.8]) {
      const w1 = new THREE.Mesh(walkGeoNS, walkMat);
      w1.rotation.x = -Math.PI / 2;
      w1.position.set(c + off, 0.07, 0);
      scene.add(w1);
      const w2 = new THREE.Mesh(walkGeoEW, walkMat);
      w2.rotation.x = -Math.PI / 2;
      w2.position.set(0, 0.07, c + off);
      scene.add(w2);
    }
  }

  // Buildings: textured facades, storefronts on the Strip, neon signs.
  const facadeSpecs = [
    ['#b08a6a', true], ['#7a8a9a', false],
    ['#c9a06a', true], ['#8a7a9a', false],
    ['#a06a5a', true], ['#5a7a8a', false],
  ];
  const facadeMats = facadeSpecs.map(([hue, brick]) =>
    new THREE.MeshStandardMaterial({ map: facadePaint(rng, hue, brick), roughness: 0.85 }));
  const glassMat = new THREE.MeshStandardMaterial({
    map: glassPaint(createRng(20261118)), roughness: 0.35, metalness: 0.15,
  });
  const finMat = new THREE.MeshStandardMaterial({ color: 0xd8d8e0, roughness: 0.4, metalness: 0.5 });
  const TOWER_SIGNS = ['HOTEL CORAL', 'CORAL TOWER', 'MARINA SUITES', 'SUNSET PLAZA'];
  let towerIdx = 0;
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x2a2a30, roughness: 1 });
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  const parks = new Set(['-1,2', '2,-2', '1,1']);
  const grassTex = paintCanvas(128, 128, grassPaint, [3, 3]);
  let shopIdx = 0;
  for (let bx = 0; bx < 8; bx++) {
    for (let bz = 0; bz < 8; bz++) {
      const cx = -160 + bx * ROAD_STEP + ROAD_STEP / 2;
      const cz = -160 + bz * ROAD_STEP + ROAD_STEP / 2;
      if (cx < BEACH_X + 30) continue; // beachfront stays open
      if (parks.has(`${bx},${bz}`)) {
        const grass = new THREE.Mesh(
          new THREE.PlaneGeometry(30, 30),
          new THREE.MeshStandardMaterial({ map: grassTex, roughness: 1 }),
        );
        grass.rotation.x = -Math.PI / 2;
        grass.position.set(cx, 0.08, cz);
        scene.add(grass);
        continue;
      }
      const downtown = Math.abs(cx) < 80 && Math.abs(cz) < 80;
      const n = downtown ? (chance(rng, 0.5) ? 3 : 2) : (chance(rng, 0.3) ? 1 : 2);
      for (let i = 0; i < n; i++) {
        const w = range(rng, 12, 24);
        const d = range(rng, 12, 24);
        const h = range(rng, 9, 46) * (downtown ? 1.7 : 1);
        // The footprint must stay inside its block (31 units between
        // roads): a wide building at the block edge would jut onto the road
        // and wedge any car driving past.
        const x = clamp(
          cx + (n === 1 ? 0 : (i === 0 ? -7 : i === 1 ? 7 : 0)) + range(rng, -2, 2),
          cx - 15.5 + w / 2, cx + 15.5 - w / 2,
        );
        const z = clamp(cz + range(rng, -4, 4), cz - 15.5 + d / 2, cz + 15.5 - d / 2);
        const isStrip = Math.abs(x + 140) < 26;
        const mat = chance(rng, 0.18) ? glassMat : pick(rng, facadeMats);
        const b = new THREE.Mesh(boxGeo, mat);
        b.scale.set(w, h, d);
        b.position.set(x, h / 2, z);
        scene.add(b);
        const roof = new THREE.Mesh(boxGeo, roofMat);
        roof.scale.set(w + 0.6, 0.8, d + 0.6);
        roof.position.set(x, h + 0.4, z);
        scene.add(roof);
        // Glass towers: rooftop crown + corner fins + a lit sign.
        if (mat === glassMat) {
          const crown = new THREE.Mesh(boxGeo, roofMat);
          crown.scale.set(w * 0.6, 2.4, d * 0.6);
          crown.position.set(x, h + 2, z);
          scene.add(crown);
          for (const s of [-1, 1]) {
            const fin = new THREE.Mesh(boxGeo, finMat);
            fin.scale.set(0.5, h * 0.9, 0.5);
            fin.position.set(x + w / 2 + 0.3, h * 0.45, z + s * (d / 2 + 0.3));
            scene.add(fin);
          }
          if (h > 24) {
            const sign = new THREE.Mesh(
              new THREE.PlaneGeometry(12, 3),
              new THREE.MeshBasicMaterial({
                map: neonPaint(TOWER_SIGNS[towerIdx % TOWER_SIGNS.length], '#ff9a3d'),
                transparent: true,
              }),
            );
            towerIdx += 1;
            sign.position.set(x + w / 2 + 0.12, h * 0.62, z);
            sign.rotation.y = Math.PI / 2;
            scene.add(sign);
          }
        }
        // Ground-floor storefront + neon sign on Strip-facing buildings.
        if (isStrip && h < 30 && shopIdx < SHOP_SIGNS.length * 2) {
          const sign = SHOP_SIGNS[shopIdx % SHOP_SIGNS.length];
          shopIdx += 1;
          const shop = new THREE.Mesh(
            new THREE.PlaneGeometry(Math.min(w * 0.9, 16), 4.2),
            new THREE.MeshStandardMaterial({
              map: storefrontPaint(sign.text, sign.color, sign.awning), roughness: 0.6,
            }),
          );
          shop.position.set(x, 2.1, z - d / 2 - 0.08);
          shop.rotation.y = Math.PI;
          scene.add(shop);
          const neon = new THREE.Mesh(
            new THREE.PlaneGeometry(10, 2.5),
            new THREE.MeshBasicMaterial({ map: neonPaint(sign.text, sign.color), transparent: true }),
          );
          neon.position.set(x, h * 0.62, z - d / 2 - 0.12);
          neon.rotation.y = Math.PI;
          scene.add(neon);
        }
        // Rooftop props: AC box + antenna + water tower on tall towers.
        if (h > 24) {
          const ac = new THREE.Mesh(boxGeo, roofMat);
          ac.scale.set(3, 1.6, 2);
          ac.position.set(x + w / 4, h + 1.4, z);
          scene.add(ac);
          const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 7, 5), roofMat);
          ant.position.set(x - w / 4, h + 4, z);
          scene.add(ant);
          if (chance(rng, 0.4)) {
            const tank = new THREE.Mesh(
              new THREE.CylinderGeometry(1.6, 1.6, 3, 8),
              new THREE.MeshStandardMaterial({ color: 0x6a4a2a, roughness: 0.9 }),
            );
            tank.position.set(x - w / 4, h + 2.2, z + d / 4);
            scene.add(tank);
            const cone = new THREE.Mesh(new THREE.ConeGeometry(1.7, 1.4, 8), roofMat);
            cone.position.set(x - w / 4, h + 4.4, z + d / 4);
            scene.add(cone);
          }
        }
        colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
      }
    }
  }

  // Billboards on rooftops around Downtown.
  const billboards = [
    { lines: ['CORAL HEAT', 'VISIT THE MARINA'], bg: '#ff2e63', fg: '#fff', x: 20, z: -40, y: 42, ry: 0 },
    { lines: ['CORAL COLA', 'TASTE THE SUNSET'], bg: '#37b6ff', fg: '#fff', x: -40, z: 40, y: 36, ry: Math.PI / 2 },
    { lines: ['SUNSET POINT', 'FERRIS WHEEL'], bg: '#ffb347', fg: '#1a1a22', x: 80, z: 80, y: 34, ry: Math.PI },
  ];
  for (const bb of billboards) {
    const board = new THREE.Mesh(
      new THREE.PlaneGeometry(22, 11),
      new THREE.MeshStandardMaterial({ map: billboardPaint(bb.lines, bb.bg, bb.fg), roughness: 0.6 }),
    );
    board.position.set(bb.x, bb.y, bb.z);
    board.rotation.y = bb.ry;
    scene.add(board);
    const post = new THREE.Mesh(new THREE.BoxGeometry(1, 6, 1), roofMat);
    post.position.set(bb.x, bb.y - 8, bb.z);
    scene.add(post);
  }

  // Palms along Coral Strip + scattered in parks.
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x7a5a34, roughness: 1 });
  const frondMat = new THREE.MeshStandardMaterial({ color: 0x2e7a2e, roughness: 0.9, side: THREE.DoubleSide });
  for (let z = -170; z <= 170; z += 13) {
    for (const x of [-172, -148]) {
      const p = growPalm(rng, trunkMat, frondMat);
      p.position.set(x + range(rng, -1, 1), 0, z + range(rng, -2, 2));
      scene.add(p);
    }
  }
  for (let i = 0; i < 26; i++) {
    const p = growPalm(rng, trunkMat, frondMat);
    p.position.set(range(rng, -140, 170), 0, range(rng, -170, 170));
    scene.add(p);
  }

  // Street lamps along the Strip and the two main avenues.
  const lampMat = new THREE.MeshStandardMaterial({ color: 0x222226, roughness: 0.6, metalness: 0.6 });
  const lampGlow = new THREE.MeshBasicMaterial({ color: 0xffd98a });
  function lamp(x, z) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 7, 6), lampMat);
    pole.position.set(x, 3.5, z);
    scene.add(pole);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.45, 8, 6), lampGlow);
    bulb.position.set(x, 7.1, z);
    scene.add(bulb);
  }
  for (let z = -160; z <= 160; z += 40) lamp(-168, z);
  for (let x = -120; x <= 160; x += 40) {
    lamp(x, -6);
    lamp(x + 12, 6);
  }

  // Traffic lights at the four big intersections.
  const lightPoleMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.6, metalness: 0.5 });
  const redMat = new THREE.MeshBasicMaterial({ color: 0xff2020 });
  const amberMat = new THREE.MeshBasicMaterial({ color: 0xffb347 });
  const greenMat = new THREE.MeshBasicMaterial({ color: 0x37e08a });
  const darkMat = new THREE.MeshBasicMaterial({ color: 0x222222 });
  for (const [ix, iz] of [[-80, -80], [0, 0], [80, 80], [-40, 40]]) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 6.5, 6), lightPoleMat);
    pole.position.set(ix + 6.5, 3.25, iz + 6.5);
    scene.add(pole);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.9, 2.4, 0.7), lightPoleMat);
    head.position.set(ix + 6.5, 6.8, iz + 6.5);
    scene.add(head);
    const bulbs = [];
    for (let i = 0; i < 3; i++) {
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 6), darkMat);
      b.position.set(ix + 6.5, 7.5 - i * 0.75, iz + 6.5 + 0.4);
      scene.add(b);
      bulbs.push(b);
    }
    animated.lights.push({ bulbs, redMat, amberMat, greenMat, darkMat, phase: (ix + iz) % 2 === 0 ? 0 : 14 });
  }

  // Street props: benches, bins, hydrants, bus stops.
  const benchMat = new THREE.MeshStandardMaterial({ color: 0x6a4a2a, roughness: 0.9 });
  const binMat = new THREE.MeshStandardMaterial({ color: 0x2a5a3a, roughness: 0.8, metalness: 0.3 });
  const hydrantMat = new THREE.MeshStandardMaterial({ color: 0xd83a2e, roughness: 0.5 });
  for (let i = 0; i < 18; i++) {
    const x = pick(rng, ROAD_COORDS) + pick(rng, [-7.2, 7.2]);
    const z = range(rng, -160, 160);
    if (i % 3 === 0) {
      const bench = new THREE.Group();
      const seat = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.12, 0.6), benchMat);
      seat.position.y = 0.5;
      bench.add(seat);
      const back = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.6, 0.1), benchMat);
      back.position.set(0, 0.9, -0.28);
      bench.add(back);
      bench.position.set(x, 0, z);
      bench.rotation.y = rng() < 0.5 ? 0 : Math.PI / 2;
      scene.add(bench);
    } else if (i % 3 === 1) {
      const bin = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.4, 0.9, 8), binMat);
      bin.position.set(x, 0.45, z);
      scene.add(bin);
    } else {
      const hyd = new THREE.Group();
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 0.7, 8), hydrantMat);
      body.position.y = 0.35;
      hyd.add(body);
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), hydrantMat);
      cap.position.y = 0.75;
      hyd.add(cap);
      hyd.position.set(x, 0, z);
      scene.add(hyd);
    }
  }
  const shelterMat = new THREE.MeshStandardMaterial({ color: 0x2a4a6a, roughness: 0.5, metalness: 0.4 });
  for (const z of [-80, 40, 120]) {
    const shelter = new THREE.Group();
    const roof = new THREE.Mesh(new THREE.BoxGeometry(4, 0.15, 1.8), shelterMat);
    roof.position.y = 2.6;
    shelter.add(roof);
    for (const s of [-1.9, 1.9]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.6, 0.12), shelterMat);
      post.position.set(s, 1.3, 0);
      shelter.add(post);
    }
    const bench = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.12, 0.5), benchMat);
    bench.position.y = 0.55;
    shelter.add(bench);
    shelter.position.set(-166, 0, z);
    scene.add(shelter);
  }

  // Beach umbrellas + towels on the sand.
  const umbrellaCols = [0xff2e63, 0x37b6ff, 0xffb347, 0x7dff9a];
  for (let i = 0; i < 7; i++) {
    const ux = range(rng, -240, -195);
    const uz = range(rng, -140, 200);
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.07, 0.07, 2.4, 6),
      new THREE.MeshStandardMaterial({ color: 0xd8d8d8 }),
    );
    pole.position.set(ux, 1.2, uz);
    scene.add(pole);
    const top = new THREE.Mesh(
      new THREE.ConeGeometry(1.9, 0.9, 8),
      new THREE.MeshStandardMaterial({ color: umbrellaCols[i % 4], roughness: 0.8 }),
    );
    top.position.set(ux, 2.7, uz);
    scene.add(top);
    const towel = new THREE.Mesh(
      new THREE.PlaneGeometry(1.6, 2.4),
      new THREE.MeshStandardMaterial({ color: umbrellaCols[(i + 2) % 4], roughness: 1 }),
    );
    towel.rotation.x = -Math.PI / 2;
    towel.position.set(ux + 2.2, 0.08, uz + 1);
    scene.add(towel);
  }

  // Marina: pier, boats, Ferris wheel on the south beach.
  const pierMat = new THREE.MeshStandardMaterial({ color: 0x6a4a2a, roughness: 1 });
  const pier = new THREE.Mesh(new THREE.BoxGeometry(10, 1.2, 90), pierMat);
  pier.position.set(-215, 0.6, 190);
  scene.add(pier);
  colliders.push({ minX: -220, maxX: -210, minZ: 145, maxZ: 235 });
  const boatHull = new THREE.MeshStandardMaterial({ color: 0xf0ead8, roughness: 0.4 });
  const boatHull2 = new THREE.MeshStandardMaterial({ color: 0x3a6a9a, roughness: 0.4 });
  for (let i = 0; i < 6; i++) {
    const boat = new THREE.Group();
    const hull = new THREE.Mesh(new THREE.BoxGeometry(4, 1.6, 10), i % 2 ? boatHull2 : boatHull);
    hull.position.y = 0.4;
    boat.add(hull);
    const cabin = new THREE.Mesh(
      new THREE.BoxGeometry(2.6, 1.6, 4),
      new THREE.MeshStandardMaterial({ color: 0xdddddd, roughness: 0.5 }),
    );
    cabin.position.set(0, 1.8, -1);
    boat.add(cabin);
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 6, 5), lampMat);
    mast.position.set(0, 4.5, 1);
    boat.add(mast);
    boat.position.set(-228 - (i % 3) * 8, 0, 160 + Math.floor(i / 3) * 40);
    boat.rotation.y = range(rng, -0.2, 0.2);
    scene.add(boat);
  }

  // Ferris wheel "The Coral Wheel" at Sunset Point.
  const wheelGroup = new THREE.Group();
  wheelGroup.position.set(-196, 0, 150);
  const legMat = new THREE.MeshStandardMaterial({ color: 0xd8d8e0, roughness: 0.5, metalness: 0.4 });
  for (const s of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.7, 34, 6), legMat);
    leg.position.set(s * 2.4, 17, 0);
    leg.rotation.z = s * 0.16;
    wheelGroup.add(leg);
  }
  const wheel = new THREE.Group();
  wheel.position.set(0, 26, 0);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(15, 0.5, 8, 40), legMat);
  wheel.add(rim);
  const hub = new THREE.Mesh(
    new THREE.CylinderGeometry(1.2, 1.2, 3, 10),
    new THREE.MeshStandardMaterial({ color: 0xff2e63, roughness: 0.4 }),
  );
  hub.rotation.x = Math.PI / 2;
  wheel.add(hub);
  const cabinColors = [0xff2e63, 0xffb347, 0x37b6ff, 0x7dff9a, 0xff7ad9, 0x9fd8ff, 0xffd23e, 0x8a7aff];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const spoke = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 15, 5), legMat);
    spoke.position.set(Math.cos(a) * 7.5, Math.sin(a) * 7.5, 0);
    spoke.rotation.z = a + Math.PI / 2;
    wheel.add(spoke);
    const cab = new THREE.Mesh(
      new THREE.BoxGeometry(2.6, 2.2, 2.2),
      new THREE.MeshStandardMaterial({ color: cabinColors[i], roughness: 0.5 }),
    );
    cab.position.set(Math.cos(a) * 15, Math.sin(a) * 15, 0);
    wheel.add(cab);
    const light = new THREE.Mesh(
      new THREE.SphereGeometry(0.35, 6, 5),
      new THREE.MeshBasicMaterial({ color: cabinColors[i] }),
    );
    light.position.set(Math.cos(a) * 15, Math.sin(a) * 15 + 1.4, 0);
    wheel.add(light);
    animated.wheelLights.push(light);
  }
  wheelGroup.add(wheel);
  scene.add(wheelGroup);
  animated.wheel = wheel;
  colliders.push({ minX: -202, maxX: -190, minZ: 144, maxZ: 156 });

  // Mission beacon: gold light column, moved by missions.js.
  const beacon = new THREE.Group();
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(2.2, 3.4, 60, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffd23e, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false }),
  );
  beam.position.y = 30;
  beacon.add(beam);
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(4, 0.35, 8, 32),
    new THREE.MeshBasicMaterial({ color: 0xffd23e }),
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.3;
  beacon.add(ring);
  const arrow = new THREE.Mesh(
    new THREE.ConeGeometry(1.4, 3.4, 8),
    new THREE.MeshBasicMaterial({ color: 0xffd23e }),
  );
  arrow.position.y = 8;
  arrow.rotation.x = Math.PI;
  beacon.add(arrow);
  beacon.visible = false;
  scene.add(beacon);

  return { colliders, animated, beacon, rng };
}

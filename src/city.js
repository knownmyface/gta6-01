// Coral Bay — the sunset marina city of CORAL HEAT, v2.6.
// A ground-up rewrite of v2.5's city module for the re-record: the same
// streets, the same seeded layout, the same painted textures, the same
// collisions, written as new code. The seeded draw sequence is the
// contract: every rng() call happens in the same order as v2.5, so the
// same seed deals the same buildings, palms, props and boats. Unseeded
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
const AREAS = [
  { label: 'CORAL STRIP', x0: -260, x1: -120, z0: -260, z1: 260 },
  { label: 'THE DOCKS', x0: -120, x1: 40, z0: 120, z1: 260 },
  { label: 'OLD TOWN', x0: -120, x1: 40, z0: -260, z1: -80 },
  { label: 'PALM HEIGHTS', x0: 40, x1: 260, z0: -260, z1: 40 },
  { label: 'SUNSET POINT', x0: -260, x1: -120, z0: 120, z1: 260 },
  { label: 'MARINA', x0: -260, x1: 60, z0: 120, z1: 260 },
  { label: 'DOWNTOWN', x0: -120, x1: 260, z0: -80, z1: 120 },
];

export function districtAt(x, z) {
  for (const area of AREAS) {
    if (x >= area.x0 && x < area.x1 && z >= area.z0 && z < area.z1) return area.label;
  }
  return 'CORAL BAY';
}

// ---------------------------------------------------------------------------
// Canvas textures: painted at runtime, wrapped as THREE.CanvasTexture.
// ---------------------------------------------------------------------------

function makeCanvasTex(width, height, painter, repeat) {
  const c = document.createElement('canvas');
  c.width = width;
  c.height = height;
  painter(c.getContext('2d'), width, height);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  if (repeat) {
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeat[0], repeat[1]);
  }
  return tex;
}

// Random grain: small translucent squares scattered over a surface.
function grain(ctx, w, h, count, palette, dot) {
  for (let i = 0; i < count; i++) {
    ctx.fillStyle = palette[Math.floor(Math.random() * palette.length)];
    ctx.globalAlpha = 0.12 + Math.random() * 0.25;
    const s = (dot || 2) * (0.5 + Math.random());
    ctx.fillRect(Math.random() * w, Math.random() * h, s, s);
  }
  ctx.globalAlpha = 1;
}

function drawAsphalt(ctx, w, h) {
  ctx.fillStyle = '#26262e';
  ctx.fillRect(0, 0, w, h);
  grain(ctx, w, h, 900, ['#33333c', '#1b1b22', '#3a3a44', '#101014'], 2);
  // Dark patches where the road was dug up and filled.
  for (let p = 0; p < 4; p++) {
    ctx.fillStyle = 'rgba(12,12,16,0.55)';
    ctx.fillRect(Math.random() * 90, Math.random() * 220, 20 + Math.random() * 30, 12 + Math.random() * 22);
  }
  // Cracks: wandering polylines.
  ctx.strokeStyle = 'rgba(10,10,14,0.8)';
  ctx.lineWidth = 1.2;
  for (let c = 0; c < 5; c++) {
    ctx.beginPath();
    let x = Math.random() * w;
    let y = Math.random() * h;
    ctx.moveTo(x, y);
    for (let j = 0; j < 5; j++) {
      x += (Math.random() - 0.5) * 26;
      y += Math.random() * 22;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  // Tyre wear: two darker bands where wheels run.
  ctx.fillStyle = 'rgba(8,8,10,0.28)';
  ctx.fillRect(26, 0, 22, h);
  ctx.fillRect(80, 0, 22, h);
}

function drawSidewalk(ctx, w, h) {
  ctx.fillStyle = '#8a8578';
  ctx.fillRect(0, 0, w, h);
  grain(ctx, w, h, 260, ['#7a7568', '#9a9588', '#6a6558'], 2);
  ctx.strokeStyle = 'rgba(60,55,45,0.65)';
  ctx.lineWidth = 2;
  for (let i = 0; i <= 4; i++) {
    ctx.beginPath(); ctx.moveTo(i * 32, 0); ctx.lineTo(i * 32, h); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, i * 32); ctx.lineTo(w, i * 32); ctx.stroke();
  }
  // Stains.
  for (let i = 0; i < 6; i++) {
    ctx.fillStyle = 'rgba(50,45,35,0.25)';
    ctx.beginPath();
    ctx.arc(Math.random() * w, Math.random() * h, 4 + Math.random() * 9, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawSand(ctx, w, h) {
  ctx.fillStyle = '#e8c98a';
  ctx.fillRect(0, 0, w, h);
  grain(ctx, w, h, 700, ['#d8b878', '#f8e0a8', '#c9a86a'], 2);
  ctx.strokeStyle = 'rgba(180,150,90,0.5)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 8; i++) {
    ctx.beginPath();
    ctx.moveTo(Math.random() * w, Math.random() * h);
    ctx.lineTo(Math.random() * w, Math.random() * h);
    ctx.stroke();
  }
}

function drawGrass(ctx, w, h) {
  ctx.fillStyle = '#4a7a3a';
  ctx.fillRect(0, 0, w, h);
  grain(ctx, w, h, 500, ['#3a6a2a', '#5a8a4a', '#6a9a3a'], 2);
}

// Brick or concrete facade with a dense lit-window grid. The grid is the
// same 12-by-15 cell walk as v2.5 (y step 10, x step 8) so the seeded
// stream deals the same windows in the same order.
function drawFacade(rng, hue, brick) {
  return makeCanvasTex(128, 128, (ctx, w, h) => {
    ctx.fillStyle = hue;
    ctx.fillRect(0, 0, w, h);
    if (brick) {
      ctx.strokeStyle = 'rgba(0,0,0,0.28)';
      ctx.lineWidth = 1;
      for (let y = 0; y < h; y += 8) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
        for (let x = (y / 8 % 2) * 12; x < w; x += 24) {
          ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + 8); ctx.stroke();
        }
      }
    } else {
      ctx.fillStyle = 'rgba(0,0,0,0.14)';
      for (let y = 0; y < h; y += 16) ctx.fillRect(0, y, w, 2);
      grain(ctx, w, h, 160, ['rgba(0,0,0,0.2)', 'rgba(255,255,255,0.12)'], 2);
    }
    // Windows: dense grid, so any slice of a close face still shows some.
    for (let y = 4; y < 124; y += 10) {
      for (let x = 4; x < 124; x += 8) {
        const lit = rng() < 0.42;
        ctx.fillStyle = lit ? (rng() < 0.7 ? '#ffd98a' : '#9fd8ff') : '#20242e';
        ctx.fillRect(x, y, 4, 6);
      }
    }
  }, [2, 2]);
}

// Glass tower: dark teal gradient, dense mostly-lit windows, mullions.
// Drawn from its own seeded stream so the city layout stays put.
function drawGlass(rng) {
  return makeCanvasTex(128, 128, (ctx, w, h) => {
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#2a4a6a');
    grad.addColorStop(0.6, '#1a3248');
    grad.addColorStop(1, '#0e1e30');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    for (let y = 0; y < h; y += 16) ctx.fillRect(0, y, w, 2);
    for (let y = 4; y < h - 4; y += 10) {
      for (let x = 4; x < w - 4; x += 9) {
        const lit = rng() < 0.55;
        ctx.fillStyle = lit ? (rng() < 0.75 ? '#ffd98a' : '#ffb347') : '#0a141e';
        ctx.fillRect(x, y, 5, 6);
      }
    }
    ctx.fillStyle = 'rgba(200,225,255,0.55)';
    for (let x = 0; x < w; x += 9) ctx.fillRect(x, 0, 1.5, h);
  }, [2, 4]);
}

// Ground-floor storefront: sign band, sunset-glass panes, door, awning.
function drawStorefront(signText, signColor, awningColor) {
  return makeCanvasTex(256, 128, (ctx, w, h) => {
    ctx.fillStyle = '#2a2a30';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = signColor;
    ctx.fillRect(0, 0, w, 26);
    ctx.fillStyle = '#111';
    ctx.font = 'bold 20px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(signText, w / 2, 19);
    for (let x = 8; x < w - 8; x += 62) {
      const grad = ctx.createLinearGradient(x, 30, x + 54, 96);
      grad.addColorStop(0, '#3a5a7a');
      grad.addColorStop(0.5, '#ff9a3d');
      grad.addColorStop(1, '#2a3a4a');
      ctx.fillStyle = grad;
      ctx.fillRect(x, 34, 54, 58);
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.fillRect(x + 6, 38, 10, 50);
    }
    ctx.fillStyle = '#1a1a22';
    ctx.fillRect(w / 2 - 14, 60, 28, 36);
    for (let x = 0; x < w; x += 16) {
      ctx.fillStyle = (x / 16) % 2 === 0 ? awningColor : '#f0ead8';
      ctx.fillRect(x, 28, 16, 10);
    }
  });
}

// Neon sign: glowing text on a dark plate.
function drawNeon(text, color) {
  return makeCanvasTex(256, 64, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(10,8,18,0.9)';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.strokeRect(3, 3, w - 6, h - 6);
    ctx.font = 'bold 30px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = color;
    ctx.shadowBlur = 14;
    ctx.fillStyle = color;
    ctx.fillText(text, w / 2, h / 2 + 1);
  });
}

function drawBillboard(lines, bg, fg) {
  return makeCanvasTex(256, 128, (ctx, w, h) => {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = fg;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 26px sans-serif';
    lines.forEach((ln, i) => ctx.fillText(ln, w / 2, 34 + i * 36));
    ctx.strokeStyle = fg;
    ctx.lineWidth = 4;
    ctx.strokeRect(4, 4, w - 8, h - 8);
  });
}

// One palm: leaning trunk, seven drooping fronds, a nut cluster.
function makePalmTree(rng, trunkMat, frondMat) {
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

const STORE_SIGNS = [
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
  const animated = { sea: null, wheel: null, wheelLights: [], lights: [], clouds: [] };

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

  // Sun disc + glow, low over the sea to the west-northwest.
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
  const cloudTex = makeCanvasTex(128, 64, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    for (let i = 0; i < 14; i++) {
      const x = 20 + Math.random() * (w - 40);
      const y = 22 + Math.random() * 20;
      const r = 10 + Math.random() * 16;
      const grad = ctx.createRadialGradient(x, y, 1, x, y, r);
      grad.addColorStop(0, 'rgba(255,235,220,0.85)');
      grad.addColorStop(1, 'rgba(255,235,220,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  });
  for (let i = 0; i < 9; i++) {
    const puff = new THREE.Mesh(
      new THREE.PlaneGeometry(range(rng, 90, 170), range(rng, 28, 48)),
      new THREE.MeshBasicMaterial({ map: cloudTex, transparent: true, depthWrite: false, fog: false }),
    );
    puff.position.set(range(rng, -500, 300), range(rng, 130, 220), range(rng, -420, 420));
    puff.lookAt(0, puff.position.y, 0);
    scene.add(puff);
    animated.clouds.push(puff);
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

  // Ground: city slab, beach strip, sea.
  const slab = new THREE.Mesh(
    new THREE.PlaneGeometry(560, 560),
    new THREE.MeshStandardMaterial({ color: 0x3d3a44, roughness: 1 }),
  );
  slab.rotation.x = -Math.PI / 2;
  slab.position.x = 20;
  scene.add(slab);

  const beach = new THREE.Mesh(
    new THREE.PlaneGeometry(80, 560),
    new THREE.MeshStandardMaterial({ map: makeCanvasTex(128, 128, drawSand, [4, 24]), roughness: 1 }),
  );
  beach.rotation.x = -Math.PI / 2;
  beach.position.set(-220, 0.05, 0);
  scene.add(beach);

  const seaCanvas = document.createElement('canvas');
  seaCanvas.width = 256;
  seaCanvas.height = 256;
  const seaCtx = seaCanvas.getContext('2d');
  seaCtx.fillStyle = '#274b7a';
  seaCtx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 90; i++) {
    seaCtx.strokeStyle = rng() < 0.5 ? 'rgba(255,170,90,0.35)' : 'rgba(255,255,255,0.18)';
    seaCtx.lineWidth = 1 + rng() * 2;
    const y = rng() * 256;
    seaCtx.beginPath();
    seaCtx.moveTo(rng() * 256, y);
    seaCtx.lineTo(rng() * 256 + 40, y + range(rng, -4, 4));
    seaCtx.stroke();
  }
  const seaTex = new THREE.CanvasTexture(seaCanvas);
  seaTex.wrapS = THREE.RepeatWrapping;
  seaTex.wrapT = THREE.RepeatWrapping;
  seaTex.repeat.set(6, 6);
  seaTex.colorSpace = THREE.SRGBColorSpace;
  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(400, 700),
    new THREE.MeshStandardMaterial({ map: seaTex, roughness: 0.35, metalness: 0.25 }),
  );
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(-440, 0.02, 0);
  scene.add(sea);
  animated.ocean = seaTex;

  // Roads: textured tarmac, centre dashes, crosswalks, tiled sidewalks.
  const tarmacTex = makeCanvasTex(128, 256, drawAsphalt, [1, 24]);
  const tarmac = new THREE.MeshStandardMaterial({ map: tarmacTex, roughness: 0.95 });
  const dashMat = new THREE.MeshBasicMaterial({ color: 0xd8c25a });
  const walkMat = new THREE.MeshStandardMaterial({ map: makeCanvasTex(128, 128, drawSidewalk, [1, 32]), roughness: 1 });
  const roadNSGeo = new THREE.PlaneGeometry(9, 400);
  const roadEWGeo = new THREE.PlaneGeometry(400, 9);
  const dashGeo = new THREE.PlaneGeometry(0.5, 3);
  const crossMat = new THREE.MeshBasicMaterial({ color: 0xe8e8e0 });
  const crossGeo = new THREE.PlaneGeometry(1.1, 3.4);
  for (const c of ROAD_COORDS) {
    const stripN = new THREE.Mesh(roadNSGeo, tarmac);
    stripN.rotation.x = -Math.PI / 2;
    stripN.position.set(c, 0.06, 0);
    scene.add(stripN);
    const stripE = new THREE.Mesh(roadEWGeo, tarmac);
    stripE.rotation.x = -Math.PI / 2;
    stripE.position.set(0, 0.06, c);
    scene.add(stripE);
    for (let z = -180; z <= 180; z += 14) {
      const dashA = new THREE.Mesh(dashGeo, dashMat);
      dashA.rotation.x = -Math.PI / 2;
      dashA.position.set(c, 0.09, z);
      scene.add(dashA);
      const dashB = new THREE.Mesh(dashGeo, dashMat);
      dashB.rotation.x = -Math.PI / 2;
      dashB.rotation.z = Math.PI / 2;
      dashB.position.set(z, 0.09, c);
      scene.add(dashB);
    }
    for (const c2 of ROAD_COORDS) {
      if ((c + c2) % 80 !== 0) continue;
      for (let i = -3; i <= 3; i++) {
        const stripe = new THREE.Mesh(crossGeo, crossMat);
        stripe.rotation.x = -Math.PI / 2;
        stripe.position.set(c + i * 1.2, 0.08, c2 + 5.6);
        scene.add(stripe);
      }
    }
  }
  const walkNSGeo = new THREE.PlaneGeometry(2.4, 400);
  const walkEWGeo = new THREE.PlaneGeometry(400, 2.4);
  for (const c of ROAD_COORDS) {
    for (const off of [-5.8, 5.8]) {
      const walkN = new THREE.Mesh(walkNSGeo, walkMat);
      walkN.rotation.x = -Math.PI / 2;
      walkN.position.set(c + off, 0.07, 0);
      scene.add(walkN);
      const walkE = new THREE.Mesh(walkEWGeo, walkMat);
      walkE.rotation.x = -Math.PI / 2;
      walkE.position.set(0, 0.07, c + off);
      scene.add(walkE);
    }
  }

  // Buildings: textured facades, storefronts on the Strip, neon signs.
  const facadeSpecs = [
    ['#b08a6a', true], ['#7a8a9a', false],
    ['#c9a06a', true], ['#8a7a9a', false],
    ['#a06a5a', true], ['#5a7a8a', false],
  ];
  const facadeMats = facadeSpecs.map(([hue, brick]) =>
    new THREE.MeshStandardMaterial({ map: drawFacade(rng, hue, brick), roughness: 0.85 }));
  const glassMat = new THREE.MeshStandardMaterial({
    map: drawGlass(createRng(20261118)), roughness: 0.35, metalness: 0.15,
  });
  const finMat = new THREE.MeshStandardMaterial({ color: 0xd8d8e0, roughness: 0.4, metalness: 0.5 });
  const TOWER_NAMES = ['HOTEL CORAL', 'CORAL TOWER', 'MARINA SUITES', 'SUNSET PLAZA'];
  let towerIdx = 0;
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x2a2a30, roughness: 1 });
  const blockGeo = new THREE.BoxGeometry(1, 1, 1);
  const parkCells = new Set(['-1,2', '2,-2', '1,1']);
  const lawnTex = makeCanvasTex(128, 128, drawGrass, [3, 3]);
  let shopIdx = 0;
  for (let blockX = 0; blockX < 8; blockX++) {
    for (let blockZ = 0; blockZ < 8; blockZ++) {
      const cellX = -160 + blockX * ROAD_STEP + ROAD_STEP / 2;
      const cellZ = -160 + blockZ * ROAD_STEP + ROAD_STEP / 2;
      if (cellX < BEACH_X + 30) continue; // beachfront stays open
      if (parkCells.has(`${blockX},${blockZ}`)) {
        const lawn = new THREE.Mesh(
          new THREE.PlaneGeometry(30, 30),
          new THREE.MeshStandardMaterial({ map: lawnTex, roughness: 1 }),
        );
        lawn.rotation.x = -Math.PI / 2;
        lawn.position.set(cellX, 0.08, cellZ);
        scene.add(lawn);
        continue;
      }
      const downtown = Math.abs(cellX) < 80 && Math.abs(cellZ) < 80;
      const count = downtown ? (chance(rng, 0.5) ? 3 : 2) : (chance(rng, 0.3) ? 1 : 2);
      for (let i = 0; i < count; i++) {
        const w = range(rng, 12, 24);
        const depth = range(rng, 12, 24);
        const h = range(rng, 9, 46) * (downtown ? 1.7 : 1);
        // The footprint must stay inside its block (31 units between
        // roads): a wide building at the block edge would jut onto the road
        // and wedge any car driving past.
        const x = clamp(
          cellX + (count === 1 ? 0 : (i === 0 ? -7 : i === 1 ? 7 : 0)) + range(rng, -2, 2),
          cellX - 15.5 + w / 2, cellX + 15.5 - w / 2,
        );
        const z = clamp(cellZ + range(rng, -4, 4), cellZ - 15.5 + depth / 2, cellZ + 15.5 - depth / 2);
        const onStrip = Math.abs(x + 140) < 26;
        const mat = chance(rng, 0.18) ? glassMat : pick(rng, facadeMats);
        const b = new THREE.Mesh(blockGeo, mat);
        b.scale.set(w, h, depth);
        b.position.set(x, h / 2, z);
        scene.add(b);
        const roofCap = new THREE.Mesh(blockGeo, roofMat);
        roofCap.scale.set(w + 0.6, 0.8, depth + 0.6);
        roofCap.position.set(x, h + 0.4, z);
        scene.add(roofCap);
        // Glass towers: rooftop crown + corner fins + a lit sign.
        if (mat === glassMat) {
          const crown = new THREE.Mesh(blockGeo, roofMat);
          crown.scale.set(w * 0.6, 2.4, depth * 0.6);
          crown.position.set(x, h + 2, z);
          scene.add(crown);
          for (const s of [-1, 1]) {
            const finPiece = new THREE.Mesh(blockGeo, finMat);
            finPiece.scale.set(0.5, h * 0.9, 0.5);
            finPiece.position.set(x + w / 2 + 0.3, h * 0.45, z + s * (depth / 2 + 0.3));
            scene.add(finPiece);
          }
          if (h > 24) {
            const sign = new THREE.Mesh(
              new THREE.PlaneGeometry(12, 3),
              new THREE.MeshBasicMaterial({
                map: drawNeon(TOWER_NAMES[towerIdx % TOWER_NAMES.length], '#ff9a3d'),
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
        if (onStrip && h < 30 && shopIdx < STORE_SIGNS.length * 2) {
          const sign = STORE_SIGNS[shopIdx % STORE_SIGNS.length];
          shopIdx += 1;
          const shop = new THREE.Mesh(
            new THREE.PlaneGeometry(Math.min(w * 0.9, 16), 4.2),
            new THREE.MeshStandardMaterial({
              map: drawStorefront(sign.text, sign.color, sign.awning), roughness: 0.6,
            }),
          );
          shop.position.set(x, 2.1, z - depth / 2 - 0.08);
          shop.rotation.y = Math.PI;
          scene.add(shop);
          const neon = new THREE.Mesh(
            new THREE.PlaneGeometry(10, 2.5),
            new THREE.MeshBasicMaterial({ map: drawNeon(sign.text, sign.color), transparent: true }),
          );
          neon.position.set(x, h * 0.62, z - depth / 2 - 0.12);
          neon.rotation.y = Math.PI;
          scene.add(neon);
        }
        // Rooftop props: AC box + antenna + water tower on tall towers.
        if (h > 24) {
          const ac = new THREE.Mesh(blockGeo, roofMat);
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
            tank.position.set(x - w / 4, h + 2.2, z + depth / 4);
            scene.add(tank);
            const cone = new THREE.Mesh(new THREE.ConeGeometry(1.7, 1.4, 8), roofMat);
            cone.position.set(x - w / 4, h + 4.4, z + depth / 4);
            scene.add(cone);
          }
        }
        colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - depth / 2, maxZ: z + depth / 2 });
      }
    }
  }

  // Billboards on rooftops around Downtown.
  const boards = [
    { lines: ['CORAL HEAT', 'VISIT THE MARINA'], bg: '#ff2e63', fg: '#fff', x: 20, z: -40, y: 42, ry: 0 },
    { lines: ['CORAL COLA', 'TASTE THE SUNSET'], bg: '#37b6ff', fg: '#fff', x: -40, z: 40, y: 36, ry: Math.PI / 2 },
    { lines: ['SUNSET POINT', 'FERRIS WHEEL'], bg: '#ffb347', fg: '#1a1a22', x: 80, z: 80, y: 34, ry: Math.PI },
  ];
  for (const bb of boards) {
    const board = new THREE.Mesh(
      new THREE.PlaneGeometry(22, 11),
      new THREE.MeshStandardMaterial({ map: drawBillboard(bb.lines, bb.bg, bb.fg), roughness: 0.6 }),
    );
    board.position.set(bb.x, bb.y, bb.z);
    board.rotation.y = bb.ry;
    scene.add(board);
    const post = new THREE.Mesh(new THREE.BoxGeometry(1, 6, 1), roofMat);
    post.position.set(bb.x, bb.y - 8, bb.z);
    scene.add(post);
  }

  // Palms along Coral Strip + scattered in parkCells.
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x7a5a34, roughness: 1 });
  const frondMat = new THREE.MeshStandardMaterial({ color: 0x2e7a2e, roughness: 0.9, side: THREE.DoubleSide });
  for (let z = -170; z <= 170; z += 13) {
    for (const x of [-172, -148]) {
      const p = makePalmTree(rng, trunkMat, frondMat);
      p.position.set(x + range(rng, -1, 1), 0, z + range(rng, -2, 2));
      scene.add(p);
    }
  }
  for (let i = 0; i < 26; i++) {
    const p = makePalmTree(rng, trunkMat, frondMat);
    p.position.set(range(rng, -140, 170), 0, range(rng, -170, 170));
    scene.add(p);
  }

  // Street lamps along the Strip and the two main avenues.
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x222226, roughness: 0.6, metalness: 0.6 });
  const bulbMat = new THREE.MeshBasicMaterial({ color: 0xffd98a });
  function addLamp(x, z) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 7, 6), poleMat);
    pole.position.set(x, 3.5, z);
    scene.add(pole);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.45, 8, 6), bulbMat);
    bulb.position.set(x, 7.1, z);
    scene.add(bulb);
  }
  for (let z = -160; z <= 160; z += 40) addLamp(-168, z);
  for (let x = -120; x <= 160; x += 40) {
    addLamp(x, -6);
    addLamp(x + 12, 6);
  }

  // Traffic lights at the four big intersections.
  const signalPoleMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.6, metalness: 0.5 });
  const redLight = new THREE.MeshBasicMaterial({ color: 0xff2020 });
  const amberLight = new THREE.MeshBasicMaterial({ color: 0xffb347 });
  const greenLight = new THREE.MeshBasicMaterial({ color: 0x37e08a });
  const offLight = new THREE.MeshBasicMaterial({ color: 0x222222 });
  for (const [ix, iz] of [[-80, -80], [0, 0], [80, 80], [-40, 40]]) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 6.5, 6), signalPoleMat);
    pole.position.set(ix + 6.5, 3.25, iz + 6.5);
    scene.add(pole);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.9, 2.4, 0.7), signalPoleMat);
    head.position.set(ix + 6.5, 6.8, iz + 6.5);
    scene.add(head);
    const bulbs = [];
    for (let i = 0; i < 3; i++) {
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 6), offLight);
      b.position.set(ix + 6.5, 7.5 - i * 0.75, iz + 6.5 + 0.4);
      scene.add(b);
      bulbs.push(b);
    }
    animated.lights.push({ bulbs, redMat: redLight, amberMat: amberLight, greenMat: greenLight, darkMat: offLight, phase: (ix + iz) % 2 === 0 ? 0 : 14 });
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
    const top = new THREE.Mesh(new THREE.BoxGeometry(4, 0.15, 1.8), shelterMat);
    top.position.y = 2.6;
    shelter.add(top);
    for (const s of [-1.9, 1.9]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.6, 0.12), shelterMat);
      post.position.set(s, 1.3, 0);
      shelter.add(post);
    }
    const seat = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.12, 0.5), benchMat);
    seat.position.y = 0.55;
    shelter.add(seat);
    shelter.position.set(-166, 0, z);
    scene.add(shelter);
  }

  // Beach umbrellas + towels on the beach.
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
  const hullWhite = new THREE.MeshStandardMaterial({ color: 0xf0ead8, roughness: 0.4 });
  const hullBlue = new THREE.MeshStandardMaterial({ color: 0x3a6a9a, roughness: 0.4 });
  for (let i = 0; i < 6; i++) {
    const boat = new THREE.Group();
    const hull = new THREE.Mesh(new THREE.BoxGeometry(4, 1.6, 10), i % 2 ? hullBlue : hullWhite);
    hull.position.y = 0.4;
    boat.add(hull);
    const cabin = new THREE.Mesh(
      new THREE.BoxGeometry(2.6, 1.6, 4),
      new THREE.MeshStandardMaterial({ color: 0xdddddd, roughness: 0.5 }),
    );
    cabin.position.set(0, 1.8, -1);
    boat.add(cabin);
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 6, 5), poleMat);
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

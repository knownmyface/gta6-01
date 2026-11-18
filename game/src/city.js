// Coral Bay: the sunset marina city of CORAL HEAT. Builds the whole 3D world
// from one seeded stream — roads, buildings with lit windows, palms, the beach,
// the ocean, the marina pier, boats and a Ferris wheel — plus the collision
// boxes, the road graph traffic and pedestrians follow, and district names.
import * as THREE from 'three';
import { createRng, pick, range, rangeInt, chance } from './rng.js';

export const ROAD_STEP = 40;
export const ROAD_COORDS = [-160, -120, -80, -40, 0, 40, 80, 120, 160];
export const CITY_MIN = -180;
export const CITY_MAX = 180;
export const BEACH_X = -180;   // sand starts west of this line
export const OCEAN_X = -245;   // water starts west of this line

const DISTRICTS = [
  { name: 'CORAL STRIP', x0: -260, x1: -120, z0: -260, z1: 260 },
  { name: 'THE DOCKS', x0: -120, x1: 40, z0: 120, z1: 260 },
  { name: 'OLD TOWN', x0: -120, x1: 40, z0: -260, z1: -80 },
  { name: 'PALM HEIGHTS', x0: 40, x1: 260, z0: -260, z1: 40 },
  { name: 'SUNSET POINT', x0: -260, x1: -120, z0: 120, z1: 260 },
  { name: 'MARINA', x0: -260, x1: 60, z0: 120, z1: 260 },
  { name: 'DOWNTOWN', x0: -120, x1: 260, z0: -80, z1: 120 },
];

export function districtAt(x, z) {
  for (const d of DISTRICTS) if (x >= d.x0 && x < d.x1 && z >= d.z0 && z < d.z1) return d.name;
  return 'CORAL BAY';
}

// A canvas texture of lit windows, generated at runtime — no image files.
function windowTexture(rng, litRatio, hue) {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = hue; g.fillRect(0, 0, 64, 128);
  for (let y = 6; y < 122; y += 12) {
    for (let x = 6; x < 58; x += 10) {
      const lit = rng() < litRatio;
      g.fillStyle = lit ? (rng() < 0.7 ? '#ffd98a' : '#9fd8ff') : '#20242e';
      g.fillRect(x, y, 6, 8);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function palmTree(rng, trunkMat, frondMat) {
  const tree = new THREE.Group();
  const h = range(rng, 5, 8);
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.32, h, 6), trunkMat);
  trunk.position.y = h / 2;
  trunk.rotation.z = range(rng, -0.08, 0.08);
  tree.add(trunk);
  const crown = new THREE.Group();
  crown.position.y = h;
  for (let i = 0; i < 7; i++) {
    const frond = new THREE.Mesh(new THREE.ConeGeometry(0.55, 3.4, 4), frondMat);
    frond.scale.set(1, 1, 0.22);
    const a = (i / 7) * Math.PI * 2;
    frond.position.set(Math.cos(a) * 1.1, 0.25, Math.sin(a) * 1.1);
    frond.rotation.set(Math.sin(a) * 1.15, 0, -Math.cos(a) * 1.15);
    crown.add(frond);
  }
  const nuts = new THREE.Mesh(new THREE.SphereGeometry(0.32, 6, 5), new THREE.MeshStandardMaterial({ color: 0x8a6a2f, roughness: 0.9 }));
  nuts.position.y = -0.2;
  crown.add(nuts);
  tree.add(crown);
  return tree;
}

export function buildCity(scene, seed) {
  const rng = createRng(seed);
  const colliders = [];
  const animated = { ocean: null, wheel: null, wheelLights: [] };

  // --- sky: gradient dome, sunset low over the ocean to the west ---
  const skyGeo = new THREE.SphereGeometry(900, 24, 16);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: { top: { value: new THREE.Color(0x2b1b4d) }, mid: { value: new THREE.Color(0xd94f4f) }, low: { value: new THREE.Color(0xff9a3d) } },
    vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `varying vec3 vP; uniform vec3 top; uniform vec3 mid; uniform vec3 low;
      void main(){ float h = normalize(vP).y; vec3 c = h > 0.25 ? mix(mid, top, smoothstep(0.25, 0.75, h)) : mix(low, mid, smoothstep(-0.05, 0.25, h));
      gl_FragColor = vec4(c, 1.0); }`,
  });
  scene.add(new THREE.Mesh(skyGeo, skyMat));

  // --- sun disc + glow, low over the ocean to the west-northwest ---
  const sun = new THREE.Mesh(new THREE.CircleGeometry(46, 32), new THREE.MeshBasicMaterial({ color: 0xffd27a, fog: false }));
  sun.position.set(-820, 130, -140);
  sun.lookAt(0, 40, 0);
  scene.add(sun);
  const glow = new THREE.Mesh(new THREE.CircleGeometry(120, 32), new THREE.MeshBasicMaterial({ color: 0xff8a3d, transparent: true, opacity: 0.28, fog: false }));
  glow.position.set(-825, 130, -140);
  glow.lookAt(0, 40, 0);
  scene.add(glow);

  // --- lights ---
  const sunLight = new THREE.DirectionalLight(0xffb36b, 2.4);
  sunLight.position.set(-300, 180, -60);
  scene.add(sunLight);
  // warm fill from the east so east-facing paint and glass are never black
  const fillLight = new THREE.DirectionalLight(0xff9a6a, 0.9);
  fillLight.position.set(300, 120, -80);
  scene.add(fillLight);
  scene.add(new THREE.HemisphereLight(0x8a5a8a, 0x3a2a1a, 1.15));
  scene.fog = new THREE.Fog(0xe0703f, 260, 820);

  // --- ground: city slab, sand strip, ocean ---
  const groundMat = new THREE.MeshStandardMaterial({ color: 0x3d3a44, roughness: 1 });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(560, 560), groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.x = 20;
  scene.add(ground);

  const sand = new THREE.Mesh(new THREE.PlaneGeometry(80, 560), new THREE.MeshStandardMaterial({ color: 0xe8c98a, roughness: 1 }));
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(-220, 0.05, 0);
  scene.add(sand);

  const oceanCanvas = document.createElement('canvas');
  oceanCanvas.width = 256; oceanCanvas.height = 256;
  const og = oceanCanvas.getContext('2d');
  og.fillStyle = '#274b7a'; og.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 90; i++) {
    og.strokeStyle = rng() < 0.5 ? 'rgba(255,170,90,0.35)' : 'rgba(255,255,255,0.18)';
    og.lineWidth = 1 + rng() * 2;
    const y = rng() * 256;
    og.beginPath(); og.moveTo(rng() * 256, y); og.lineTo(rng() * 256 + 40, y + range(rng, -4, 4)); og.stroke();
  }
  const oceanTex = new THREE.CanvasTexture(oceanCanvas);
  oceanTex.wrapS = oceanTex.wrapT = THREE.RepeatWrapping;
  oceanTex.repeat.set(6, 6);
  oceanTex.colorSpace = THREE.SRGBColorSpace;
  const ocean = new THREE.Mesh(new THREE.PlaneGeometry(400, 700), new THREE.MeshStandardMaterial({ map: oceanTex, roughness: 0.35, metalness: 0.25 }));
  ocean.rotation.x = -Math.PI / 2;
  ocean.position.set(-440, 0.02, 0);
  scene.add(ocean);
  animated.ocean = oceanTex;

  // --- roads: asphalt strips + centre dashes + sidewalks ---
  const asphalt = new THREE.MeshStandardMaterial({ color: 0x23232c, roughness: 0.95 });
  const dashMat = new THREE.MeshBasicMaterial({ color: 0xd8c25a });
  const walkMat = new THREE.MeshStandardMaterial({ color: 0x8a8578, roughness: 1 });
  const roadGeoNS = new THREE.PlaneGeometry(9, 400);
  const roadGeoEW = new THREE.PlaneGeometry(400, 9);
  const dashGeo = new THREE.PlaneGeometry(0.5, 3);
  for (const c of ROAD_COORDS) {
    const ns = new THREE.Mesh(roadGeoNS, asphalt); ns.rotation.x = -Math.PI / 2; ns.position.set(c, 0.06, 0); scene.add(ns);
    const ew = new THREE.Mesh(roadGeoEW, asphalt); ew.rotation.x = -Math.PI / 2; ew.position.set(0, 0.06, c); scene.add(ew);
    for (let z = -180; z <= 180; z += 14) {
      const d = new THREE.Mesh(dashGeo, dashMat); d.rotation.x = -Math.PI / 2; d.position.set(c, 0.09, z); scene.add(d);
      const d2 = new THREE.Mesh(dashGeo, dashMat); d2.rotation.x = -Math.PI / 2; d2.rotation.z = Math.PI / 2; d2.position.set(z, 0.09, c); scene.add(d2);
    }
  }
  // sidewalks: lighter strips along each road edge
  const walkGeoNS = new THREE.PlaneGeometry(2.4, 400);
  const walkGeoEW = new THREE.PlaneGeometry(400, 2.4);
  for (const c of ROAD_COORDS) {
    for (const off of [-5.8, 5.8]) {
      const w1 = new THREE.Mesh(walkGeoNS, walkMat); w1.rotation.x = -Math.PI / 2; w1.position.set(c + off, 0.07, 0); scene.add(w1);
      const w2 = new THREE.Mesh(walkGeoEW, walkMat); w2.rotation.x = -Math.PI / 2; w2.position.set(0, 0.07, c + off); scene.add(w2);
    }
  }

  // --- buildings: one per block quadrant, window-lit, pastel + glass towers ---
  const facadeHues = ['#b08a6a', '#7a8a9a', '#c9a06a', '#8a7a9a', '#a06a5a', '#5a7a8a'];
  const facadeMats = facadeHues.map((h) => new THREE.MeshStandardMaterial({ map: windowTexture(rng, 0.45, h), roughness: 0.85 }));
  const glassMat = new THREE.MeshStandardMaterial({ map: windowTexture(rng, 0.6, '#3a5a7a'), roughness: 0.25, metalness: 0.5 });
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x2a2a30, roughness: 1 });
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  const parks = new Set(['-1,2', '2,-2', '1,1']);
  for (let bx = 0; bx < 8; bx++) {
    for (let bz = 0; bz < 8; bz++) {
      const cx = -160 + bx * ROAD_STEP + ROAD_STEP / 2;
      const cz = -160 + bz * ROAD_STEP + ROAD_STEP / 2;
      if (cx < BEACH_X + 30) continue; // beachfront stays open
      if (parks.has(`${bx},${bz}`)) {
        // pocket park: grass + palms + benches
        const grass = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.MeshStandardMaterial({ color: 0x4a7a3a, roughness: 1 }));
        grass.rotation.x = -Math.PI / 2; grass.position.set(cx, 0.08, cz); scene.add(grass);
        continue;
      }
      const n = chance(rng, 0.3) ? 1 : 2;
      for (let i = 0; i < n; i++) {
        const w = range(rng, 12, 24), d = range(rng, 12, 24);
        const h = range(rng, 9, 46) * (Math.abs(cx) < 60 && Math.abs(cz) < 60 ? 1.5 : 1);
        const x = cx + (n === 1 ? 0 : (i === 0 ? -7 : 7)) + range(rng, -2, 2);
        const z = cz + range(rng, -4, 4);
        const mat = chance(rng, 0.18) ? glassMat : pick(rng, facadeMats);
        const b = new THREE.Mesh(boxGeo, mat);
        b.scale.set(w, h, d);
        b.position.set(x, h / 2, z);
        scene.add(b);
        const roof = new THREE.Mesh(boxGeo, roofMat);
        roof.scale.set(w + 0.6, 0.8, d + 0.6);
        roof.position.set(x, h + 0.4, z);
        scene.add(roof);
        // rooftop props: AC box + antenna on tall towers
        if (h > 24) {
          const ac = new THREE.Mesh(boxGeo, roofMat);
          ac.scale.set(3, 1.6, 2); ac.position.set(x + w / 4, h + 1.4, z); scene.add(ac);
          const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 7, 5), roofMat);
          ant.position.set(x - w / 4, h + 4, z); scene.add(ant);
        }
        colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
      }
    }
  }

  // --- palms along Coral Strip + scattered in parks ---
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x7a5a34, roughness: 1 });
  const frondMat = new THREE.MeshStandardMaterial({ color: 0x2e7a2e, roughness: 0.9, side: THREE.DoubleSide });
  for (let z = -170; z <= 170; z += 13) {
    for (const x of [-172, -148]) {
      const p = palmTree(rng, trunkMat, frondMat);
      p.position.set(x + range(rng, -1, 1), 0, z + range(rng, -2, 2));
      scene.add(p);
    }
  }
  for (let i = 0; i < 26; i++) {
    const p = palmTree(rng, trunkMat, frondMat);
    p.position.set(range(rng, -140, 170), 0, range(rng, -170, 170));
    scene.add(p);
  }

  // --- street lamps along the Strip ---
  const lampMat = new THREE.MeshStandardMaterial({ color: 0x222226, roughness: 0.6, metalness: 0.6 });
  const lampGlow = new THREE.MeshBasicMaterial({ color: 0xffd98a });
  for (let z = -160; z <= 160; z += 40) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 7, 6), lampMat);
    pole.position.set(-168, 3.5, z); scene.add(pole);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.45, 8, 6), lampGlow);
    bulb.position.set(-168, 7.1, z); scene.add(bulb);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.16, 0.16), lampMat);
    arm.position.set(-167, 6.9, z); scene.add(arm);
  }

  // --- marina: pier, boats, Ferris wheel on the south beach ---
  const pierMat = new THREE.MeshStandardMaterial({ color: 0x6a4a2a, roughness: 1 });
  const pier = new THREE.Mesh(new THREE.BoxGeometry(10, 1.2, 90), pierMat);
  pier.position.set(-215, 0.6, 190); scene.add(pier);
  colliders.push({ minX: -220, maxX: -210, minZ: 145, maxZ: 235 });
  const boatHull = new THREE.MeshStandardMaterial({ color: 0xf0ead8, roughness: 0.4 });
  const boatHull2 = new THREE.MeshStandardMaterial({ color: 0x3a6a9a, roughness: 0.4 });
  for (let i = 0; i < 6; i++) {
    const boat = new THREE.Group();
    const hull = new THREE.Mesh(new THREE.BoxGeometry(4, 1.6, 10), i % 2 ? boatHull2 : boatHull);
    hull.position.y = 0.4; boat.add(hull);
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.6, 4), new THREE.MeshStandardMaterial({ color: 0xdddddd, roughness: 0.5 }));
    cabin.position.set(0, 1.8, -1); boat.add(cabin);
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 6, 5), lampMat);
    mast.position.set(0, 4.5, 1); boat.add(mast);
    boat.position.set(-228 - (i % 3) * 8, 0, 160 + Math.floor(i / 3) * 40);
    boat.rotation.y = range(rng, -0.2, 0.2);
    scene.add(boat);
  }

  // Ferris wheel "The Coral Wheel" at Sunset Point
  const wheelGroup = new THREE.Group();
  wheelGroup.position.set(-196, 0, 150);
  const legMat = new THREE.MeshStandardMaterial({ color: 0xd8d8e0, roughness: 0.5, metalness: 0.4 });
  for (const s of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.7, 34, 6), legMat);
    leg.position.set(s * 2.4, 17, 0); leg.rotation.z = s * 0.16; wheelGroup.add(leg);
  }
  const wheel = new THREE.Group();
  wheel.position.set(0, 26, 0);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(15, 0.5, 8, 40), legMat);
  wheel.add(rim);
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 3, 10), new THREE.MeshStandardMaterial({ color: 0xff2e63, roughness: 0.4 }));
  hub.rotation.x = Math.PI / 2; wheel.add(hub);
  const cabinColors = [0xff2e63, 0xffb347, 0x37b6ff, 0x7dff9a, 0xff7ad9, 0x9fd8ff, 0xffd23e, 0x8a7aff];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const spoke = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 15, 5), legMat);
    spoke.position.set(Math.cos(a) * 7.5, Math.sin(a) * 7.5, 0);
    spoke.rotation.z = a + Math.PI / 2;
    wheel.add(spoke);
    const cab = new THREE.Mesh(new THREE.BoxGeometry(2.6, 2.2, 2.2), new THREE.MeshStandardMaterial({ color: cabinColors[i], roughness: 0.5 }));
    cab.position.set(Math.cos(a) * 15, Math.sin(a) * 15, 0);
    wheel.add(cab);
    const light = new THREE.Mesh(new THREE.SphereGeometry(0.35, 6, 5), new THREE.MeshBasicMaterial({ color: cabinColors[i] }));
    light.position.set(Math.cos(a) * 15, Math.sin(a) * 15 + 1.4, 0);
    wheel.add(light);
    animated.wheelLights.push(light);
  }
  wheelGroup.add(wheel);
  scene.add(wheelGroup);
  animated.wheel = wheel;
  colliders.push({ minX: -202, maxX: -190, minZ: 144, maxZ: 156 });

  // --- mission beacon: gold light column, moved by missions.js ---
  const beacon = new THREE.Group();
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(2.2, 3.4, 60, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffd23e, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false }),
  );
  beam.position.y = 30;
  beacon.add(beam);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(4, 0.35, 8, 32), new THREE.MeshBasicMaterial({ color: 0xffd23e }));
  ring.rotation.x = Math.PI / 2; ring.position.y = 0.3;
  beacon.add(ring);
  const arrow = new THREE.Mesh(new THREE.ConeGeometry(1.4, 3.4, 8), new THREE.MeshBasicMaterial({ color: 0xffd23e }));
  arrow.position.y = 8; arrow.rotation.x = Math.PI;
  beacon.add(arrow);
  beacon.visible = false;
  scene.add(beacon);

  return { colliders, animated, beacon, rng };
}

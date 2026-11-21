// coralcity.js — Coral Bay: sunset coastal marina city. Grid streets, towers,
// palms, beach, ocean, marina piers with moored boats, ferris wheel, props.
import * as THREE from 'three';
import { box, cyl, rand, randi, pick, mulberry } from './util.js';

export const CITY = { half: 340, roadGap: 76, block: 44 };
export const MARINA = { x: 150, z: 210, w: 260, d: 90 };

export function buildCity(G) {
  const S = G.scene;
  const rng = mulberry(20261121);
  const colliders = [];
  const addCollider = (x, z, hw, hd) => colliders.push({ x, z, hw, hd });
  const mat = (c) => new THREE.MeshLambertMaterial({ color: c });

  // Sky: big gradient dome (vertex-coloured sphere, BackSide)
  const skyGeo = new THREE.SphereGeometry(900, 24, 12);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color(0x2b1a5e) }, mid: { value: new THREE.Color(0xff7a3c) }, bot: { value: new THREE.Color(0xffb36b) } },
    vertexShader: 'varying vec3 vP; void main(){ vP=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader: 'varying vec3 vP; uniform vec3 top; uniform vec3 mid; uniform vec3 bot; void main(){ float h=normalize(vP).y; vec3 c = h>0.25 ? mix(mid,top,smoothstep(0.25,0.9,h)) : mix(bot,mid,smoothstep(-0.05,0.25,h)); gl_FragColor=vec4(c,1.0); }',
  });
  S.add(new THREE.Mesh(skyGeo, skyMat));

  // Sun disc + glow sprite
  const sun = new THREE.Mesh(new THREE.CircleGeometry(46, 32), new THREE.MeshBasicMaterial({ color: 0xffd9a0, fog: false }));
  sun.position.set(-420, 150, -620); sun.lookAt(0, 40, 0); S.add(sun);
  const sunGlow = new THREE.Mesh(new THREE.CircleGeometry(90, 32), new THREE.MeshBasicMaterial({ color: 0xff8c4a, transparent: true, opacity: 0.28, fog: false }));
  sunGlow.position.copy(sun.position).multiplyScalar(1.001); sunGlow.lookAt(0, 40, 0); S.add(sunGlow);

  // Ground: city slab + beach strip + ocean plane
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(760, 760), mat(0x3d3a4a));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; S.add(ground);
  const beach = new THREE.Mesh(new THREE.PlaneGeometry(760, 70), mat(0xe8c98a));
  beach.rotation.x = -Math.PI / 2; beach.position.set(0, 0.05, 345); beach.receiveShadow = true; S.add(beach);
  const ocean = new THREE.Mesh(new THREE.PlaneGeometry(1200, 420), new THREE.MeshPhongMaterial({ color: 0x1d6f8e, shininess: 120, specular: 0xff9a5c }));
  ocean.rotation.x = -Math.PI / 2; ocean.position.set(0, 0.1, 590); S.add(ocean);
  G.ocean = ocean;

  // Roads: grid strips + centre dashes
  const roadMat = mat(0x23232e);
  const dashMat = mat(0xf5d76e);
  const roads = [];
  for (let i = -4; i <= 4; i++) {
    const c = i * CITY.roadGap;
    roads.push([c, 0, 14, 700]); roads.push([0, c, 700, 14]);
  }
  for (const [x, z, w, d] of roads) {
    const r = new THREE.Mesh(new THREE.PlaneGeometry(w, d), roadMat);
    r.rotation.x = -Math.PI / 2; r.position.set(x, 0.08, z); r.receiveShadow = true; S.add(r);
  }
  for (let i = -4; i <= 4; i++) {
    const c = i * CITY.roadGap;
    for (let t = -320; t <= 320; t += 16) {
      const d1 = new THREE.Mesh(new THREE.PlaneGeometry(4, 1.1), dashMat);
      d1.rotation.x = -Math.PI / 2; d1.position.set(c, 0.12, t); S.add(d1);
      const d2 = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 4), dashMat);
      d2.rotation.x = -Math.PI / 2; d2.position.set(t, 0.12, c); S.add(d2);
    }
  }

  // Buildings: blocks between roads, sunset-lit facades
  const palette = [0x8a6f8f, 0xb0703c, 0x5c7a9e, 0xc98a4b, 0x7a5a8a, 0x4a6a7a, 0xa85a5a, 0x6a8a6a, 0x9a7a3a, 0x5566aa];
  const winMat = new THREE.MeshBasicMaterial({ color: 0xffd27a });
  for (let gx = -4; gx <= 4; gx++) for (let gz = -4; gz <= 4; gz++) {
    if (gx === 0 && gz === 0) continue; // central plaza
    if (gz === 4 && gx >= 1) continue; // marina district left open
    const cx = gx * CITY.roadGap, cz = gz * CITY.roadGap;
    const bx = cx + rand(-8, 8), bz = cz + rand(-8, 8);
    const w = rand(20, 34), d = rand(20, 34), h = rand(14, 78);
    const b = box(w, h, d, pick(palette), bx, h / 2, bz);
    S.add(b); addCollider(bx, bz, w / 2 + 1, d / 2 + 1);
    // lit windows: small emissive planes on the sun-facing side
    const rows = Math.floor(h / 7);
    for (let r = 0; r < rows; r++) for (let k = 0; k < 4; k++) {
      if (rng() < 0.45) continue;
      const win = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 2.8), winMat);
      win.position.set(bx - w / 2 + 4 + k * (w - 8) / 3, 5 + r * 7, bz + d / 2 + 0.06);
      S.add(win);
    }
    // rooftop box
    if (rng() < 0.6) S.add(box(w * 0.3, 3, d * 0.3, 0x2e2e3a, bx + w * 0.2, h + 1.5, bz));
  }

  // Central plaza: fountain + statue
  const plaza = cyl(16, 18, 1.2, 0x9a8a7a, 0, 0.6, 0, 24); S.add(plaza);
  const fountain = cyl(9, 10, 1.6, 0x3a9ab0, 0, 1.4, 0, 20); S.add(fountain);
  S.add(cyl(1.2, 2, 14, 0xd8c9a0, 0, 8, 0, 8));

  // Palm trees along roads and beach
  const palmTrunk = mat(0x7a5230), palmLeaf = mat(0x2e8a4a);
  function palm(x, z, s = 1) {
    const g = new THREE.Group();
    const trunk = cyl(0.35 * s, 0.55 * s, 9 * s, 0x7a5230, 0, 4.5 * s, 0, 7);
    trunk.rotation.z = 0.08; g.add(trunk);
    for (let i = 0; i < 6; i++) {
      const leaf = new THREE.Mesh(new THREE.ConeGeometry(1.1 * s, 5 * s, 4), palmLeaf);
      const a = (i / 6) * Math.PI * 2;
      leaf.position.set(Math.cos(a) * 1.8 * s, 9.2 * s, Math.sin(a) * 1.8 * s);
      leaf.rotation.set(Math.sin(a) * 1.1, 0, -Math.cos(a) * 1.1);
      leaf.castShadow = true; g.add(leaf);
    }
    g.position.set(x, 0, z); S.add(g);
  }
  for (let i = -4; i <= 4; i++) {
    palm(i * CITY.roadGap + 12, -320 + rand(-4, 4));
    palm(i * CITY.roadGap - 12, 320 - rand(0, 8));
    palm(-320 + rand(-4, 4), i * CITY.roadGap + 12);
    palm(320 - rand(0, 8), i * CITY.roadGap - 12);
  }
  for (let x = -300; x <= 300; x += 26) palm(x + rand(-5, 5), 330 + rand(-4, 6), rand(0.9, 1.3));

  // Beach props: umbrellas + lifeguard tower
  for (let x = -260; x <= 260; x += 52) {
    const ux = x + rand(-8, 8);
    S.add(cyl(0.12, 0.12, 3.4, 0xd8d8d8, ux, 1.7, 348, 6));
    const um = new THREE.Mesh(new THREE.ConeGeometry(3.4, 1.4, 10), mat(pick([0xff5a5a, 0xffd23c, 0x3ca8ff, 0xff8ac2])));
    um.position.set(ux, 3.9, 348); um.castShadow = true; S.add(um);
    S.add(box(3.4, 0.5, 1.4, pick([0xff8a5a, 0x5ad2ff, 0xffe08a]), ux + 4, 0.3, 350));
  }
  const tower = new THREE.Group();
  tower.add(box(1, 7, 1, 0x8a6a3a, -2, 3.5, 0)); tower.add(box(1, 7, 1, 0x8a6a3a, 2, 3.5, 0));
  tower.add(box(6, 0.6, 5, 0xd8c9a0, 0, 7.2, 0));
  tower.add(box(6, 2.4, 0.3, 0xff5a5a, 0, 8.6, 2.4));
  tower.add(new THREE.Mesh(new THREE.ConeGeometry(4.4, 2, 4), mat(0xff5a5a))).children;
  tower.children[tower.children.length - 1].position.set(0, 10.6, 0);
  tower.position.set(-120, 0, 348); S.add(tower);

  // Ferris wheel on the beachfront
  const wheel = new THREE.Group();
  const rim = new THREE.Mesh(new THREE.TorusGeometry(22, 1, 8, 28), mat(0xffd23c));
  wheel.add(rim);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const cab = box(3.4, 3, 3, pick([0xff5a5a, 0x3ca8ff, 0x7ae0a0, 0xff8ac2]), Math.cos(a) * 22, Math.sin(a) * 22, 0);
    wheel.add(cab);
    const spoke = box(0.5, 44, 0.5, 0xd8d8d8, 0, 0, 0);
    spoke.rotation.z = a; wheel.add(spoke);
  }
  wheel.position.set(210, 26, 330); S.add(wheel);
  G.ferris = wheel;
  S.add(box(3, 26, 3, 0x555566, 206, 13, 330)); S.add(box(3, 26, 3, 0x555566, 214, 13, 330));

  // Marina district: piers + moored boats + boathouses
  const pierMat = mat(0x6a4a2a);
  for (let p = 0; p < 3; p++) {
    const px = MARINA.x - 90 + p * 90;
    const pier = box(8, 1, 70, 0x6a4a2a, px, 0.5, MARINA.z + 20);
    S.add(pier);
    for (let b = 0; b < 3; b++) {
      const bx = px + (b % 2 === 0 ? -9 : 9), bz = MARINA.z - 10 + b * 26;
      const hull = box(5, 2, 13, pick([0xf0f0f0, 0x3ca8ff, 0xff5a5a, 0xffe08a]), bx, 0.6, bz);
      hull.rotation.y = 0; S.add(hull);
      S.add(box(3, 1.6, 5, 0x2e3a4a, bx, 2.2, bz - 1));
    }
  }
  // Boathouses along the marina edge
  for (let i = 0; i < 4; i++) {
    const hx = MARINA.x - 120 + i * 80;
    S.add(box(26, 10, 18, pick([0x7a8a9a, 0x9a7a5a, 0x5a7a8a]), hx, 5, MARINA.z - 62));
    addCollider(hx, MARINA.z - 62, 14, 10);
  }
  // Marina water plane (lighter, inside the bay)
  const bay = new THREE.Mesh(new THREE.PlaneGeometry(260, 135), new THREE.MeshPhongMaterial({ color: 0x2a8ab0, shininess: 140, specular: 0xffb36b }));
  bay.rotation.x = -Math.PI / 2; bay.position.set(MARINA.x, 0.15, 232); S.add(bay);

  // Streetlights
  for (let i = -4; i <= 4; i++) for (const z of [-300, -150, 0, 150, 300]) {
    const x = i * CITY.roadGap + 9;
    S.add(cyl(0.18, 0.22, 7, 0x333344, x, 3.5, z, 6));
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.7, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffe9a0 }));
    lamp.position.set(x, 7.2, z); S.add(lamp);
  }

  G.colliders = colliders;
  G.city = { palm, addCollider };
  return { colliders, marina: MARINA };
}

export function collideCircle(G, x, z, r) {
  for (const c of G.colliders) {
    if (Math.abs(x - c.x) < c.hw + r && Math.abs(z - c.z) < c.hd + r) return c;
  }
  return null;
}
export function clampToCity(x, z) {
  return [Math.max(-CITY.half, Math.min(CITY.half, x)), Math.max(-CITY.half, Math.min(CITY.half + 30, z))];
}

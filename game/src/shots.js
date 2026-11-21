// shots.js — deterministic staging for the 4 screenshots. Each stage puts the
// game in a composed, legible frame, freezes gameplay (shot mode) so the
// frame does not drift, and reports window.__shotReady when rendered.
// Cover = the v2.10 frame: dense neon casino chase, 116 MPH, 5 stars.
import * as THREE from "../vendor/three/three.module.min.js";
import { spawnPoliceCar, deployRoadblock, spawnHelicopter } from "./cops.js";
import { spawnBoat, spawnPoliceBoat } from "./boats.js";
import { startRace } from "./raceway.js";

function placeCar(G, car, x, z, heading, speed) {
  car.x = x;
  car.z = z;
  car.heading = heading;
  car.speed = speed || 0;
  car.mesh.position.set(x, 0, z);
  car.mesh.rotation.y = heading;
  G.player.pos.set(x, 0, z);
  G.player.heading = heading;
  G.player.speed = car.speed;
}

export function stageCover(G) {
  G.shotMode = true;
  G.hud.hideStart();
  // Player car on the casino boulevard, facing the Crown (-Z = sunset).
  placeCar(G, G.playerCar, 30, -38, Math.PI, 44.6);
  G.displaySpeed = 116;
  G.player.mode = "car";
  if (G.playerMesh) G.playerMesh.visible = false;
  // Wanted: full 5 stars, synced to the player object.
  G.setWanted(5);
  // Four police cars in frame: two flanking behind, two ahead by the casino.
  const spots = [
    [18, -18, Math.PI + 0.25], [42, -20, Math.PI - 0.2],
    [16, -66, Math.PI + 0.5], [46, -68, Math.PI - 0.4],
  ];
  // Trim any extra pursuit cars first so exactly four show.
  for (const p of [...(G.police || [])]) G.scene.remove(p.mesh);
  G.police = [];
  for (const [x, z, h] of spots) {
    const p = spawnPoliceCar(G, x, z);
    p.x = x; p.z = z; p.heading = h; p.speed = 40;
    p.mesh.position.set(x, 0, z);
    p.mesh.rotation.y = h;
  }
  // Helicopter low + ahead, searchlight pool on the player car.
  if (G.heli) { G.scene.remove(G.heli.group); G.heli = null; }
  spawnHelicopter(G);
  G.heli.height = 15;
  G.heli.orbitR = 10;
  G.heli.group.position.set(44, 15, -64);
  G.heli.pool.position.set(30, 0.12, -38);
  // Roadblock with spike strips ahead, in front of the casino.
  deployRoadblock(G, 38);
  // Explosion + fire glow ahead-right, smoke rising. Re-fired every 0.7s
  // by the boot loop while this shot is staged, so it never fades out.
  G.coverFx = { x: 56, z: -80 };
  G.fx.explosion(56, 1, -80);
  G.fx.burst(56, 2, -80, "fire", 30, 12);
  G.fx.burst(56, 4, -80, "smoke", 18, 6);
  // Denser boulevard traffic in frame.
  for (const t of G.traffic || []) {
    t.mesh.visible = true;
  }
  // Mission panel: the heist escape, exactly as the cover needs it.
  G.hud.setMission({ id: 20, title: "Casino Heist — Escape", objective: "Escape the Coral Crown — 5 stars, roadblock ahead" });
  G.hud.setCash(86420);
  G.hud.setWanted(5);
  G.hud.setSpeed(116);
  G.hud.setRadio("PALM WAVE 101.4 — Neon Nights");
  G.hud.banner("CASINO HEIST — ESCAPE");
  G.cameraYaw = Math.PI;
  G.cameraPitch = 0.32;
  G.save.cash = 86420;
}

export function stageMarina(G) {
  G.shotMode = true;
  G.hud.hideStart();
  // Player speedboat underway along the coast, marina on the left of frame.
  if (G.playerCar) { G.scene.remove(G.playerCar.mesh); G.playerCar = null; }
  if (G.playerMesh) G.playerMesh.visible = false;
  const boat = spawnBoat(G, "coral-speedster", -70, -236, Math.PI / 2);
  G.player.mode = "boat";
  G.player.pos.set(-70, 0, -236);
  G.player.heading = Math.PI / 2;
  G.player.speed = 30;
  G.displaySpeed = 78;
  // Two police boats in the wake.
  for (const b of [...(G.policeBoats || [])]) G.scene.remove(b.mesh);
  G.policeBoats = [];
  spawnPoliceBoat(G, -20, -228);
  spawnPoliceBoat(G, 5, -246);
  for (const b of G.policeBoats) { b.heading = Math.PI / 2; b.speed = 28; }
  G.setWanted(3);
  G.hud.setMission({ id: 21, title: "Boat Getaway", objective: "Outrun the harbour patrol to open water" });
  G.hud.setCash(42150);
  G.hud.setWanted(3);
  G.hud.setSpeed(78);
  G.hud.setRadio("CORAL FM 88.1 — Sunset Drive");
  G.hud.banner("MISSION 21 — BOAT GETAWAY");
  G.cameraYaw = Math.PI / 2;
  G.cameraPitch = 0.3;
}

export function stageFoot(G) {
  G.shotMode = true;
  G.hud.hideStart();
  // On-foot carjacking on the boulevard: Reef beside a stopped car, door
  // side, a police car closing in behind.
  if (G.playerCar) { G.scene.remove(G.playerCar.mesh); G.playerCar = null; }
  if (!G.playerMesh) return;
  G.playerMesh.visible = true;
  G.player.mode = "foot";
  G.player.pos.set(-24, 0, -166);
  G.player.heading = -Math.PI / 2;
  G.playerMesh.position.set(-24, 0, -166);
  G.playerMesh.rotation.y = G.player.heading;
  const near = (G.traffic || [])[0];
  if (near) {
    near.x = -30; near.z = -166;
    near.heading = -Math.PI / 2;
    near.mesh.position.set(-30, 0, -166);
    near.mesh.rotation.y = -Math.PI / 2;
  }
  for (const p of [...(G.police || [])]) G.scene.remove(p.mesh);
  G.police = [];
  const cop = spawnPoliceCar(G, -58, -168);
  cop.x = -58; cop.z = -168; cop.heading = Math.PI / 2; cop.speed = 0;
  cop.mesh.position.set(-58, 0, -168);
  cop.mesh.rotation.y = Math.PI / 2;
  G.setWanted(2);
  G.hud.setMission({ id: 3, title: "Hot Wheels", objective: "Carjack a car on the boulevard — press F" });
  G.hud.setCash(12480);
  G.hud.setWanted(2);
  G.hud.setSpeed(0);
  G.hud.setRadio("TIDE TALK 540 AM — Harbor News");
  G.hud.banner("ON FOOT — PRESS F TO JACK THE CAR");
  G.cameraYaw = -Math.PI / 2;
  G.cameraPitch = 0.3;
}

export function stageRace(G) {
  G.shotMode = true;
  G.hud.hideStart();
  // Boulevard Sprint mid-race: player P2, lap 1/2, gate 4, rivals ahead.
  const race = startRace(G, "boulevard-sprint");
  if (!race) return;
  race.countdown = 0;
  race.lap = 1;
  race.gate = 4;
  race.position = 2;
  race.elapsed = 42.6;
  // Player just before gate 4 so the next gate arch is visible ahead,
  // with two rivals in front of them on the road.
  const heading = 0; // north along road x=300 toward gate 4 at (300,-60)
  placeCar(G, G.playerCar, 300, -100, heading, 40);
  G.displaySpeed = 104;
  race.rivals[0].x = 297;
  race.rivals[0].z = -78;
  race.rivals[0].heading = heading;
  race.rivals[0].mesh.position.set(297, 0, -78);
  race.rivals[0].mesh.rotation.y = heading;
  race.rivals[1].x = 304;
  race.rivals[1].z = -68;
  race.rivals[1].heading = heading;
  race.rivals[1].mesh.position.set(304, 0, -68);
  race.rivals[1].mesh.rotation.y = heading;
  G.setWanted(0);
  G.hud.setMission({ id: 6, title: "Boulevard Sprint", objective: "Win the Boulevard Sprint — 2 laps" });
  G.hud.setCash(17350);
  G.hud.setWanted(0);
  G.hud.setSpeed(104);
  G.hud.setRace(race);
  G.hud.setRadio("PALM WAVE 101.4 — Neon Nights");
  G.hud.banner("BOULEVARD SPRINT — LAP 1/2 — P2/4");
  G.cameraYaw = heading;
  G.cameraPitch = 0.3;
}

export function stageShot(G, name) {
  G.shotName = name;
  if (name === "cover") stageCover(G);
  else if (name === "marina") stageMarina(G);
  else if (name === "foot") stageFoot(G);
  else if (name === "race") stageRace(G);
  else stageCover(G);
  // Let a few frames render, then signal readiness for the screenshot tool.
  let frames = 0;
  const tick = () => {
    frames++;
    if (frames >= 6) {
      window.__shotReady = true;
      document.title = "CORAL HEAT — shot " + name + " ready";
      return;
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

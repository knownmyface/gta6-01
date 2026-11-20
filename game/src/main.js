// Coral Heat — the game itself: boot, input, camera, the foot/car/boat switch,
// shooting, carjacking, missions, the HUD feed and the save. One file, one job:
// hold the loop together and let the systems do the work.

import * as THREE from 'three';
import { buildWorld, WATER_EDGE } from './city.js';
import { Ride, Traffic, PoliceDirector, RIDE_DEFS } from './vehicles.js';
import { Boat, Marina, HarborPatrol, BOAT_DEFS } from './boats.js';
import { Walker, Crowd } from './player.js';
import { CarjackSequence, makeDriverFigure } from './carjack.js';
import { Arsenal } from './weapons.js';
import { Combat } from './combat.js';
import { MissionRunner, MISSIONS } from './missions.js';
import { Hud } from './hud.js';
import { SoundBank } from './audio.js';
import { loadSave, writeSave } from './save.js';
import { SideActivities } from './side.js';
import { shotFromUrl, applyShot } from './shots.js';
import { makeDice, clamp, lerp } from './rng.js';

const $ = (id) => document.getElementById(id);

class CoralGame {
  constructor() {
    this.saved = loadSave();
    this.cash = this.saved.cash;
    this.garage = this.saved.garage || 0;
    this.tokens = this.saved.tokens || 0;
    this.best = this.saved.best || { topSpeed: 0, maxWanted: 0, missionsDone: 0 };
    this.muted = !!this.saved.muted;
    this.mode = 'menu'; // menu | foot | car | boat
    this.paused = false;
    this.cinematic = null;
    this.holdJack = false;
    this.objectiveOverride = null;
    this.saveTimer = 0;
    this.shotName = shotFromUrl();
    this.staged = !!this.shotName; // staged still: hold every position, keep the HUD live

    const stage = $('stage');
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.06;
    stage.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 2000);
    this.camera.position.set(20, 8, -30);

    this.world = buildWorld(this.scene, 'coral-bay-v27');
    this.dice = makeDice(20261120);
    this.walker = new Walker(this.scene, 12, 34);
    this.traffic = new Traffic(this.scene, this.world);
    this.marina = new Marina(this.scene, this.world.slips);
    this.patrol = new HarborPatrol(this.scene);
    this.police = new PoliceDirector(this.scene, this.world);
    this.crowd = new Crowd(this.scene, this.world);
    this.combat = new Combat(this.scene, this.world);
    this.arsenal = new Arsenal();
    // restore the saved arsenal
    this.arsenal.slots.forEach((s, i) => {
      s.owned = !!this.saved.weapons[i];
      if (this.saved.ammo && this.saved.ammo[i] > 0) s.ammo = this.saved.ammo[i];
      if (this.saved.ammo && this.saved.ammo[i] === -1) s.ammo = Infinity;
    });
    this.side = new SideActivities(this.scene);
    this.sound = new SoundBank();
    this.hud = new Hud(this.world);
    this.carjack = new CarjackSequence(this.scene);
    this.carjack.onStage = (stage, text) => this.hud.toast(text);
    this.missions = new MissionRunner((ev) => this.onMissionEvent(ev));
    this.missions.startMission(this.saved.mission || 0);

    this.ride = null;      // current car (Ride) or null
    this.myRide = null;    // last car Kai drove, parked somewhere
    this.boat = null;      // current boat (Boat) or null
    this.camHeading = Math.PI;
    this.camPitch = 0.32;
    this.camPos = new THREE.Vector3(20, 8, -30);
    this.camLook = new THREE.Vector3(0, 1.5, 0);
    this.keys = {};
    this.mouseDown = false;
    this.marker = this.buildMarker();
    this.markerTimer = 0;
    this.wakeMeshes = [];
    this.clock = new THREE.Clock();
    this.elapsed = 0;
    this.frames = 0;

    this.bindInput();
    window.addEventListener('resize', () => this.onResize());
    $('loading').style.display = 'none';
    this.loop = this.loop.bind(this);
    requestAnimationFrame(this.loop);

    // staged screenshot? Skip the menu and compose the scene.
    if (this.shotName) {
      $('menu-overlay').style.display = 'none';
      this.mode = 'foot';
      this.applyShotFacade(this.shotName);
    }
  }

  buildMarker() {
    const g = new THREE.Group();
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(1.6, 2.4, 42, 12, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false }),
    );
    beam.position.y = 21;
    g.add(beam);
    const gem = new THREE.Mesh(
      new THREE.OctahedronGeometry(1.5),
      new THREE.MeshBasicMaterial({ color: 0xffd23f }),
    );
    gem.position.y = 6;
    g.add(gem);
    g.userData.gem = gem;
    g.visible = false;
    this.scene.add(g);
    return g;
  }

  bindInput() {
    const canvas = this.renderer.domElement;
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.keys[e.code] = true;
      if (e.code === 'KeyE') this.onInteract();
      if (e.code === 'KeyR') this.hud.toast(`Radio: ${this.sound.nextStation().name}`);
      if (e.code === 'KeyH' && this.mode === 'car') this.sound.honk();
      if (e.code === 'Digit1') this.arsenal.select(0);
      if (e.code === 'Digit2') this.arsenal.select(1);
      if (e.code === 'Digit3') this.arsenal.select(2);
      if (e.code === 'KeyP') this.togglePause();
      if (e.code === 'ArrowLeft') this.camHeading += 0.18;
      if (e.code === 'ArrowRight') this.camHeading -= 0.18;
    });
    window.addEventListener('keyup', (e) => { this.keys[e.code] = false; });
    canvas.addEventListener('mousedown', (e) => {
      if (this.mode === 'menu' || this.paused) return;
      if (document.pointerLockElement !== canvas) canvas.requestPointerLock();
      this.mouseDown = true;
      this.tryShoot();
    });
    window.addEventListener('mouseup', () => { this.mouseDown = false; });
    window.addEventListener('mousemove', (e) => {
      if (document.pointerLockElement !== canvas) return;
      this.camHeading -= e.movementX * 0.0028;
      this.camPitch = clamp(this.camPitch + e.movementY * 0.002, -0.15, 0.9);
    });
    $('play-btn').addEventListener('click', () => this.startGame());
    $('resume-btn').addEventListener('click', () => this.togglePause());
  }

  startGame() {
    this.sound.unlock();
    $('menu-overlay').style.display = 'none';
    this.mode = 'foot';
    this.hud.toast('Welcome back to Coral Bay, Kai.');
    this.hud.showBanner('CORAL HEAT', 'Mission 1 — First Light. Follow the yellow diamond.');
  }

  togglePause() {
    if (this.mode === 'menu') return;
    this.paused = !this.paused;
    $('pause-overlay').style.display = this.paused ? 'flex' : 'none';
    if (this.paused) this.saveNow();
  }

  saveNow() {
    writeSave({
      cash: this.cash, missionIndex: this.missions.index, arsenal: this.arsenal,
      garage: this.garage, tokens: this.tokens, best: this.best, muted: this.muted,
    });
  }

  onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  // ---- interactions: E key ----
  onInteract() {
    if (this.mode === 'menu' || this.paused || this.carjack.active) return;
    const w = this.walker;
    if (this.mode === 'foot') {
      // board a moored boat first (water's edge), then cars
      const boat = this.marina.nearestBoardable(w.x, w.z, 5);
      if (boat && w.x < -150) {
        this.boardBoat(boat);
        return;
      }
      // own parked ride: just get in
      if (this.myRide && Math.hypot(w.x - this.myRide.x, w.z - this.myRide.z) < 4.5) {
        this.enterRide(this.myRide);
        return;
      }
      // traffic car: the carjack sequence
      const target = this.traffic.nearestStealable(w.x, w.z, 4.5);
      if (target) {
        const driver = makeDriverFigure(0xffd23f);
        driver.position.set(target.x, 0, target.z);
        this.scene.add(driver);
        target.driver = driver;
        this.traffic.cars = this.traffic.cars.filter((c) => c.ride !== target);
        this.carjack.begin(target, driver, w, (ride) => this.finishJack(ride));
        return;
      }
      // shops
      const shop = this.side.nearestShop(w.x, w.z, 6);
      if (shop) {
        const offer = shop.offers[0];
        const res = this.side.buy(offer, this);
        this.hud.toast(res.ok ? `Bought: ${offer.name}` : `${shop.name}: ${res.reason}`);
      }
    } else if (this.mode === 'car') {
      this.exitRide();
    } else if (this.mode === 'boat') {
      this.exitBoat();
    }
  }

  finishJack(ride) {
    this.enterRide(ride);
    this.missions.noteJack();
    this.police.addHeat(14);
    this.hud.toast('Carjacked! The PD noticed.');
    this.sound.honk();
  }

  enterRide(ride) {
    this.ride = ride;
    this.myRide = ride;
    this.mode = 'car';
    this.walker.mesh.visible = false;
    this.camHeading = ride.heading;
  }

  exitRide() {
    if (!this.ride) return;
    const r = this.ride;
    const sx = r.x - Math.cos(r.heading) * 2.2;
    const sz = r.z + Math.sin(r.heading) * 2.2;
    this.walker.x = sx; this.walker.z = sz;
    this.walker.mesh.position.set(sx, 0, sz);
    this.walker.mesh.visible = true;
    this.ride = null;
    this.mode = 'foot';
  }

  boardBoat(boat) {
    this.marina.unmoor(boat);
    this.boat = boat;
    this.mode = 'boat';
    this.walker.mesh.visible = false;
    this.missions.noteBoard(boat.kind);
    this.sound.splash();
    this.hud.toast(`Aboard the ${boat.def.name} — the bay is yours.`);
    this.camHeading = boat.heading;
  }

  exitBoat() {
    if (!this.boat) return;
    const b = this.boat;
    // beach the walker on the nearest dry land
    const lx = Math.max(b.x, -152);
    this.walker.x = lx; this.walker.z = b.z;
    this.walker.mesh.position.set(lx, 0, b.z);
    this.walker.mesh.visible = true;
    this.boat = null;
    this.mode = 'foot';
  }

  // ---- shooting ----
  tryShoot() {
    if (this.mode !== 'foot' && this.mode !== 'car') return;
    if (this.paused) return;
    const def = this.arsenal.fire();
    if (!def) return;
    this.sound.gunshot(def.sound);
    const origin = this.mode === 'foot'
      ? { x: this.walker.x, y: 1.55, z: this.walker.z }
      : { x: this.ride.x, y: 1.3, z: this.ride.z };
    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);
    const spread = def.spread;
    dir.x += (Math.random() - 0.5) * spread;
    dir.y += (Math.random() - 0.5) * spread * 0.5;
    dir.z += (Math.random() - 0.5) * spread;
    dir.normalize();
    const targets = [];
    for (const p of this.crowd.peds) targets.push({ x: p.x, z: p.z, radius: 0.6, label: 'ped', ped: p });
    for (const c of this.police.cruisers) {
      if (!c.disabled) targets.push({ x: c.x, z: c.z, radius: 2.4, label: 'cruiser', cruiser: c });
    }
    for (const b of this.police.blocks) {
      if (!b.disabled) targets.push({ x: b.x, z: b.z, radius: 2.4, label: 'cruiser', cruiser: b });
    }
    const hit = this.combat.shoot(
      { x: origin.x, y: origin.y, z: origin.z },
      { x: dir.x, y: dir.y, z: dir.z },
      def, targets,
      (t, dmg) => {
        if (t.ped) {
          this.crowd.peds = this.crowd.peds.filter((p) => p !== t.ped);
          this.scene.remove(t.ped.mesh);
          this.crowd.scare(t.ped.x, t.ped.z, 14);
          this.police.addHeat(15);
          this.combat.impactBurst(t.ped.x, 1.2, t.ped.z);
        }
        if (t.cruiser) {
          t.cruiser.health -= dmg;
          this.combat.impactBurst(t.cruiser.x, 1.2, t.cruiser.z);
          if (t.cruiser.health <= 0) {
            t.cruiser.disabled = true;
            t.cruiser.speed = 0;
            this.missions.noteDisabled();
            this.police.addHeat(6);
            this.hud.toast('Cruiser disabled!');
          }
        }
      },
    );
    if (!hit.label) this.police.addHeat(2);
    this.walker.aiming = true;
  }

  // ---- mission events ----
  onMissionEvent(ev) {
    if (ev.type === 'mission-start') {
      this.hud.showBanner(`MISSION ${ev.mission.id} — ${ev.mission.name.toUpperCase()}`, ev.mission.brief);
      this.hud.toast(ev.mission.brief);
    } else if (ev.type === 'objective-done') {
      this.sound.chime();
      this.hud.toast(ev.next ? `Next: ${ev.next.text}` : 'Job done — collect your pay.');
    } else if (ev.type === 'mission-complete') {
      this.cash += ev.mission.reward;
      this.best.missionsDone = Math.max(this.best.missionsDone, ev.mission.id);
      this.hud.showBanner('MISSION COMPLETE', `+$${ev.mission.reward.toLocaleString('en-US')} — ${ev.mission.name}`);
      this.sound.chime();
      this.saveNow();
    } else if (ev.type === 'story-complete') {
      this.cash += 10000;
      this.hud.showBanner('CORAL HEAT — STORY COMPLETE', 'Kai is free. The bay is yours. +$10,000');
      this.saveNow();
    }
  }

  // ---- screenshot staging facade (shots.js drives this) ----
  applyShotFacade(name) {
    const self = this;
    // freeze the pursuit while staging: the still is composed, not chased
    self.police.stageHold = true;
    self.patrol.stageHold = true;
    self.hud.quiet = true; // no banners or toasts over a still
    // the constructor's mission-start banner is already up: take it down
    self.hud.bannerTimer = 0;
    self.hud.el.banner.style.display = 'none';
    self.hud.toastTimer = 0;
    self.hud.el.toast.style.display = 'none';
    const f = {
      setMission(i, obj) { self.missions.startMission(i); self.missions.objIndex = obj || 0; },
      setCash(n) { self.cash = n; },
      setSpeed(mph) {
        // hold the speedometer: with no keys pressed the ride would coast to 0
        self.stagedSpeed = mph / 2.2;
        if (self.ride) self.ride.speed = self.stagedSpeed;
        if (self.boat) self.boat.speed = self.stagedSpeed;
      },
      setWanted(n) {
        self.police.wanted = n;
        self.police.heat = [0, 15, 32, 50, 70, 90][n] || 0;
        if (n >= 3 && !self.police.heli) self.police.heli = self.police.buildHeli();
      },
      setObjective(text) { self.objectiveOverride = text; },
      setRadio(i) { self.sound.station = i; },
      setCamera(pos, look) {
        self.cinematic = { pos: new THREE.Vector3(pos.x, pos.y, pos.z), look: new THREE.Vector3(look.x, look.y, look.z) };
      },
      placeWalker(x, z, heading) {
        self.walker.x = x; self.walker.z = z; self.walker.heading = heading;
        self.walker.mesh.position.set(x, 0, z);
        self.walker.mesh.rotation.y = heading;
        self.walker.mesh.visible = true;
      },
      giveRide(kind, x, z, heading) {
        const ride = new Ride(self.scene, kind, x, z, heading, self.dice);
        self.enterRide(ride);
        return ride;
      },
      giveBoat(kind, x, z, heading) {
        const boat = new Boat(self.scene, kind, x, z, heading);
        self.boat = boat;
        self.mode = 'boat';
        self.walker.mesh.visible = false;
        self.missions.noteBoard(kind);
        self.camHeading = heading;
        return boat;
      },
      spawnPursuit(n, dist) {
        for (let i = 0; i < n; i++) {
          const a = self.ride ? self.ride.heading : 0;
          // tight on the bumper, inside the cover camera's frame
          const bx = (self.ride ? self.ride.x : 0) - Math.sin(a) * (dist + i * 5) + (i === 0 ? -3.5 : 3.5);
          const bz = (self.ride ? self.ride.z : 0) - Math.cos(a) * (dist + i * 5);
          const c = new Ride(self.scene, 'cruiser', bx, bz, a, self.dice);
          c.speed = 26;
          self.police.cruisers.push(c);
        }
      },
      spawnHeli() {
        if (!self.police.heli) self.police.heli = self.police.buildHeli();
        self.police.wanted = Math.max(self.police.wanted, 3);
        // park Air One in the camera's view, past the player, low enough to
        // fit the frame: 40m behind the player's motion, 22m up, facing back
        const heading = self.ride ? self.ride.heading : self.boat ? self.boat.heading : self.camHeading;
        const px = self.ride ? self.ride.x : self.boat ? self.boat.x : self.walker.x;
        const pz = self.ride ? self.ride.z : self.boat ? self.boat.z : self.walker.z;
        self.police.heli.position.set(px - Math.sin(heading) * 40, 22, pz - Math.cos(heading) * 40);
        self.police.heli.rotation.y = heading;
      },
      spawnPatrolBoat(x, z) {
        const b = new Boat(self.scene, 'patrol', x, z, 0);
        b.staged = true;
        self.patrol.boats.push(b);
        return b;
      },
      stageCarjack(kind, x, z, heading) {
        const ride = new Ride(self.scene, kind, x, z, heading, self.dice);
        const driver = makeDriverFigure(0x2fd4c4);
        driver.position.set(x, 0, z);
        self.scene.add(driver);
        self.carjack.begin(ride, driver, self.walker, () => {});
        // freeze mid-drag: driver half out of the car, Kai at the door
        self.carjack.stage = 'drag';
        self.carjack.timer = 0.4;
        self.holdJack = true;
        // the frozen sequence never runs its drag step, so pose the driver now
        const dx = Math.cos(heading);
        const dz = -Math.sin(heading);
        driver.position.set(x - dx * 2.4, 0, z + dz * 2.4);
        driver.rotation.y = heading;
        driver.rotation.z = 0.45;
        driver.visible = true;
        self.walker.x = x - dx * 1.25;
        self.walker.z = z + dz * 1.25;
        self.walker.mesh.position.set(self.walker.x, 0, self.walker.z);
        self.walker.mesh.rotation.y = heading + Math.PI / 2;
        self.hud.prompt('E — CARJACK');
      },
    };
    const done = applyShot(f, name);
    window.__coralShot = done;
  }

  readInput() {
    const k = this.keys;
    return {
      up: !!(k.KeyW || k.ArrowUp),
      down: !!(k.KeyS || k.ArrowDown),
      left: !!(k.KeyA || k.ArrowLeft),
      right: !!(k.KeyD || k.ArrowRight),
      sprint: !!(k.ShiftLeft || k.ShiftRight),
      brake: !!k.Space,
    };
  }

  updateCamera(dt) {
    if (this.cinematic) {
      this.camera.position.copy(this.cinematic.pos);
      this.camera.lookAt(this.cinematic.look);
      return;
    }
    let tx, ty, tz, lx, ly, lz;
    if (this.mode === 'car' && this.ride) {
      const r = this.ride;
      const back = 10.5, up = 4.2;
      tx = r.x - Math.sin(r.heading) * back;
      ty = up;
      tz = r.z - Math.cos(r.heading) * back;
      lx = r.x + Math.sin(r.heading) * 8;
      ly = 1.6;
      lz = r.z + Math.cos(r.heading) * 8;
    } else if (this.mode === 'boat' && this.boat) {
      const b = this.boat;
      tx = b.x - Math.sin(b.heading) * 12;
      ty = 5.5;
      tz = b.z - Math.cos(b.heading) * 12;
      lx = b.x + Math.sin(b.heading) * 10;
      ly = 1.2;
      lz = b.z + Math.cos(b.heading) * 10;
    } else {
      const w = this.walker;
      tx = w.x - Math.sin(this.camHeading) * 7.5;
      ty = 3.4 + this.camPitch * 3;
      tz = w.z - Math.cos(this.camHeading) * 7.5;
      lx = w.x + Math.sin(this.camHeading) * 5;
      ly = 1.5;
      lz = w.z + Math.cos(this.camHeading) * 5;
    }
    const lam = 1 - Math.exp(-7 * dt);
    this.camPos.x = lerp(this.camPos.x, tx, lam);
    this.camPos.y = lerp(this.camPos.y, ty, lam);
    this.camPos.z = lerp(this.camPos.z, tz, lam);
    this.camLook.x = lerp(this.camLook.x, lx, lam);
    this.camLook.y = lerp(this.camLook.y, ly, lam);
    this.camLook.z = lerp(this.camLook.z, lz, lam);
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.camLook);
  }

  loop() {
    requestAnimationFrame(this.loop);
    const dt = Math.min(this.clock.getDelta(), 0.05);
    const t = (this.elapsed += dt);
    if (this.paused) { this.renderer.render(this.scene, this.camera); return; }
    const input = this.readInput();

    // world life
    this.world.update(dt, t);
    this.traffic.update(dt, this.walker.x, this.walker.z);
    this.crowd.update(dt);
    this.marina.update(dt, t);
    this.side.update(dt, t);
    this.combat.update(dt);
    this.arsenal.tick(dt);

    // player modes (frozen for a staged still: the camera is composed, not chased)
    if (this.mode === 'foot') {
      if (!this.staged) this.walker.step(input, this.camHeading, dt, this.world);
      if (this.mouseDown && this.arsenal.active().def.auto) this.tryShoot();
      const tok = this.side.collectToken(this.walker.x, this.walker.z);
      if (tok) { this.tokens += 1; this.cash += 150; this.hud.toast(`Coral token! +$150 (${this.tokens}/12)`); this.sound.chime(); }
    } else if (this.mode === 'car' && this.ride) {
      if (this.staged) {
        if (this.stagedSpeed != null) this.ride.speed = this.stagedSpeed;
      } else {
        const before = this.ride.health;
        this.ride.drive(input, dt, this.world);
        if (this.garage >= 1) this.ride.speed = Math.min(this.ride.speed, this.ride.def.top * 1.15);
        if (this.ride.health < before) this.police.addHeat(0.4);
      }
      if (this.mouseDown && this.arsenal.active().def.auto) this.tryShoot();
      this.walker.x = this.ride.x; this.walker.z = this.ride.z;
    } else if (this.mode === 'boat' && this.boat) {
      if (this.staged) {
        if (this.stagedSpeed != null) this.boat.speed = this.stagedSpeed;
      } else {
        const needWake = this.boat.sail(input, dt, t);
        if (needWake) this.boat.markWake();
        if (this.boat.x > -170) this.police.addHeat(0.2); // beaching a boat draws eyes
      }
      this.walker.x = this.boat.x; this.walker.z = this.boat.z;
    }

    // carjack sequence (frozen for the foot still)
    if (!this.holdJack) this.carjack.update(dt);

    // police + patrol (menu mode has no ride or boat yet: fall back to the walker)
    const inCar = this.mode === 'car' && this.ride;
    const inBoat = this.mode === 'boat' && this.boat;
    const px = inCar ? this.ride.x : inBoat ? this.boat.x : this.walker.x;
    const pz = inCar ? this.ride.z : inBoat ? this.boat.z : this.walker.z;
    const pspeed = inCar ? this.ride.speed : inBoat ? this.boat.speed : this.walker.walkSpeed;
    this.police.update(dt, px, pz, pspeed, t);
    this.patrol.update(dt, px, pz, this.police.wanted, t);
    if (this.police.wanted > this.best.maxWanted) this.best.maxWanted = this.police.wanted;
    const mph = Math.abs(pspeed) * 2.2;
    if (mph > this.best.topSpeed) this.best.topSpeed = Math.round(mph);

    // missions
    const obj = this.missions.objective();
    this.missions.tick({ x: px, z: pz, mode: this.mode, wanted: this.police.wanted, dt });
    this.markerTimer += dt;
    if (obj && obj.x !== undefined) {
      this.marker.visible = true;
      this.marker.position.set(obj.x, 0, obj.z);
      this.marker.userData.gem.position.y = 6 + Math.sin(t * 2.2) * 0.8;
      this.marker.userData.gem.rotation.y = t * 1.4;
    } else {
      this.marker.visible = false;
    }

    // audio
    this.sound.musicTick(t);
    const driving = this.mode === 'car' || this.mode === 'boat';
    const norm = clamp(Math.abs(pspeed) / 40, 0, 1);
    this.sound.setEngine(norm, driving);
    this.sound.setSiren(this.police.wanted);

    // HUD
    const mission = this.missions.current();
    const hudState = {
      mission,
      objectiveText: this.objectiveOverride || (obj ? obj.text : 'Free roam — explore Coral Bay.'),
      missionProgress: this.missions.done ? 1 : (mission ? (this.missions.objIndex + this.missions.objectiveProgress({ x: px, z: pz })) / mission.objectives.length : 0),
      cash: this.cash,
      wanted: this.police.wanted,
      health: this.walker.health,
      vehicleDamage: this.ride ? 100 - this.ride.health : this.boat ? 100 - this.boat.health : 0,
      x: px, z: pz,
      speed: pspeed,
      vehicleName: this.mode === 'car' && this.ride ? this.ride.def.name : this.mode === 'boat' && this.boat ? this.boat.def.name : 'ON FOOT',
      gearText: this.mode === 'car' ? `KAI SOLANO · ${this.ride ? Math.round(this.ride.health) : 100}% HULL` : this.mode === 'boat' ? 'KAI SOLANO · ON THE WATER' : 'KAI SOLANO',
      stationName: this.sound.currentStation().name,
      trackName: this.sound.currentStation().track,
      weaponSlot: this.arsenal.current,
      weaponAmmo: [0, 1, 2].map((i) => this.arsenal.ammoText(i)),
      mode: this.mode,
      weaponOut: this.mode === 'foot',
      marker: obj && obj.x !== undefined ? { x: obj.x, z: obj.z } : null,
      police: this.police.cruisers.map((c) => ({ x: c.x, z: c.z })),
      boats: [...this.marina.moored, ...this.patrol.boats, ...(this.boat ? [this.boat] : [])].map((b) => ({ x: b.x, z: b.z })),
      traffic: this.traffic.cars.slice(0, 14).map((c) => ({ x: c.ride.x, z: c.ride.z })),
      heading: this.mode === 'car' && this.ride ? this.ride.heading : this.mode === 'boat' && this.boat ? this.boat.heading : this.camHeading,
    };
    this.hud.update(hudState, dt);

    // prompt: what E does right now
    if (this.mode === 'foot' && !this.carjack.active && !this.holdJack) {
      if (this.marina.nearestBoardable(this.walker.x, this.walker.z, 5) && this.walker.x < -150) {
        this.hud.prompt('E — BOARD BOAT');
      } else if (this.myRide && Math.hypot(this.walker.x - this.myRide.x, this.walker.z - this.myRide.z) < 4.5) {
        this.hud.prompt('E — GET IN');
      } else if (this.traffic.nearestStealable(this.walker.x, this.walker.z, 4.5)) {
        this.hud.prompt('E — CARJACK');
      } else if (this.side.nearestShop(this.walker.x, this.walker.z, 6)) {
        this.hud.prompt('E — SHOP');
      } else {
        this.hud.prompt(null);
      }
    } else if (this.mode === 'car' || this.mode === 'boat') {
      this.hud.prompt(null);
    }

    this.updateCamera(dt);
    this.renderer.render(this.scene, this.camera);
    this.frames += 1;
    if (this.frames === 3) window.__coralReady = true;
    this.saveTimer += dt;
    if (this.saveTimer > 20) { this.saveTimer = 0; this.saveNow(); }
  }
}

try {
  window.__coralGame = new CoralGame();
} catch (err) {
  window.__coralError = String(err && err.stack || err);
  const loading = document.getElementById('loading');
  if (loading) loading.textContent = 'ERROR: ' + window.__coralError;
  throw err;
}

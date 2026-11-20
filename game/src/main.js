// CORAL HEAT v2.8 — the game itself: boot, input, camera, the foot/car/boat
// switch, shooting, carjacking, jobs, the dashboard feed and the save. One
// file, one job: hold the loop together and let the systems do the work. The
// frame is split into small ticks — player, pursuit, jobs, HUD — so the loop
// itself stays short enough to read at a glance.

import * as THREE from 'three';
import { buildBayCity } from './city.js';
import { Car, StreetTraffic, Pursuit } from './vehicles.js';
import { Hull, Mooring, HarborWatch } from './boats.js';
import { Hero, StreetCrowd } from './player.js';
import { TheftScene, makeVictim } from './carjack.js';
import { Loadout } from './weapons.js';
import { Gunplay } from './combat.js';
import { JobRunner } from './missions.js';
import { Dashboard } from './hud.js';
import { Radio } from './audio.js';
import { readSave, storeSave } from './save.js';
import { SideHustle } from './side.js';
import { stillFromQuery, stageStill } from './shots.js';
import { makeRandom, clampVal, mix } from './rng.js';

const $ = (id) => document.getElementById(id);
const CHASE_BACK = 11;
const CHASE_UP = 4.5;

class HeatGame {
  constructor() {
    this.saved = readSave();
    this.cash = this.saved.cash;
    this.garage = this.saved.garage || 0;
    this.tokens = this.saved.tokens || 0;
    this.best = this.saved.best || { topSpeed: 0, maxWanted: 0, missionsDone: 0 };
    this.muted = !!this.saved.muted;
    this.mode = 'menu'; // menu | foot | car | boat
    this.paused = false;
    this.cinematic = null;
    this.holdTheft = false;
    this.objectiveOverride = null;
    this.saveTimer = 0;
    this.shotName = stillFromQuery();
    this.staged = !!this.shotName; // staged still: hold every position, keep the HUD live

    const stage = $('viewport');
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.06;
    stage.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 2000);
    this.camera.position.set(20, 8, -30);

    this.world = buildBayCity(this.scene, 'coral-bay-v28');
    this.dice = makeRandom(20261121);
    this.hero = new Hero(this.scene, 12, 34);
    this.traffic = new StreetTraffic(this.scene, this.world);
    this.mooring = new Mooring(this.scene, this.world.slips);
    this.harbor = new HarborWatch(this.scene);
    this.pursuit = new Pursuit(this.scene, this.world);
    this.crowd = new StreetCrowd(this.scene, this.world);
    this.gunplay = new Gunplay(this.scene, this.world);
    this.loadout = new Loadout();
    // restore the saved loadout
    this.loadout.slots.forEach((s, i) => {
      s.owned = !!this.saved.weapons[i];
      if (this.saved.ammo && this.saved.ammo[i] > 0) s.ammo = this.saved.ammo[i];
      if (this.saved.ammo && this.saved.ammo[i] === -1) s.ammo = Infinity;
    });
    this.side = new SideHustle(this.scene);
    this.radio = new Radio();
    this.dash = new Dashboard(this.world);
    this.theft = new TheftScene(this.scene);
    this.theft.onPhase = (phase, text) => this.dash.note(text);
    this.jobs = new JobRunner((ev) => this.onJobEvent(ev));
    this.jobs.beginJob(this.saved.mission || 0);

    this.car = null;   // current car (Car) or null
    this.myCar = null; // last car Kai drove, parked somewhere
    this.hull = null;  // current boat (Hull) or null
    this.camHeading = Math.PI;
    this.camPitch = 0.32;
    this.camPos = new THREE.Vector3(20, 8, -30);
    this.camLook = new THREE.Vector3(0, 1.5, 0);
    this.keys = {};
    this.mouseDown = false;
    this.marker = this.buildMarker();
    this.markerTimer = 0;
    this.clock = new THREE.Clock();
    this.elapsed = 0;
    this.frames = 0;

    this.bindInput();
    window.addEventListener('resize', () => this.onResize());
    $('loader').style.display = 'none';
    this.loop = this.loop.bind(this);
    requestAnimationFrame(this.loop);

    // staged screenshot? Skip the menu and compose the scene.
    if (this.shotName) {
      $('menu-screen').style.display = 'none';
      this.mode = 'foot';
      this.stageFacade(this.shotName);
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
      if (e.code === 'KeyR') this.dash.note(`Radio: ${this.radio.nextChannel().name}`);
      if (e.code === 'KeyH' && this.mode === 'car') this.radio.horn();
      if (e.code === 'Digit1') this.loadout.pick(0);
      if (e.code === 'Digit2') this.loadout.pick(1);
      if (e.code === 'Digit3') this.loadout.pick(2);
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
      this.camPitch = clampVal(this.camPitch + e.movementY * 0.002, -0.15, 0.9);
    });
    $('play-button').addEventListener('click', () => this.startGame());
    $('resume-button').addEventListener('click', () => this.togglePause());
  }

  startGame() {
    this.radio.start();
    $('menu-screen').style.display = 'none';
    this.mode = 'foot';
    this.dash.note('Welcome back to Coral Bay, Kai.');
    this.dash.flashBanner('CORAL HEAT', 'Mission 1 — First Light. Follow the yellow diamond.');
  }

  togglePause() {
    if (this.mode === 'menu') return;
    this.paused = !this.paused;
    $('pause-screen').style.display = this.paused ? 'flex' : 'none';
    if (this.paused) this.saveNow();
  }

  saveNow() {
    storeSave({
      cash: this.cash, missionIndex: this.jobs.index, loadout: this.loadout,
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
    if (this.mode === 'menu' || this.paused || this.theft.active) return;
    const w = this.hero;
    if (this.mode === 'foot') {
      // board a moored boat first (water's edge), then cars
      const boat = this.mooring.closestDocked(w.x, w.z, 5);
      if (boat && w.x < -150) {
        this.boardBoat(boat);
        return;
      }
      // own parked car: just get in
      if (this.myCar && Math.hypot(w.x - this.myCar.x, w.z - this.myCar.z) < 4.5) {
        this.enterCar(this.myCar);
        return;
      }
      // traffic car: the theft scene
      const target = this.traffic.closestStealable(w.x, w.z, 4.5);
      if (target) {
        const victim = makeVictim(0xffd23f);
        victim.position.set(target.x, 0, target.z);
        this.scene.add(victim);
        target.driver = victim;
        this.traffic.cars = this.traffic.cars.filter((c) => c.car !== target);
        this.theft.start(target, victim, w, (car) => this.finishTheft(car));
        return;
      }
      // shops
      const shop = this.side.closestStore(w.x, w.z, 6);
      if (shop) {
        const offer = shop.offers[0];
        const res = this.side.purchase(offer, this);
        this.dash.note(res.ok ? `Bought: ${offer.name}` : `${shop.name}: ${res.reason}`);
      }
    } else if (this.mode === 'car') {
      this.exitCar();
    } else if (this.mode === 'boat') {
      this.exitBoat();
    }
  }

  finishTheft(car) {
    this.enterCar(car);
    this.jobs.markJack();
    this.pursuit.raiseHeat(14);
    this.dash.note('Carjacked! The PD noticed.');
    this.radio.horn();
  }

  enterCar(car) {
    this.car = car;
    this.myCar = car;
    this.mode = 'car';
    this.hero.mesh.visible = false;
    this.camHeading = car.heading;
  }

  exitCar() {
    if (!this.car) return;
    const r = this.car;
    const sx = r.x - Math.cos(r.heading) * 2.2;
    const sz = r.z + Math.sin(r.heading) * 2.2;
    this.hero.x = sx;
    this.hero.z = sz;
    this.hero.mesh.position.set(sx, 0, sz);
    this.hero.mesh.visible = true;
    this.car = null;
    this.mode = 'foot';
  }

  boardBoat(boat) {
    this.mooring.castOff(boat);
    this.hull = boat;
    this.mode = 'boat';
    this.hero.mesh.visible = false;
    this.jobs.markBoard(boat.kind);
    this.radio.splash();
    this.dash.note(`Aboard the ${boat.def.name} — the bay is yours.`);
    this.camHeading = boat.heading;
  }

  exitBoat() {
    if (!this.hull) return;
    const b = this.hull;
    // beach the hero on the nearest dry land
    const lx = Math.max(b.x, -152);
    this.hero.x = lx;
    this.hero.z = b.z;
    this.hero.mesh.position.set(lx, 0, b.z);
    this.hero.mesh.visible = true;
    this.hull = null;
    this.mode = 'foot';
  }

  // ---- shooting ----
  tryShoot() {
    if (this.mode !== 'foot' && this.mode !== 'car') return;
    if (this.paused) return;
    const def = this.loadout.shoot();
    if (!def) return;
    this.radio.bang(def.sound);
    const origin = this.mode === 'foot'
      ? { x: this.hero.x, y: 1.55, z: this.hero.z }
      : { x: this.car.x, y: 1.3, z: this.car.z };
    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);
    const spread = def.spread;
    dir.x += (Math.random() - 0.5) * spread;
    dir.y += (Math.random() - 0.5) * spread * 0.5;
    dir.z += (Math.random() - 0.5) * spread;
    dir.normalize();
    const targets = this.collectTargets();
    const hit = this.gunplay.fire(
      { x: origin.x, y: origin.y, z: origin.z },
      { x: dir.x, y: dir.y, z: dir.z },
      def, targets,
      (t, dmg) => this.applyHit(t, dmg),
    );
    if (!hit.label) this.pursuit.raiseHeat(2);
    this.hero.aiming = true;
  }

  collectTargets() {
    const targets = [];
    for (const p of this.crowd.peds) targets.push({ x: p.x, z: p.z, radius: 0.6, label: 'ped', ped: p });
    for (const c of this.pursuit.cruisers) {
      if (!c.disabled) targets.push({ x: c.x, z: c.z, radius: 2.4, label: 'cruiser', cruiser: c });
    }
    for (const b of this.pursuit.blocks) {
      if (!b.disabled) targets.push({ x: b.x, z: b.z, radius: 2.4, label: 'cruiser', cruiser: b });
    }
    return targets;
  }

  applyHit(t, dmg) {
    if (t.ped) {
      this.crowd.peds = this.crowd.peds.filter((p) => p !== t.ped);
      this.scene.remove(t.ped.mesh);
      this.crowd.scare(t.ped.x, t.ped.z, 14);
      this.pursuit.raiseHeat(15);
      this.gunplay.hitPuff(t.ped.x, 1.2, t.ped.z);
      return;
    }
    if (t.cruiser) {
      t.cruiser.health -= dmg;
      this.gunplay.hitPuff(t.cruiser.x, 1.2, t.cruiser.z);
      if (t.cruiser.health > 0) return;
      t.cruiser.disabled = true;
      t.cruiser.speed = 0;
      this.jobs.markDisabled();
      this.pursuit.raiseHeat(6);
      this.dash.note('Interceptor disabled!');
    }
  }

  // ---- job events ----
  onJobEvent(ev) {
    if (ev.type === 'job-start') {
      this.dash.flashBanner(`MISSION ${ev.job.id} — ${ev.job.name.toUpperCase()}`, ev.job.brief);
      this.dash.note(ev.job.brief);
    } else if (ev.type === 'task-done') {
      this.radio.ding();
      this.dash.note(ev.next ? `Next: ${ev.next.text}` : 'Job done — collect your pay.');
    } else if (ev.type === 'job-complete') {
      this.cash += ev.job.reward;
      this.best.missionsDone = Math.max(this.best.missionsDone, ev.job.id);
      this.dash.flashBanner('MISSION COMPLETE', `+$${ev.job.reward.toLocaleString('en-US')} — ${ev.job.name}`);
      this.radio.ding();
      this.saveNow();
    } else if (ev.type === 'story-complete') {
      this.cash += 10000;
      this.dash.flashBanner('CORAL HEAT — STORY COMPLETE', 'Kai is free. The bay is yours. +$10,000');
      this.saveNow();
    }
  }

  // ---- screenshot staging facade (shots.js drives this) ----
  stageFacade(name) {
    const self = this;
    // freeze the pursuit while staging: the still is composed, not chased
    self.pursuit.stageHold = true;
    self.harbor.stageHold = true;
    self.dash.quiet = true; // no banners or toasts over a still
    // the constructor's job-start banner is already up: take it down
    self.dash.bannerTimer = 0;
    self.dash.el.banner.style.display = 'none';
    self.dash.toastTimer = 0;
    self.dash.el.toast.style.display = 'none';
    const f = {
      setMission(i, obj) { self.jobs.beginJob(i); self.jobs.taskIndex = obj || 0; },
      setCash(n) { self.cash = n; },
      setSpeed(mph) {
        // hold the speedometer: with no keys pressed the car would coast to 0
        self.stagedSpeed = mph / 2.2;
        if (self.car) self.car.speed = self.stagedSpeed;
        if (self.hull) self.hull.speed = self.stagedSpeed;
      },
      setWanted(n) {
        self.pursuit.wanted = n;
        self.pursuit.heat = [0, 15, 32, 50, 70, 90][n] || 0;
        if (n >= 3 && !self.pursuit.heli) self.pursuit.heli = self.pursuit.makeHeli();
      },
      setObjective(text) { self.objectiveOverride = text; },
      setRadio(i) { self.radio.station = i; },
      setCamera(pos, look) {
        self.cinematic = { pos: new THREE.Vector3(pos.x, pos.y, pos.z), look: new THREE.Vector3(look.x, look.y, look.z) };
      },
      placeWalker(x, z, heading) {
        self.hero.x = x;
        self.hero.z = z;
        self.hero.heading = heading;
        self.hero.mesh.position.set(x, 0, z);
        self.hero.mesh.rotation.y = heading;
        self.hero.mesh.visible = true;
      },
      giveRide(kind, x, z, heading) {
        const car = new Car(self.scene, kind, x, z, heading);
        self.enterCar(car);
        return car;
      },
      giveBoat(kind, x, z, heading) {
        const boat = new Hull(self.scene, kind, x, z, heading);
        self.hull = boat;
        self.mode = 'boat';
        self.hero.mesh.visible = false;
        self.jobs.markBoard(kind);
        self.camHeading = heading;
        return boat;
      },
      spawnPursuit(n, dist) {
        for (let i = 0; i < n; i++) {
          const a = self.car ? self.car.heading : 0;
          // tight on the bumper, inside the cover camera's frame
          const bx = (self.car ? self.car.x : 0) - Math.sin(a) * (dist + i * 5) + (i === 0 ? -3.5 : 3.5);
          const bz = (self.car ? self.car.z : 0) - Math.cos(a) * (dist + i * 5);
          const c = new Car(self.scene, 'interceptor', bx, bz, a);
          c.speed = 26;
          self.pursuit.cruisers.push(c);
        }
      },
      spawnHeli() {
        if (!self.pursuit.heli) self.pursuit.heli = self.pursuit.makeHeli();
        self.pursuit.wanted = Math.max(self.pursuit.wanted, 3);
        // park Air One in the camera's view, past the player, low enough to
        // fit the frame: 32m behind the player's motion, 19m up, facing back
        const heading = self.car ? self.car.heading : self.hull ? self.hull.heading : self.camHeading;
        const px = self.car ? self.car.x : self.hull ? self.hull.x : self.hero.x;
        const pz = self.car ? self.car.z : self.hull ? self.hull.z : self.hero.z;
        self.pursuit.heli.position.set(px - Math.sin(heading) * 32, 19, pz - Math.cos(heading) * 32);
        self.pursuit.heli.rotation.y = heading;
      },
      spawnPatrolBoat(x, z) {
        const b = new Hull(self.scene, 'harbor', x, z, 0);
        b.staged = true;
        self.harbor.boats.push(b);
        return b;
      },
      stageCarjack(kind, x, z, heading) {
        const car = new Car(self.scene, kind, x, z, heading);
        const victim = makeVictim(0x2fd4c4);
        victim.position.set(x, 0, z);
        self.scene.add(victim);
        self.theft.start(car, victim, self.hero, () => {});
        // freeze mid-drag: driver half out of the car, Kai at the door
        self.theft.phase = 'drag';
        self.theft.timer = 0.4;
        self.holdTheft = true;
        // the frozen sequence never runs its drag step, so pose the driver now
        const dx = Math.cos(heading);
        const dz = -Math.sin(heading);
        victim.position.set(x - dx * 2.4, 0, z + dz * 2.4);
        victim.rotation.y = heading;
        victim.rotation.z = 0.45;
        victim.visible = true;
        self.hero.x = x - dx * 1.25;
        self.hero.z = z + dz * 1.25;
        self.hero.mesh.position.set(self.hero.x, 0, self.hero.z);
        self.hero.mesh.rotation.y = heading + Math.PI / 2;
        self.dash.cue('E — CARJACK');
      },
    };
    const done = stageStill(f, name);
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

  // where the player is, how fast, in what — one place, used by every tick
  playerPose() {
    const inCar = this.mode === 'car' && this.car;
    const inBoat = this.mode === 'boat' && this.hull;
    const px = inCar ? this.car.x : inBoat ? this.hull.x : this.hero.x;
    const pz = inCar ? this.car.z : inBoat ? this.hull.z : this.hero.z;
    const pspeed = inCar ? this.car.speed : inBoat ? this.hull.speed : this.hero.walkSpeed;
    return { px, pz, pspeed, inCar, inBoat };
  }

  tickPlayer(dt, input, t) {
    if (this.mode === 'foot') {
      if (!this.staged) this.hero.walk(input, this.camHeading, dt, this.world);
      if (this.mouseDown && this.loadout.currentGun().def.auto) this.tryShoot();
      const tok = this.side.grabToken(this.hero.x, this.hero.z);
      if (tok) {
        this.tokens += 1;
        this.cash += 150;
        this.dash.note(`Coral token! +$150 (${this.tokens}/12)`);
        this.radio.ding();
      }
    } else if (this.mode === 'car' && this.car) {
      if (this.staged) {
        if (this.stagedSpeed != null) this.car.speed = this.stagedSpeed;
      } else {
        const before = this.car.health;
        this.car.roll(input, dt, this.world);
        if (this.garage >= 1) this.car.speed = Math.min(this.car.speed, this.car.def.top * 1.15);
        if (this.car.health < before) this.pursuit.raiseHeat(0.4);
      }
      if (this.mouseDown && this.loadout.currentGun().def.auto) this.tryShoot();
      this.hero.x = this.car.x;
      this.hero.z = this.car.z;
    } else if (this.mode === 'boat' && this.hull) {
      if (this.staged) {
        if (this.stagedSpeed != null) this.hull.speed = this.stagedSpeed;
      } else {
        const needWake = this.hull.cruise(input, dt, t);
        if (needWake) this.hull.leaveWake();
        if (this.hull.x > -170) this.pursuit.raiseHeat(0.2); // beaching a boat draws eyes
      }
      this.hero.x = this.hull.x;
      this.hero.z = this.hull.z;
    }
    // theft scene (frozen for the foot still)
    if (!this.holdTheft) this.theft.tick(dt);
  }

  tickPursuit(dt, pose, t) {
    this.pursuit.update(dt, pose.px, pose.pz, pose.pspeed, t);
    this.harbor.update(dt, pose.px, pose.pz, this.pursuit.wanted, t);
    if (this.pursuit.wanted > this.best.maxWanted) this.best.maxWanted = this.pursuit.wanted;
    const mph = Math.abs(pose.pspeed) * 2.2;
    if (mph > this.best.topSpeed) this.best.topSpeed = Math.round(mph);
  }

  tickJobs(dt, pose, t) {
    const obj = this.jobs.task();
    this.jobs.tick({ x: pose.px, z: pose.pz, mode: this.mode, wanted: this.pursuit.wanted, dt });
    this.markerTimer += dt;
    if (obj && obj.x !== undefined) {
      this.marker.visible = true;
      this.marker.position.set(obj.x, 0, obj.z);
      this.marker.userData.gem.position.y = 6 + Math.sin(t * 2.2) * 0.8;
      this.marker.userData.gem.rotation.y = t * 1.4;
    } else {
      this.marker.visible = false;
    }
    return obj;
  }

  tickHud(dt, pose, obj) {
    const job = this.jobs.job();
    const dashState = {
      job,
      objectiveText: this.objectiveOverride || (obj ? obj.text : 'Free roam — explore Coral Bay.'),
      jobProgress: this.jobs.done ? 1 : (job ? (this.jobs.taskIndex + this.jobs.taskFraction({ x: pose.px, z: pose.pz })) / job.tasks.length : 0),
      cash: this.cash,
      wanted: this.pursuit.wanted,
      health: this.hero.health,
      vehicleDamage: this.car ? 100 - this.car.health : this.hull ? 100 - this.hull.health : 0,
      nitro: this.car ? this.car.nitro : 1,
      x: pose.px,
      z: pose.pz,
      speed: pose.pspeed,
      vehicleName: this.mode === 'car' && this.car ? this.car.def.name : this.mode === 'boat' && this.hull ? this.hull.def.name : 'ON FOOT',
      gearText: this.mode === 'car' ? `KAI SOLANO · ${this.car ? Math.round(this.car.health) : 100}% HULL` : this.mode === 'boat' ? 'KAI SOLANO · ON THE WATER' : 'KAI SOLANO',
      stationName: this.radio.currentChannel().name,
      trackName: this.radio.currentChannel().track,
      weaponSlot: this.loadout.current,
      weaponAmmo: [0, 1, 2].map((i) => this.loadout.ammoLabel(i)),
      mode: this.mode,
      weaponOut: this.mode === 'foot',
      marker: obj && obj.x !== undefined ? { x: obj.x, z: obj.z } : null,
      police: this.pursuit.cruisers.map((c) => ({ x: c.x, z: c.z })),
      boats: [...this.mooring.moored, ...this.harbor.boats, ...(this.hull ? [this.hull] : [])].map((b) => ({ x: b.x, z: b.z })),
      traffic: this.traffic.cars.slice(0, 14).map((c) => ({ x: c.car.x, z: c.car.z })),
      heading: this.mode === 'car' && this.car ? this.car.heading : this.mode === 'boat' && this.hull ? this.hull.heading : this.camHeading,
    };
    this.dash.draw(dashState, dt);
  }

  tickPrompt() {
    // prompt: what E does right now
    if (this.mode === 'foot' && !this.theft.active && !this.holdTheft) {
      if (this.mooring.closestDocked(this.hero.x, this.hero.z, 5) && this.hero.x < -150) {
        this.dash.cue('E — BOARD BOAT');
      } else if (this.myCar && Math.hypot(this.hero.x - this.myCar.x, this.hero.z - this.myCar.z) < 4.5) {
        this.dash.cue('E — GET IN');
      } else if (this.traffic.closestStealable(this.hero.x, this.hero.z, 4.5)) {
        this.dash.cue('E — CARJACK');
      } else if (this.side.closestStore(this.hero.x, this.hero.z, 6)) {
        this.dash.cue('E — SHOP');
      } else {
        this.dash.cue(null);
      }
    } else if (this.mode === 'car' || this.mode === 'boat') {
      this.dash.cue(null);
    }
  }

  updateCamera(dt) {
    if (this.cinematic) {
      this.camera.position.copy(this.cinematic.pos);
      this.camera.lookAt(this.cinematic.look);
      return;
    }
    let tx;
    let ty;
    let tz;
    let lx;
    let ly;
    let lz;
    if (this.mode === 'car' && this.car) {
      const r = this.car;
      tx = r.x - Math.sin(r.heading) * CHASE_BACK;
      ty = CHASE_UP;
      tz = r.z - Math.cos(r.heading) * CHASE_BACK;
      lx = r.x + Math.sin(r.heading) * 8;
      ly = 1.6;
      lz = r.z + Math.cos(r.heading) * 8;
    } else if (this.mode === 'boat' && this.hull) {
      const b = this.hull;
      tx = b.x - Math.sin(b.heading) * 12;
      ty = 5.5;
      tz = b.z - Math.cos(b.heading) * 12;
      lx = b.x + Math.sin(b.heading) * 10;
      ly = 1.2;
      lz = b.z + Math.cos(b.heading) * 10;
    } else {
      const w = this.hero;
      tx = w.x - Math.sin(this.camHeading) * 7.5;
      ty = 3.4 + this.camPitch * 3;
      tz = w.z - Math.cos(this.camHeading) * 7.5;
      lx = w.x + Math.sin(this.camHeading) * 5;
      ly = 1.5;
      lz = w.z + Math.cos(this.camHeading) * 5;
    }
    const lam = 1 - Math.exp(-7 * dt);
    this.camPos.x = mix(this.camPos.x, tx, lam);
    this.camPos.y = mix(this.camPos.y, ty, lam);
    this.camPos.z = mix(this.camPos.z, tz, lam);
    this.camLook.x = mix(this.camLook.x, lx, lam);
    this.camLook.y = mix(this.camLook.y, ly, lam);
    this.camLook.z = mix(this.camLook.z, lz, lam);
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
    this.world.animate(dt, t);
    this.traffic.update(dt, this.hero.x, this.hero.z);
    this.crowd.update(dt);
    this.mooring.update(dt, t);
    this.side.update(dt, t);
    this.gunplay.update(dt);
    this.loadout.update(dt);

    // player, pursuit, jobs, HUD — one tick each, in order
    this.tickPlayer(dt, input, t);
    const pose = this.playerPose();
    this.tickPursuit(dt, pose, t);
    const obj = this.tickJobs(dt, pose, t);

    // audio
    this.radio.beat(t);
    const driving = this.mode === 'car' || this.mode === 'boat';
    const norm = clampVal(Math.abs(pose.pspeed) / 40, 0, 1);
    this.radio.engineHum(norm, driving);
    this.radio.sirenWail(this.pursuit.wanted);

    this.tickHud(dt, pose, obj);
    this.tickPrompt();

    this.updateCamera(dt);
    this.renderer.render(this.scene, this.camera);
    this.frames += 1;
    if (this.frames === 3) window.__coralReady = true;
    this.saveTimer += dt;
    if (this.saveTimer > 20) { this.saveTimer = 0; this.saveNow(); }
  }
}

try {
  window.__coralGame = new HeatGame();
} catch (err) {
  window.__coralError = String(err && err.stack || err);
  const loading = document.getElementById('loader');
  if (loading) loading.textContent = 'ERROR: ' + window.__coralError;
  throw err;
}

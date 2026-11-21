// CORAL HEAT — boot. Builds the world, wires input, runs the loop and
// exposes window.__game for playtests. Camera sits directly behind the
// player in every mode (foot, car, bike, boat); the game never reads a file
// that is not under game/ and never touches the network.
CH.boot = (function () {
  const U = CH.util;
  let lastT = 0;

  function params() {
    const q = new URLSearchParams(window.location.search);
    return { seed: parseInt(q.get('seed') || '7', 10) || 7, shot: q.get('shot') || null };
  }

  function init() {
    const S = CH.S;
    const qp = params();
    S.seed = qp.seed;
    S.rng = U.mulberry32(S.seed);
    window.__shotReady = false;
    window.__shotError = '';
    window.addEventListener('error', (e) => {
      S.shotError = String(e.message || e.error || 'error');
      window.__shotError = S.shotError;
    });
    // --- renderer ---------------------------------------------------------
    // Headless verification (SwiftShader) runs without antialiasing: it is
    // far faster in software and the game still looks right; real desktop
    // Chrome gets the full antialiased frame.
    const headless = !!navigator.webdriver;
    const renderer = new THREE.WebGLRenderer({ antialias: !headless, powerPreference: 'high-performance' });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    document.body.appendChild(renderer.domElement);
    const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 1400);
    camera.position.set(0, 4, -12);
    const scene = new THREE.Scene();
    S.renderer = renderer; S.camera = camera; S.scene = scene;

    // --- world ------------------------------------------------------------
    CH.city.build(scene);
    CH.garage.build(scene);
    CH.raceway.build(scene);
    CH.bikes.spawnBikes(scene);
    CH.boats.spawnBoats(scene);
    CH.drive.spawnTraffic(scene, 26);
    CH.walk.spawnPeds(scene, 40);

    // --- player -----------------------------------------------------------
    const mesh = CH.walk.makePlayer();
    mesh.position.set(0, 0, 0);
    scene.add(mesh);
    S.player = {
      x: 0, z: 0, heading: 0, speed: 0, health: 100, armour: 0, cash: 500,
      wanted: 0, inCar: false, inBoat: false, inBike: false,
      car: null, boat: null, bike: null, mesh, moving: false, handbrake: false,
    };
    CH.story.buildBeacon(scene);

    // --- save ---------------------------------------------------------------
    const save = CH.savegame.load();
    S.missions.idx = save.mission;
    S.player.cash = save.cash;
    S.garage.owned = save.owned.slice();
    S.stats.racesWon = save.racesWon;
    S.stats.carsStolen = save.carsStolen;
    S._hasSave = save.mission > 0 || save.cash !== 500;

    // --- HUD + input --------------------------------------------------------
    CH.hud.build();
    bindInput();

    window.__game = {
      state: S, player: S.player, traffic: S.traffic, police: S.police,
      missions: { current: () => CH.story.current() },
      race: S.race, city: CH.city,
    };

    if (qp.shot) {
      CH.shots.stage(qp.shot);
    } else {
      CH.hud.showStart(S._hasSave);
    }

    window.addEventListener('resize', () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    });
    requestAnimationFrame(loop);
  }

  function bindInput() {
    const S = CH.S;
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      S.input.keys[e.code] = true;
      if (S.mode !== 'play') return;
      if (e.code === 'KeyE') contextAction();
      if (e.code === 'KeyF') CH.fight.openWheel(!S.weapon.wheelOpen);
      if (e.code === 'KeyR') {
        S.radio.station = (S.radio.station + 1) % S.radio.stations.length;
        CH.hud.toast('RADIO: ' + S.radio.stations[S.radio.station]);
        CH.sound.radioJingle();
      }
      if (e.code === 'KeyM') CH.hud.renderMissionList();
      if (e.code === 'Escape') togglePause(true);
      if (e.code === 'Digit1') CH.fight.selectWeapon(0);
      if (e.code === 'Digit2') CH.fight.selectWeapon(1);
      if (e.code === 'Digit3') CH.fight.selectWeapon(2);
      if (e.code === 'Digit4') CH.fight.selectWeapon(3);
    });
    window.addEventListener('keyup', (e) => { S.input.keys[e.code] = false; });
    window.addEventListener('mousemove', (e) => {
      S.input.mouseDX = (S.input.mouseDX || 0) + (e.movementX || 0);
      S.input.mouseX = e.clientX; S.input.mouseY = e.clientY;
    });
    window.addEventListener('mousedown', (e) => {
      if (S.mode !== 'play' || e.button !== 0) return;
      if (e.target && (e.target.tagName === 'BUTTON' || e.target.closest('#startScreen'))) return;
      CH.fight.shoot();
    });
    window.addEventListener('blur', () => { S.input.keys = {}; });
  }

  function contextAction() {
    const S = CH.S, p = S.player;
    if (p.inCar) {
      if (CH.garage.bankCar()) return;
      CH.drive.exitCar();
      return;
    }
    if (p.inBoat) { CH.boats.disembark(); return; }
    if (p.inBike) { CH.bikes.dismount(); return; }
    const car = CH.drive.nearestCar(p.x, p.z, 4.5);
    if (car) {
      CH.drive.enterCar(car);
      CH.cops.addWanted(1); // carjacking is a crime
      CH.hud.toast('JACKED THE ' + car.type.toUpperCase() + ' — +1 STAR');
      return;
    }
    const bike = CH.bikes.nearestBike(p.x, p.z, 3.5);
    if (bike) { CH.bikes.mount(bike); return; }
    const boat = p.z > CH.CFG.waterZ - 8 ? CH.boats.nearestBoat(p.x, p.z, 9) : null;
    if (boat) { CH.boats.board(boat); return; }
    const shop = CH.garage.nearestShop(p.x, p.z);
    if (shop) { CH.garage.buy(shop.kind); return; }
  }

  function startGame(fromSave) {
    const S = CH.S;
    CH.sound.start();
    if (fromSave) {
      const save = CH.savegame.load();
      S.missions.idx = save.mission;
      S.player.cash = save.cash;
    }
    CH.hud.hideStart();
    S.mode = 'play';
    CH.story.startMission(CH.story.current());
    CH.sound.click();
  }

  function togglePause(on) {
    const S = CH.S;
    if (on && S.mode === 'play') { S.mode = 'paused'; U.show('pauseScreen', true); }
    else if (!on && S.mode === 'paused') { S.mode = 'play'; U.show('pauseScreen', false); }
  }

  function updateCamera(dt) {
    const S = CH.S, p = S.player, cam = S.camera;
    const inVehicle = p.inCar || p.inBoat;
    const dist = p.inBoat ? 13 : p.inCar ? 10.5 : p.inBike ? 8.5 : 6.5;
    const height = p.inBoat ? 5.2 : p.inCar ? 3.9 : p.inBike ? 3.2 : 2.9;
    const sin = Math.sin(p.heading), cos = Math.cos(p.heading);
    const tx = p.x - sin * dist, tz = p.z - cos * dist, ty = height;
    const k = 1 - Math.exp(-dt * (inVehicle ? 5 : 7));
    cam.position.x = U.lerp(cam.position.x, tx, k);
    cam.position.y = U.lerp(cam.position.y, ty, k);
    cam.position.z = U.lerp(cam.position.z, tz, k);
    cam.lookAt(p.x + sin * 9, 1.4, p.z + cos * 9);
  }

  function loop(t) {
    requestAnimationFrame(loop);
    const S = CH.S;
    const dt = Math.min(0.05, lastT ? (t - lastT) / 1000 : 0.016);
    lastT = t;
    if (S.mode === 'paused') {
      S.renderer.render(S.scene, S.camera);
      return;
    }
    S.clock += dt;
    S.frame++;
    if (S.mode === 'play') {
      if (S.player.inCar) CH.drive.updatePlayerCar(dt);
      else if (S.player.inBoat) CH.boats.sail(dt);
      else if (S.player.inBike) CH.bikes.ride(dt);
      else CH.walk.update(dt);
      CH.drive.updateTraffic(dt);
      CH.walk.updatePeds(dt);
      CH.cops.update(dt, S.scene);
      CH.boats.updatePoliceBoats(dt);
      CH.raceway.update(dt);
      CH.story.update(dt);
      CH.fight.update(dt);
      CH.city.update(dt);
      if (S.player.health <= 0) {
        // Wasted: respawn at the clinic, lighter in the pocket.
        CH.hud.banner('WASTED — BACK ON YOUR FEET');
        S.player.health = 100;
        S.player.cash = Math.max(0, S.player.cash - 500);
        if (S.player.inCar) CH.drive.exitCar();
        S.player.x = 0; S.player.z = 0;
        S.player.mesh.position.set(0, 0, 0);
        CH.cops.setWanted(0);
      }
      CH.shots.tick();
    }
    updateCamera(dt);
    CH.hud.update(dt);
    S.renderer.render(S.scene, S.camera);
  }

  return { init, startGame, togglePause };
})();

window.addEventListener('DOMContentLoaded', () => CH.boot.init());

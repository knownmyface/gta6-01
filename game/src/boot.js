// CORAL HEAT — boot: renderer, state, input, main loop, start screen.
// This is the game entry: it builds the world, wires every system together
// and runs the frame loop. Play with keyboard + mouse, no network, no build.
(function () {
  'use strict';
  var U = Coral.util;

  var G = {
    scene: null, camera: null, renderer: null,
    player: null, keys: {},
    time: 0, running: false, paused: false,
    camYaw: 0, camPitch: 0.32,
    traffic: [], parked: [], peds: [], cops: [], bikes: [], boatsList: [],
    roadblocks: [], heli: null,
    mission: null, completedMissions: [],
    weaponIdx: 0, ammo: {}, radioStation: 0,
    shakeT: 0, shakeMag: 0,
    heatTimer: 0, blockTimer: 0,
    hud: null, sound: null, savegame: null,
    shotMode: 0, shotSettled: false,
    onCarjack: null, busted: null,
  };
  Coral.G = G;
  G.hud = Coral.hud;
  G.sound = Coral.sound;
  G.savegame = Coral.savegame;

  function shake(mag) {
    G.shakeMag = Math.max(G.shakeMag, mag);
    G.shakeT = 0.4;
  }
  G.shake = shake;

  function makeRenderer() {
    var renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.domElement.id = 'game-canvas';
    document.getElementById('game-root').appendChild(renderer.domElement);
    return renderer;
  }

  function bindInput() {
    window.addEventListener('keydown', function (ev) {
      G.keys[ev.code] = true;
      Coral.sound.unlock();
      if (ev.code === 'KeyM') toggleMission();
      if (ev.code === 'KeyE') tryEnterVehicle();
      if (ev.code === 'KeyQ') Coral.fight.openWeaponWheel(G);
      if (ev.code === 'KeyR') {
        var name = Coral.sound.nextStation();
        G.radioStation = (G.radioStation + 1) % 3;
        G.hud.showToast('RADIO — ' + name);
      }
      if (ev.code === 'KeyH') toggleHelp();
      if (ev.code === 'KeyP' || ev.code === 'Escape') togglePause();
      if (ev.code === 'Digit1') Coral.fight.cycleWeapon(G, -1);
      if (ev.code === 'Digit2') Coral.fight.cycleWeapon(G, 1);
      if (ev.code === 'KeyC') Coral.savegame.save(G);
      if (ev.code === 'Space') ev.preventDefault();
    });
    window.addEventListener('keyup', function (ev) {
      G.keys[ev.code] = false;
    });
    window.addEventListener('mousedown', function (ev) {
      if (ev.button !== 0) return;
      Coral.sound.unlock();
      if (G.wheelOpen) return;
      if (G.running && !G.paused) Coral.fight.fire(G);
    });
    window.addEventListener('mousemove', function (ev) {
      if (document.pointerLockElement) {
        G.camYaw -= ev.movementX * 0.0032;
        G.camPitch = U.clamp(G.camPitch + ev.movementY * 0.002, 0.05, 0.9);
      }
    });
    window.addEventListener('resize', function () {
      G.camera.aspect = window.innerWidth / window.innerHeight;
      G.camera.updateProjectionMatrix();
      G.renderer.setSize(window.innerWidth, window.innerHeight);
    });
    document.addEventListener('pointerlockchange', function () {
      if (!document.pointerLockElement) G.mouseLook = false;
    });
  }

  function toggleMission() {
    if (G.mission) {
      Coral.story.failMission(G, 'abandoned');
      return;
    }
    var next = Coral.story.nextMissionId(G);
    if (next === null) next = Coral.story2.nextMissionId(G);
    if (next === null) {
      G.hud.showToast('All 22 missions complete — Port Coral is yours, Rin');
      return;
    }
    if (next < 12) Coral.story.startMission(G, next);
    else Coral.story2.startMission(G, next);
  }

  function tryEnterVehicle() {
    var p = G.player;
    if (p.boat) { Coral.boats.leaveBoat(G); return; }
    if (p.bike) { Coral.bikes.dismountBike(G); return; }
    if (p.car) { Coral.drive.exitCar(G); return; }
    // On foot: nearest boat (on the pier), bike, then car.
    var boat = Coral.boats.nearestBoat(G, 6);
    if (boat && p.z > 195) { Coral.boats.boardBoat(G, boat); return; }
    var bike = Coral.bikes.nearestBike(G, 3.5);
    if (bike) { Coral.bikes.mountBike(G, bike); return; }
    var car = Coral.drive.nearestStealable(G, 4.5);
    if (car) {
      if (car.driver === 'traffic') {
        Coral.cops.addHeat(G, 1, 'carjacking');
        G.hud.showToast('You jacked the ' + car.name + '!');
      }
      Coral.drive.enterCar(G, car);
    } else {
      var shop = Coral.garage.nearestShop(G, 7);
      if (shop) { openShop(shop); return; }
      var house = Coral.garage.nearestSafehouse(G, 7);
      if (house) { Coral.garage.enterSafehouse(G, house); return; }
      G.hud.showToast('No vehicle nearby — find a car, bike or boat');
    }
  }

  function openShop(shop) {
    G.shopOpen = shop;
    var list = shop.stock.map(function (it) {
      return '<button data-id="' + it.id + '">' + it.name + ' — ' + U.fmtMoney(it.price) + '</button>';
    }).join('');
    var panel = U.el('shop-panel');
    panel.innerHTML = '<h2>' + shop.name + '</h2><p>' + shop.blurb + '</p>' + list +
      '<button data-id="__close">Close (E)</button>';
    panel.style.display = 'block';
    var btns = panel.querySelectorAll('button');
    for (var i = 0; i < btns.length; i++) {
      btns[i].addEventListener('click', function (ev) {
        var id = ev.currentTarget.getAttribute('data-id');
        if (id === '__close') { closeShop(); return; }
        Coral.garage.buy(G, G.shopOpen, id);
      });
    }
  }

  function closeShop() {
    var panel = U.el('shop-panel');
    if (panel) { panel.style.display = 'none'; panel.innerHTML = ''; }
    G.shopOpen = null;
  }

  function toggleHelp() {
    var h = U.el('help-panel');
    if (!h) return;
    h.style.display = h.style.display === 'block' ? 'none' : 'block';
  }

  function togglePause() {
    G.paused = !G.paused;
    var p = U.el('pause-panel');
    if (p) p.style.display = G.paused ? 'block' : 'none';
  }

  function busted() {
    G.hud.showToast('BUSTED — the Port Coral PD has you');
    Coral.cops.setWanted(G, 0, '');
    Coral.cops.clearForce(G);
    G.player.cash = Math.max(0, G.player.cash - 300);
    G.player.health = 100;
    G.player.x = 0; G.player.z = -62;
    G.player.mesh.position.set(0, 0, -62);
    if (G.player.car) Coral.drive.exitCar(G);
    Coral.savegame.autosave(G);
  }
  G.busted = busted;

  function onCarjack(car) {
    Coral.cops.addHeat(G, 1, 'carjacking');
  }
  G.onCarjack = onCarjack;

  function wantedSync() {
    // The wanted level lives on the player object; the HUD reads it there.
    G.player.wanted = U.clamp(G.player.wanted || 0, 0, 5);
  }

  function loop() {
    requestAnimationFrame(loop);
    var dt = Math.min(0.05, G.clock.getDelta());
    G.time += dt;
    if (!G.running || G.paused) {
      G.renderer.render(G.scene, G.camera);
      return;
    }
    wantedSync();
    Coral.city.update(dt, G.time);
    Coral.walk.updateOnFoot(G, dt);
    Coral.drive.updatePlayerCar(G, dt);
    Coral.drive.updateTraffic(G, dt);
    Coral.bikes.updateBike(G, dt);
    Coral.boats.updateBoats(G, dt, G.time);
    Coral.walk.updatePedestrians(G, dt);
    Coral.cops.decayWanted(G, dt);
    Coral.cops.updateCops(G, dt, G.time);
    Coral.fight.updateParticles(G, dt);
    Coral.raceway.update(G, dt);
    Coral.story.update(G, dt);
    Coral.story2.update(G, dt);
    Coral.walk.updateCamera(G, dt);
    // Screen shake after explosions.
    if (G.shakeT > 0) {
      G.shakeT -= dt;
      G.camera.position.x += (Math.random() - 0.5) * G.shakeMag;
      G.camera.position.y += (Math.random() - 0.5) * G.shakeMag;
      if (G.shakeT <= 0) G.shakeMag = 0;
    }
    // Engine hum follows speed.
    if (G.sound) {
      var sp = G.player.car ? Math.abs(G.player.car.speed) / 52
        : G.player.bike ? Math.abs(G.player.bike.speed) / 58
        : G.player.boat ? Math.abs(G.player.boat.speed) / 44 : 0;
      G.sound.engineHum(sp);
    }
    G.hud.update(G);
    G.renderer.render(G.scene, G.camera);
  }

  function startGame(fromSave) {
    var start = U.el('start-screen');
    if (start) start.style.display = 'none';
    if (fromSave) {
      var data = Coral.savegame.load();
      if (data) Coral.savegame.apply(G, data);
    }
    G.running = true;
    Coral.sound.unlock();
    Coral.sound.startRadio(G.radioStation || 0);
    G.hud.showToast('Welcome to Port Coral, Rin — press M for your first job');
    var canvas = G.renderer.domElement;
    canvas.addEventListener('click', function () {
      if (!document.pointerLockElement) canvas.requestPointerLock();
    });
  }

  function buildStartScreen() {
    var s = U.el('start-screen');
    if (!s) return;
    var save = Coral.savegame.saveSummary();
    s.innerHTML =
      '<div class="start-inner">' +
      '<h1>CORAL <span>HEAT</span></h1>' +
      '<p class="tagline">An open-world crime story in Port Coral — a sunset marina city of neon, noise and bad decisions.</p>' +
      '<p class="story">You are Rin Marlowe, courier. One bad delivery pulls you into 22 missions, a casino heist and a boat chase out of town.</p>' +
      '<button id="btn-new">NEW GAME</button>' +
      (save ? '<button id="btn-continue">CONTINUE — ' + U.fmtMoney(save.cash) + ' · ' + save.missions + '/22 missions · ' + save.when + '</button>' : '') +
      '<div class="controls">WASD move / drive · Mouse look (click to lock) · E enter car / boat / shop · F punch · Click shoot · Q weapon wheel · R radio · M mission · C save · P pause</div>' +
      '<div class="fine">Original game. All names, characters, places and music are invented. No network requests; three.js is vendored locally.</div>' +
      '</div>';
    U.el('btn-new').addEventListener('click', function () { startGame(false); });
    var cont = U.el('btn-continue');
    if (cont) cont.addEventListener('click', function () { startGame(true); });
  }

  function init() {
    G.scene = new THREE.Scene();
    G.camera = new THREE.PerspectiveCamera(68, window.innerWidth / window.innerHeight, 0.1, 2000);
    G.camera.position.set(0, 8, -14);
    G.renderer = makeRenderer();
    G.clock = new THREE.Clock();
    var city = Coral.city.build(G.scene);
    G.city = city;
    G.player = Coral.walk.makePlayer(G, 0, -40);
    Coral.drive.spawnTraffic(G, 26);
    Coral.drive.spawnParked(G, 22);
    Coral.walk.spawnPedestrians(G, 40);
    Coral.bikes.spawnBikes(G);
    Coral.boats.spawnMarinaBoats(G);
    Coral.garage.buildShops(G);
    Coral.hud.build();
    Coral.hud.updateWeapon(Coral.fight.currentWeapon(G));
    bindInput();
    buildStartScreen();
    // Shot mode: stage the requested frame and render it live.
    var shot = Coral.shots.shotFromUrl();
    if (shot > 0) {
      var start = U.el('start-screen');
      if (start) start.style.display = 'none';
      G.running = true;
      Coral.shots.stage(G, shot);
      G.hud.update(G);
    }
    loop();
  }

  window.addEventListener('load', init);
})();

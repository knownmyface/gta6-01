// CORAL HEAT — the HUD. All DOM, so it stays crisp in screenshots: mission
// panel top-left, wanted stars + cash + health top-right, circular minimap
// bottom-left, big speedometer bottom-right, radio and objective banner
// bottom-centre, plus the weapon wheel, start screen and pause screen.
CH.hud = (function () {
  const U = CH.util;
  let mapCtx = null, toastAt = 0, bannerAt = 0;

  function build() {
    const hud = document.createElement('div');
    hud.id = 'hud';
    hud.innerHTML = `
      <div id="missionPanel"><div id="missionTitle">CORAL HEAT</div><div id="missionSub">Loading the city…</div><div id="missionCash"></div></div>
      <div id="wantedBox"><div id="stars">☆☆☆☆☆</div><div id="cashLine">$500</div><div id="healthBar"><div id="healthFill"></div></div><div id="armourLine"></div></div>
      <div id="minimapWrap"><canvas id="minimap" width="190" height="190"></canvas><div id="mapLabel">CORAL BAY</div></div>
      <div id="speedo"><div id="speedNum">0</div><div id="speedUnit">MPH</div><div id="speedCar">ON FOOT</div></div>
      <div id="banner"></div>
      <div id="toast"></div>
      <div id="prompt"></div>
      <div id="radioBar"><span id="radioStation">CORAL 87.9 FM</span><span id="radioSong">Sunset Drive — The Palms</span><span id="radioObj"></span></div>
      <div id="crosshair">+</div>
      <div id="weaponWheel"><div class="ww-title">WEAPON WHEEL</div><div id="wwSlots"></div><div class="ww-hint">1-4 select · F close</div></div>
      <div id="raceHud"><span id="raceLap">LAP 1/3</span><span id="racePos">P4/4</span><span id="raceName"></span></div>
      <div id="startScreen">
        <div class="ss-title">CORAL HEAT</div>
        <div class="ss-sub">A sunset open-world crime story — Coral Bay</div>
        <div class="ss-desc">22 missions. Steal cars, outrun the law, crack the Coral Palms casino and escape by boat.</div>
        <button id="startBtn">START GAME</button>
        <button id="continueBtn">CONTINUE</button>
        <div class="ss-controls">WASD move / drive · Mouse camera · E enter / exit car · Space handbrake · Shift run<br>F weapon wheel · Click shoot · R radio · M missions · Esc pause</div>
        <div class="ss-foot">Original city, characters and story. No network — everything runs from local files.</div>
      </div>
      <div id="pauseScreen"><div class="ps-title">PAUSED</div><button id="resumeBtn">RESUME</button><div class="ps-hint">Esc to resume · M for missions</div></div>
      <div id="missionList"></div>`;
    document.body.appendChild(hud);
    mapCtx = U.el('minimap').getContext('2d');
    // Hide the toggleable overlays with inline styles at build time: the
    // stylesheet must not hard-hide them, or U.show can never reveal them.
    U.show('weaponWheel', false);
    U.show('raceHud', false);
    U.show('crosshair', false);
    U.show('missionList', false);
    U.show('pauseScreen', false);
    U.show('continueBtn', false);
    U.el('startBtn').addEventListener('click', () => CH.boot.startGame(false));
    U.el('continueBtn').addEventListener('click', () => CH.boot.startGame(true));
    U.el('resumeBtn').addEventListener('click', () => CH.boot.togglePause(false));
    renderWheel();
  }

  function banner(text) {
    const b = U.el('banner');
    if (!b) return;
    b.textContent = text;
    b.style.opacity = '1';
    bannerAt = CH.S.clock;
    CH.S.missions.banner = text;
  }
  function toast(text) {
    const t = U.el('toast');
    if (!t) return;
    t.textContent = text;
    t.style.opacity = '1';
    toastAt = CH.S.clock;
  }
  function setPrompt(text) {
    const p = U.el('prompt');
    if (p) p.textContent = text || '';
  }

  function renderWheel() {
    const slots = U.el('wwSlots');
    if (!slots) return;
    slots.innerHTML = CH.fight.WEAPONS.map((w, i) =>
      `<div class="ww-slot${i === CH.S.weapon.current ? ' sel' : ''}">${i + 1}. ${w.name}</div>`
    ).join('');
    U.show('weaponWheel', CH.S.weapon.wheelOpen);
  }

  function drawMinimap() {
    if (!mapCtx) return;
    const S = CH.S;
    const c = mapCtx, W = 190, H = 190;
    c.clearRect(0, 0, W, H);
    const sc = (v) => ((v + 330) / 660) * W;
    // Water at the bottom (south = bay).
    c.fillStyle = '#1e6f8e';
    c.fillRect(0, sc(300), W, H - sc(300));
    c.fillStyle = '#c9a86a';
    c.fillRect(0, sc(282), W, sc(300) - sc(282));
    // Roads.
    c.strokeStyle = '#5a5f68'; c.lineWidth = 3;
    for (let v = -300; v <= 300; v += 60) {
      c.beginPath(); c.moveTo(sc(v), sc(-300)); c.lineTo(sc(v), sc(300)); c.stroke();
      c.beginPath(); c.moveTo(sc(-300), sc(v)); c.lineTo(sc(300), sc(v)); c.stroke();
    }
    // Casino district glow.
    c.fillStyle = 'rgba(255,45,149,0.35)';
    c.fillRect(sc(-270), sc(-270), sc(-60) - sc(-270), sc(-60) - sc(-270));
    // Race gates.
    if (S.race.active) {
      c.fillStyle = '#ffb020';
      const g = CH.raceway.gatePos();
      c.beginPath(); c.arc(sc(g[0]), sc(g[1]), 5, 0, 7); c.fill();
    }
    // Mission target.
    const m = CH.story.current();
    if (m) {
      c.fillStyle = '#ffd23e';
      c.beginPath(); c.arc(sc(m.target.x), sc(m.target.z), 6, 0, 7); c.fill();
      c.strokeStyle = '#ffd23e'; c.lineWidth = 2;
      c.beginPath(); c.arc(sc(m.target.x), sc(m.target.z), 10, 0, 7); c.stroke();
    }
    // Police.
    c.fillStyle = '#4da6ff';
    for (const pc of S.police.cars) { c.beginPath(); c.arc(sc(pc.x), sc(pc.z), 3.5, 0, 7); c.fill(); }
    if (S.police.heli) { c.beginPath(); c.arc(sc(S.police.heli.x), sc(S.police.heli.z), 4.5, 0, 7); c.fill(); }
    // Player arrow.
    const px = sc(S.player.x), py = sc(S.player.z);
    c.save();
    c.translate(px, py); c.rotate(-S.player.heading + Math.PI);
    c.fillStyle = '#ff5a3c';
    c.beginPath(); c.moveTo(0, -8); c.lineTo(6, 6); c.lineTo(-6, 6); c.closePath(); c.fill();
    c.restore();
  }

  function update(dt) {
    const S = CH.S, p = S.player;
    if (!p) return;
    // Fade the banner and toast.
    if (CH.S.clock - bannerAt > 4) { const b = U.el('banner'); if (b) b.style.opacity = '0'; }
    if (CH.S.clock - toastAt > 3.5) { const t = U.el('toast'); if (t) t.style.opacity = '0'; }
    // Mission panel.
    const m = CH.story.current();
    if (m) {
      U.el('missionTitle').textContent = 'MISSION ' + m.id + ' — ' + m.title.toUpperCase();
      U.el('missionSub').textContent = m.sub;
      U.el('missionCash').textContent = 'REWARD ' + U.fmtCash(m.reward) + ' · ' + (S.missions.idx + 1) + '/22';
      U.el('radioObj').textContent = m.title.toUpperCase();
    }
    // Wanted stars + cash + health.
    let stars = '';
    for (let i = 0; i < 5; i++) stars += i < p.wanted ? '★' : '☆';
    U.el('stars').textContent = stars;
    U.el('stars').style.color = p.wanted >= 4 ? '#ff3b30' : '#ffd23e';
    U.el('cashLine').textContent = U.fmtCash(p.cash);
    U.el('healthFill').style.width = Math.max(0, p.health) + '%';
    U.el('armourLine').textContent = p.armour > 0 ? 'ARMOUR ' + Math.round(p.armour) + '%' : '';
    // Speedometer: a staged shot may pin the dial (the chase reads 116).
    const shown = (typeof S.shotSpeed === 'number' && S.shotSpeed > 0) ? S.shotSpeed : (p.speed || 0);
    const mph = Math.round(Math.abs(shown) * CH.CFG.mph);
    U.el('speedNum').textContent = mph;
    U.el('speedCar').textContent = p.inCar ? (p.car ? p.car.type.toUpperCase() : 'CAR') : p.inBoat ? 'SPEEDBOAT' : p.inBike ? (p.bike ? p.bike.type.toUpperCase() : 'BIKE') : 'ON FOOT';
    // Radio.
    U.el('radioStation').textContent = S.radio.stations[S.radio.station];
    // Race HUD.
    U.show('raceHud', S.race.active);
    if (S.race.active) {
      U.el('raceLap').textContent = 'LAP ' + Math.min(S.race.lap, S.race.laps) + '/' + S.race.laps;
      U.el('racePos').textContent = 'P' + S.race.pos + '/4';
      U.el('raceName').textContent = CH.raceway.CIRCUITS[S.race.circuit].name.toUpperCase();
    }
    // Crosshair only on foot with a gun.
    U.show('crosshair', !p.inCar && !p.inBoat && S.weapon.current > 0 && S.mode === 'play');
    // Context prompt.
    if (S.mode === 'play') {
      if (!p.inCar && !p.inBoat && !p.inBike) {
        const car = CH.drive.nearestCar(p.x, p.z, 4);
        const bike = car ? null : CH.bikes.nearestBike(p.x, p.z, 3);
        const boat = p.z > CH.CFG.waterZ - 6 ? CH.boats.nearestBoat(p.x, p.z, 8) : null;
        const shop = CH.garage.nearestShop(p.x, p.z);
        if (car) setPrompt('Press E to jack the ' + car.type);
        else if (bike) setPrompt('Press E to ride the ' + bike.type);
        else if (boat) setPrompt('Press E to board the speedboat');
        else if (shop) setPrompt('Press E — ' + shop.name);
        else setPrompt('');
      } else if (p.inCar) {
        const sh = CH.garage.nearestSafehouse(p.x, p.z);
        setPrompt(sh ? 'Press E to bank this car at ' + sh.name : 'E exit car');
      } else if (p.inBoat) setPrompt('E step ashore');
      else if (p.inBike) setPrompt('E get off the bike');
    } else setPrompt('');
    // Minimap every third frame.
    if (S.frame % 3 === 0) drawMinimap();
  }

  function showStart(hasSave) {
    U.show('startScreen', true);
    U.show('continueBtn', hasSave);
    U.show('hud', true);
  }
  function hideStart() { U.show('startScreen', false); }

  function renderMissionList() {
    const list = U.el('missionList');
    if (!list) return;
    const all = CH.story.all();
    list.innerHTML = '<div class="ml-title">MISSIONS — ' + (CH.S.missions.idx + 1) + '/22</div>' +
      all.map((m, i) => `<div class="ml-row${i === CH.S.missions.idx ? ' cur' : ''}${i < CH.S.missions.idx ? ' done' : ''}">${m.id}. ${m.title} — ${U.fmtCash(m.reward)}</div>`).join('');
    U.show('missionList', true);
    setTimeout(() => U.show('missionList', false), 6000);
  }

  return { build, update, banner, toast, setPrompt, renderWheel, showStart, hideStart, renderMissionList, drawMinimap };
})();

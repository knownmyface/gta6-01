// CORAL HEAT — HUD: minimap, speedometer, wanted stars, cash, mission
// panel, objective banner, radio readout, weapon wheel and toasts.
// All DOM, drawn over the WebGL canvas; the minimap is a small canvas that
// re-draws roads, the player arrow, cops, the objective marker and boats.
Coral.hud = (function () {
  'use strict';
  var U = Coral.util;

  var mini = null;
  var miniCtx = null;
  var objective = null; // {x, z, dist}
  var wheelEl = null;
  var toastTimer = null;

  function build() {
    var root = U.el('hud');
    if (!root || root.children.length) return;
    root.innerHTML =
      '<div id="mission-panel"><div id="mission-title">PORT CORAL</div>' +
      '<div id="mission-obj">Press M for a mission</div></div>' +
      '<div id="wanted-box"><div id="stars"></div>' +
      '<div id="cash">$250</div><div id="health-bar"><div id="health-fill"></div></div></div>' +
      '<div id="minimap-wrap"><canvas id="minimap" width="190" height="190"></canvas>' +
      '<div id="mini-label">PORT CORAL</div></div>' +
      '<div id="speed-box"><div id="speed-num">0</div><div id="speed-unit">MPH</div>' +
      '<div id="gear">PARK</div></div>' +
      '<div id="radio-box">CORAL FM 98.1</div>' +
      '<div id="objective-banner"></div>' +
      '<div id="weapon-box"><span id="weapon-icon">✊</span> <span id="weapon-name">Fists</span> ' +
      '<span id="weapon-ammo">∞</span></div>' +
      '<div id="race-box" style="display:none"></div>' +
      '<div id="toast"></div>' +
      '<div id="hint">WASD drive/walk · E enter car · F punch · Q weapon wheel · R radio · M mission · H help</div>';
    mini = U.el('minimap');
    miniCtx = mini ? mini.getContext('2d') : null;
    wheelEl = document.createElement('div');
    wheelEl.id = 'weapon-wheel';
    wheelEl.style.display = 'none';
    document.body.appendChild(wheelEl);
  }

  function starsHtml(level) {
    var s = '';
    for (var i = 0; i < 5; i++) {
      s += '<span class="star' + (i < level ? ' on' : '') + '">★</span>';
    }
    return s;
  }

  function update(state) {
    var p = state.player;
    var stars = U.el('stars');
    if (stars) stars.innerHTML = starsHtml(p.wanted || 0);
    var cash = U.el('cash');
    if (cash) cash.textContent = U.fmtMoney(p.cash || 0);
    var fill = U.el('health-fill');
    if (fill) {
      fill.style.width = U.clamp(p.health || 0, 0, 100) + '%';
      fill.style.background = (p.health || 0) < 30 ? '#ff2a2a' : '#39ff88';
    }
    var speed = 0;
    var gear = 'PARK';
    if (p.car) { speed = U.mph(p.car.speed); gear = p.car.speed > 1 ? 'DRIVE' : p.car.speed < -1 ? 'REVERSE' : 'PARK'; }
    else if (p.bike) { speed = U.mph(p.bike.speed); gear = 'BIKE'; }
    else if (p.boat) { speed = U.mph(p.boat.speed); gear = 'BOAT'; }
    else if (p.onFoot) { speed = U.mph(p.speed || 0); gear = 'ON FOOT'; }
    var num = U.el('speed-num');
    if (num) num.textContent = String(Math.round(speed));
    var g = U.el('gear');
    if (g) g.textContent = gear;
    var radio = U.el('radio-box');
    if (radio && state.sound) radio.textContent = state.sound.stationName || 'CORAL FM 98.1';
    drawMinimap(state);
  }

  function drawMinimap(state) {
    if (!miniCtx) return;
    var c = miniCtx;
    var S = 190;
    c.clearRect(0, 0, S, S);
    c.fillStyle = 'rgba(12, 16, 32, 0.85)';
    c.beginPath();
    c.arc(S / 2, S / 2, S / 2, 0, Math.PI * 2);
    c.fill();
    c.save();
    c.beginPath();
    c.arc(S / 2, S / 2, S / 2, 0, Math.PI * 2);
    c.clip();
    var world = 620;
    var scale = S / world;
    function toX(x) { return S / 2 + (x - state.player.x) * scale; }
    function toY(z) { return S / 2 + (z - state.player.z) * scale; }
    // Roads.
    c.strokeStyle = 'rgba(200, 200, 210, 0.5)';
    c.lineWidth = 3;
    for (var gx = -310; gx <= 310; gx += 62) {
      c.beginPath(); c.moveTo(toX(gx), toY(-310)); c.lineTo(toX(gx), toY(310)); c.stroke();
      c.beginPath(); c.moveTo(toX(-310), toY(gx)); c.lineTo(toX(310), toY(gx)); c.stroke();
    }
    // Water strip.
    c.fillStyle = 'rgba(38, 120, 190, 0.8)';
    c.fillRect(0, toY(200), S, S);
    // Casino district.
    c.fillStyle = 'rgba(255, 47, 214, 0.85)';
    c.fillRect(toX(170) - 8, toY(95) - 8, 16, 16);
    // Objective marker.
    if (objective) {
      var ox = toX(objective.x), oy = toY(objective.z);
      c.fillStyle = '#ffd23d';
      c.beginPath(); c.arc(ox, oy, 7, 0, Math.PI * 2); c.fill();
      c.strokeStyle = '#ffd23d';
      c.beginPath(); c.arc(ox, oy, 11 + 3 * Math.sin(Date.now() / 240), 0, Math.PI * 2); c.stroke();
    }
    // Cops as red dots, boats as cyan dots.
    var cops = state.cops || [];
    c.fillStyle = '#ff2a2a';
    for (var i = 0; i < cops.length; i++) {
      c.beginPath(); c.arc(toX(cops[i].x), toY(cops[i].z), 3.5, 0, Math.PI * 2); c.fill();
    }
    if (state.heli) {
      c.fillStyle = '#ff7a2f';
      c.beginPath(); c.arc(toX(state.heli.x), toY(state.heli.z), 4.5, 0, Math.PI * 2); c.fill();
    }
    var boats = state.boatsList || [];
    c.fillStyle = '#2fe8ff';
    for (var b = 0; b < boats.length; b++) {
      c.beginPath(); c.arc(toX(boats[b].x), toY(boats[b].z), 3, 0, Math.PI * 2); c.fill();
    }
    // Player arrow, pointing up the heading.
    var px = S / 2, py = S / 2;
    var hd = state.player.heading || 0;
    c.save();
    c.translate(px, py);
    c.rotate(hd);
    c.fillStyle = '#ffffff';
    c.beginPath();
    c.moveTo(0, -9); c.lineTo(6, 7); c.lineTo(-6, 7); c.closePath();
    c.fill();
    c.restore();
    c.restore();
    // North ring.
    c.strokeStyle = 'rgba(255,255,255,0.7)';
    c.lineWidth = 2;
    c.beginPath(); c.arc(S / 2, S / 2, S / 2 - 1, 0, Math.PI * 2); c.stroke();
  }

  function setMission(mission, obj) {
    var t = U.el('mission-title');
    if (t) t.textContent = 'MISSION ' + mission.id + ' — ' + mission.title.toUpperCase();
    var o = U.el('mission-obj');
    if (o) o.textContent = '▸ ' + obj.label;
    var banner = U.el('objective-banner');
    if (banner) {
      banner.textContent = mission.title + ' — ' + obj.label;
      banner.style.display = 'block';
      setTimeout(function () { banner.style.display = 'none'; }, 4200);
    }
  }

  function clearMission() {
    var t = U.el('mission-title');
    if (t) t.textContent = 'PORT CORAL';
    var o = U.el('mission-obj');
    if (o) o.textContent = 'Press M for a mission';
  }

  function setObjectiveMarker(x, z, dist) {
    objective = { x: x, z: z, dist: dist };
  }

  function clearObjectiveMarker() {
    objective = null;
  }

  function showToast(text) {
    var t = U.el('toast');
    if (!t) return;
    t.textContent = text;
    t.style.opacity = '1';
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.style.opacity = '0'; }, 3600);
  }

  function updateCash() {
    // Cash text refreshes on the next update() tick; force it now too.
    var cash = U.el('cash');
    if (cash && window.Coral && Coral.G && Coral.G.player) {
      cash.textContent = U.fmtMoney(Coral.G.player.cash || 0);
    }
  }

  function updateWeapon(w) {
    var icon = U.el('weapon-icon');
    if (icon) icon.textContent = w.icon;
    var name = U.el('weapon-name');
    if (name) name.textContent = w.name;
    var ammo = U.el('weapon-ammo');
    if (ammo) {
      var state = Coral.G;
      var left = w.ammo === Infinity ? '∞' : String(
        state && state.ammo && state.ammo[w.id] !== undefined ? state.ammo[w.id] : w.ammo);
      ammo.textContent = left;
    }
  }

  function showWheel(weapons, selectedIdx) {
    if (!wheelEl) return;
    var html = '<div class="wheel-title">WEAPON WHEEL — click to pick</div>';
    for (var i = 0; i < weapons.length; i++) {
      html += '<button class="wheel-item' + (i === selectedIdx ? ' sel' : '') +
        '" data-i="' + i + '">' + weapons[i].icon + ' ' + weapons[i].name + '</button>';
    }
    wheelEl.innerHTML = html;
    wheelEl.style.display = 'block';
    var btns = wheelEl.querySelectorAll('.wheel-item');
    for (var j = 0; j < btns.length; j++) {
      btns[j].addEventListener('click', function (ev) {
        var idx = Number(ev.currentTarget.getAttribute('data-i'));
        if (Coral.G && Coral.fight) Coral.fight.closeWeaponWheel(Coral.G, idx);
      });
    }
  }

  function hideWheel() {
    if (wheelEl) wheelEl.style.display = 'none';
  }

  function showRace(circuit, position, lap, bestLap, lastLap) {
    var box = U.el('race-box');
    if (!box) return;
    box.style.display = 'block';
    box.innerHTML = '<b>' + circuit.name.toUpperCase() + '</b> · LAP ' + lap + '/' + circuit.laps +
      ' · <span class="pos">P' + position + '/2</span>' +
      (bestLap ? ' · BEST ' + U.fmtTime(bestLap) : '') +
      (lastLap ? ' · LAST ' + U.fmtTime(lastLap) : '');
  }

  function hideRace() {
    var box = U.el('race-box');
    if (box) box.style.display = 'none';
  }

  return {
    build: build,
    update: update,
    setMission: setMission,
    clearMission: clearMission,
    setObjectiveMarker: setObjectiveMarker,
    clearObjectiveMarker: clearObjectiveMarker,
    showToast: showToast,
    updateCash: updateCash,
    updateWeapon: updateWeapon,
    showWheel: showWheel,
    hideWheel: hideWheel,
    showRace: showRace,
    hideRace: hideRace,
  };
})();

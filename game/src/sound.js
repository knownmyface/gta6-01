// CORAL HEAT — sound: WebAudio synth radio + effects, no audio files.
// Three stations are generated loops (bass + hats + lead) built from
// oscillators, plus one-shot effects for shots, booms, sirens and UI.
Coral.sound = (function () {
  'use strict';
  var U = Coral.util;

  var ctx = null;
  var master = null;
  var radioTimer = null;
  var currentStation = 0;
  var muted = false;

  var STATIONS = [
    { name: 'CORAL FM 98.1 — Sunset Pop', bpm: 112, root: 220, wave: 'triangle', bright: 0.5 },
    { name: 'NEON 104.7 — Night Drive', bpm: 96, root: 164.8, wave: 'sawtooth', bright: 0.3 },
    { name: 'MARINA 88.3 — Wave Lounge', bpm: 78, root: 196, wave: 'sine', bright: 0.7 },
  ];

  function ensure() {
    if (ctx) return ctx;
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(ctx.destination);
    } catch (e) {
      ctx = null;
    }
    return ctx;
  }

  function unlock() {
    ensure();
    if (ctx && ctx.state === 'suspended') ctx.resume();
  }

  function tone(freq, dur, type, vol, when, slideTo) {
    if (!ensure()) return;
    var t0 = ctx.currentTime + (when || 0);
    var o = ctx.createOscillator();
    var g = ctx.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(vol || 0.2, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    o.connect(g);
    g.connect(master);
    o.start(t0);
    o.stop(t0 + dur + 0.05);
  }

  function noise(dur, vol, filterFreq) {
    if (!ensure()) return;
    var t0 = ctx.currentTime;
    var len = Math.floor(ctx.sampleRate * dur);
    var buf = ctx.createBuffer(1, len, ctx.sampleRate);
    var ch = buf.getChannelData(0);
    for (var i = 0; i < len; i++) ch[i] = (Math.random() * 2 - 1) * (1 - i / len);
    var src = ctx.createBufferSource();
    src.buffer = buf;
    var f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = filterFreq || 1200;
    var g = ctx.createGain();
    g.gain.value = vol || 0.3;
    src.connect(f);
    f.connect(g);
    g.connect(master);
    src.start(t0);
  }

  function radioTick() {
    if (!ensure()) return;
    var st = STATIONS[currentStation];
    var beat = 60 / st.bpm / 2;
    var scale = [1, 1.122, 1.335, 1.498, 1.782];
    var bar = Math.floor(ctx.currentTime / (beat * 8)) % 4;
    var roots = [1, 0.891, 1.189, 1.335];
    var root = st.root * roots[bar];
    // Bass on the beat.
    tone(root / 2, beat * 0.9, st.wave, 0.22, 0);
    tone(root / 2, beat * 0.9, st.wave, 0.18, beat * 2);
    // Lead sparkle on off-beats.
    var n = scale[Math.floor(Math.random() * scale.length)];
    tone(root * 2 * n, beat * 0.7, 'sine', 0.06 * st.bright + 0.02, beat);
    tone(root * 2 * scale[(bar + 2) % scale.length], beat * 0.7, 'sine', 0.05, beat * 3);
    // Hat tick.
    noise(0.03, 0.05, 6000);
    radioTimer = setTimeout(radioTick, beat * 1000);
  }

  function startRadio(stationIdx) {
    ensure();
    if (typeof stationIdx === 'number') currentStation = stationIdx;
    stopRadio();
    radioTimer = setTimeout(radioTick, 60);
    return STATIONS[currentStation].name;
  }

  function stopRadio() {
    if (radioTimer) { clearTimeout(radioTimer); radioTimer = null; }
  }

  function nextStation() {
    currentStation = (currentStation + 1) % STATIONS.length;
    startRadio(currentStation);
    return STATIONS[currentStation].name;
  }

  function setMuted(m) {
    muted = !!m;
    if (master) master.gain.value = muted ? 0 : 0.5;
  }

  function shot(kind) {
    if (kind === 'shotgun') { noise(0.22, 0.5, 900); tone(90, 0.18, 'square', 0.25, 0, 45); }
    else if (kind === 'smg') { noise(0.08, 0.3, 1800); }
    else if (kind === 'rifle') { noise(0.3, 0.45, 700); tone(70, 0.25, 'square', 0.2, 0, 40); }
    else { noise(0.12, 0.35, 1400); tone(160, 0.1, 'square', 0.15, 0, 70); }
  }

  function boom() {
    noise(0.9, 0.7, 320);
    tone(55, 0.8, 'sine', 0.5, 0, 28);
  }

  function thud() {
    noise(0.16, 0.4, 500);
    tone(80, 0.14, 'sine', 0.3, 0, 45);
  }

  function swing() {
    noise(0.09, 0.2, 2400);
  }

  function jump() {
    tone(280, 0.16, 'sine', 0.12, 0, 520);
  }

  function door() {
    tone(190, 0.1, 'square', 0.1, 0, 140);
    noise(0.08, 0.12, 800);
  }

  function buy() {
    tone(660, 0.09, 'sine', 0.16);
    tone(880, 0.14, 'sine', 0.16, 0.09);
  }

  function mission() {
    tone(392, 0.14, 'triangle', 0.2);
    tone(523, 0.14, 'triangle', 0.2, 0.13);
    tone(659, 0.22, 'triangle', 0.2, 0.26);
  }

  function win() {
    var notes = [523, 659, 784, 1046];
    for (var i = 0; i < notes.length; i++) tone(notes[i], 0.2, 'triangle', 0.2, i * 0.12);
  }

  function countdown() {
    tone(440, 0.12, 'square', 0.14);
    tone(440, 0.12, 'square', 0.14, 0.4);
    tone(880, 0.3, 'square', 0.18, 0.8);
  }

  function siren(level) {
    if (!ensure()) return;
    var cycles = 2 + level;
    for (var i = 0; i < cycles; i++) {
      tone(700, 0.32, 'sawtooth', 0.05, i * 0.7, 950);
      tone(950, 0.32, 'sawtooth', 0.05, i * 0.7 + 0.35, 700);
    }
  }

  function engineHum(speedNorm) {
    // Called from the loop; a soft oscillator follows speed. Kept cheap by
    // reusing one oscillator node.
    if (!ensure() || muted) return;
    if (!engineHum.osc) {
      engineHum.osc = ctx.createOscillator();
      engineHum.gain = ctx.createGain();
      engineHum.osc.type = 'sawtooth';
      engineHum.gain.gain.value = 0.02;
      engineHum.osc.connect(engineHum.gain);
      engineHum.gain.connect(master);
      engineHum.osc.start();
    }
    var f = 55 + speedNorm * 130;
    engineHum.osc.frequency.setTargetAtTime(f, ctx.currentTime, 0.08);
    engineHum.gain.gain.setTargetAtTime(0.015 + speedNorm * 0.035, ctx.currentTime, 0.1);
  }

  return {
    STATIONS: STATIONS,
    ensure: ensure,
    unlock: unlock,
    startRadio: startRadio,
    stopRadio: stopRadio,
    nextStation: nextStation,
    setMuted: setMuted,
    shot: shot,
    boom: boom,
    thud: thud,
    swing: swing,
    jump: jump,
    door: door,
    buy: buy,
    mission: mission,
    win: win,
    countdown: countdown,
    siren: siren,
    engineHum: engineHum,
    get stationName() { return STATIONS[currentStation].name; },
  };
})();

// CORAL HEAT — all sound is synthesized live with WebAudio, no audio files.
// Engine hum, sirens, gunshots, explosions, radio jingles and UI blips are
// small oscillator/noise recipes, so the game ships zero audio assets.
CH.sound = (function () {
  const U = CH.util;
  let ctx = null, master = null, engineOsc = null, engineGain = null, radioTimer = null;
  let started = false;

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.35;
      master.connect(ctx.destination);
      return true;
    } catch (e) { return false; }
  }
  function start() {
    if (started) return;
    if (!ensure()) return;
    started = true;
    try {
      // Engine: two detuned saws through a lowpass, pitch follows speed.
      engineOsc = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      engineOsc.type = 'sawtooth'; osc2.type = 'sawtooth';
      engineOsc.frequency.value = 55; osc2.frequency.value = 58;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 420;
      engineGain = ctx.createGain(); engineGain.gain.value = 0.0;
      engineOsc.connect(lp); osc2.connect(lp); lp.connect(engineGain); engineGain.connect(master);
      engineOsc.start(); osc2.start();
      CH.sound._engineOsc = engineOsc; CH.sound._engineOsc2 = osc2;
    } catch (e) { /* audio is decoration, never fatal */ }
  }
  function setEngine(speed01, on) {
    if (!ctx || !engineGain) return;
    try {
      const f = 50 + speed01 * 160;
      CH.sound._engineOsc.frequency.setTargetAtTime(f, ctx.currentTime, 0.08);
      CH.sound._engineOsc2.frequency.setTargetAtTime(f * 1.03 + 2, ctx.currentTime, 0.08);
      engineGain.gain.setTargetAtTime(on ? 0.05 + speed01 * 0.06 : 0.0, ctx.currentTime, 0.1);
    } catch (e) {}
  }
  function blip(freq, dur, type, vol) {
    if (!ensure()) return;
    try {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = type || 'sine'; o.frequency.value = freq || 660;
      g.gain.setValueAtTime(vol || 0.15, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + (dur || 0.12));
      o.connect(g); g.connect(master); o.start(); o.stop(ctx.currentTime + (dur || 0.12));
    } catch (e) {}
  }
  function noiseBurst(dur, vol, lowpass) {
    if (!ensure()) return;
    try {
      const len = Math.floor(ctx.sampleRate * dur);
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = ctx.createBufferSource(); src.buffer = buf;
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lowpass || 1200;
      const g = ctx.createGain(); g.gain.value = vol || 0.4;
      src.connect(f); f.connect(g); g.connect(master); src.start();
    } catch (e) {}
  }
  function shot() { noiseBurst(0.09, 0.5, 2600); blip(190, 0.07, 'square', 0.12); }
  function explosion() {
    noiseBurst(0.9, 0.7, 500);
    blip(70, 0.7, 'sine', 0.35);
  }
  function siren(on) {
    // Two-tone police siren loop, started/stopped by the cop system.
    if (!ctx) return;
    if (on && !CH.sound._siren) {
      try {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = 'triangle'; o.frequency.value = 750;
        g.gain.value = 0.045;
        const lfo = ctx.createOscillator(); lfo.frequency.value = 0.6;
        const lg = ctx.createGain(); lg.gain.value = 260;
        lfo.connect(lg); lg.connect(o.frequency);
        o.connect(g); g.connect(master); o.start(); lfo.start();
        CH.sound._siren = { o, lfo, g };
      } catch (e) {}
    } else if (!on && CH.sound._siren) {
      try { CH.sound._siren.o.stop(); CH.sound._siren.lfo.stop(); } catch (e) {}
      CH.sound._siren = null;
    }
  }
  function radioJingle() {
    // A tiny three-note station sting when the radio changes.
    const notes = [523, 659, 784];
    notes.forEach((n, i) => setTimeout(() => blip(n, 0.16, 'triangle', 0.12), i * 110));
  }
  function missionDone() { blip(660, 0.14, 'triangle', 0.16); setTimeout(() => blip(880, 0.22, 'triangle', 0.16), 140); }
  function pickup() { blip(990, 0.1, 'sine', 0.14); }
  function click() { blip(440, 0.06, 'square', 0.08); }

  return { start, setEngine, blip, noiseBurst, shot, explosion, siren, radioJingle, missionDone, pickup, click };
})();

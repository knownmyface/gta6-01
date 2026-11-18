// Procedural audio for CORAL HEAT v2.4: no audio files, every sound is
// synthesized with WebAudio. Engine hum, police siren, gunshots, UI blips
// and three radio stations of sequenced synth music. Safe to call before any
// user gesture: the context is created lazily and everything no-ops while it
// is suspended. v2.4 is a from-scratch rewrite of v2.3's audio.js: same
// stations, same mix, same one-shots, different code. The sequencer is
// split into one helper per layer now (bass, pad, lead, hat), and the
// note-sequence one-shots share a single jingle helper.
const STATIONS = [
  { name: 'CORAL FM 92.1', track: 'Sunset Drive — The Palms', bpm: 96, root: 220.00, scale: [0, 3, 5, 7, 10], wave: 'triangle', bass: true },
  { name: 'HEATWAVE 88', track: 'Neon Pursuit — Vex Marlow', bpm: 128, root: 164.81, scale: [0, 2, 3, 7, 8, 10], wave: 'sawtooth', bass: true },
  { name: 'MARINA NIGHTS', track: 'Low Tide — Ana Solis', bpm: 76, root: 196.00, scale: [0, 4, 5, 7, 11], wave: 'sine', bass: false },
];

// The lead melody walk, one entry per 16th step (-1 = rest).
const LEAD_WALK = [0, -1, 2, -1, 5, -1, 3, -1, 7, -1, 5, -1, 3, 2, -1, 0];
const CHORD_STEPS = [0, 3, 7, 10];
const PAD_TONES = [0, 3, 7];

const MASTER_VOLUME = 0.9;
const MUSIC_VOLUME = 0.16;
const MUSIC_VOLUME_DUCKED = 0.09;
const SFX_VOLUME = 0.5;

export class RadioAudio {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.musicGain = null;
    this.sfxGain = null;
    this.station = 0;
    this.muted = false;
    this.engineOsc = null;
    this.engineOsc2 = null;
    this.engineGain = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.step = 0;
    this.nextStepTime = 0;
    this.musicTimer = null;
    this.started = false;
  }

  // --- context + buses ------------------------------------------------------
  makeOsc(type, freq) {
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    return o;
  }

  makeGain(value) {
    const g = this.ctx.createGain();
    g.gain.value = value;
    return g;
  }

  ensure() {
    if (this.ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      this.ctx = new AC();
      this.master = this.makeGain(MASTER_VOLUME);
      this.master.connect(this.ctx.destination);
      this.musicGain = this.makeGain(MUSIC_VOLUME);
      this.musicGain.connect(this.master);
      this.sfxGain = this.makeGain(SFX_VOLUME);
      this.sfxGain.connect(this.master);
      return true;
    } catch {
      return false;
    }
  }

  unlock() {
    if (!this.ensure()) return;
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
    if (this.started) return;
    this.started = true;
    this.startEngine();
    this.startSiren();
    this.startMusicLoop();
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : MASTER_VOLUME;
  }

  setStation(i) {
    this.station = ((i % STATIONS.length) + STATIONS.length) % STATIONS.length;
    this.step = 0;
    return STATIONS[this.station];
  }

  currentStation() { return STATIONS[this.station]; }

  // --- engine: two detuned oscillators whose pitch follows speed ---
  startEngine() {
    const o1 = this.makeOsc('sawtooth', 55);
    const o2 = this.makeOsc('square', 27.5);
    const g = this.makeGain(0.0);
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 420;
    o1.connect(f);
    o2.connect(f);
    f.connect(g);
    g.connect(this.sfxGain);
    o1.start();
    o2.start();
    this.engineOsc = o1;
    this.engineOsc2 = o2;
    this.engineGain = g;
  }

  setEngine(speedMph, inCar) {
    if (!this.engineGain) return;
    const t = this.ctx.currentTime;
    const target = inCar ? 0.05 + Math.min(0.09, speedMph / 1800) : 0.0;
    this.engineGain.gain.setTargetAtTime(target, t, 0.08);
    const freq = 48 + speedMph * 1.1;
    this.engineOsc.frequency.setTargetAtTime(freq, t, 0.1);
    this.engineOsc2.frequency.setTargetAtTime(freq / 2, t, 0.1);
  }

  // --- police siren: slow two-tone wail, gain follows wanted level ---
  startSiren() {
    const o = this.makeOsc('sine', 720);
    const g = this.makeGain(0.0);
    const lfo = this.makeOsc('square', 0.55);
    const lg = this.makeGain(180);
    lfo.connect(lg);
    lg.connect(o.frequency);
    o.connect(g);
    g.connect(this.sfxGain);
    o.start();
    lfo.start();
    this.sirenOsc = o;
    this.sirenGain = g;
  }

  setSiren(wanted) {
    if (!this.sirenGain) return;
    const t = this.ctx.currentTime;
    const gain = wanted > 0 ? 0.028 + wanted * 0.008 : 0;
    this.sirenGain.gain.setTargetAtTime(gain, t, 0.3);
    // Duck the radio under a 3+ star chase so the siren cuts through.
    if (this.musicGain) {
      const music = wanted >= 3 ? MUSIC_VOLUME_DUCKED : MUSIC_VOLUME;
      this.musicGain.gain.setTargetAtTime(music, t, 0.5);
    }
  }

  // --- radio: a tiny step sequencer, one 16-step loop per station ---
  startMusicLoop() {
    this.musicTimer = setInterval(() => this.musicTick(), 40);
  }

  musicTick() {
    if (!this.ctx || this.ctx.state === 'suspended' || this.muted) return;
    const st = STATIONS[this.station];
    const stepDur = 60 / st.bpm / 4;
    while (this.nextStepTime < this.ctx.currentTime + 0.12) {
      if (this.nextStepTime < this.ctx.currentTime - 0.05) {
        this.nextStepTime = this.ctx.currentTime;
      }
      this.scheduleStep(st, this.step, this.nextStepTime, stepDur);
      this.step = (this.step + 1) % 64;
      this.nextStepTime += stepDur;
    }
  }

  // One 16th step, four layers: bass on the beat, pad on the bar, lead
  // walking the pentatonic, hat ticking the off-16ths.
  scheduleStep(st, step, time, stepDur) {
    const s16 = step % 16;
    const chord = CHORD_STEPS[Math.floor(step / 16) % 4];
    this.playBass(st, s16, chord, time, stepDur);
    this.playPad(st, s16, chord, time, stepDur);
    this.playLead(st, s16, chord, time, stepDur);
    if (s16 % 2 === 1) this.noise(time, 0.03, 0.05, 6000);
  }

  playBass(st, s16, chord, time, stepDur) {
    if (s16 % 4 !== 0 || !st.bass) return;
    this.note(st.root / 2, time, stepDur * 3.5, 'sine', 0.5);
    void chord;
  }

  playPad(st, s16, chord, time, stepDur) {
    if (s16 !== 0 && s16 !== 8) return;
    for (const iv of PAD_TONES) {
      const semi = st.scale[iv % st.scale.length] + chord;
      this.note(st.root * Math.pow(2, semi / 12) / 2, time, stepDur * 8, 'triangle', 0.10);
    }
  }

  playLead(st, s16, chord, time, stepDur) {
    const lv = LEAD_WALK[s16];
    if (lv < 0) return;
    const semi = st.scale[lv % st.scale.length] + 12 * Math.floor(lv / st.scale.length) + chord;
    this.note(st.root * Math.pow(2, semi / 12), time, stepDur * 1.8, st.wave, 0.16);
  }

  // The note envelope: attack to full volume in 10ms, then an exponential
  // decay to near-silence by the end of the note.
  applyEnvelope(gain, time, dur, vol) {
    gain.setValueAtTime(0, time);
    gain.linearRampToValueAtTime(vol, time + 0.01);
    gain.exponentialRampToValueAtTime(0.001, time + dur);
  }

  note(freq, time, dur, type, vol) {
    const o = this.makeOsc(type, freq);
    const g = this.makeGain(0);
    this.applyEnvelope(g.gain, time, dur, vol);
    o.connect(g);
    g.connect(this.musicGain);
    o.start(time);
    o.stop(time + dur + 0.05);
  }

  noise(time, dur, vol, freq) {
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    }
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = freq;
    const g = this.makeGain(vol);
    src.connect(f);
    f.connect(g);
    g.connect(this.musicGain);
    src.start(time);
  }

  // --- one-shots (all no-op while the context is suspended) ---
  ready() {
    return !!this.ctx && this.ctx.state !== 'suspended';
  }

  // A short run of notes, evenly spaced: the mission jingle, the steal
  // jingle, the shop cha-ching and the coin pickup are all one shape.
  jingle(freqs, gap, dur, type, vol) {
    const t0 = this.ctx.currentTime;
    freqs.forEach((f, i) => {
      this.note(f, t0 + i * gap, dur, type, vol);
    });
  }

  blip(freq = 880) {
    if (!this.ready()) return;
    this.note(freq, this.ctx.currentTime, 0.09, 'square', 0.12);
  }

  gunshot() {
    if (!this.ready()) return;
    this.noise(this.ctx.currentTime, 0.14, 0.5, 900);
    this.note(90, this.ctx.currentTime, 0.1, 'square', 0.25);
  }

  crash() {
    if (!this.ready()) return;
    this.noise(this.ctx.currentTime, 0.25, 0.4, 400);
  }

  missionJingle() {
    if (!this.ready()) return;
    this.jingle([523.25, 659.25, 783.99, 1046.5], 0.09, 0.35, 'triangle', 0.2);
  }

  stealJingle() {
    if (!this.ready()) return;
    this.jingle([392, 311, 466], 0.07, 0.2, 'sawtooth', 0.12);
  }

  // Reload clicks, weapon switch, shop cha-ching, coin.
  reloadClick() {
    if (!this.ready()) return;
    const t0 = this.ctx.currentTime;
    this.noise(t0, 0.05, 0.25, 2500);
    this.note(180, t0 + 0.12, 0.08, 'square', 0.12);
    this.noise(t0 + 0.28, 0.06, 0.3, 1800);
  }

  weaponSwitch() {
    if (!this.ready()) return;
    const t0 = this.ctx.currentTime;
    this.noise(t0, 0.06, 0.3, 3000);
    this.note(320, t0 + 0.08, 0.06, 'square', 0.1);
  }

  shopBuy() {
    if (!this.ready()) return;
    this.jingle([1046.5, 1318.5], 0.08, 0.22, 'triangle', 0.18);
  }

  coinPickup() {
    if (!this.ready()) return;
    this.jingle([987.77, 1318.5], 0.06, 0.16, 'sine', 0.2);
  }

  dryFire() {
    if (!this.ready()) return;
    this.noise(this.ctx.currentTime, 0.04, 0.2, 3500);
  }
}

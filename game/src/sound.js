// Coral Heat — sound: WebAudio synth (engine, siren, shots, explosions, radio
// stations as tiny sequencers). No audio files, no network. Fresh write, round 7.

export const STATIONS = [
  { name: 'BAY FM 98.5', track: 'Sunset Drive — The Palms', base: 220, mode: 'chill' },
  { name: 'NEON 104.1', track: 'Casino Lights — Velvet Reef', base: 174, mode: 'drive' },
  { name: 'REEF ROCK 91.7', track: 'Full Throttle — Coral Kings', base: 110, mode: 'rock' },
];

export class Sound {
  constructor() {
    this.ctx = null;
    this.station = 0;
    this.muted = false;
    this.engineOsc = null;
    this.engineGain = null;
    this.musicTimer = 0;
    this.step = 0;
    this.sirenOn = false;
    this.sirenOsc = null;
  }
  ensure() {
    if (this.ctx) return;
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      const o = this.ctx.createOscillator();
      o.type = 'sawtooth'; o.frequency.value = 60;
      const g = this.ctx.createGain(); g.gain.value = 0;
      const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 500;
      o.connect(f); f.connect(g); g.connect(this.ctx.destination);
      o.start();
      this.engineOsc = o; this.engineGain = g;
    } catch (e) { this.ctx = null; }
  }
  stationName() { return STATIONS[this.station].name; }
  stationTrack() { return STATIONS[this.station].track; }
  nextStation() {
    this.station = (this.station + 1) % STATIONS.length;
    this.step = 0;
    return STATIONS[this.station];
  }
  beep(freq = 660, dur = 0.12) {
    if (!this.ctx || this.muted) return;
    const o = this.ctx.createOscillator();
    o.type = 'square'; o.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.08, this.ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + dur);
    o.connect(g); g.connect(this.ctx.destination);
    o.start(); o.stop(this.ctx.currentTime + dur);
  }
  fanfare(win) {
    if (!this.ctx || this.muted) return;
    const notes = win ? [523, 659, 784, 1046] : [392, 330, 262];
    notes.forEach((f, i) => setTimeout(() => this.beep(f, 0.22), i * 130));
  }
  shot(id) {
    if (!this.ctx || this.muted) return;
    const dur = id === 'shotgun' ? 0.25 : 0.08;
    const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * dur, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const src = this.ctx.createBufferSource(); src.buffer = buf;
    const g = this.ctx.createGain(); g.gain.value = id === 'launcher' ? 0.5 : 0.22;
    src.connect(g); g.connect(this.ctx.destination);
    src.start();
  }
  explosion() {
    if (!this.ctx || this.muted) return;
    const dur = 0.7;
    const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * dur, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 1.6);
    const src = this.ctx.createBufferSource(); src.buffer = buf;
    const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 320;
    const g = this.ctx.createGain(); g.gain.value = 0.6;
    src.connect(f); f.connect(g); g.connect(this.ctx.destination);
    src.start();
  }
  update(dt, speedMph, wanted) {
    if (!this.ctx) return;
    // engine hum follows speed
    if (this.engineOsc) {
      const target = this.muted ? 0 : 0.03 + Math.min(0.06, speedMph / 2400);
      this.engineGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.1);
      this.engineOsc.frequency.setTargetAtTime(50 + speedMph * 1.4, this.ctx.currentTime, 0.1);
    }
    // siren while wanted >= 2
    if (wanted >= 2 && !this.muted) {
      if (!this.sirenOsc) {
        const o = this.ctx.createOscillator();
        o.type = 'triangle';
        const g = this.ctx.createGain(); g.gain.value = 0.025;
        o.connect(g); g.connect(this.ctx.destination);
        o.start();
        this.sirenOsc = o;
      }
      this.sirenOsc.frequency.setTargetAtTime((Math.floor(this.ctx.currentTime * 1.4) % 2 === 0) ? 700 : 950, this.ctx.currentTime, 0.05);
    } else if (this.sirenOsc) {
      this.sirenOsc.stop();
      this.sirenOsc = null;
    }
    // radio: tiny bass sequencer, one note per beat
    this.musicTimer -= dt;
    if (this.musicTimer <= 0 && !this.muted) {
      this.musicTimer = STATIONS[this.station].mode === 'rock' ? 0.22 : 0.34;
      const st = STATIONS[this.station];
      const scale = [1, 1.122, 1.335, 1.498, 1.782];
      const n = scale[this.step % scale.length] * st.base * (this.step % 8 === 0 ? 0.5 : 1);
      this.step++;
      const o = this.ctx.createOscillator();
      o.type = st.mode === 'rock' ? 'square' : 'sine';
      o.frequency.value = n;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.035, this.ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.3);
      o.connect(g); g.connect(this.ctx.destination);
      o.start(); o.stop(this.ctx.currentTime + 0.32);
    }
  }
}

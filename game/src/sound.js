// sound.js — procedural audio: engine hum, police siren, three synth radio
// stations, gunshots, explosions and UI blips. All WebAudio, no audio files.
import { pick } from './util.js';

const STATIONS = [
  { name: 'CORAL FM 98.5', base: 220, mode: 'major', bpm: 112 },
  { name: 'NEON NIGHTS 104.1', base: 174, mode: 'minor', bpm: 96 },
  { name: 'REEF REGGAE 91.3', base: 196, mode: 'major', bpm: 78 },
];

const MAJOR = [0, 2, 4, 7, 9];
const MINOR = [0, 2, 3, 5, 7];

export function initSound(W) {
  const S = {
    ctx: null,
    station: 0,
    radioOn: true,
    nextNote: 0,
    engineOsc: null,
    engineGain: null,
    sirenOsc: null,
    sirenGain: null,
    muted: false,
    ensure() {
      if (S.ctx) return S.ctx;
      try {
        S.ctx = new (window.AudioContext || window.webkitAudioContext)();
      } catch (e) {
        S.ctx = null;
      }
      return S.ctx;
    },
    stationName() {
      return STATIONS[S.station].name;
    },
    nextStation() {
      S.station = (S.station + 1) % STATIONS.length;
      W.hudFlash('RADIO — ' + STATIONS[S.station].name);
    },
    startEngine() {
      const ctx = S.ensure();
      if (!ctx || S.engineOsc) return;
      S.engineOsc = ctx.createOscillator();
      S.engineOsc.type = 'sawtooth';
      S.engineOsc.frequency.value = 60;
      S.engineGain = ctx.createGain();
      S.engineGain.gain.value = 0.0;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 420;
      S.engineOsc.connect(filter);
      filter.connect(S.engineGain);
      S.engineGain.connect(ctx.destination);
      S.engineOsc.start();
    },
    updateEngine(speed, throttle) {
      if (!S.ctx || !S.engineOsc) return;
      const rpm = 50 + Math.abs(speed) * 4 + (throttle ? 18 : 0);
      S.engineOsc.frequency.setTargetAtTime(rpm, S.ctx.currentTime, 0.08);
      S.engineGain.gain.setTargetAtTime(S.muted ? 0 : 0.045, S.ctx.currentTime, 0.1);
    },
    startSiren() {
      const ctx = S.ensure();
      if (!ctx || S.sirenOsc) return;
      S.sirenOsc = ctx.createOscillator();
      S.sirenOsc.type = 'sine';
      S.sirenGain = ctx.createGain();
      S.sirenGain.gain.value = 0.0;
      S.sirenOsc.connect(S.sirenGain);
      S.sirenGain.connect(ctx.destination);
      S.sirenOsc.start();
    },
    updateSiren(wanted, t) {
      if (!S.ctx || !S.sirenOsc) return;
      if (wanted > 0) {
        const f = 660 + Math.sin(t * 4.2) * 220;
        S.sirenOsc.frequency.setTargetAtTime(f, S.ctx.currentTime, 0.05);
        S.sirenGain.gain.setTargetAtTime(S.muted ? 0 : 0.03, S.ctx.currentTime, 0.2);
      } else {
        S.sirenGain.gain.setTargetAtTime(0, S.ctx.currentTime, 0.2);
      }
    },
    radioTick(t) {
      const ctx = S.ensure();
      if (!ctx || !S.radioOn || S.muted) return;
      if (t < S.nextNote) return;
      const st = STATIONS[S.station];
      const beat = 60 / st.bpm;
      S.nextNote = t + beat / 2;
      const scale = st.mode === 'major' ? MAJOR : MINOR;
      const step = Math.floor(t / (beat / 2)) % 16;
      if (step % 2 === 0) {
        const note = pick(scale) + 12 * pick([0, 0, 1]);
        const freq = st.base * Math.pow(2, note / 12);
        const osc = ctx.createOscillator();
        osc.type = pick(['triangle', 'square']);
        osc.frequency.value = freq;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.05, ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + beat * 0.9);
        osc.connect(g);
        g.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + beat);
      }
      if (step % 4 === 0) {
        // Bass thump.
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = st.base / 2;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.09, ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + beat * 0.7);
        osc.connect(g);
        g.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + beat * 0.8);
      }
    },
    shot(name) {
      const ctx = S.ensure();
      if (!ctx || S.muted) return;
      const len = 0.12;
      const buf = ctx.createBuffer(1, ctx.sampleRate * len, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const g = ctx.createGain();
      g.gain.value = name === 'Tide Shotgun' ? 0.5 : 0.3;
      src.connect(g);
      g.connect(ctx.destination);
      src.start();
    },
    boom() {
      const ctx = S.ensure();
      if (!ctx || S.muted) return;
      const len = 0.7;
      const buf = ctx.createBuffer(1, ctx.sampleRate * len, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 2.2);
      }
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 320;
      const g = ctx.createGain();
      g.gain.value = 0.6;
      src.connect(filter);
      filter.connect(g);
      g.connect(ctx.destination);
      src.start();
    },
    checkpoint() {
      const ctx = S.ensure();
      if (!ctx || S.muted) return;
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.setValueAtTime(1320, ctx.currentTime + 0.09);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.12, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
      osc.connect(g);
      g.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    },
    blip() {
      const ctx = S.ensure();
      if (!ctx || S.muted) return;
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = 660;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.08, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
      osc.connect(g);
      g.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.15);
    },
  };
  W.sound = S;
  return S;
}

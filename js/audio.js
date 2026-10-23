// All audio is created only after a user gesture (Sound.unlock) and never autoplays.
// Music is generated live with WebAudio, so no audio files are bundled and no audio licensing is involved.
// "Happy Birthday to You" (Good Morning to All, 1893) is in the public domain.
// Optional licensed tracks can be listed in res/audio/manifest.json (see ASSETS.md) and are played via <audio>.
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

// Happy Birthday melody in C major: [midi, beats]
const HB = [[67,.75],[67,.25],[69,1],[67,1],[72,1],[71,2],[67,.75],[67,.25],[69,1],[67,1],[74,1],[72,2],[67,.75],[67,.25],[79,1],[76,1],[72,1],[71,1],[69,1],[77,.75],[77,.25],[76,1],[72,1],[74,1],[72,2]];
const PROG = [[48, 55, 60, 64], [45, 52, 57, 60], [41, 48, 53, 57], [43, 50, 55, 59]]; // C Am F G
const PENT = [72, 74, 76, 79, 81, 84, 79, 76];

export class Sound {
  constructor() { this.ctx = null; this.track = "none"; this.playing = false; this.timer = null; this.nextT = 0; this.step = 0; this.listeners = new Set(); this.file = null; this.status = "idle"; this.vol = 0.7; }
  onChange(f) { this.listeners.add(f); return () => this.listeners.delete(f); }
  emit() { this.listeners.forEach((f) => f(this.status, this.playing)); }
  get supported() { return !!(window.AudioContext || window.webkitAudioContext); }
  async unlock() {
    if (this.ctx) { if (this.ctx.state === "suspended") await this.ctx.resume().catch(() => {}); return !!this.ctx; }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) { this.status = "unsupported"; this.emit(); return false; }
      this.ctx = new AC();
      this.master = this.ctx.createGain(); this.master.gain.value = this.vol; this.master.connect(this.ctx.destination);
      this.music = this.ctx.createGain(); this.music.gain.value = 0; this.music.connect(this.master);
      this.rev = this.ctx.createConvolver(); this.rev.buffer = this.impulse(2.2); const rg = this.ctx.createGain(); rg.gain.value = 0.35; this.rev.connect(rg); rg.connect(this.music);
      if (this.ctx.state === "suspended") await this.ctx.resume();
      return true;
    } catch { this.status = "unavailable"; this.emit(); return false; }
  }
  impulse(sec) { const r = this.ctx.sampleRate, n = r * sec, b = this.ctx.createBuffer(2, n, r); for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 2.6); } return b; }
  setTrack(t) { const was = this.playing; this.pause(true); this.track = t || "none"; if (this.file) { this.file.pause(); this.file = null; } this.status = this.track === "none" ? "none" : "ready"; this.emit(); if (was && this.track !== "none") this.play(); }
  async play() {
    if (this.track === "none") { this.status = "none"; this.emit(); return false; }
    if (!(await this.unlock())) return false;
    if (this.track.startsWith("file:")) {
      try {
        if (!this.file) { this.file = new Audio("res/audio/" + encodeURIComponent(this.track.slice(5))); this.file.loop = true; this.file.volume = this.vol * 0.8; this.file.addEventListener("error", () => { this.playing = false; this.status = "unavailable"; this.emit(); }, { once: true }); }
        await this.file.play(); this.playing = true; this.status = "playing"; this.emit(); return true;
      } catch { this.playing = false; this.status = "unavailable"; this.emit(); return false; }
    }
    this.playing = true; this.status = "playing"; this.step = 0; this.nextT = this.ctx.currentTime + 0.1;
    this.music.gain.cancelScheduledValues(this.ctx.currentTime); this.music.gain.setTargetAtTime(0.9, this.ctx.currentTime, 0.4);
    clearInterval(this.timer); this.timer = setInterval(() => this.tick(), 120); this.tick(); this.emit(); return true;
  }
  pause(silent) {
    clearInterval(this.timer); this.timer = null;
    if (this.file) this.file.pause();
    if (this.ctx && this.music) { this.music.gain.cancelScheduledValues(this.ctx.currentTime); this.music.gain.setTargetAtTime(0, this.ctx.currentTime, 0.15); }
    this.playing = false; if (!silent) { this.status = this.track === "none" ? "none" : "paused"; this.emit(); }
  }
  toggle() { return this.playing ? (this.pause(), false) : this.play(); }
  tick() {
    if (!this.ctx || !this.playing) return;
    while (this.nextT < this.ctx.currentTime + 0.5) this.nextT = this.schedule(this.nextT, this.step++);
  }
  note(t, midi, dur, { type = "sine", g = 0.2, a = 0.01, bright = 0, wet = 0.6, detune = 0 } = {}) {
    const c = this.ctx, o = c.createOscillator(), e = c.createGain(), f = c.createBiquadFilter();
    o.type = type; o.frequency.value = mtof(midi); o.detune.value = detune; f.type = "lowpass"; f.frequency.value = 900 + bright * 5000;
    e.gain.setValueAtTime(0.0001, t); e.gain.exponentialRampToValueAtTime(g, t + a); e.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(f); f.connect(e); e.connect(this.music); const s = c.createGain(); s.gain.value = wet; e.connect(s); s.connect(this.rev);
    o.start(t); o.stop(t + dur + 0.05);
  }
  bell(t, midi, dur, g = 0.16) { this.note(t, midi, dur, { type: "sine", g, a: 0.004, bright: 1 }); this.note(t, midi + 12, dur * 0.5, { type: "sine", g: g * 0.35, a: 0.003, bright: 1 }); this.note(t, midi + 19, dur * 0.25, { type: "sine", g: g * 0.15, a: 0.002, bright: 1 }); }
  schedule(t, s) {
    const k = this.track;
    if (k === "musicbox") {
      const bpm = 84, beat = 60 / bpm, ph = s % (HB.length + 3);
      if (ph >= HB.length) return t + beat * 1.5;
      const [m, b] = HB[ph]; this.bell(t, m, Math.max(0.6, b * beat * 2.2)); if (ph === 0) this.note(t, 48, beat * 3, { type: "triangle", g: 0.08 });
      if (ph === 6 || ph === 12 || ph === 18) this.note(t, [53, 55, 48][(ph / 6 - 1) | 0] , beat * 3, { type: "triangle", g: 0.07 });
      return t + b * beat;
    }
    if (k === "piano") {
      const bar = Math.floor(s / 8) % 4, ch = PROG[bar], i = s % 8, pat = [0, 1, 2, 3, 2, 1, 3, 2];
      this.note(t, ch[pat[i]] + 12, 1.6, { type: "triangle", g: 0.14, a: 0.008, bright: 0.4 });
      if (i === 0) { this.note(t, ch[0] - 12, 3.4, { type: "sine", g: 0.16, a: 0.02 }); this.note(t, ch[1], 3.4, { type: "triangle", g: 0.05, a: 0.05 }); }
      return t + 0.42;
    }
    if (k === "pad") {
      const ch = PROG[s % 4];
      ch.forEach((m, j) => { this.note(t, m + 12, 4.6, { type: "sawtooth", g: 0.035, a: 1.4, bright: 0.2, detune: j * 5 - 8, wet: 0.9 }); this.note(t, m, 4.6, { type: "sine", g: 0.06, a: 1.6, wet: 0.9 }); });
      if (s % 2) this.bell(t + 1.2, PENT[(s * 3) % 8], 2.5, 0.07);
      return t + 4;
    }
    if (k === "sparkle") {
      const bar = Math.floor(s / 8) % 4, i = s % 8, ch = PROG[bar];
      this.bell(t, PENT[(i * 3 + bar) % 8], 0.5, 0.11);
      if (i % 2 === 0) this.note(t, ch[0], 0.9, { type: "triangle", g: 0.12, a: 0.01 });
      if (i === 4) this.note(t, ch[2] + 12, 0.8, { type: "triangle", g: 0.06 });
      return t + 0.27;
    }
    return t + 1;
  }
  // ---- sound effects (only audible after unlock) ----
  noise(t, dur, { f = 1200, q = 0.7, g = 0.3, type = "bandpass", sweep = 0 } = {}) {
    const c = this.ctx, n = c.sampleRate * dur, b = c.createBuffer(1, n, c.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    const s = c.createBufferSource(), fl = c.createBiquadFilter(), e = c.createGain(); s.buffer = b; fl.type = type; fl.frequency.setValueAtTime(f, t); if (sweep) fl.frequency.exponentialRampToValueAtTime(sweep, t + dur); fl.Q.value = q;
    e.gain.setValueAtTime(0.0001, t); e.gain.exponentialRampToValueAtTime(g, t + dur * 0.2); e.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(fl); fl.connect(e); e.connect(this.master); s.start(t);
  }
  sfx(name) {
    if (!this.ctx || this.ctx.state !== "running") return;
    const c = this.ctx, t = c.currentTime + 0.01, m = this.music;
    const tone = (f, d, g, type = "sine", a = 0.005) => { const o = c.createOscillator(), e = c.createGain(); o.type = type; o.frequency.value = f; e.gain.setValueAtTime(0.0001, t); e.gain.exponentialRampToValueAtTime(g, t + a); e.gain.exponentialRampToValueAtTime(0.0001, t + d); o.connect(e); e.connect(this.master); o.start(t); o.stop(t + d + 0.05); };
    if (name === "whoosh") this.noise(t, 0.9, { f: 900, sweep: 220, q: 0.8, g: 0.35 });
    else if (name === "pop") { tone(520, 0.12, 0.3, "triangle"); this.noise(t, 0.08, { f: 2500, g: 0.15, type: "highpass" }); }
    else if (name === "chime") [79, 83, 88].forEach((n, i) => { const o = c.createOscillator(), e = c.createGain(); o.frequency.value = mtof(n); e.gain.setValueAtTime(0.0001, t + i * 0.09); e.gain.exponentialRampToValueAtTime(0.18, t + i * 0.09 + 0.01); e.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.09 + 1.2); o.connect(e); e.connect(this.master); o.start(t + i * 0.09); o.stop(t + i * 0.09 + 1.3); });
    else if (name === "cut") { this.noise(t, 0.25, { f: 3000, sweep: 800, g: 0.25, q: 0.5 }); tone(160, 0.2, 0.25, "triangle"); }
    else if (name === "tap") tone(660, 0.07, 0.12, "triangle");
    else if (name === "fanfare") [60, 64, 67, 72].forEach((n, i) => { const o = c.createOscillator(), e = c.createGain(); o.type = "triangle"; o.frequency.value = mtof(n + 12); e.gain.setValueAtTime(0.0001, t + i * 0.12); e.gain.exponentialRampToValueAtTime(0.16, t + i * 0.12 + 0.02); e.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.12 + 0.9); o.connect(e); e.connect(this.master); o.start(t + i * 0.12); o.stop(t + i * 0.12 + 1); });
    void m;
  }
  destroy() {
    clearInterval(this.timer); this.timer = null; this.playing = false;
    if (this.file) { this.file.pause(); this.file.removeAttribute("src"); this.file = null; }
    if (this.ctx) { try { this.ctx.close(); } catch { /* ignore */ } this.ctx = null; }
    this.listeners.clear();
  }
}

/** Optional, permission-based blow detection. Never throws; reports state via callbacks.
 *  Heuristic: sustained loud, low-frequency-heavy, non-tonal input above the ambient baseline.
 *  It can still be fooled by other loud broadband noises (wind, clapping). The on-screen button is always available. */
export class BlowDetector {
  constructor({ onBlow, onState }) { this.onBlow = onBlow; this.onState = onState || (() => {}); this.on = false; }
  static get supported() { return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && (window.AudioContext || window.webkitAudioContext)); }
  async start() {
    if (this.on) return true;
    if (!BlowDetector.supported) { this.onState("unsupported"); return false; }
    if (!window.isSecureContext) { this.onState("insecure"); return false; }
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
    } catch (e) { this.onState(e && e.name === "NotAllowedError" ? "denied" : "nodevice"); return false; }
    try {
      const AC = window.AudioContext || window.webkitAudioContext; this.ac = new AC(); await this.ac.resume();
      const src = this.ac.createMediaStreamSource(this.stream); this.an = this.ac.createAnalyser(); this.an.fftSize = 1024; src.connect(this.an);
      this.buf = new Uint8Array(this.an.fftSize); this.freq = new Uint8Array(this.an.frequencyBinCount); this.on = true; this.loud = 0; this.base = null; this.t0 = performance.now(); this.samples = [];
      this.onState("listening"); this.tick(); return true;
    } catch { this.stop(); this.onState("nodevice"); return false; }
  }
  tick() {
    if (!this.on) return;
    this.an.getByteTimeDomainData(this.buf);
    let s = 0; for (let i = 0; i < this.buf.length; i++) { const v = (this.buf[i] - 128) / 128; s += v * v; }
    const rms = Math.sqrt(s / this.buf.length);
    this.an.getByteFrequencyData(this.freq);
    let lo = 0, hi = 0, mx = 0, sum = 0; const n = this.freq.length; for (let i = 1; i < n; i++) { const v = this.freq[i]; sum += v; if (v > mx) mx = v; if (i < n * 0.25) lo += v; else hi += v; }
    const tonal = mx > (sum / n) * 5; // a whistle, hum or musical note has one dominant peak; breath noise does not
    const now = performance.now();
    if (now - this.t0 < 700) { this.samples.push(rms); } else {
      if (this.base == null) this.base = Math.max(0.01, this.samples.reduce((a, b) => a + b, 0) / Math.max(1, this.samples.length));
      const thr = Math.max(0.1, this.base * 4), noisy = lo > hi * 0.4 && !tonal; // broadband, low-heavy, not tonal
      this.loud = rms > thr && noisy ? this.loud + 1 : Math.max(0, this.loud - 2);
      if (this.loud > 14) { this.loud = 0; const f = this.onBlow; this.stop(); f(); return; } // about 0.25s of sustained input at 60fps
    }
    this.raf = requestAnimationFrame(() => this.tick());
  }
  stop() {
    this.on = false; cancelAnimationFrame(this.raf);
    if (this.stream) this.stream.getTracks().forEach((t) => t.stop());
    this.stream = null; if (this.ac) { try { this.ac.close(); } catch { /* ignore */ } this.ac = null; }
  }
}

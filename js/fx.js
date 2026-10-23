// Lightweight canvas effects. One rAF loop per instance, DPR capped, paused when the tab is hidden,
// and fully static (no animation loop) when the user prefers reduced motion.
const TAU = Math.PI * 2;
const R = (a, b) => a + Math.random() * (b - a);
const pick = (a) => a[(Math.random() * a.length) | 0];

function star(c, r) { c.beginPath(); for (let i = 0; i < 8; i++) { const a = (i * Math.PI) / 4, k = i % 2 ? r * 0.25 : r; c.lineTo(Math.cos(a) * k, Math.sin(a) * k); } c.closePath(); c.fill(); }
function heart(c, r) { c.beginPath(); c.moveTo(0, r * 0.35); c.bezierCurveTo(-r, -r * 0.3, -r * 0.5, -r, 0, -r * 0.45); c.bezierCurveTo(r * 0.5, -r, r, -r * 0.3, 0, r * 0.35); c.fill(); }
function petal(c, r) { c.beginPath(); c.moveTo(0, -r); c.bezierCurveTo(r * 0.9, -r * 0.5, r * 0.6, r * 0.7, 0, r); c.bezierCurveTo(-r * 0.6, r * 0.7, -r * 0.9, -r * 0.5, 0, -r); c.fill(); }
function leaf(c, r) { c.beginPath(); c.moveTo(0, -r); c.quadraticCurveTo(r * 0.9, 0, 0, r); c.quadraticCurveTo(-r * 0.9, 0, 0, -r); c.fill(); c.strokeStyle = "rgba(0,0,0,.25)"; c.lineWidth = 1; c.beginPath(); c.moveTo(0, -r); c.lineTo(0, r); c.stroke(); }
function flake(c, r) { c.lineWidth = Math.max(1, r * 0.25); c.lineCap = "round"; for (let i = 0; i < 3; i++) { c.rotate(Math.PI / 3); c.beginPath(); c.moveTo(-r, 0); c.lineTo(r, 0); c.stroke(); } }
function glow(c, r, col) { const g = c.createRadialGradient(0, 0, 0, 0, 0, r); g.addColorStop(0, col); g.addColorStop(1, "transparent"); c.fillStyle = g; c.beginPath(); c.arc(0, 0, r, 0, TAU); c.fill(); }

const DRAW = {
  dot: (c, p) => { c.beginPath(); c.arc(0, 0, p.r, 0, TAU); c.fill(); },
  star: (c, p) => star(c, p.r),
  rect: (c, p) => c.fillRect(-p.r, -p.r * 0.5, p.r * 2, p.r),
  ribbon: (c, p) => c.fillRect(-p.r * 2.5, -1.5, p.r * 5, 3),
  heart: (c, p) => heart(c, p.r),
  petal: (c, p) => petal(c, p.r),
  leaf: (c, p) => leaf(c, p.r),
  flake: (c, p) => { c.strokeStyle = p.c; flake(c, p.r); },
  glow: (c, p) => glow(c, p.r, p.c),
  bubble: (c, p) => { c.strokeStyle = p.c; c.lineWidth = 1.2; c.beginPath(); c.arc(0, 0, p.r, 0, TAU); c.stroke(); c.fillStyle = "rgba(255,255,255,.18)"; c.beginPath(); c.arc(-p.r * 0.35, -p.r * 0.35, p.r * 0.25, 0, TAU); c.fill(); },
  rain: (c, p) => { c.strokeStyle = p.c; c.lineWidth = 1; c.beginPath(); c.moveTo(0, 0); c.lineTo(0, p.r * 4); c.stroke(); },
  spark: (c, p) => { c.beginPath(); c.arc(0, 0, p.r, 0, TAU); c.fill(); },
  balloon: (c, p) => {
    c.beginPath(); c.ellipse(0, 0, p.r * 0.82, p.r, 0, 0, TAU); c.fill();
    c.fillStyle = "rgba(255,255,255,.35)"; c.beginPath(); c.ellipse(-p.r * 0.3, -p.r * 0.35, p.r * 0.14, p.r * 0.3, -0.5, 0, TAU); c.fill();
    c.strokeStyle = "rgba(255,255,255,.55)"; c.lineWidth = 1.2; c.beginPath(); c.moveTo(0, p.r); c.quadraticCurveTo(p.r * 0.3, p.r * 1.7, 0, p.r * 2.4); c.stroke();
  },
  lantern: (c, p) => { glow(c, p.r * 2.4, "rgba(255,170,60,.35)"); c.fillStyle = p.c; c.beginPath(); c.roundRect(-p.r * 0.6, -p.r * 0.8, p.r * 1.2, p.r * 1.6, p.r * 0.3); c.fill(); },
};

const AMB = {
  dust: { n: 40, shape: "dot", make: (w, h, p) => ({ r: R(0.6, 1.8), vx: R(-6, 6), vy: R(-8, -2), a: R(0.1, 0.4), tw: R(0.5, 2) }) },
  sparkle: { n: 34, shape: "star", make: () => ({ r: R(1.5, 4.5), vx: R(-3, 3), vy: R(-4, 4), a: 1, tw: R(1, 3.5) }) },
  snow: { n: 70, shape: "dot", make: () => ({ r: R(1, 3.6), vx: R(-10, 10), vy: R(20, 50), a: R(0.5, 0.95), sw: R(0.5, 1.6) }) },
  petals: { n: 26, shape: "petal", make: () => ({ r: R(4, 8), vx: R(-10, 10), vy: R(18, 42), a: 0.9, sw: R(0.6, 1.4), vr: R(-1.5, 1.5) }) },
  hearts: { n: 20, shape: "heart", make: () => ({ r: R(4, 9), vx: R(-8, 8), vy: R(-30, -12), a: R(0.3, 0.8), sw: R(0.6, 1.2) }) },
  bokeh: { n: 18, shape: "glow", make: () => ({ r: R(20, 70), vx: R(-6, 6), vy: R(-12, -3), a: R(0.18, 0.4), tw: R(0.3, 1) }) },
  embers: { n: 36, shape: "dot", make: () => ({ r: R(0.8, 2.4), vx: R(-10, 10), vy: R(-50, -18), a: 1, tw: R(2, 6) }) },
  bubbles: { n: 26, shape: "bubble", make: () => ({ r: R(3, 12), vx: R(-6, 6), vy: R(-50, -15), a: 0.8, sw: R(0.6, 1.4) }) },
  fireflies: { n: 24, shape: "glow", make: () => ({ r: R(4, 9), vx: R(-14, 14), vy: R(-14, 14), a: 1, tw: R(0.6, 1.6), wander: 1 }) },
  leaves: { n: 18, shape: "leaf", make: () => ({ r: R(5, 10), vx: R(-14, 14), vy: R(22, 50), a: 0.9, sw: R(0.5, 1.2), vr: R(-2, 2) }) },
  rain: { n: 60, shape: "rain", make: () => ({ r: R(3, 7), vx: -14, vy: R(380, 560), a: R(0.12, 0.35) }) },
  confetti: { n: 36, shape: "rect", make: () => ({ r: R(3, 6), vx: R(-10, 10), vy: R(30, 70), a: 0.9, vr: R(-4, 4), sw: R(0.5, 1.4) }) },
  stars: { n: 60, shape: "dot", make: () => ({ r: R(0.5, 1.6), vx: R(-1.5, 1.5), vy: R(-1, 1), a: 1, tw: R(0.5, 2.4) }) },
  none: { n: 0 },
};

export class FX {
  constructor(canvas, { reduced = false, still = false } = {}) {
    this.cv = canvas; this.c = canvas.getContext("2d"); this.ps = []; this.t = 0; this.running = false; this.reduced = reduced; this.still = still;
    this.amb = null; this.cols = ["#fff"]; this.sched = []; this.w = 0; this.h = 0;
    this.ro = new ResizeObserver(() => this.resize()); this.ro.observe(canvas.parentElement || canvas);
    this.vis = () => (document.hidden ? this.stop() : this.ps.length || this.amb ? this.start() : 0);
    document.addEventListener("visibilitychange", this.vis);
    this.resize();
  }
  resize() {
    const r = (this.cv.parentElement || this.cv).getBoundingClientRect(), d = Math.min(devicePixelRatio || 1, 1.5);
    this.w = Math.max(1, r.width); this.h = Math.max(1, r.height);
    this.cv.width = this.w * d; this.cv.height = this.h * d; this.d = d;
    if (this.reduced || this.still) this.drawStatic();
  }
  ambient(type, colors) {
    this.ps = this.ps.filter((p) => !p.amb);
    this.amb = AMB[type] && AMB[type].n ? type : null; this.cols = colors && colors.length ? colors : ["#fff"];
    if (!this.amb) { this.clear(); return; }
    const A = AMB[type], n = Math.round(A.n * Math.min(1, (this.w * this.h) / 900000 + 0.35));
    for (let i = 0; i < n; i++) { const p = { ...A.make(this.w, this.h), x: R(0, this.w), y: R(0, this.h), rot: R(0, TAU), shape: A.shape, c: pick(this.cols), amb: 1, ph: R(0, TAU) }; this.ps.push(p); }
    if (this.reduced || this.still) this.drawStatic(); else this.start();
  }
  burst(type, colors, { x = 0.5, y = 0.5 } = {}) {
    if (this.reduced) return;
    const cols = colors && colors.length ? colors : ["#ff4f9a", "#ffd166", "#06d6a0", "#4cc9f0", "#fff"], w = this.w, h = this.h, add = (p) => this.ps.push({ rot: R(0, TAU), ph: R(0, TAU), c: pick(cols), life: 0, ...p });
    const T = {
      confetti: () => { for (let i = 0; i < 160; i++) { const left = i % 2; add({ x: left ? 0 : w, y: h * 0.92, vx: (left ? 1 : -1) * R(150, Math.max(400, w * 0.7)), vy: -R(500, 1100), g: 700, drag: 0.7, r: R(3, 7), shape: "rect", vr: R(-9, 9), sw: R(1, 3), max: R(3, 5) }); } },
      rainConfetti: () => { for (let i = 0; i < 120; i++) add({ x: R(0, w), y: R(-h * 0.6, 0), vx: R(-30, 30), vy: R(80, 220), g: 20, r: R(3, 7), shape: "rect", vr: R(-6, 6), sw: R(1, 3), max: 9 }); },
      fireworks: () => { for (let i = 0; i < 7; i++) this.sched.push({ t: this.t + i * 0.8 + R(0, 0.3), f: () => { const x = R(w * 0.15, w * 0.85), ty = R(h * 0.12, h * 0.45); add({ x, y: h, vx: R(-20, 20), vy: -Math.sqrt(2 * 300 * (h - ty)), g: 300, r: 2, shape: "dot", max: 2.2, rocket: 1, trail: 1 }); } }); },
      sparkle: () => { for (let i = 0; i < 90; i++) add({ x: R(0, w), y: R(-h * 0.5, 0), vx: R(-20, 20), vy: R(60, 180), g: 10, r: R(2, 5), shape: "star", vr: R(-3, 3), max: R(5, 8), tw: R(4, 9) }); },
      balloons: () => { for (let i = 0; i < 16; i++) add({ x: R(w * 0.05, w * 0.95), y: h + R(40, 400), vx: 0, vy: -R(60, 130), r: R(22, 36), shape: "balloon", sw: R(0.5, 1.1), max: 14 }); },
      lanterns: () => { for (let i = 0; i < 18; i++) add({ x: R(w * 0.05, w * 0.95), y: h + R(20, 300), vx: R(-6, 6), vy: -R(25, 60), r: R(9, 15), shape: "lantern", sw: R(0.3, 0.7), max: 18, c: pick(["#ffb347", "#ff9a3c", "#ffd27a"]) }); },
      petals: () => { for (let i = 0; i < 80; i++) add({ x: R(0, w), y: R(-h * 0.6, 0), vx: R(-30, 30), vy: R(50, 130), r: R(5, 10), shape: "petal", vr: R(-3, 3), sw: R(0.8, 1.8), max: 12 }); },
      hearts: () => { for (let i = 0; i < 40; i++) add({ x: R(w * 0.1, w * 0.9), y: h + R(0, 200), vx: R(-20, 20), vy: -R(80, 200), r: R(6, 14), shape: "heart", sw: R(0.6, 1.4), max: 9 }); },
      snow: () => { for (let i = 0; i < 120; i++) add({ x: R(0, w), y: R(-h, 0), vx: R(-20, 20), vy: R(50, 130), r: R(1.5, 4), shape: "dot", sw: R(0.5, 1.6), max: 14, c: "#fff" }); },
      stars: () => { for (let i = 0; i < 110; i++) { const a = R(0, TAU), s = R(80, 520); add({ x: w * x, y: h * y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, drag: 1.1, r: R(1.5, 4.5), shape: "star", max: R(1.6, 3), tw: 8 }); } },
    };
    (T[type] || T.confetti)();
    this.start();
  }
  spawnSparks(x, y, n, col) { for (let i = 0; i < n; i++) { const a = R(0, TAU), s = R(60, 380); this.ps.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, g: 220, drag: 1.4, r: R(1, 2.6), shape: "spark", max: R(0.8, 1.6), life: 0, c: col || pick(["#ffd166", "#ff4f9a", "#4cc9f0", "#fff", "#b388ff"]), rot: 0, ph: 0, tw: 5 }); } this.start(); }
  clear() { this.c.setTransform(1, 0, 0, 1, 0, 0); this.c.clearRect(0, 0, this.cv.width, this.cv.height); }
  start() { if (this.running || this.reduced || this.still || document.hidden) return; this.running = true; this.last = performance.now(); this.raf = requestAnimationFrame((t) => this.loop(t)); }
  stop() { this.running = false; cancelAnimationFrame(this.raf); }
  loop(now) {
    if (!this.running) return;
    const dt = Math.min(0.05, (now - this.last) / 1000); this.last = now; this.t += dt;
    for (let i = this.sched.length - 1; i >= 0; i--) if (this.sched[i].t <= this.t) { this.sched[i].f(); this.sched.splice(i, 1); }
    const w = this.w, h = this.h, c = this.c;
    c.setTransform(this.d, 0, 0, this.d, 0, 0); c.clearRect(0, 0, w, h);
    const out = [];
    for (const p of this.ps) {
      p.ph += dt * (p.sw || 1) * 2;
      if (p.amb) {
        if (p.wander) { p.vx += R(-30, 30) * dt; p.vy += R(-30, 30) * dt; p.vx = Math.max(-20, Math.min(20, p.vx)); p.vy = Math.max(-20, Math.min(20, p.vy)); }
        p.x += (p.vx + (p.sw ? Math.sin(p.ph) * 14 : 0)) * dt; p.y += p.vy * dt; p.rot += (p.vr || 0) * dt;
        const m = 40;
        if (p.y > h + m) { p.y = -m; p.x = R(0, w); } else if (p.y < -m) { p.y = h + m; p.x = R(0, w); }
        if (p.x > w + m) p.x = -m; else if (p.x < -m) p.x = w + m;
        out.push(p); this.draw(p, p.a * (p.tw ? 0.55 + 0.45 * Math.sin(this.t * p.tw + p.ph) : 1));
        continue;
      }
      p.life += dt;
      if (p.life > p.max) continue;
      if (p.drag) { const k = Math.exp(-p.drag * dt); p.vx *= k; p.vy *= k; }
      p.vy += (p.g || 0) * dt; p.x += (p.vx + (p.sw && p.shape !== "dot" ? Math.sin(p.ph) * 20 : 0)) * dt; p.y += p.vy * dt; p.rot += (p.vr || 0) * dt;
      if (p.rocket) {
        if (p.vy >= -20 || p.life > p.max - 0.05) { const col = pick(["#ffd166", "#ff4f9a", "#4cc9f0", "#b388ff", "#fff"]); for (let i = 0; i < 46; i++) { const a = (i / 46) * TAU, s = R(120, 300); out.push({ x: p.x, y: p.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, g: 160, drag: 1.5, r: R(1.2, 2.4), shape: "spark", max: R(1, 1.7), life: 0, c: col, rot: 0, ph: 0, tw: 6 }); } continue; }
        c.globalAlpha = 0.5; c.fillStyle = "#fff"; c.fillRect(p.x - 1, p.y, 2, 14);
      }
      if (p.y > h + 80 && p.vy > 0 && !p.rocket) continue;
      if (p.y < -120 && p.vy < 0 && p.shape !== "dot" && !p.rocket) continue;
      const fade = Math.min(1, (p.max - p.life) / 1, p.life * 4 + 0.2);
      out.push(p); this.draw(p, fade * (p.tw ? 0.6 + 0.4 * Math.sin(this.t * p.tw + p.ph) : 1));
    }
    this.ps = out; c.globalAlpha = 1;
    if (!this.ps.length && !this.sched.length) { this.stop(); this.clear(); return; }
    this.raf = requestAnimationFrame((t) => this.loop(t));
  }
  draw(p, a) {
    const c = this.c; c.save(); c.globalAlpha = Math.max(0, Math.min(1, a)); c.translate(p.x, p.y);
    const sx = p.shape === "rect" || p.shape === "ribbon" ? Math.cos(p.ph * 1.7) : 1; c.rotate(p.rot); c.scale(sx || 0.1, 1);
    c.fillStyle = p.c; if (p.shape === "glow" || p.shape === "lantern") c.globalCompositeOperation = "lighter";
    DRAW[p.shape](c, p); c.restore();
  }
  drawStatic() {
    const c = this.c; c.setTransform(this.d, 0, 0, this.d, 0, 0); c.clearRect(0, 0, this.w, this.h);
    for (const p of this.ps) if (p.amb) this.draw(p, p.a * 0.7);
  }
  destroy() { this.stop(); this.ro.disconnect(); document.removeEventListener("visibilitychange", this.vis); this.ps = []; this.sched = []; }
}

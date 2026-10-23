// Player: state-driven multi-scene birthday experience.
// Only the current scene is in the DOM; the next scene is built when you advance, so nothing is revealed early.
import { SPECS } from "./specs.js";
import { normalize, esc } from "./story.js";
import { buildScene } from "./scenes.js";
import { backdrop } from "./art.js";
import { FX } from "./fx.js";
import { Sound, BlowDetector } from "./audio.js";

export const specById = (id) => SPECS.find((s) => s.id === id) || SPECS[0];
const reducedMQ = () => (window.matchMedia ? matchMedia("(prefers-reduced-motion: reduce)").matches : false);
const FONT = (n, fb) => `'${n}',${fb}`;
const SERIF = ["Playfair Display", "Cormorant Garamond", "DM Serif Display", "Lora", "Cinzel", "Abril Fatface", "Limelight", "Special Elite", "Great Vibes", "Homemade Apple"];
const stack = (n) => FONT(n, SERIF.includes(n) ? "Georgia,serif" : /Mono|Elite/.test(n) ? "monospace" : "system-ui,sans-serif");

let manifest = null; // optional photo backdrops: res/backdrops/manifest.json
const loadManifest = () => (manifest ||= fetch("res/backdrops/manifest.json").then((r) => (r.ok ? r.json() : {})).catch(() => ({})));

export class Player {
  constructor(root, { template = "template-01", data = {}, mode = "full", scene = null, onEvent = null } = {}) {
    this.root = root; this.mode = mode; this.onEvent = onEvent; this.reduced = reducedMQ(); this.dead = false;
    this.cleanups = []; this.timers = new Set(); this.index = 0; this.visited = new Set([0]); this.busy = false; this.st = {};
    this.spec = specById(template); this.data = data; this.m = normalize(data, this.spec);
    if (mode !== "thumb") { this.sound = new Sound(); this.sound.setTrack(this.m.music); this.cleanups.push(this.sound.onChange(() => this.hudSound())); }
    this.build();
    if (mode === "thumb") { this.renderStatic(scene || "welcome"); return; }
    this.enter(0, 0, true);
  }
  ev(n, p) { try { this.onEvent && this.onEvent(n, p); } catch { /* ignore */ } }
  after(fn, ms) { const t = setTimeout(() => { this.timers.delete(t); if (!this.dead) fn(); }, ms); this.timers.add(t); return t; }
  on(el, t, fn, o) { el.addEventListener(t, fn, o); this.cleanups.push(() => el.removeEventListener(t, fn, o)); }

  // ---------- structure ----------
  vars() {
    const s = this.spec, [ink, mute, ac, ac2, card] = s.pal;
    const lum = (h) => { const n = parseInt(h.replace("#", "").slice(0, 6), 16) || 0; return (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255; };
    this.root.style.cssText = `--ink:${ink};--mute:${mute};--ac:${ac};--ac2:${ac2};--card:${card};--f-d:${stack(s.f[0])};--f-b:${stack(s.f[1])};--f-s:${stack(s.f[2])};--pf:${s.pf || "none"};--scrim:${s.scrim || "transparent"};--onac:${lum(ac) > 0.62 ? "#111" : "#fff"};--cake:${s.cake?.plate || "#fff"}`;
    this.root.dataset.tone = lum(ink) > 0.55 ? "dark" : "light";
    // creator's visual options (wizard step "Experience"); null/absent keeps the template's own design
    const o = this.m?.opts || {}, st = this.root.style;
    if (/^#[0-9a-f]{6}$/i.test(o.accent || "")) { st.setProperty("--ac", o.accent); st.setProperty("--onac", lum(o.accent) > 0.62 ? "#111" : "#fff"); }
    const FONTS = ["'Playfair Display',Georgia,serif", "'Inter',system-ui,sans-serif", "'Space Mono',monospace", "'Dancing Script','Great Vibes',cursive", "'Archivo Black','Bebas Neue',sans-serif"];
    if (Number.isInteger(o.font) && FONTS[o.font]) st.setProperty("--f-d", FONTS[o.font]);
    this.root.dataset.align = ["left", "right"].includes(o.align) ? o.align : "";
  }
  build() {
    const r = this.root, s = this.spec;
    const UP = ["Bebas Neue", "Bangers", "Archivo Black", "Orbitron", "Cinzel", "Limelight", "Syne", "Amatic SC", "Permanent Marker"], SC = ["Great Vibes", "Dancing Script", "Pacifico", "Homemade Apple"];
    r.className = `bwx t-${String(s.n).padStart(2, "0")}${UP.includes(s.f[0]) ? " hd-upper" : ""}${SC.includes(s.f[0]) ? " hd-script" : ""} mode-${this.mode} tex-${s.tex} bt-${s.bt} tr-${s.tr} rv-${s.rv}${this.reduced ? " reduced" : ""}`;
    r.setAttribute("data-template", s.id);
    this.vars();
    r.innerHTML = `<div class="bwx-bg"></div><div class="bwx-photobg"></div><div class="bwx-tex"></div><div class="bwx-scrim"></div><canvas class="bwx-fx bg" aria-hidden="true"></canvas><div class="bwx-view"></div><canvas class="bwx-fx top" aria-hidden="true"></canvas><div class="bwx-hud"><button type="button" class="hud-back" data-hud="back" aria-label="Previous scene" hidden>←</button><span class="chap" aria-hidden="true"></span><ol class="dots"></ol><button type="button" class="snd" data-hud="snd" aria-pressed="false" hidden></button></div><div class="bwx-lb" hidden role="dialog" aria-modal="true" aria-label="Photo viewer"><button type="button" class="x" data-lbx="close" aria-label="Close photo">×</button><button type="button" class="p" data-lbx="-1" aria-label="Previous photo">←</button><img alt=""><button type="button" class="n" data-lbx="1" aria-label="Next photo">→</button></div><div class="bwx-live sr" aria-live="polite" role="status"></div>`;
    r.querySelector(".bwx-bg").innerHTML = backdrop(s.art);
    loadManifest().then((mf) => { const f = mf && mf[s.id]; if (f && !this.dead) { const im = new Image(); im.onload = () => { r.querySelector(".bwx-photobg").style.backgroundImage = `url("res/backdrops/${encodeURI(f)}")`; r.classList.add("has-photobg"); }; im.src = "res/backdrops/" + encodeURI(f); } });
    this.view = r.querySelector(".bwx-view"); this.live = r.querySelector(".bwx-live");
    const still = this.mode === "thumb" || this.reduced;
    this.fxBg = new FX(r.querySelector(".bwx-fx.bg"), { reduced: this.reduced, still: this.mode === "thumb" });
    this.fxTop = new FX(r.querySelector(".bwx-fx.top"), { reduced: this.reduced, still: this.mode === "thumb" });
    const an = this.m.opts?.anim || "normal", amb = an === "calm" ? "none" : this.m.opts?.confetti ? "confetti" : s.amb;
    this.fxBg.ambient(amb, [s.pal[2], s.pal[3], "#ffffff"]);
    void still;
    if (this.mode === "thumb") return;
    this.on(r, "click", (e) => this.click(e));
    this.on(r, "error", (e) => { if (e.target.tagName === "IMG") { const f = e.target.closest("figure"); if (f) f.classList.add("broken"); } }, true);
    this.on(r, "keydown", (e) => this.key(e));
    if (this.mode === "full") this.on(document, "keydown", (e) => { if (!r.contains(e.target) && (e.target === document.body || e.target === document.documentElement)) this.key(e); }); // arrows work even when nothing is focused
    if (!this.reduced) {
      let raf = 0; this.on(r, "pointermove", (e) => { if (raf) return; raf = requestAnimationFrame(() => { raf = 0; const b = r.getBoundingClientRect(); r.style.setProperty("--px", ((e.clientX - b.left) / b.width - 0.5).toFixed(3)); r.style.setProperty("--py", ((e.clientY - b.top) / b.height - 0.5).toFixed(3)); }); }, { passive: true });
    }
    this.hudDots();
  }
  renderStatic(id) {
    const sc = this.m.scenes.find((s) => s.id === id) ? id : "welcome";
    this.index = this.m.scenes.findIndex((s) => s.id === sc); this.root.dataset.scene = sc; this.root.classList.add("static");
    this.view.innerHTML = buildScene(sc, this.m, this.spec, { first: this.index === 0 });
    this.view.querySelectorAll("[data-env]").forEach((e) => e.classList.add("open"));
    this.mountScene(this.view.firstElementChild, true);
  }

  // ---------- navigation ----------
  get ids() { return this.m.scenes.map((s) => s.id); }
  get current() { return this.ids[this.index]; }
  announce(t) { this.live.textContent = t; }
  async enter(i, dir = 1, first = false) {
    if (this.busy && !first) return;
    i = Math.max(0, Math.min(this.ids.length - 1, i)); const id = this.ids[i], old = this.view.firstElementChild;
    this.busy = true; this.index = i; this.visited.add(i); this.st = {};
    const html = buildScene(id, this.m, this.spec, { first: i === 0 });
    const t = document.createElement("template"); t.innerHTML = html; const el = t.content.firstElementChild; el.classList.add("entering");
    this.root.dataset.scene = id; this.root.dataset.index = String(i);
    this.cleanScene();
    this.view.appendChild(el);
    this.mountScene(el, false);
    if (old && !first && !this.reduced) { try { await this.transition(old, el, dir); } catch { /* ignore */ } }
    else if (old) { old.remove(); }
    if (old && old.isConnected) old.remove();
    el.classList.remove("entering"); this.busy = false;
    this.hudUpdate(); this.ev("scene", { id, index: i });
    const h = el.querySelector("[id^=h-]"); if (h) { h.setAttribute("tabindex", "-1"); try { h.focus({ preventScroll: true }); } catch { /* ignore */ } }
    this.announce(`${this.m.scenes[i].label}, scene ${i + 1} of ${this.ids.length}`);
    if (id === "finale") { this.after(() => { const an = this.m.opts?.anim || "normal", cols = [this.spec.pal[2], this.spec.pal[3], "#ffffff", "#ffd166", "#ff4f9a", "#4cc9f0"]; this.fxTop.burst(an === "calm" ? "sparkle" : this.spec.fx, cols); if (an === "lively") this.after(() => this.fxTop.burst(this.spec.fx === "confetti" ? "rainConfetti" : "confetti", cols), 1400); this.sound?.sfx("fanfare"); }, 350); this.ev("finale"); }
  }
  next() { if (this.canNext()) this.enter(this.index + 1, 1); }
  back() { if (this.index > 0) this.enter(this.index - 1, -1); }
  canNext() { if (this.index >= this.ids.length - 1) return false; if (this.mode === "preview") return true; const id = this.current; if (id === "welcome") return !!this.st.started; if (id === "cake") return !!this.st.wished; if (id === "cut") return !!this.st.cut; return true; }
  go(id) { const i = this.ids.indexOf(id); if (i >= 0) this.enter(i, i >= this.index ? 1 : -1); }
  replay() { this.fxTop.stop(); this.fxTop.clear(); this.fxTop.ps = []; this.sound?.pause(); this.visited = new Set([0]); this.ev("replay"); this.enter(0, -1); }

  transition(out, inn, dir) {
    const tr = this.spec.tr, D = 650, E = "cubic-bezier(.2,.7,.2,1)", o = { duration: D, easing: E, fill: "both" };
    const A = (el, kf, op = o) => el.animate(kf, op).finished.catch(() => {});
    inn.style.zIndex = 2; out.style.zIndex = 1; out.style.pointerEvents = "none";
    let pr;
    const T = {
      fade: () => Promise.all([A(inn, [{ opacity: 0 }, { opacity: 1 }]), A(out, [{ opacity: 1 }, { opacity: 0 }])]),
      rise: () => Promise.all([A(inn, [{ opacity: 0, transform: "translateY(48px)" }, { opacity: 1, transform: "none" }]), A(out, [{ opacity: 1 }, { opacity: 0, transform: "translateY(-32px)" }])]),
      wipe: () => Promise.all([A(inn, [{ clipPath: dir > 0 ? "inset(0 100% 0 0)" : "inset(0 0 0 100%)" }, { clipPath: "inset(0 0 0 0)" }], { ...o, duration: 800 }), A(out, [{ opacity: 1 }, { opacity: 0.2 }], { ...o, duration: 800 })]),
      zoom: () => Promise.all([A(inn, [{ opacity: 0, transform: "scale(1.18)" }, { opacity: 1, transform: "none" }]), A(out, [{ opacity: 1 }, { opacity: 0, transform: "scale(.9)" }])]),
      blur: () => Promise.all([A(inn, [{ opacity: 0, filter: "blur(22px)" }, { opacity: 1, filter: "blur(0)" }], { ...o, duration: 800 }), A(out, [{ opacity: 1, filter: "blur(0)" }, { opacity: 0, filter: "blur(22px)" }], { ...o, duration: 800 })]),
      iris: () => Promise.all([A(inn, [{ clipPath: "circle(0% at 50% 55%)" }, { clipPath: "circle(80% at 50% 55%)" }], { ...o, duration: 850 }), A(out, [{ opacity: 1 }, { opacity: 0.3 }], { ...o, duration: 850 })]),
      shutter: () => Promise.all([A(inn, [{ clipPath: "inset(50% 0 50% 0)" }, { clipPath: "inset(0% 0 0% 0)" }], { ...o, duration: 850 }), A(out, [{ opacity: 1 }, { opacity: 0 }], { ...o, duration: 850 })]),
      slide: () => Promise.all([A(inn, [{ transform: `translateX(${dir * 100}%)` }, { transform: "none" }]), A(out, [{ transform: "none", opacity: 1 }, { transform: `translateX(${-dir * 35}%)`, opacity: 0 }])]),
      flip: () => { this.view.style.perspective = "1400px"; return Promise.all([A(inn, [{ transform: `rotateY(${-dir * 80}deg)`, opacity: 0 }, { transform: "none", opacity: 1 }], { ...o, duration: 800 }), A(out, [{ transform: "none", opacity: 1 }, { transform: `rotateY(${dir * 80}deg)`, opacity: 0 }], { ...o, duration: 800 })]).finally(() => (this.view.style.perspective = "")); },
      page: () => { this.view.style.perspective = "1800px"; inn.style.transformOrigin = "0 50%"; return Promise.all([A(inn, [{ transform: `rotateY(${-dir * 60}deg)`, opacity: 0 }, { transform: "none", opacity: 1 }], { ...o, duration: 850 }), A(out, [{ opacity: 1 }, { opacity: 0 }], { ...o, duration: 700 })]).finally(() => { this.view.style.perspective = ""; inn.style.transformOrigin = ""; }); },
      glitch: () => Promise.all([A(inn, [{ opacity: 0, transform: "translateX(-14px) skewX(6deg)", filter: "hue-rotate(90deg)" }, { opacity: 1, transform: "translateX(10px)", filter: "hue-rotate(-60deg)", offset: 0.2 }, { opacity: 0.6, transform: "translateX(-6px)", offset: 0.4 }, { opacity: 1, transform: "translateX(3px)", offset: 0.65 }, { opacity: 1, transform: "none", filter: "none" }], { duration: 520, easing: "steps(8)", fill: "both" }), A(out, [{ opacity: 1 }, { opacity: 0, transform: "translateX(18px) skewX(-8deg)" }], { duration: 360, easing: "steps(5)", fill: "both" })]),
      curtain: async () => {
        const c = document.createElement("div"); c.className = "bwx-curt"; c.innerHTML = "<i></i><i></i>"; this.root.appendChild(c);
        inn.style.visibility = "hidden";
        await Promise.all([...c.children].map((p, k) => p.animate([{ transform: `translateX(${k ? 100 : -100}%)` }, { transform: "none" }], { duration: 480, easing: "ease-in", fill: "both" }).finished.catch(() => {})));
        out.remove(); inn.style.visibility = "";
        await Promise.all([...c.children].map((p, k) => p.animate([{ transform: "none" }, { transform: `translateX(${k ? 100 : -100}%)` }], { duration: 560, easing: "ease-out", fill: "both" }).finished.catch(() => {})));
        c.remove();
      },
    };
    pr = (T[tr] || T.fade)();
    return pr.then(() => { [inn, out].forEach((e) => { e.getAnimations?.().forEach((a) => a.cancel()); e.style.cssText = ""; }); });
  }
  cleanScene() { (this.sceneClean || []).forEach((f) => f()); this.sceneClean = []; this.mic?.stop(); this.mic = null; }

  // ---------- scene mounting ----------
  reveal(el) {
    const mode = this.spec.rv, nodes = [...el.querySelectorAll("[data-rv]")];
    if (this.reduced || this.mode === "thumb" || mode === "none") return;
    let t = 0.12;
    const total = nodes.reduce((a, n) => a + n.textContent.length, 0), step = Math.min(0.032, 5 / Math.max(1, total));
    nodes.forEach((n) => {
      n.classList.add("rv", "rv-" + mode); n.style.setProperty("--d", t.toFixed(2) + "s");
      if (mode === "words" || mode === "chars" || mode === "type") {
        if (n.children.length) { t += 0.15; return; }
        const txt = n.textContent; n.setAttribute("aria-label", txt); n.textContent = "";
        const frag = document.createDocumentFragment(); let i = 0;
        txt.split(/(\s+)/).forEach((w) => {
          if (/^\s+$/.test(w) || !w) { frag.appendChild(document.createTextNode(" ")); return; }
          const wrap = document.createElement("span"); wrap.className = "ww"; wrap.setAttribute("aria-hidden", "true");
          if (mode === "words") { const s = document.createElement("span"); s.className = "w"; s.style.setProperty("--i", i++); s.textContent = w; wrap.appendChild(s); }
          else for (const ch of w) { const s = document.createElement("span"); s.className = "w"; s.style.setProperty("--i", i++); s.textContent = ch; wrap.appendChild(s); }
          frag.appendChild(wrap);
        });
        n.appendChild(frag);
        const per = mode === "type" ? step : mode === "chars" ? 0.035 : 0.09; n.style.setProperty("--s", per + "s"); t += i * per + 0.1;
      } else t += 0.16;
    });
  }
  mountScene(el, still) {
    const id = el.dataset.scene;
    if (!still) this.reveal(el);
    const q = (s) => el.querySelector(s), qa = (s) => [...el.querySelectorAll(s)];
    if (id === "cake" && BlowDetector.supported && window.isSecureContext) { const b = q('[data-act="mic"]'); if (b) b.hidden = false; }
    const cf = q("[data-cf]"); if (cf) this.coverflow(cf, el);
    const stk = q("[data-stack]"); if (stk) this.cardStack(stk, el);
    const kb = q("[data-kb]"); if (kb) this.kenburns(el, kb, still);
    qa(".hs").forEach((h) => this.on(h, "wheel", (e) => { if (Math.abs(e.deltaY) > Math.abs(e.deltaX) && h.scrollWidth > h.clientWidth) { h.scrollLeft += e.deltaY; e.preventDefault(); } }, { passive: false }));
    this.mem = this.m.ph.memories;
  }
  coverflow(cf, el) {
    const items = [...cf.querySelectorAll(".cfi")]; let a = 0; const n = items.length, cnt = el.querySelector(".cnt");
    const set = (k) => { a = (k + n) % n; items.forEach((it, i) => { let o = i - a; if (o > n / 2) o -= n; if (o < -n / 2) o += n; it.style.setProperty("--o", o); it.style.zIndex = 10 - Math.abs(o); it.classList.toggle("on", o === 0); it.setAttribute("aria-hidden", o === 0 ? "false" : "true"); }); if (cnt) cnt.textContent = `${a + 1} / ${n}`; };
    set(0); this.cf = (d) => set(a + d);
    this.on(cf, "keydown", (e) => { if (e.key === "ArrowRight") { set(a + 1); e.stopPropagation(); e.preventDefault(); } if (e.key === "ArrowLeft") { set(a - 1); e.stopPropagation(); e.preventDefault(); } });
    items.forEach((it, i) => this.on(it, "click", () => { if (i !== a) set(i); else this.lightbox(i); }));
    let x0 = null; this.on(cf, "pointerdown", (e) => (x0 = e.clientX)); this.on(cf, "pointerup", (e) => { if (x0 != null && Math.abs(e.clientX - x0) > 40) set(a + (e.clientX < x0 ? 1 : -1)); x0 = null; });
  }
  cardStack(stk, el) {
    const cards = [...stk.querySelectorAll(".sk")]; let order = cards.map((_, i) => i);
    const paint = () => order.forEach((ci, pos) => { const c = cards[ci]; c.style.setProperty("--k", pos); c.style.zIndex = cards.length - pos; c.style.transform = ""; c.style.opacity = ""; c.inert = pos > 0; });
    const flick = (dir) => { const top = cards[order[0]]; const a = top.animate([{ transform: "none", opacity: 1 }, { transform: `translateX(${dir * 120}%) rotate(${dir * 18}deg)`, opacity: 0 }], { duration: 380, easing: "ease-in" }); a.finished.then(() => { order.push(order.shift()); paint(); }).catch(() => {}); };
    paint(); this.stk = flick;
    el.querySelector("[data-stk]")?.addEventListener("click", () => flick(1));
    let x0 = null; this.on(stk, "pointerdown", (e) => (x0 = e.clientX)); this.on(stk, "pointerup", (e) => { if (x0 != null && Math.abs(e.clientX - x0) > 40) flick(e.clientX > x0 ? 1 : -1); x0 = null; });
    this.on(stk, "keydown", (e) => { if (e.key === "ArrowRight") { flick(1); e.stopPropagation(); } if (e.key === "ArrowLeft") { flick(-1); e.stopPropagation(); } });
  }
  kenburns(el, kb, still) {
    const sl = [...kb.querySelectorAll(".sl")], dots = [...el.querySelectorAll("[data-kbi]")]; let a = 0, timer = null, paused = false;
    const show = (k) => { a = (k + sl.length) % sl.length; sl.forEach((s, i) => s.classList.toggle("on", i === a)); dots.forEach((d, i) => d.toggleAttribute("aria-current", i === a)); };
    dots.forEach((d, i) => d.addEventListener("click", () => show(i)));
    if (!this.reduced && !still && sl.length > 1) { timer = setInterval(() => !paused && !document.hidden && show(a + 1), 4600); this.sceneClean.push(() => clearInterval(timer)); }
    kb.addEventListener("pointerenter", () => (paused = true)); kb.addEventListener("pointerleave", () => (paused = false));
  }
  lightbox(i) {
    const lb = this.root.querySelector(".bwx-lb"), img = lb.querySelector("img"), list = this.m.ph.memories; if (!list[i]) return;
    let k = i; const show = () => { img.src = list[k].url; img.alt = list[k].cap || "Memory " + (k + 1); }; show(); lb.hidden = false; this.lbOpen = true; this.lbPrev = document.activeElement; this.lbk = (d) => { k = (k + d + list.length) % list.length; show(); }; lb.querySelector(".x").focus();
  }
  closeLb() { const lb = this.root.querySelector(".bwx-lb"); lb.hidden = true; this.lbOpen = false; try { this.lbPrev?.focus(); } catch { /* ignore */ } }

  // ---------- events ----------
  key(e) {
    if (this.lbOpen) { if (e.key === "Escape") this.closeLb(); else if (e.key === "ArrowRight") this.lbk(1); else if (e.key === "ArrowLeft") this.lbk(-1); else if (e.key === "Tab") { e.preventDefault(); } return; }
    if (e.target.closest("input,textarea,select")) return;
    if (e.key === "ArrowRight" && e.target.closest(".hs") == null && this.canNext() && this.current !== "welcome") this.next();
    else if (e.key === "ArrowLeft" && e.target.closest(".hs") == null && this.index > 0) this.back();
  }
  async click(e) {
    const t = e.target.closest("[data-act],[data-hud],[data-lb],[data-lbx],[data-hs],[data-cfn],[data-kbi]"); if (!t) return;
    const a = t.dataset.act, h = t.dataset.hud;
    if (t.dataset.lbx) { if (t.dataset.lbx === "close") this.closeLb(); else this.lbk(+t.dataset.lbx); return; }
    if (t.dataset.lb != null) { this.lightbox(+t.dataset.lb); return; }
    if (t.dataset.hs) { const s = t.closest(".sc").querySelector(".hs"); s.scrollBy({ left: +t.dataset.hs * s.clientWidth * 0.8, behavior: this.reduced ? "auto" : "smooth" }); return; }
    if (t.dataset.cfn) { this.cf?.(+t.dataset.cfn); return; }
    if (h === "back") return this.back();
    if (h === "snd") return this.toggleSound();
    if (a === "start") { this.st.started = true; this.ev("start"); this.sound?.unlock().then(() => { if (this.mode === "full" && this.m.music !== "none") this.sound.play(); this.sound.sfx("whoosh"); }); this.next(); }
    else if (a === "next") { this.sound?.sfx("tap"); this.next(); }
    else if (a === "back") this.back();
    else if (a === "replay") this.replay();
    else if (a === "env") { const env = t.closest("[data-env]"); env.classList.toggle("open"); t.setAttribute("aria-expanded", env.classList.contains("open")); t.textContent = env.classList.contains("open") ? "Close the envelope" : "Open the letter"; this.sound?.sfx("tap"); }
    else if (a === "blow") this.blow(t.closest(".sc"));
    else if (a === "relight") this.relight(t.closest(".sc"));
    else if (a === "mic") this.micToggle(t.closest(".sc"), t);
    else if (a === "cut") this.cut(t.closest(".sc"), t);
    else if (a === "recut") this.recut(t.closest(".sc"));
  }

  // ---------- sound ----------
  hudSound() {
    const b = this.root.querySelector(".snd"); if (!b || !this.sound) return; const s = this.sound.status, on = this.sound.playing;
    b.hidden = this.m.music === "none"; b.setAttribute("aria-pressed", on);
    const unavailable = s === "unavailable" || s === "unsupported";
    b.disabled = unavailable; b.dataset.state = unavailable ? "off" : on ? "on" : "paused";
    b.innerHTML = `<span aria-hidden="true">${unavailable ? "🔇" : on ? "♪" : "♪̸"}</span><span class="sr">${unavailable ? "Music unavailable" : on ? "Pause music" : "Play music"}</span>`;
    b.title = unavailable ? "Music is unavailable on this device" : on ? "Pause music" : "Play music";
  }
  async toggleSound() { await this.sound.unlock(); const r = this.sound.toggle(); if (r && r.then) await r; this.hudSound(); }

  // ---------- cake: candles ----------
  blow(sc) {
    if (this.st.wished || this.st.blowing) return; this.st.blowing = true; const svg = sc.querySelector(".cake-svg");
    const cs = [...svg.querySelectorAll(".candle")]; this.sound?.sfx("whoosh"); this.mic?.stop();
    sc.querySelector(".mic-st").textContent = "";
    cs.forEach((c, i) => this.after(() => c.classList.add("out"), i * 140));
    svg.closest(".stage").classList.add("blown");
    this.after(() => { this.st.wished = true; this.st.blowing = false; sc.dataset.wish = "done"; this.root.dataset.wish = "done"; const stage = sc.querySelector(".stage"); sc.querySelector(".ctl").hidden = true; sc.querySelector(".msg").classList.add("dim"); const d = sc.querySelector(".done"); d.hidden = false; d.classList.add("show"); this.sound?.sfx("chime"); this.fxTop.burst("sparkle", [this.spec.pal[2], "#fff", "#ffd166"]); this.ev("blown"); this.announce(this.m.wishMadeTitle + " " + this.m.wishMade); void stage; d.querySelector(".bt.main")?.focus({ preventScroll: true }); }, cs.length * 140 + 700);
  }
  relight(sc) { const svg = sc.querySelector(".cake-svg"); svg.querySelectorAll(".candle").forEach((c) => c.classList.remove("out")); svg.closest(".stage").classList.remove("blown"); sc.querySelector(".done").hidden = true; sc.querySelector(".ctl").hidden = false; sc.querySelector(".msg").classList.remove("dim"); this.st.wished = false; this.root.dataset.wish = ""; sc.querySelector('[data-act="blow"]').focus({ preventScroll: true }); }
  async micToggle(sc, btn) {
    const status = sc.querySelector(".mic-st"); if (this.mic?.on) { this.mic.stop(); status.textContent = "Microphone off. Use the button, or try again."; btn.textContent = "Use my microphone"; return; }
    const msg = { listening: "Listening… take a breath and blow gently towards your microphone, or press the button.", denied: "Microphone permission was denied. No problem: use the Blow the Candles button.", nodevice: "No microphone could be used. Use the Blow the Candles button.", unsupported: "Microphone blow detection is not supported here. Use the button.", insecure: "Microphone needs a secure (https) page. Use the button." };
    this.mic = new BlowDetector({ onBlow: () => this.blow(sc), onState: (s) => { status.textContent = msg[s] || ""; if (s === "listening") btn.textContent = "Stop listening"; else btn.textContent = "Use my microphone"; } });
    await this.mic.start();
  }

  // ---------- cake: cutting ----------
  async cut(sc, btn) {
    if (this.st.cutting || this.st.cut) return; this.st.cutting = true; btn.disabled = true; const svg = sc.querySelector(".cake-svg"); svg.classList.add("cutting");
    const $ = (s) => svg.querySelector(s), knife = $(".knife"), all = $(".cake-all"), P1 = JSON.parse(knife.dataset.p1), P2 = JSON.parse(knife.dataset.p2), fast = this.reduced;
    const run = (el, kf, opt) => { const a = el.animate(kf, { fill: "forwards", easing: "linear", ...opt }); return a.finished.catch(() => {}); };
    const knifePass = async (P, line) => {
      const seg = P.slice(1).map((p, i) => Math.hypot(p[0] - P[i][0], p[1] - P[i][1])), L = seg.reduce((a, b) => a + b, 0), len = +line.dataset.len; let cum = 0;
      const kf = [{ transform: `translate(${P[0][0]}px,${P[0][1] - 150}px)`, opacity: 0, offset: 0 }, { transform: `translate(${P[0][0]}px,${P[0][1] - 4}px)`, opacity: 1, offset: 0.18 }];
      P.slice(1).forEach((p, i) => { cum += seg[i]; kf.push({ transform: `translate(${p[0]}px,${p[1]}px)`, opacity: 1, offset: 0.18 + 0.64 * (cum / L) }); });
      const e = P[P.length - 1]; kf.push({ transform: `translate(${e[0]}px,${e[1] - 90}px)`, opacity: 0, offset: 1 });
      const D = fast ? 200 : 1500; this.sound?.sfx("cut");
      await Promise.all([run(knife, kf, { duration: D }), run(line, [{ strokeDashoffset: len, offset: 0 }, { strokeDashoffset: len, offset: 0.18 }, { strokeDashoffset: 0, offset: 0.82 }, { strokeDashoffset: 0, offset: 1 }], { duration: D })]);
    };
    await knifePass(P1, $(".cut-line.l1")); if (this.dead) return;
    await knifePass(P2, $(".cut-line.l2")); if (this.dead) return;
    const D = fast ? 0.05 : 1;
    $(".cut-faces").style.opacity = 1; run($(".cut-faces"), [{ opacity: 0 }, { opacity: 1 }], { duration: 350 * D });
    const w = $(".cut-wedge"); w.style.transformOrigin = "220px 330px";
    await run(w, [{ transform: "none", opacity: 1 }, { transform: "translate(0,14px) scale(1.02)", opacity: 1, offset: 0.35 }, { transform: "translate(50px,60px) scale(1.07)", opacity: 0 }], { duration: 750 * D, easing: "ease-in-out" });
    svg.querySelectorAll(".cut-line").forEach((l) => run(l, [{ opacity: 1 }, { opacity: 0 }], { duration: 300 * D }));
    $(".cake-all").getAnimations?.(); run(all, [{ transform: "translate(60px,0)" }, { transform: "translate(8px,0)" }], { duration: 700 * D, easing: "ease-in-out" });
    const sl = $(".slice"); sl.style.opacity = 1; await run($(".slice-art"), [{ transform: "translate(-120px,-40px) scale(.7) rotate(-8deg)", opacity: 0 }, { transform: "none", opacity: 1 }], { duration: 650 * D, easing: "cubic-bezier(.2,.8,.2,1)" });
    this.st.cut = true; this.st.cutting = false; sc.dataset.cut = "done"; this.root.dataset.cut = "done";
    this.sound?.sfx("chime"); this.fxTop.burst("confetti", [this.spec.pal[2], this.spec.pal[3], "#fff", "#ffd166", "#ff4f9a"]); this.ev("cut");
    sc.querySelector(".ctl").hidden = true; sc.querySelector(".msg").classList.add("dim"); const d = sc.querySelector(".done"); d.hidden = false; d.classList.add("show"); this.announce(this.m.cutTitle + " " + this.m.cut); void all; d.querySelector(".bt.main")?.focus({ preventScroll: true });
  }
  recut(sc) {
    const svg = sc.querySelector(".cake-svg"); svg.getAnimations({ subtree: true }).forEach((a) => a.cancel());
    svg.querySelectorAll(".cake-all,.cut-wedge,.cut-faces,.slice,.slice-art,.knife,.cut-line").forEach((e) => (e.style.cssText = e.classList.contains("cut-faces") || e.classList.contains("slice") ? "opacity:0" : ""));
    svg.classList.remove("cutting"); svg.querySelectorAll(".cut-line").forEach((l) => (l.style.strokeDashoffset = l.dataset.len));
    sc.querySelector(".done").hidden = true; sc.querySelector(".ctl").hidden = false; sc.querySelector(".msg").classList.remove("dim"); const b = sc.querySelector('[data-act="cut"]'); b.disabled = false; b.focus({ preventScroll: true }); this.st.cut = false; this.root.dataset.cut = "";
  }

  // ---------- HUD ----------
  hudDots() {
    const d = this.root.querySelector(".dots"); d.innerHTML = this.m.scenes.map((s, i) => `<li><button type="button" data-dot="${i}" aria-label="${esc(s.label)}"></button></li>`).join("");
    this.on(d, "click", (e) => { const b = e.target.closest("[data-dot]"); if (!b) return; const i = +b.dataset.dot; if (this.mode === "preview" || (this.visited.has(i) && i < this.index)) this.enter(i, i > this.index ? 1 : -1); });
    this.hudSound();
  }
  hudUpdate() {
    const r = this.root, i = this.index, n = this.ids.length;
    r.querySelector(".chap").textContent = `${String(i + 1).padStart(2, "0")} / ${String(n).padStart(2, "0")} · ${this.m.scenes[i].label}`;
    r.querySelectorAll(".dots button").forEach((b, k) => { b.toggleAttribute("aria-current", k === i); b.classList.toggle("seen", this.visited.has(k)); b.disabled = !(this.mode === "preview" || (this.visited.has(k) && k < i)); });
    r.querySelector(".hud-back").hidden = i === 0; r.dataset.last = i === n - 1 ? "1" : "";
  }

  // ---------- updates & teardown ----------
  update({ template, data } = {}) {
    if (this.dead) return; const cur = this.current;
    if (data) { this.data = data; }
    if (template && template !== this.spec.id) { this.spec = specById(template); this.cleanScene(); this.fxTop.destroy(); this.fxBg.destroy(); this.cleanups.forEach((f) => { try { f(); } catch { /* ignore */ } }); this.cleanups = []; if (this.sound) this.cleanups.push(this.sound.onChange(() => this.hudSound())); this.m = normalize(this.data, this.spec); this.build(); this.sound?.setTrack(this.m.music); }
    this.m = normalize(this.data, this.spec); this.sound?.setTrack(this.m.music);
    this.vars(); { const an = this.m.opts?.anim || "normal"; this.fxBg.ambient(an === "calm" ? "none" : this.m.opts?.confetti ? "confetti" : this.spec.amb, [this.spec.pal[2], this.spec.pal[3], "#ffffff"]); }
    this.hudDots(); const i = this.ids.indexOf(cur); this.index = i >= 0 ? i : Math.min(this.index, this.ids.length - 1);
    if (this.mode === "thumb") return this.renderStatic(cur);
    const id = this.ids[this.index]; this.cleanScene();
    const html = buildScene(id, this.m, this.spec, { first: this.index === 0 }); const t = document.createElement("template"); t.innerHTML = html;
    this.view.replaceChildren(t.content.firstElementChild); this.root.dataset.scene = id; this.mountScene(this.view.firstElementChild, false); this.hudUpdate();
  }
  destroy() {
    this.dead = true; this.timers.forEach(clearTimeout); this.timers.clear(); this.cleanScene(); this.cleanups.forEach((f) => { try { f(); } catch { /* ignore */ } }); this.cleanups = [];
    this.fxBg?.destroy(); this.fxTop?.destroy(); this.sound?.destroy(); this.mic?.stop(); this.root.replaceChildren(); this.root.className = "";
  }
}

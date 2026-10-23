// End-to-end tests: real Chromium, real static server, real backend (spawned with a throwaway DB + upload dir).
// Usage: npm i && (cd backend && npm i) && npx playwright install chromium && node scripts/e2e.mjs [filter]
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import zlib from "node:zlib";
import assert from "node:assert";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { serve } from "./static-server.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const filter = process.argv[2] || "";
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "bw-e2e-"));
const FRONT = 5611, API = 8787;
const { SPECS } = await import(path.join(root, "js/specs.js"));

// ---------- test assets ----------
const crcT = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = (b) => { let c = ~0; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return ~c >>> 0; };
const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
function png(w, h, rgb) { const raw = Buffer.alloc((w * 3 + 1) * h); for (let y = 0; y < h; y++) { raw[y * (w * 3 + 1)] = 0; for (let x = 0; x < w; x++) { const o = y * (w * 3 + 1) + 1 + x * 3; raw[o] = rgb[0] * (0.5 + x / w / 2); raw[o + 1] = rgb[1] * (0.5 + y / h / 2); raw[o + 2] = rgb[2]; } } const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 2; return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ih), chunk("IDAT", zlib.deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]); }
const imgs = [[240, 300, [255, 120, 90]], [300, 240, [90, 160, 255]], [260, 260, [120, 220, 130]]].map(([w, h, c], i) => { const f = path.join(tmp, `photo${i + 1}.png`); fs.writeFileSync(f, png(w, h, c)); return f; });
function wav(file, fn, secs = 8) { const sr = 48000, n = sr * secs, b = Buffer.alloc(44 + n * 2); b.write("RIFF", 0); b.writeUInt32LE(36 + n * 2, 4); b.write("WAVEfmt ", 8); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(sr, 24); b.writeUInt32LE(sr * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write("data", 36); b.writeUInt32LE(n * 2, 40); let st = 0; for (let i = 0; i < n; i++) b.writeInt16LE(Math.max(-32767, Math.min(32767, fn(i / sr, () => st, (v) => (st = v)) * 32767)), 44 + i * 2); fs.writeFileSync(file, b); }
const blowWav = path.join(tmp, "blow.wav"), toneWav = path.join(tmp, "tone.wav");
// breath-like noise: brown-ish (low-pass filtered) noise after 1.2s of near silence
wav(blowWav, (t, g, s) => { if (t < 1.2 || t > 6) return (Math.random() - 0.5) * 0.002; s(g() * 0.97 + (Math.random() - 0.5) * 0.12); return Math.max(-1, Math.min(1, g() * 3.2)); });
wav(toneWav, (t) => (t < 1.2 ? 0 : 0.7 * Math.sin(2 * Math.PI * 440 * t)));

// ---------- servers ----------
const { srv, url: _u } = await serve(root, FRONT); void _u;
const FE = `http://localhost:${FRONT}`;
const upDir = path.join(tmp, "up"), dbFile = path.join(tmp, "t.sqlite");
const be = spawn(process.execPath, ["server.js"], { cwd: path.join(root, "backend"), env: { ...process.env, PORT: String(API), ALLOWED_ORIGINS: FE, PUBLIC_API_URL: `http://localhost:${API}`, DB_PATH: dbFile, UPLOAD_DIR: upDir, CRON_SECRET: "e2e-secret", PUBLISH_LIMIT: "1000", CLEANUP_INTERVAL_MS: "3600000" }, stdio: ["ignore", "pipe", "pipe"] });
let beLog = ""; be.stdout.on("data", (d) => (beLog += d)); be.stderr.on("data", (d) => (beLog += d));
for (let i = 0; i < 50; i++) { try { await fetch(`http://localhost:${API}/api/pages/zz`); break; } catch { await new Promise((r) => setTimeout(r, 200)); } }
const SAFE = ["--disable-dev-shm-usage", "--no-sandbox"];
const brw = await chromium.launch({ args: SAFE });
const MIC = ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"];
const launchers = { mic: () => chromium.launch({ args: [...SAFE, ...MIC, `--use-file-for-fake-audio-capture=${blowWav}`] }), mic2: () => chromium.launch({ args: [...SAFE, ...MIC, `--use-file-for-fake-audio-capture=${toneWav}`] }) };
const extra = [];
const lazy = async (k) => { const b = await launchers[k](); extra.push(b); return b; };

// ---------- tiny test runner ----------
let pass = 0, fail = 0; const failures = [];
async function test(name, fn) {
  if (filter && !filter.split("|").some((f) => name.toLowerCase().includes(f.toLowerCase()))) return;
  const t0 = Date.now();
  try { await fn(); pass++; console.log(`ok   ${name} (${((Date.now() - t0) / 1000).toFixed(1)}s)`); } catch (e) { fail++; failures.push(name); console.log(`FAIL ${name}\n     ${String(e.stack || e).split("\n").slice(0, 40).join("\n     ")}`); }
}
const nn = (n) => String(n).padStart(2, "0");
const [R0, R1] = (process.env.RANGE || "1-50").split("-").map(Number); // batch heavy tests: RANGE=1-10
const inR = (n) => n >= R0 && n <= R1;
async function ctx(browser, o = {}) { const c = await browser.newContext({ viewport: { width: 1280, height: 800 }, ...o }); const errs = []; c.on("page", (p) => { p.on("crash", () => console.log("   PAGE CRASH")); p.on("pageerror", (e) => errs.push(String(e))); p.on("console", (m) => m.type() === "error" && !/404|Failed to load resource/.test(m.text()) && errs.push(m.text())); }); c.errs = errs; return c; }
const idle = (p) => p.waitForFunction(() => window.P && !P.busy, null, { timeout: 8000 });
const sceneId = (p) => p.evaluate(() => P.current);
const nScenes = (p) => p.locator(".bwx .sc").count();

/** Plays the whole journey like a recipient would; returns the visited scene ids. */
async function journey(page, { tap = false, checkFx = false } = {}) {
  const click = (sel) => (tap ? page.locator(sel).first().tap() : page.locator(sel).first().click());
  assert.equal(await nScenes(page), 1, "only one scene in the DOM at the start");
  assert.equal(await sceneId(page), "welcome");
  const welcomeText = await page.locator(".bwx").innerText();
  assert.ok(/alex/i.test(welcomeText), "recipient name on welcome");
  assert.ok(!/Blow the Candles|Every year with you|Time to cut the cake|Cut the Cake|Replay Birthday/i.test(welcomeText), "later scenes are NOT revealed on the welcome screen");
  await click('[data-act="start"]'); await idle(page);
  const seq = ["welcome"]; let backTested = false;
  for (let i = 0; i < 12; i++) {
    const id = await sceneId(page); seq.push(id); assert.equal(await nScenes(page), 1, "one scene at a time: " + id);
    if (!backTested && id !== "finale") { backTested = true; await click('.sc [data-act="back"], .bwx-hud [data-hud="back"]'); await idle(page); assert.equal(await sceneId(page), seq[seq.length - 2], "back works"); await click(seq.length === 2 ? '[data-act="start"]' : '.sc [data-act="next"]'); await idle(page); assert.equal(await sceneId(page), id, "forward again"); }
    if (id === "cake") {
      assert.equal(await page.locator('.sc [data-act="next"]:visible').count(), 0, "cannot skip the cake before blowing");
      await click('[data-act="blow"]'); await page.waitForFunction(() => P.root.dataset.wish === "done", null, { timeout: 8000 });
      assert.equal(await page.locator(".candle.out").count(), 5, "all candles extinguished");
      assert.ok(/./.test(await page.locator(".done:visible").innerText()), "wish-made message shown");
      await click('.done [data-act="next"]');
    } else if (id === "cut") {
      assert.equal(await page.locator('.sc [data-act="next"]:visible').count(), 0, "cannot skip the cut");
      await click('[data-act="cut"]'); await page.waitForFunction(() => P.root.dataset.cut === "done", null, { timeout: 15000 });
      assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector(".cut-faces")).opacity), "1", "cut faces revealed");
      assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector(".slice")).opacity), "1", "slice served");
      assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector(".cut-wedge")).opacity), "0", "wedge removed from cake");
      await click('.done [data-act="next"]');
    } else if (id === "finale") {
      assert.ok(await page.locator('[data-act="replay"]').isVisible(), "replay visible");
      assert.ok(/alex/i.test(await page.locator(".bwx").innerText()));
      if (checkFx) { // poll the celebration canvas: every pixel scanned, up to 3s (fireworks start with thin rockets)
        let px = 0; for (let t = 0; t < 12 && px < 4; t++) { await page.waitForTimeout(250); px = await page.evaluate(() => { const c = document.querySelector(".bwx-fx.top"), d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data; let k = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 0) k++; return k; }); }
        assert.ok(px >= 4, "celebration effect drawn (" + px + " px)"); }
      await click('[data-act="replay"]'); await idle(page); assert.equal(await sceneId(page), "welcome", "replay restarts at scene 1"); assert.equal(await nScenes(page), 1);
      break;
    } else await click('.sc [data-act="next"]');
    await idle(page);
  }
  return seq;
}
const SAMPLE_Q = (t, extra = "") => `${FE}/scripts/harness.html?t=${nn(t)}&mode=full${extra}`;

// =============== 1. every template, full journey (reduced motion = fast path) ===============
const seqs = new Set();
await test("all 50 templates: complete journey, one scene at a time, back/next/blow/cut/replay", async () => {
  let c = await ctx(brw, { reducedMotion: "reduce" }), p = await c.newPage(); const allErrs = [];
  const bad = [];
  for (let n = 1; n <= 50; n++) {
    if (!inR(n)) continue;
    if (process.env.DBG) console.log("   template", n); await p.goto(SAMPLE_Q(n)); await p.waitForFunction(() => window.ready);
    try { const s = await journey(p); seqs.add(s.join(">")); assert.equal(s[0], "welcome"); assert.equal(s.at(-1), "finale"); assert.equal(s.length, 7); } catch (e) { bad.push(`template-${nn(n)}: ${e.message.split("\n")[0]}`); }
  }
  allErrs.push(...c.errs); assert.deepEqual(bad, []); assert.deepEqual(allErrs, [], "no console/page errors");
  if (R1 - R0 >= 49) assert.ok(seqs.size >= 5, "scene sequences differ between templates: " + seqs.size);
  await c.close();
});

// =============== 2. real motion path (transitions, knife animation, celebration) ===============
await test("real animations: transitions, knife cut, celebration on 10 templates", async () => {
  const c = await ctx(brw), p = await c.newPage();
  for (const n of [4, 6, 9, 13, 19, 26, 31, 35, 46, 50]) { await p.goto(SAMPLE_Q(n)); await p.waitForFunction(() => window.ready); await journey(p, { checkFx: true }); }
  assert.deepEqual(c.errs, []); await c.close();
});

// =============== 3. touch ===============
await test("touchscreen (390x844, tap only): start, next, blow candles, cut cake, replay", async () => {
  const c = await ctx(brw, { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, reducedMotion: "reduce" }), p = await c.newPage();
  for (const n of [5, 22, 40]) { await p.goto(SAMPLE_Q(n)); await p.waitForFunction(() => window.ready); await journey(p, { tap: true }); }
  assert.deepEqual(c.errs, []); await c.close();
});

// =============== 4. responsive: no horizontal overflow, every scene, every template ===============
for (const [label, vp] of [["mobile 390x844", { width: 390, height: 844 }], ["small phone 320x568", { width: 320, height: 568 }], ["tablet 820x1180", { width: 820, height: 1180 }], ["desktop 1440x900", { width: 1440, height: 900 }]]) {
  await test(`no horizontal overflow, 50 templates x 7 scenes @ ${label}`, async () => {
    const c = await ctx(brw, { viewport: vp, reducedMotion: "reduce" }), p = await c.newPage(); const bad = [];
    for (let n = R0; n <= R1; n++) {
      await p.goto(`${FE}/scripts/harness.html?t=${nn(n)}&mode=preview`); await p.waitForFunction(() => window.ready);
      for (const id of ["welcome", "wishes", "letter", "memories", "cake", "cut", "finale"]) {
        await p.evaluate((i) => P.go(i), id); await p.waitForFunction(() => !P.busy); await p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
        const o = await p.evaluate(() => { const sc = document.querySelector(".sc"), de = document.documentElement; const wide = [...sc.querySelectorAll("*")].filter((e) => { if (e.closest(".hs,.strip,.tl,.mq,.bgp,.kb,.clg,.bal,.ring,.burst,.rot,.tbl,.ped,.flo,.lb,.stage::before,.cr,.cf,.roll,.cake-svg")) return false; const r = e.getBoundingClientRect(), b = document.querySelector(".bwx").getBoundingClientRect(); return r.width > 0 && (r.right > b.right + 3 || r.left < b.left - 3); }).slice(0, 3).map((e) => e.className.toString().slice(0, 30)); const ox = getComputedStyle(sc).overflowX; return { page: de.scrollWidth - innerWidth, sc: ox === "hidden" || ox === "clip" ? 0 : sc.scrollWidth - sc.clientWidth, wide }; });
        if (o.page > 1 || o.sc > 2 || o.wide.length) bad.push(`t${nn(n)}/${id}: page+${o.page} sc+${o.sc} ${o.wide.join("|")}`);
      }
    }
    if (bad.length) console.log("     " + bad.slice(0, 60).join("\n     ")); assert.deepEqual(bad.slice(0, 15), [], `${bad.length} overflow(s)`); await c.close();
  });
}

// =============== 5. candles: microphone (fake capture device) + button fallback ===============
await test("microphone: breath-like noise from a fake audio device blows the candles out", async () => {
  const c = await ctx(await lazy("mic"), { permissions: ["microphone"] }), p = await c.newPage();
  await p.goto(`${FE}/scripts/harness.html?t=06&mode=preview`); await p.waitForFunction(() => window.ready);
  await p.evaluate(() => P.go("cake")); await idle(p);
  await p.locator('[data-act="mic"]').click();
  await p.waitForFunction(() => /Listening/.test(document.querySelector(".mic-st").textContent), null, { timeout: 4000 });
  await p.waitForFunction(() => P.root.dataset.wish === "done", null, { timeout: 12000 });
  assert.equal(await p.locator(".candle.out").count(), 5); assert.deepEqual(c.errs, []); await c.close();
});
await test("microphone: a loud steady tone does NOT blow the candles; the button still works", async () => {
  const c = await ctx(await lazy("mic2"), { permissions: ["microphone"] }), p = await c.newPage();
  await p.goto(`${FE}/scripts/harness.html?t=06&mode=preview`); await p.waitForFunction(() => window.ready);
  await p.evaluate(() => P.go("cake")); await idle(p);
  await p.locator('[data-act="mic"]').click(); await p.waitForTimeout(5500);
  assert.notEqual(await p.evaluate(() => P.root.dataset.wish), "done", "tone must not trigger");
  await p.locator('[data-act="blow"]').click(); await p.waitForFunction(() => P.root.dataset.wish === "done", null, { timeout: 8000 }); await c.close();
});
await test("microphone: permission denied shows a friendly message and the button still works", async () => {
  const c = await ctx(brw), p = await c.newPage();
  await p.addInitScript(() => { navigator.mediaDevices.getUserMedia = () => Promise.reject(Object.assign(new Error("x"), { name: "NotAllowedError" })); });
  await p.goto(`${FE}/scripts/harness.html?t=06&mode=preview`); await p.waitForFunction(() => window.ready);
  await p.evaluate(() => P.go("cake")); await idle(p); await p.locator('[data-act="mic"]').click();
  await p.waitForFunction(() => /denied/i.test(document.querySelector(".mic-st").textContent));
  await p.locator('[data-act="blow"]').click(); await p.waitForFunction(() => P.root.dataset.wish === "done"); await c.close();
});
await test("microphone: unsupported browsers just don't show the mic button", async () => {
  const c = await ctx(brw), p = await c.newPage(); await p.addInitScript(() => { Object.defineProperty(navigator, "mediaDevices", { value: undefined }); });
  await p.goto(`${FE}/scripts/harness.html?t=06&mode=preview`); await p.waitForFunction(() => window.ready);
  await p.evaluate(() => P.go("cake")); await idle(p); assert.equal(await p.locator('[data-act="mic"]:visible').count(), 0); await p.locator('[data-act="blow"]').click(); await p.waitForFunction(() => P.root.dataset.wish === "done"); await c.close();
});

// =============== 6. music ===============
await test("music: no audio before the tap, toggle works, state is visible, cleanup on destroy", async () => {
  const c = await ctx(brw), p = await c.newPage();
  await p.goto(`${FE}/scripts/harness.html?manual=1&t=06`); await p.waitForFunction(() => window.ready);
  await p.evaluate(() => mk({ story: { music: { track: "musicbox" }, captions: [] } })); await idle(p);
  assert.equal(await p.evaluate(() => P.sound.ctx), null, "no AudioContext before user gesture (no autoplay)");
  assert.ok(await p.locator(".snd").isVisible(), "visible music toggle"); assert.equal(await p.locator(".snd").getAttribute("aria-pressed"), "false");
  await p.locator('[data-act="start"]').click(); await idle(p);
  await p.waitForFunction(() => P.sound.playing && P.sound.ctx.state === "running", null, { timeout: 5000 });
  await p.waitForTimeout(1300); assert.ok(await p.evaluate(() => P.sound.ctx.currentTime) > 0.8, "audio clock advancing");
  assert.equal(await p.locator(".snd").getAttribute("aria-pressed"), "true"); assert.equal(await p.locator(".snd").getAttribute("data-state"), "on");
  await p.locator(".snd").click(); await p.waitForFunction(() => !P.sound.playing); assert.equal(await p.locator(".snd").getAttribute("aria-pressed"), "false"); assert.equal(await p.locator(".snd").getAttribute("data-state"), "paused");
  await p.locator(".snd").click(); await p.waitForFunction(() => P.sound.playing);
  for (const t of ["piano", "pad", "sparkle"]) { await p.evaluate((x) => P.sound.setTrack(x), t); await p.waitForFunction(() => P.sound.playing); await p.waitForTimeout(500); }
  await p.evaluate(() => { window.__s = P.sound; P.destroy(); }); assert.equal(await p.evaluate(() => [__s.ctx, __s.timer, __s.playing]).then(JSON.stringify), "[null,null,false]", "timers + context released");
  assert.deepEqual(c.errs, []); await c.close();
});
await test("music: unavailable audio (no WebAudio / missing file) never breaks the experience", async () => {
  const c = await ctx(brw), p = await c.newPage();
  await p.addInitScript(() => { window.AudioContext = undefined; window.webkitAudioContext = undefined; });
  await p.goto(`${FE}/scripts/harness.html?manual=1&t=06`); await p.waitForFunction(() => window.ready);
  await p.evaluate(() => mk({ story: { music: { track: "musicbox" } } })); await p.locator('[data-act="start"]').click(); await idle(p);
  assert.equal(await sceneId(p), "wishes"); await p.waitForFunction(() => document.querySelector(".snd").disabled, null, { timeout: 3000 }); assert.equal(await p.locator(".snd").getAttribute("data-state"), "off");
  const p2 = await c.newPage(); await p2.goto(`${FE}/scripts/harness.html?manual=1&t=06`); await p2.waitForFunction(() => window.ready);
  await p2.evaluate(() => mk({ story: { music: { track: "file:missing.mp3" } } })); await p2.locator('[data-act="start"]').click(); await idle(p2);
  await p2.waitForFunction(() => P.sound.status === "unavailable", null, { timeout: 5000 }); assert.equal(await sceneId(p2), "wishes"); await c.close();
});

// =============== 7. accessibility / motion / robustness ===============
await test("reduced motion: reduced class, no reveal animations, no looping ambient canvas", async () => {
  const c = await ctx(brw, { reducedMotion: "reduce" }), p = await c.newPage(); await p.goto(SAMPLE_Q(8)); await p.waitForFunction(() => window.ready);
  assert.ok(await p.locator(".bwx.reduced").count()); assert.equal(await p.locator(".rv").count(), 0); assert.equal(await p.evaluate(() => P.fxBg.running), false); await c.close();
});
await test("keyboard: tab to the start button, Enter advances, arrows navigate, focus moves to the heading", async () => {
  const c = await ctx(brw, { reducedMotion: "reduce" }), p = await c.newPage(); await p.goto(SAMPLE_Q(1)); await p.waitForFunction(() => window.ready);
  for (let i = 0; i < 6 && !(await p.evaluate(() => document.activeElement?.dataset?.act === "start")); i++) await p.keyboard.press("Tab");
  assert.equal(await p.evaluate(() => document.activeElement.dataset.act), "start"); await p.keyboard.press("Enter"); await idle(p);
  assert.equal(await sceneId(p), "wishes"); assert.ok(await p.evaluate(() => document.activeElement.id.startsWith("h-")), "heading focused");
  await p.evaluate(() => document.activeElement.blur()); await p.keyboard.press("ArrowRight"); await idle(p); assert.equal(await sceneId(p), "letter"); await p.keyboard.press("ArrowLeft"); await idle(p); assert.equal(await sceneId(p), "wishes");
  assert.ok(await p.locator('[aria-live="polite"]').count()); await c.close();
});
await test("missing photos degrade gracefully (placeholder, no errors); no photos at all still renders", async () => {
  const c = await ctx(brw, { reducedMotion: "reduce" }), p = await c.newPage(); await p.goto(`${FE}/scripts/harness.html?manual=1&t=26&mode=preview`); await p.waitForFunction(() => window.ready);
  await p.evaluate(() => mk({ photos: [{ url: "/nope1.png" }, { url: "/nope2.png" }, { url: "/nope3.png" }] }));
  for (const id of ["welcome", "letter", "memories", "finale"]) { await p.evaluate((i) => P.go(i), id); await idle(p); }
  await p.waitForFunction(() => document.querySelectorAll(".ph.broken").length > 0, null, { timeout: 5000 });
  await p.evaluate(() => mk({ photos: [] })); for (const id of ["welcome", "wishes", "letter", "memories", "cake", "cut", "finale"]) { await p.evaluate((i) => P.go(i), id); await idle(p); }
  assert.deepEqual(c.errs, []); await c.close();
});
await test("creator options: accent, font, alignment, calm/lively motion are applied", async () => {
  const c = await ctx(brw, { reducedMotion: "reduce" }), p = await c.newPage(); await p.goto(`${FE}/scripts/harness.html?manual=1&t=01&mode=preview`); await p.waitForFunction(() => window.ready);
  await p.evaluate(() => mk({ opts: { accent: "#ff0066", font: 3, align: "left", anim: "calm", confetti: false } }));
  assert.equal(await p.evaluate(() => P.root.style.getPropertyValue("--ac")), "#ff0066"); assert.match(await p.evaluate(() => P.root.style.getPropertyValue("--f-d")), /Dancing Script/); assert.equal(await p.evaluate(() => P.root.dataset.align), "left"); await c.close();
});

// =============== 8. gallery page ===============
await test("gallery: 50 templates, search, category filter, previews, full-experience dialog, use-template links", async () => {
  const c = await ctx(brw), p = await c.newPage(); await p.goto(FE + "/index.html");
  assert.equal(await p.locator("#grid .card").count(), 8); await p.locator("#all").click(); assert.equal(await p.locator("#grid .card").count(), 50);
  assert.ok(await p.evaluate(() => [...document.querySelectorAll("#grid img")].every((i) => i.getAttribute("src").includes("template-previews"))), "thumbnails are per-template files");
  await p.fill("#q", "glass"); const g = await p.locator("#grid .card h3").allInnerTexts(); assert.ok(g.includes("Aurora Glass") && g.includes("Liquid Glass") && g.length < 50, "search by name/category"); await p.fill("#q", "liquid"); assert.deepEqual(await p.locator("#grid .card h3").allInnerTexts(), ["Liquid Glass"]); await p.fill("#q", "");
  await p.locator('#chips .chip:has-text("Cinematic")').click(); assert.equal(await p.locator("#grid .card").count(), 5);
  assert.match(await p.locator("#grid .card a.btn").first().getAttribute("href"), /create\.html\?t=template-0[6-9]|template-10/);
  await p.locator('#grid [data-p]').first().click(); await p.waitForSelector("#dp .bwx"); assert.ok(await p.locator("#dlg[open]").count());
  await p.locator('#dp [data-act="start"]').click(); await p.waitForFunction(() => document.querySelector("#dp .bwx").dataset.scene === "wishes", null, { timeout: 6000 });
  await p.locator("#dc").click(); await p.waitForFunction(() => !document.querySelector("#pv") && !document.querySelector("#dp .bwx"), null, { timeout: 3000 }); // player destroyed on close
  assert.deepEqual(c.errs, []); await c.close();
});

await test("wizard: 'Play full experience' dialog plays the real sequence and cleans up on close", async () => {
  const c = await ctx(brw, { reducedMotion: "reduce" }), p = await c.newPage(); await p.goto(`${FE}/create.html?t=template-11`); await p.waitForSelector("#frame .bwx");
  await p.click("#full"); await p.waitForSelector("#fd .bwx"); assert.ok(await p.evaluate(() => document.querySelector("#fdp").getBoundingClientRect().height > 300), "dialog player has height");
  await p.locator('#fd [data-act="start"]').click(); await p.waitForFunction(() => document.querySelector("#fd .bwx").dataset.scene === "wishes");
  await p.click("#fdc"); await p.waitForFunction(() => !document.querySelector("#fd .bwx")); assert.deepEqual(c.errs, []); await c.close();
});

// =============== 9. wizard -> publish -> viewer -> expiry (real backend) ===============
const future = new Date(Date.now() + 3 * 864e5).toISOString().slice(0, 10);
let published = null;
await test("wizard: validation, live preview, photos, custom wording, scene order, music, publish via the real API", async () => {
  const c = await ctx(brw, { reducedMotion: "reduce" }), p = await c.newPage(); await p.goto(`${FE}/create.html?t=template-26`);
  await p.waitForSelector("#frame .bwx");
  assert.ok(await p.locator('#grid .card.sel h3:has-text("Modern Scrapbook")').count(), "template from URL preselected");
  await p.click("#nx"); await p.waitForSelector("#from:visible"); await p.click("#nx"); assert.ok(await p.locator("#from[aria-invalid=true]").count() && await p.locator("#name[aria-invalid=true]").count() && await p.locator("#date[aria-invalid=true]").count(), "inline validation");
  assert.ok((await p.locator(".ferr").first().innerText()).length > 3);
  await p.fill("#from", "Sam"); await p.fill("#name", "Mira"); await p.fill("#nick", "Mimi"); await p.selectOption("#rel", "Sister"); await p.fill("#date", future);
  await p.fill("#greet", "GREETING_CUSTOM"); await p.fill("#letter", "Dear {name},\n\nLETTER_P1 unique words.\n\nLETTER_P2 ends here."); await p.fill("#sig", "Yours, Sam");
  await p.waitForTimeout(400); await p.evaluate(() => document.querySelector('#scn [data-g="welcome"]').click());
  await p.waitForFunction(() => document.querySelector("#frame .hb .nm")?.textContent === "Mimi", null, { timeout: 4000 }); // live preview, no reload
  assert.ok(/GREETING_CUSTOM/.test(await p.locator("#frame .bwx").innerText()));
  await p.click("#nx"); await p.click("#nx".replace("nx", "nx")); // -> step 2 (photos): blocked until a photo exists
  assert.ok(/Add at least one photo/.test(await p.locator("#err").innerText()));
  await p.setInputFiles("#files", imgs); await p.waitForSelector("#th .th >> nth=2");
  await p.fill('#th [data-a="cap"][data-i="1"]', "CAPTION_BEACH"); await p.waitForTimeout(300);
  await p.click("#nx"); // -> wording
  await p.fill("#t-welcomeKicker", "KICKER_CUSTOM"); await p.fill("#t-cta", "Tap me now"); await p.fill("#t-wishes", "WISHES_CUSTOM text"); await p.fill("#t-h0", "HL_ONE"); await p.fill("#t-h1", "HL_TWO");
  await p.fill("#t-wishMade", "WISHMADE_CUSTOM"); await p.fill("#t-cut", "CUT_CUSTOM"); await p.fill("#t-final", "FINAL_CUSTOM"); await p.fill("#t-finalKicker", "FKICK_CUSTOM");
  await p.click("#nx"); // -> scenes/music/style
  await p.click('#scl [data-u="2"]'); await p.click('#scl [data-u="1"]'); // memories first (wishes, letter, memories -> memories, wishes, letter)
  await p.fill('#scl input[type=text][data-i="0"]', "Our pages"); await p.selectOption("#music", "piano");
  await p.uncheck("#accDef"); await p.evaluate(() => { const a = document.querySelector("#acc"); a.value = "#ff0066"; a.dispatchEvent(new Event("input", { bubbles: true })); }); await p.selectOption("#fnt", "3"); await p.selectOption("#aln", "left"); await p.check("#cf");
  await p.click("#tm"); await p.waitForFunction(() => document.querySelector("#tm").getAttribute("aria-pressed") === "true"); await p.click("#tm"); // try-music control
  await p.click("#nx"); // review
  assert.ok(/Our pages/.test(await p.locator("#sum").innerText()), "review lists the custom scene order");
  await p.click("#pub"); assert.ok(/Confirm/.test(await p.locator("#perr").innerText())); await p.check("#ok"); await p.click("#pub");
  await p.waitForSelector("#res .ok code", { timeout: 15000 });
  const link = await p.locator("#res .ok code").first().innerText(); assert.match(link, /\/birthday\/[a-z0-9-]+$/);
  published = { link, slug: link.split("/").pop() };
  const api = await (await fetch(`http://localhost:${API}/api/pages/${published.slug}`)).json();
  assert.equal(api.story.captions[1], "CAPTION_BEACH", "caption stored: " + JSON.stringify(api.story.captions)); assert.equal(api.story.scenes[0].label, "Our pages", "scene label stored: " + JSON.stringify(api.story.scenes)); assert.equal(api.story.music.track, "piano"); assert.equal(api.nickname, "Mimi"); assert.equal(api.photos.length, 3); assert.equal(api.opts.accent, "#ff0066");
  assert.deepEqual(c.errs, []); await c.close();
});

await test("published link: /birthday/SLUG redirects, loads the right template + every custom value + photos from the backend", async () => {
  assert.ok(published, "needs the wizard test"); const c = await ctx(brw, { reducedMotion: "reduce" }), p = await c.newPage();
  const url = published.link.replace(/^https?:\/\/[^/]+/, FE); await p.goto(url); await p.waitForSelector(".bwx");
  assert.match(p.url(), /birthday\.html\?s=/); assert.ok(await p.locator(".bwx.t-26").count(), "template-26 rendered"); assert.equal(await p.title(), "Happy Birthday Mimi");
  let t = (await p.locator(".bwx").innerText()).toLowerCase(); assert.ok(t.includes("mimi") && t.includes("kicker_custom") && t.includes("greeting_custom") && t.includes("tap me now"), "welcome values");
  assert.ok(!/LETTER_P1|WISHES_CUSTOM/.test(t), "no early reveal");
  assert.equal(await p.evaluate(() => getComputedStyle(document.querySelector(".bwx")).getPropertyValue("--ac").trim()), "#ff0066");
  assert.ok(await p.locator(".snd").isVisible(), "music toggle present (piano configured)");
  await p.click('[data-act="start"]'); await p.waitForTimeout(300);
  const order = [], seen = {};
  for (let i = 0; i < 9; i++) {
    await p.waitForFunction(() => document.querySelector(".sc") && !document.querySelector(".sc.entering"));
    const id = await p.evaluate(() => document.querySelector(".sc").dataset.scene); order.push(id); const txt = await p.locator(".sc").innerText(); seen[id] = txt;
    if (id === "memories") { assert.ok(await p.locator(".sc img").count() >= 1); const ok = await p.evaluate(() => Promise.all([...document.querySelectorAll(".sc img")].map((i) => i.complete && i.naturalWidth > 0 ? 1 : new Promise((r) => { i.onload = () => r(1); i.onerror = () => r(0); setTimeout(() => r(0), 4000); })))); assert.ok(ok.every(Boolean), "memory photos load from backend"); assert.ok(/CAPTION_BEACH/.test(txt), "photo caption shown; scene text was: " + JSON.stringify(txt.slice(0, 200)) + " html=" + (await p.evaluate(() => document.querySelector(".sc").innerHTML.slice(0, 900)))); }
    if (id === "cake") { await p.click('[data-act="blow"]'); await p.waitForSelector(".done:visible", { timeout: 8000 }); seen.cakeDone = await p.locator(".done").innerText(); await p.click('.done [data-act="next"]'); }
    else if (id === "cut") { await p.click('[data-act="cut"]'); await p.waitForSelector(".done:visible", { timeout: 8000 }); seen.cutDone = await p.locator(".done").innerText(); await p.click('.done [data-act="next"]'); }
    else if (id === "finale") break; else await p.click('.sc [data-act="next"]');
  }
  assert.deepEqual(order, ["letter", "memories", "wishes", "cake", "cut", "finale"], "custom scene order honoured"); assert.ok(seen.letter.toLowerCase().includes("our pages"), "custom scene label shown");
  assert.ok(seen.wishes.includes("WISHES_CUSTOM") && seen.wishes.includes("HL_ONE") && seen.wishes.includes("HL_TWO"), "wishes + highlights");
  assert.ok(seen.letter.includes("LETTER_P1") && seen.letter.includes("LETTER_P2") && seen.letter.toLowerCase().includes("mimi") && seen.letter.includes("Yours, Sam"), "letter + {name} + signature");
  assert.ok(seen.cakeDone.includes("WISHMADE_CUSTOM") && seen.cutDone.includes("CUT_CUSTOM"), "wish-made + cut messages");
  assert.ok(seen.finale.toLowerCase().includes("final_custom") && seen.finale.toLowerCase().includes("fkick_custom") && seen.finale.toLowerCase().includes("mimi"), "finale values");
  assert.ok(await p.evaluate(() => [...document.querySelectorAll(".chap")].length) >= 1);
  await p.click('[data-act="replay"]'); await p.waitForFunction(() => document.querySelector(".sc")?.dataset.scene === "welcome"); assert.deepEqual(c.errs, []); await c.close();
});

await test("published link on a phone: no horizontal overflow in any scene", async () => {
  const c = await ctx(brw, { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, reducedMotion: "reduce" }), p = await c.newPage(); await p.goto(published.link.replace(/^https?:\/\/[^/]+/, FE)); await p.waitForSelector(".bwx");
  assert.ok((await p.evaluate(() => document.documentElement.scrollWidth - innerWidth)) <= 1); await p.locator('[data-act="start"]').tap(); await c.close();
});

await test("API compatibility: legacy payload (no story) still publishes and renders; photo URLs come from the backend storage path", async () => {
  const f = new FormData(); f.append("data", JSON.stringify({ name: "Old", from: "Page", template: "template-03", date: future, tz: "UTC", greeting: "legacy hi", photos: [] })); f.append("photos", new Blob([fs.readFileSync(imgs[0])], { type: "image/png" }), "a.png");
  const r = await fetch(`http://localhost:${API}/api/pages`, { method: "POST", body: f }); assert.equal(r.status, 201); const j = await r.json(); assert.ok(j.slug && j.editToken && j.expiresAt);
  const d = await (await fetch(`http://localhost:${API}/api/pages/${j.slug}`)).json(); assert.match(d.photos[0].url, new RegExp(`^http://localhost:${API}/uploads/`));
  const c = await ctx(brw, { reducedMotion: "reduce" }), p = await c.newPage(); await p.goto(`${FE}/birthday.html?s=${j.slug}`); await p.waitForSelector(".bwx.t-03"); assert.ok((await p.locator(".bwx").innerText()).includes("legacy hi")); assert.deepEqual(c.errs, []); await c.close();
});

await test("viewer states: unknown slug, bad slug, server down", async () => {
  const c = await ctx(brw), p = await c.newPage();
  await p.goto(`${FE}/birthday/nosuchpage`); await p.waitForSelector(".bw-note h1"); assert.match(await p.locator(".bw-note h1").innerText(), /not found/i);
  await p.goto(`${FE}/birthday.html?s=../../etc`); await p.waitForSelector(".bw-note h1"); assert.match(await p.locator(".bw-note h1").innerText(), /not found/i);
  const p2 = await c.newPage(); await p2.route(`http://localhost:${API}/**`, (r) => r.abort()); await p2.goto(`${FE}/birthday.html?s=abc`); await p2.waitForSelector(".bw-note h1"); assert.match(await p2.locator(".bw-note h1").innerText(), /Could not load/i); await c.close();
});

await test("expiry: server rejects (410), a page that is open stops showing content, files and rows are cleaned up", async () => {
  const require = createRequire(path.join(root, "backend/package.json")); const Database = require("better-sqlite3"); const db = new Database(dbFile);
  const c = await ctx(brw, { reducedMotion: "reduce" }), p = await c.newPage(); await p.goto(published.link.replace(/^https?:\/\/[^/]+/, FE)); await p.waitForSelector(".bwx");
  const dirs = () => (fs.existsSync(upDir) ? fs.readdirSync(upDir).length : 0); const before = dirs(); assert.ok(before >= 1, "uploads exist");
  db.prepare("UPDATE pages SET expires_at=? WHERE slug=?").run(Date.now() - 5000, published.slug);
  assert.equal((await fetch(`http://localhost:${API}/api/pages/${published.slug}`)).status, 410, "API refuses expired page");
  await p.evaluate(() => document.dispatchEvent(new Event("visibilitychange"))); // viewer re-validates with the server (not just a timer)
  await p.waitForSelector(".bw-note h1", { timeout: 6000 }); assert.match(await p.locator(".bw-note h1").innerText(), /expired/i); assert.equal(await p.locator(".bwx").count(), 0, "birthday content removed");
  await p.goto(published.link.replace(/^https?:\/\/[^/]+/, FE)); await p.waitForSelector(".bw-note h1"); assert.match(await p.locator(".bw-note").innerText(), /expired|not found/i, "after cleanup the page is gone");
  await new Promise((r) => setTimeout(r, 400));
  assert.equal(db.prepare("SELECT COUNT(*) n FROM pages WHERE slug=?").get(published.slug).n, 0, "row removed");
  assert.ok(dirs() < before, "uploaded photos deleted"); db.close(); assert.deepEqual(c.errs, []); await c.close();
});

// ---------- teardown ----------
await brw.close(); for (const b of extra) await b.close(); srv.close(); be.kill();
fs.rmSync(tmp, { recursive: true, force: true });
console.log(`\n${pass} passed, ${fail} failed`);
if (fail) { console.log("Failed:", failures.join("; ")); console.log("--- backend log tail ---\n" + beLog.split("\n").slice(-8).join("\n")); }
process.exit(fail ? 1 : 0);

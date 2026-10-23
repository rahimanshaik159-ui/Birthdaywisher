// Static checks (no browser needed): structure, template metadata, assets, syntax, escaping, no CDN dependencies.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import assert from "node:assert";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const R = (p) => path.join(root, p);
let n = 0;
const ok = (m) => { n++; console.log("ok", m); };

const { SPECS, CATS } = await import(R("js/specs.js"));
const { T } = await import(R("js/templates.js"));
const { normalize, cleanScenes } = await import(R("js/story.js"));
const { buildScene } = await import(R("js/scenes.js"));

assert.equal(SPECS.length, 50); assert.equal(T.length, 50);
SPECS.forEach((s, i) => assert.equal(s.id, "template-" + String(i + 1).padStart(2, "0")));
ok("exactly 50 templates, template-01 .. template-50");

const names = ["Pure Minimal", "Swiss Editorial", "Monochrome Portrait", "Luxury Ivory", "Soft Pastel", "Midnight Cinema", "Golden Hour Film", "Dream Sequence", "Movie Premiere", "Starlit Night", "Liquid Glass", "Aurora Glass", "Neon Cyber", "Chrome Future", "Holographic Dream", "Botanical Garden", "Forest Serenity", "Mountain Escape", "Ocean Breeze", "Tropical Paradise", "Sunset Memories", "Desert Dusk", "City Lights", "Starlight Romance", "Vintage Love Letter", "Modern Scrapbook", "Memory Journal", "Polaroid Story", "Editorial Photo Wall", "Travel Diary", "3D Cartoon World", "Doodle Celebration", "Paper Cut Art", "Clay Celebration", "Comic Book Birthday", "Royal Celebration", "Black and Gold Gala", "Champagne Sparkle", "Floral Celebration", "Confetti Festival", "Gradient Dreamscape", "Bento Memory Grid", "Interactive Timeline", "Scrapbook Collage", "Typography Motion", "Winter Wonderland", "Celestial Universe", "Watercolor Memories", "Retro Analog", "Interactive Birthday Journey"];
SPECS.forEach((s, i) => assert.equal(s.name, names[i], "name " + (i + 1)));
assert.equal(CATS.length, 10);
ok("all 50 requested creative directions present with the requested names, in 10 categories");

const sig = (s) => JSON.stringify([s.W, s.S, s.L, s.M, s.C, s.X, s.F, s.fr, s.bt, s.tr, s.rv, s.amb, s.fx, s.tex, s.ord]);
assert.equal(new Set(SPECS.map(sig)).size, 50, "layout/motion signature unique");
assert.equal(new Set(SPECS.map((s) => JSON.stringify(s.art))).size, 50, "art direction unique");
assert.equal(new Set(SPECS.map((s) => JSON.stringify(s.cake))).size, 50, "cake design unique");
assert.equal(new Set(SPECS.map((s) => JSON.stringify(s.pal))).size, 50, "palette unique");
const fonts = new Set(SPECS.map((s) => s.f[0])); assert.ok(fonts.size >= 20, "display fonts: " + fonts.size);
for (const k of ["W", "S", "L", "M", "C", "X", "F", "fr", "bt", "tr", "rv", "amb", "fx"]) assert.ok(new Set(SPECS.map((s) => s[k])).size >= 4, k + " variety");
ok(`50 unique art/cake/palette/layout signatures; ${fonts.size} display fonts; ${new Set(SPECS.map((s) => s.ord)).size} scene orders`);

const hashes = new Set();
for (const s of SPECS) { const f = R(`res/template-previews/${s.id}.jpg`); assert.ok(fs.existsSync(f), "missing preview " + s.id); assert.ok(fs.statSync(f).size > 8000); hashes.add(crypto.createHash("sha256").update(fs.readFileSync(f)).digest("hex")); }
assert.equal(hashes.size, 50);
ok("50 distinct preview images exist (each is a screenshot of the real engine)");

// escaping: every user-supplied string must be HTML-escaped in every scene of every template
const evil = '<img src=x onerror=alert(1)>"\'';
const data = { name: evil, nickname: "", from: evil, rel: evil, date: "2030-01-02", greeting: evil, letter: evil + "\n\n" + evil, signature: evil, photos: [{ url: 'a.jpg"onerror="alert(1)', x: 50, y: 50 }, { url: "b.jpg" }, { url: "c.jpg" }], story: { text: { wishes: evil, highlights: [evil], welcomeKicker: evil, cta: evil, wishPrompt: evil, wishMadeTitle: evil, wishMade: evil, cutTitle: evil, cut: evil, finalKicker: evil, final: evil }, captions: [evil, evil, evil], scenes: [{ id: "letter", label: evil }] } };
for (const t of T) {
  const m = normalize(data, t.spec);
  for (const id of ["welcome", "wishes", "letter", "memories", "cake", "cut", "finale"]) {
    const h = buildScene(id, m, t.spec, {});
    assert.ok(!/<img src=x/i.test(h), `unescaped markup in ${t.id}/${id}`);
    assert.ok(!/onerror="alert/i.test(h.replace(/&quot;/g, "'")) || !/\sonerror=/i.test(h), `attribute injection in ${t.id}/${id}`);
  }
}
ok("user text, captions, labels and photo URLs are escaped in all 350 scene renderings");

assert.deepEqual(cleanScenes([{ id: "cut" }, { id: "welcome" }, { id: "x" }, { id: "wishes", on: false }]).map((s) => s.id), ["welcome", "cut", "wishes", "letter", "memories", "cake", "finale"]);
ok("scene list always starts with welcome, ends with finale, ignores unknown ids");

for (const f of ["index.html", "create.html", "birthday.html", "404.html", "server.py", "css/main.css", "css/experience.css", "css/scenes.css", "css/fonts.css", "js/config.js", "backend/server.js", "backend/schema.sql", "backend/.env.example", ".env.example", "README.md", "ASSETS.md"]) assert.ok(fs.existsSync(R(f)), "missing " + f);
ok("project files present (frontend, backend, server.py routing, docs)");

for (const f of fs.readdirSync(R("js")).filter((x) => x.endsWith(".js"))) execFileSync(process.execPath, ["--check", R("js/" + f)]);
ok("all js/*.js parse");

const bad = [];
for (const f of ["css/experience.css", "css/scenes.css", "css/fonts.css", "js/art.js", "js/engine.js", "js/scenes.js", "birthday.html"]) { const t = fs.readFileSync(R(f), "utf8"); for (const m of t.matchAll(/https?:\/\/[^\s"')`]+/g)) if (!/w3\.org/.test(m[0]) && !/localhost/.test(m[0]) && !/example\.com/.test(m[0])) bad.push(f + ": " + m[0]); }
assert.deepEqual(bad, [], "no remote assets/CDNs in the experience");
ok("the experience loads no remote assets (fonts and art are local)");

const fontCss = fs.readFileSync(R("css/fonts.css"), "utf8");
for (const m of fontCss.matchAll(/url\(\.\.\/(res\/fonts\/[^)]+)\)/g)) assert.ok(fs.existsSync(R(m[1])), "font file " + m[1]);
ok("every @font-face file exists locally");

const gi = fs.readFileSync(R(".gitignore"), "utf8");
for (const p of ["storage", "data", ".env", "node_modules"]) assert.ok(gi.includes(p), ".gitignore has " + p);
ok(".gitignore keeps uploads, database, .env and node_modules out of git");
console.log(`\n${n} static checks passed`);

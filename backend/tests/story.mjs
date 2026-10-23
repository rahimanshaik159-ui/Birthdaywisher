// Tests for the multi-scene `story` payload. Runs against a throwaway DB and upload dir.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import assert from "node:assert";
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "bw-story-"));
Object.assign(process.env, { DB_PATH: tmp + "/t.sqlite", UPLOAD_DIR: tmp + "/up", CRON_SECRET: "s3cret", ALLOWED_ORIGINS: "http://x" });
const { app, db, cleanup, cleanStory } = await import("../server.js");
const srv = app.listen(0);
const B = `http://localhost:${srv.address().port}`;
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");
const fut = new Date(Date.now() + 3 * 864e5).toISOString().slice(0, 10);

// --- unit: cleanStory ---
let s = cleanStory({ scenes: [{ id: "letter", on: false, label: "  Hi  " }, { id: "bogus" }, { id: "letter" }, { id: "welcome" }, { id: "cut" }], text: { wishes: "  hello ", evil: "x", highlights: ["a", "", "b".repeat(100), 1, "c", "d", "e", "f", "g"] }, photos: { welcome: 9, wishes: 1, letter: [0, 0, 1, 2, 7, -1, 1.5], memories: [1, 2], finale: [2, 1, 0, 1] }, captions: ["A", "B".repeat(90), "C", "D"], music: { track: "../../etc/passwd" } }, 3);
assert.deepEqual(s.scenes.map((x) => x.id), ["letter", "cut"], "unknown/duplicate/fixed scene ids dropped");
assert.equal(s.scenes[0].on, false); assert.equal(s.scenes[0].label, "Hi");
assert.equal(s.text.wishes, "hello"); assert.ok(!("evil" in s.text));
assert.equal(s.text.highlights.length, 6); assert.ok(s.text.highlights.every((h) => h.length <= 40));
assert.equal(s.photos.welcome, null); assert.equal(s.photos.wishes, 1);
assert.deepEqual(s.photos.letter, [0, 1, 2], "indexes deduped, bounded, integer only");
assert.deepEqual(s.photos.finale, [2, 1, 0]);
assert.equal(s.captions.length, 3); assert.equal(s.captions[1].length, 60);
assert.equal(s.music.track, "none", "path-traversal style track name rejected");
assert.equal(cleanStory({ music: { track: "file:song.mp3" } }, 1).music.track, "file:song.mp3");
assert.equal(cleanStory(null, 1).v, 2); assert.equal(cleanStory([], 1).scenes.length, 0);
console.log("ok cleanStory unit");

// --- integration: publish -> fetch keeps story ---
const pub = (data, n = 3) => { const f = new FormData(); f.append("data", JSON.stringify({ name: "Mira", from: "Jo", template: "template-26", date: fut, tz: "Asia/Kolkata", photos: [], ...data })); for (let i = 0; i < n; i++) f.append("photos", new Blob([png]), `p${i}.png`); return fetch(B + "/api/pages", { method: "POST", body: f }); };
const story = { scenes: [{ id: "memories", on: true, label: "Our pages" }, { id: "wishes", on: true }, { id: "letter", on: false }, { id: "cake", on: true }, { id: "cut", on: true }], text: { wishes: "<script>x</script> Many happy returns", highlights: ["Joy", "Health"], cta: "Open it!", final: "The end" }, photos: { welcome: 2, letter: [1], memories: [1, 2], finale: [0] }, captions: ["Main", "Beach", "Cake"], music: { track: "musicbox" } };
let r = await pub({ story, letter: "Dear Mira", signature: "Jo" });
assert.equal(r.status, 201); const j = await r.json();
r = await fetch(`${B}/api/pages/${j.slug}`); assert.equal(r.status, 200);
const d = await r.json();
assert.equal(d.story.v, 2); assert.deepEqual(d.story.scenes.map((x) => x.id), ["memories", "wishes", "letter", "cake", "cut"]);
assert.equal(d.story.scenes[0].label, "Our pages"); assert.equal(d.story.scenes[2].on, false);
assert.equal(d.story.photos.welcome, 2); assert.deepEqual(d.story.photos.memories, [1, 2]);
assert.equal(d.story.text.cta, "Open it!"); assert.equal(d.story.music.track, "musicbox");
assert.equal(d.story.text.wishes, "<script>x</script> Many happy returns", "stored verbatim; the viewer escapes on render");
assert.equal(d.photos.length, 3); assert.equal(d.letter, "Dear Mira"); assert.equal(d.signature, "Jo");
console.log("ok story round-trip with 3 photos");

// photo index beyond uploaded count is dropped, not trusted
r = await pub({ story: { photos: { welcome: 5, memories: [0, 4] } } }, 1); const j2 = await r.json();
const d2 = await (await fetch(`${B}/api/pages/${j2.slug}`)).json();
assert.equal(d2.story.photos.welcome, null); assert.deepEqual(d2.story.photos.memories, [0]);
console.log("ok out-of-range photo indexes dropped");

// legacy payload (no story) still publishes and loads
r = await pub({}, 1); assert.equal(r.status, 201); const j3 = await r.json();
const d3 = await (await fetch(`${B}/api/pages/${j3.slug}`)).json(); assert.equal(d3.story.scenes.length, 0);
console.log("ok legacy payload without story");

// expiry still rejects + cleanup removes files for story pages
const id = d.photos[0].url.split("/uploads/")[1].split("/")[0];
assert.ok(fs.existsSync(path.join(tmp, "up", id)), "files exist before expiry");
db.prepare("UPDATE pages SET expires_at=? WHERE slug=?").run(Date.now() - 1000, j.slug);
assert.equal((await fetch(`${B}/api/pages/${j.slug}`)).status, 410);
assert.equal((await fetch(d.photos[0].url.replace(/^https?:\/\/[^/]+/, B))).status, 410, "photo also refused");
await new Promise((r) => setTimeout(r, 100)); // the 410 response schedules cleanup via setImmediate
cleanup();
assert.ok(!fs.existsSync(path.join(tmp, "up", id)), "files deleted by cleanup");
assert.equal(db.prepare("SELECT COUNT(*) n FROM pages WHERE slug=?").get(j.slug).n, 0);
console.log("ok expired story page rejected (410) and fully cleaned up");
srv.close(); fs.rmSync(tmp, { recursive: true, force: true });
console.log("story tests passed");

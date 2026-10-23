import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import assert from "node:assert";
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "bw-"));
Object.assign(process.env, {
  DB_PATH: tmp + "/t.sqlite",
  UPLOAD_DIR: tmp + "/up",
  CRON_SECRET: "s3cret",
  ALLOWED_ORIGINS: "http://x",
});
const { app, db, storage, cleanup, endOfDay } = await import("../server.js");
const srv = app.listen(0);
const B = `http://localhost:${srv.address().port}`;
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);
const fut = new Date(Date.now() + 2 * 864e5).toISOString().slice(0, 10);
const pub = (over = {}, img = png) => {
  const f = new FormData();
  f.append(
    "data",
    JSON.stringify({
      name: "Arun",
      from: "Sam",
      template: "template-06",
      date: fut,
      tz: "Asia/Kolkata",
      photos: [{ x: 50, y: 40 }],
      ...over,
    }),
  );
  f.append("photos", new Blob([img]), "a.png");
  return fetch(B + "/api/pages", { method: "POST", body: f });
};
let r = await pub();
assert.equal(r.status, 201);
const p = await r.json();
console.log("ok publish");
r = await pub();
const p2 = await r.json();
assert.notEqual(p.slug, p2.slug);
console.log("ok slug collision ->", p2.slug);
assert.equal((await pub({}, Buffer.from("not an image"))).status, 400);
console.log("ok rejects fake image");
assert.equal((await pub({ name: "" })).status, 400);
assert.equal((await pub({ date: "2020-01-01" })).status, 400);
console.log("ok validation");
r = await fetch(`${B}/api/pages/${p.slug}`);
const d = await r.json();
assert.equal(r.status, 200);
assert.equal((await fetch(B + new URL(d.photos[0].url).pathname)).status, 200);
console.log("ok serve page+photo");
assert.equal(
  endOfDay("2026-03-08", "America/New_York"),
  Date.UTC(2026, 2, 9, 3, 59, 59),
);
console.log("ok DST-day expiry");
db.prepare("UPDATE pages SET expires_at=? WHERE slug=?").run(
  Date.now() - 1000,
  p.slug,
);
const orig = storage.remove;
storage.remove = () => {
  throw Object.assign(new Error("x"), { code: "EBUSY" });
};
assert.equal((await fetch(`${B}/api/pages/${p.slug}`)).status, 410);
assert.equal((await fetch(B + new URL(d.photos[0].url).pathname)).status, 410);
console.log("ok expired -> 410 before cleanup runs");
let c = cleanup();
assert.ok(c.failed >= 1);
assert.equal(
  db.prepare("SELECT status FROM pages WHERE slug=?").get(p.slug).status,
  "deleting",
);
console.log("ok failed deletion kept for retry");
storage.remove = orig;
c = cleanup();
assert.equal(
  db.prepare("SELECT 1 FROM pages WHERE slug=?").get(p.slug),
  undefined,
);
assert.ok(!fs.existsSync(path.join(tmp, "up", p.id)));
console.log("ok retry deleted row + files");
const o = "a".repeat(32);
fs.mkdirSync(path.join(tmp, "up", o));
fs.utimesSync(path.join(tmp, "up", o), new Date(0), new Date(0));
cleanup();
assert.ok(!fs.existsSync(path.join(tmp, "up", o)));
console.log("ok orphan sweep");
assert.equal((await fetch(B + "/api/cleanup", { method: "POST" })).status, 401);
assert.equal(
  (
    await fetch(B + "/api/cleanup", {
      method: "POST",
      headers: { "x-cron-secret": "s3cret" },
    })
  ).status,
  200,
);
console.log("ok cleanup endpoint auth");
srv.close();
process.exit(0);

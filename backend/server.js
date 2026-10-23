import express from "express";
import cors from "cors";
import multer from "multer";
import rateLimit from "express-rate-limit";
import Database from "better-sqlite3";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const E = process.env,
  ROOT = path.resolve(E.UPLOAD_DIR || "./storage"),
  PUB = E.PUBLIC_API_URL || "https://birthdaywisher-api.onrender.com";
fs.mkdirSync(ROOT, { recursive: true });
fs.mkdirSync(path.dirname(path.resolve(E.DB_PATH || "./data/bw.sqlite")), {
  recursive: true,
});
export const db = new Database(E.DB_PATH || "./data/bw.sqlite");
db.exec(fs.readFileSync(new URL("./schema.sql", import.meta.url), "utf8"));
// Storage driver (local disk). Swap this object for S3/R2/Supabase to use object storage.
export const storage = {
  save(id, file, buf) {
    fs.mkdirSync(path.join(ROOT, id), { recursive: true });
    fs.writeFileSync(path.join(ROOT, id, file), buf);
  },
  remove(id) {
    fs.rmSync(path.join(ROOT, id), { recursive: true, force: true });
  },
  ids() {
    return fs
      .readdirSync(ROOT)
      .map((n) => ({
        id: n,
        age: Date.now() - fs.statSync(path.join(ROOT, n)).mtimeMs,
      }));
  },
  path: (id, f) => path.join(ROOT, id, f),
};
const log = (...a) => console.log(new Date().toISOString(), ...a); // never log content
const sha = (s) => crypto.createHash("sha256").update(s).digest("hex");
const MAGIC = (b) =>
  b[0] == 0xff && b[1] == 0xd8
    ? "jpg"
    : b.slice(0, 4).toString("hex") == "89504e47"
      ? "png"
      : b.slice(0, 4).toString() == "RIFF" &&
          b.slice(8, 12).toString() == "WEBP"
        ? "webp"
        : null;
function tzOffset(ms, tz) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hourCycle: "h23",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
    })
      .formatToParts(ms)
      .map((x) => [x.type, +x.value]),
  );
  return (
    Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) -
    Math.floor(ms / 1000) * 1000
  );
}
/** Policy: page expires at 23:59:59 on the birthday date in the chosen IANA timezone (DST-safe, offset resolved at that instant). */
export function endOfDay(date, tz) {
  const [y, m, d] = date.split("-").map(Number);
  let g = Date.UTC(y, m - 1, d, 23, 59, 59);
  g -= tzOffset(g, tz);
  g = Date.UTC(y, m - 1, d, 23, 59, 59) - tzOffset(g, tz);
  return g;
}
const str = (v, n) => (typeof v == "string" ? v.trim().slice(0, n) : "");
const TEXT_KEYS = { welcomeKicker: 80, cta: 40, wishes: 1500, wishPrompt: 300, wishMadeTitle: 80, wishMade: 400, cutTitle: 80, cut: 400, finalKicker: 80, final: 600 };
const MIDDLE = ["wishes", "letter", "memories", "cake", "cut"];
const TRACK_RE = /^(none|musicbox|piano|pad|sparkle|file:[A-Za-z0-9_.-]{1,60})$/;
/** Whitelists and clamps the multi-scene `story` object. Unknown keys are dropped; photo indexes must refer to uploaded photos. */
export function cleanStory(s, n) {
  s = s && typeof s == "object" && !Array.isArray(s) ? s : {};
  const t = s.text && typeof s.text == "object" ? s.text : {}, text = {};
  for (const [k, max] of Object.entries(TEXT_KEYS)) if (typeof t[k] == "string" && t[k].trim()) text[k] = str(t[k], max);
  if (Array.isArray(t.highlights)) text.highlights = t.highlights.map((h) => str(h, 40)).filter(Boolean).slice(0, 6);
  const seen = new Set(), scenes = [];
  for (const sc of Array.isArray(s.scenes) ? s.scenes : []) {
    if (!sc || !MIDDLE.includes(sc.id) || seen.has(sc.id)) continue;
    seen.add(sc.id); scenes.push({ id: sc.id, on: sc.on !== false, label: str(sc.label, 40) });
  }
  const idx = (v) => (Number.isInteger(v) && v >= 0 && v < n ? v : null);
  const list = (a, max) => [...new Set((Array.isArray(a) ? a : []).map(idx).filter((i) => i !== null))].slice(0, max);
  const p = s.photos && typeof s.photos == "object" ? s.photos : {};
  const photos = { welcome: idx(p.welcome), wishes: idx(p.wishes), letter: list(p.letter, 3), memories: list(p.memories, 10), finale: list(p.finale, 3) };
  const captions = Array.isArray(s.captions) ? s.captions.slice(0, n).map((c) => str(c, 60)) : [];
  const track = typeof s.music?.track == "string" && TRACK_RE.test(s.music.track) ? s.music.track : "none";
  return { v: 2, text, scenes, photos, captions, music: { track } };
}
export const app = express();
app.set("trust proxy", 1);
const origins = (E.ALLOWED_ORIGINS || "").split(",").filter(Boolean);
app.use(
  cors({
    origin: (o, cb) => cb(null, !o || origins.includes(o)),
    methods: ["GET", "POST", "DELETE"],
    allowedHeaders: ["x-edit-token", "x-cron-secret"],
  }),
);
app.use((q, r, n) => {
  r.set("X-Content-Type-Options", "nosniff");
  r.set("Cross-Origin-Resource-Policy", "cross-origin");
  n();
});
const up = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 10, fields: 5 },
});
const pubLimit = rateLimit({
  windowMs: 3600e3,
  limit: +E.PUBLISH_LIMIT || 10,
  standardHeaders: true,
});
const slugify = (s) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32) || "wish";
app.post("/api/pages", pubLimit, up.array("photos", 10), (q, r) => {
  let d;
  try {
    d = JSON.parse(q.body.data);
  } catch {
    return r.status(400).json({ error: "Invalid request data." });
  }
  const c = {
    name: str(d.name, 60),
    from: str(d.from, 60),
    rel: str(d.rel, 30),
    nickname: str(d.nickname, 40),
    greeting: str(d.greeting, 200),
    letter: str(d.letter, 3000),
    signature: str(d.signature, 80),
    template: str(d.template, 20),
    date: str(d.date, 10),
    tz: str(d.tz, 60),
    opts: {},
  };
  const errs = [];
  if (!c.name) errs.push("Birthday person's name is required.");
  if (!c.from) errs.push("Your name is required.");
  if (!/^template-(0[1-9]|[1-4]\d|50)$/.test(c.template))
    errs.push("Unknown template.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(c.date))
    errs.push("Birthday date is invalid.");
  try {
    new Intl.DateTimeFormat("en", { timeZone: c.tz });
  } catch {
    errs.push("Timezone is invalid.");
  }
  const o = d.opts || {};
  c.opts = {
    confetti: !!o.confetti,
    align: ["left", "center", "right"].includes(o.align) ? o.align : "center",
    anim: ["calm", "normal", "lively"].includes(o.anim) ? o.anim : "normal",
    font: Number.isInteger(o.font) && o.font >= 0 && o.font < 5 ? o.font : null,
    accent: /^#[0-9a-f]{6}$/i.test(o.accent || "") ? o.accent : null,
  };
  let exp = 0;
  if (!errs.length) {
    exp = endOfDay(c.date, c.tz);
    if (exp <= Date.now())
      errs.push("The birthday date has already passed in the chosen timezone.");
    if (exp > Date.now() + 366 * 864e5)
      errs.push("Birthday date must be within one year.");
  }
  const files = q.files || [];
  const meta = Array.isArray(d.photos) ? d.photos : [];
  if (!files.length) errs.push("Add at least one photo.");
  const exts = files.map((f) => MAGIC(f.buffer));
  if (exts.includes(null))
    errs.push("Only real JPEG, PNG or WebP images are accepted.");
  if (errs.length)
    return r.status(400).json({ error: errs.join(" "), errors: errs });
  const id = crypto.randomBytes(16).toString("hex"),
    token = crypto.randomBytes(24).toString("base64url");
  c.story = cleanStory(d.story, files.length);
  c.photos = files.map((f, i) => ({
    file: crypto.randomBytes(8).toString("hex") + "." + exts[i],
    x: Math.min(100, Math.max(0, +meta[i]?.x || 50)),
    y: Math.min(100, Math.max(0, +meta[i]?.y || 50)),
  }));
  try {
    c.photos.forEach((p, i) => storage.save(id, p.file, files[i].buffer));
  } catch (e) {
    try {
      storage.remove(id);
    } catch {}
    return r
      .status(500)
      .json({ error: "Storage failed. Nothing was published." });
  }
  let slug = slugify(c.name);
  for (let i = 0; i < 5; i++) {
    try {
      db.prepare(
        "INSERT INTO pages(id,slug,token_hash,data,tz,expires_at,created_at) VALUES(?,?,?,?,?,?,?)",
      ).run(id, slug, sha(token), JSON.stringify(c), c.tz, exp, Date.now());
      return r
        .status(201)
        .json({ slug, id, editToken: token, expiresAt: exp, tz: c.tz });
    } catch (e) {
      if (!String(e.code).includes("CONSTRAINT")) break;
      slug =
        slugify(c.name).slice(0, 27) +
        "-" +
        crypto.randomBytes(2).toString("hex");
    }
  }
  storage.remove(id);
  r.status(500).json({ error: "Could not create a unique link. Try again." });
});
const live = (slug) => {
  const row =
    /^[a-z0-9-]{1,40}$/.test(slug) &&
    db.prepare("SELECT * FROM pages WHERE slug=?").get(slug);
  return row && row;
};
app.get("/api/pages/:slug", (q, r) => {
  const row = live(q.params.slug);
  r.set("Cache-Control", "no-store");
  if (!row || row.status == "deleting")
    return r
      .status(row ? 410 : 404)
      .json({ error: row ? "expired" : "not_found" });
  if (row.expires_at <= Date.now()) {
    db.prepare("UPDATE pages SET status='expired' WHERE id=?").run(row.id);
    setImmediate(cleanup);
    return r.status(410).json({ error: "expired" });
  }
  const d = JSON.parse(row.data);
  d.photos = d.photos.map((p) => ({
    url: `${PUB}/uploads/${row.id}/${p.file}`,
    x: p.x,
    y: p.y,
  }));
  r.set(
    "Cache-Control",
    `private, max-age=${Math.min(60, Math.floor((row.expires_at - Date.now()) / 1000))}`,
  );
  r.json({ ...d, expiresAt: row.expires_at });
});
app.get("/uploads/:id/:file", (q, r) => {
  const { id, file } = q.params;
  if (
    !/^[a-f0-9]{32}$/.test(id) ||
    !/^[a-f0-9]{16}\.(jpg|png|webp)$/.test(file)
  )
    return r.sendStatus(404);
  const row = db
    .prepare("SELECT expires_at,status FROM pages WHERE id=?")
    .get(id);
  if (!row || row.status != "active" || row.expires_at <= Date.now())
    return r.sendStatus(410);
  r.set(
    "Cache-Control",
    `private, max-age=${Math.min(300, Math.floor((row.expires_at - Date.now()) / 1000))}`,
  );
  r.sendFile(
    storage.path(id, file),
    (e) => e && !r.headersSent && r.sendStatus(404),
  );
});
app.delete("/api/pages/:slug", (q, r) => {
  const row = live(q.params.slug);
  const t = q.get("x-edit-token") || "";
  if (!row || sha(t) !== row.token_hash)
    return r.status(404).json({ error: "not_found" });
  db.prepare("UPDATE pages SET status='expired',expires_at=? WHERE id=?").run(
    Date.now(),
    row.id,
  );
  cleanup();
  r.json({ ok: true });
});
/** Deletes expired pages' files first, then the row. Failed deletions keep the row (status 'deleting') and are retried every run. */
export function cleanup() {
  const now = Date.now();
  let done = 0,
    fail = 0;
  for (const row of db
    .prepare(
      "SELECT id,del_attempts FROM pages WHERE expires_at<=? OR status IN('expired','deleting')",
    )
    .all(now)) {
    try {
      storage.remove(row.id);
      db.prepare("DELETE FROM pages WHERE id=?").run(row.id);
      done++;
    } catch (e) {
      fail++;
      db.prepare(
        "UPDATE pages SET status='deleting',del_attempts=del_attempts+1 WHERE id=?",
      ).run(row.id);
      log(
        "cleanup failed",
        row.id,
        "attempt",
        row.del_attempts + 1,
        e.code || "ERR",
      );
    }
  }
  try {
    const known = new Set(
      db
        .prepare("SELECT id FROM pages")
        .all()
        .map((x) => x.id),
    );
    for (const { id, age } of storage.ids())
      if (/^[a-f0-9]{32}$/.test(id) && !known.has(id) && age > 600e3) {
        try {
          storage.remove(id);
          done++;
        } catch {
          fail++;
        }
      }
  } catch {}
  if (done || fail) log("cleanup", { deleted: done, failed: fail });
  return { deleted: done, failed: fail };
}
app.post("/api/cleanup", (q, r) => {
  const s = Buffer.from(q.get("x-cron-secret") || ""),
    k = Buffer.from(E.CRON_SECRET || "");
  if (!k.length || s.length !== k.length || !crypto.timingSafeEqual(s, k))
    return r.sendStatus(401);
  r.json(cleanup());
});
app.get("/api/health", (q, r) => r.json({ ok: true }));
app.use((e, q, r, n) =>
  r
    .status(e.code == "LIMIT_FILE_SIZE" ? 413 : 400)
    .json({
      error:
        e.code == "LIMIT_FILE_SIZE"
          ? "Each photo must be 5 MB or smaller."
          : "Upload rejected.",
    }),
);
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  setInterval(cleanup, +E.CLEANUP_INTERVAL_MS || 60000);
  cleanup();
  app.listen(+E.PORT || 8787, () => log("API on", E.PORT || 8787));
}

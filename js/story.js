// Shared data model for the multi-scene experience.
// The wizard, the gallery preview and the published viewer all pass raw page data through normalize().
// Old pages (published before multi-scene support, with no `story` key) still normalize correctly.

export const SCENES = ["welcome", "wishes", "letter", "memories", "cake", "cut", "finale"];
export const MIDDLE = ["wishes", "letter", "memories", "cake", "cut"];
export const SCENE_NAMES = {
  welcome: "Welcome",
  wishes: "Wishes",
  letter: "Letter",
  memories: "Memories",
  cake: "Cake & Candles",
  cut: "Cake Cutting",
  finale: "Finale",
};
export const TRACKS = {
  none: "No music",
  musicbox: "Music box (Happy Birthday melody)",
  piano: "Soft piano",
  pad: "Warm ambient pad",
  sparkle: "Sparkle bells",
};
export const TRACK_RE = /^(none|musicbox|piano|pad|sparkle|file:[A-Za-z0-9_.-]{1,60})$/;

export const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

/** Replace {name} {from} {rel} {date} tokens. Values are inserted raw: call esc() on the result. */
export const fill = (s, m) =>
  String(s ?? "").replace(/\{(name|from|rel|date)\}/g, (_, k) => ({ name: m.display, from: m.from, rel: m.rel, date: m.dateLabel })[k] || "");

export const DEFAULT_TEXT = {
  greeting: "Wishing you a day as special as you are.",
  wishes: "May your life be filled with happiness, good health and unforgettable memories. Keep smiling, keep believing in yourself, and keep shining.",
  highlights: ["More happiness", "Greater success", "Good health", "Always stay you"],
  letter:
    "Dear {name},\n\nToday is not just another day. It is a special day because someone truly special came into this world.\n\nYou bring joy and warmth into the lives of everyone around you, and I am lucky to have you. May this year bring you more happiness, new adventures and everything you dream of.\n\nOnce again, a very happy birthday!",
  wishPrompt: "Close your eyes, take a deep breath, make a wish… then blow out the candles.",
  wishMadeTitle: "Wish made!",
  wishMade: "May all your dreams come true, {name}.",
  cutTitle: "A slice for you",
  cut: "A sweet slice for a special person…",
  finalKicker: "Once again…",
  final: "Keep smiling. Stay happy always. Have an amazing year ahead!",
  cta: "Open Your Surprise",
};

const clip = (s, n) => (typeof s === "string" ? s.trim().slice(0, n) : "");
const idx = (v, n) => (Number.isInteger(v) && v >= 0 && v < n ? v : null);

/** Cleans scene list: welcome first, finale last, no duplicates, only known ids. */
export function cleanScenes(list, defaults = SCENES) {
  const seen = new Set(["welcome", "finale"]);
  const mid = [];
  const meta = {};
  for (const s of Array.isArray(list) ? list : []) {
    if (!s || !MIDDLE.includes(s.id) || seen.has(s.id)) continue;
    seen.add(s.id);
    meta[s.id] = { on: s.on !== false, label: clip(s.label, 40) };
    mid.push(s.id);
  }
  for (const id of defaults.filter((d) => MIDDLE.includes(d))) if (!seen.has(id)) { mid.push(id); meta[id] = { on: true, label: "" }; }
  return ["welcome", ...mid, "finale"].map((id) => ({ id, on: id === "welcome" || id === "finale" ? true : meta[id].on, label: meta[id]?.label || (id === "welcome" || id === "finale" ? "" : "") }));
}

export function normalize(d, spec) {
  d = d || {};
  const st = d.story || {};
  const tx = st.text || {};
  const photos = (d.photos || []).filter((p) => p && p.url);
  const n = photos.length;
  const display = clip(d.nickname, 40) || clip(d.name, 60) || "Name";
  let dateLabel = "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(d.date || "")) {
    try { dateLabel = new Date(d.date + "T12:00:00").toLocaleDateString(undefined, { day: "numeric", month: "long" }); } catch { /* ignore */ }
  }
  const m = { display, name: clip(d.name, 60) || "Name", from: clip(d.from, 60), rel: clip(d.rel, 30), dateLabel, date: d.date || "" };
  const t = (k, def) => fill(clip(tx[k], 1500) || def, m);
  const sceneList = cleanScenes(st.scenes, spec?.orderIds || SCENES);
  const lab = (id) => fill(sceneList.find((s) => s.id === id)?.label || (spec?.labels?.[id]) || SCENE_NAMES[id], m);
  const ph = (i) => (i == null || !photos[i] ? null : { ...photos[i], i, cap: clip((st.captions || [])[i], 60) });
  const pm = st.photos || {};
  const mainIdx = n ? 0 : null;
  const mem = (Array.isArray(pm.memories) && pm.memories.length ? pm.memories : n > 1 ? photos.map((_, i) => i).slice(1) : []).map((i) => idx(i, n)).filter((i) => i != null).slice(0, 10);
  const list = (a, fb) => (Array.isArray(a) && a.length ? a.map((i) => idx(i, n)).filter((i) => i != null).slice(0, 3) : fb);
  const hl = (Array.isArray(tx.highlights) ? tx.highlights : DEFAULT_TEXT.highlights).map((h) => fill(clip(h, 40), m)).filter(Boolean).slice(0, 6);
  const letterRaw = fill(clip(d.letter, 3000) || DEFAULT_TEXT.letter, m);
  return {
    ...m,
    greeting: fill(clip(d.greeting, 200) || DEFAULT_TEXT.greeting, m),
    welcomeKicker: fill(clip(tx.welcomeKicker, 80), m),
    cta: clip(tx.cta, 40),
    wishes: t("wishes", DEFAULT_TEXT.wishes),
    highlights: hl,
    letterParas: letterRaw.split(/\n{2,}|\n/).map((s) => s.trim()).filter(Boolean),
    sig: fill(clip(d.signature, 80) || (m.from ? "With love, " + m.from : ""), m),
    wishPrompt: t("wishPrompt", DEFAULT_TEXT.wishPrompt),
    wishMadeTitle: t("wishMadeTitle", DEFAULT_TEXT.wishMadeTitle),
    wishMade: t("wishMade", DEFAULT_TEXT.wishMade),
    cutTitle: t("cutTitle", DEFAULT_TEXT.cutTitle),
    cut: t("cut", DEFAULT_TEXT.cut),
    finalKicker: t("finalKicker", DEFAULT_TEXT.finalKicker),
    final: t("final", DEFAULT_TEXT.final),
    scenes: sceneList.filter((s) => s.on).map((s) => ({ id: s.id, label: lab(s.id) })),
    allScenes: sceneList.map((s) => ({ ...s, label: lab(s.id) })),
    photos: photos.map((_, i) => ph(i)),
    ph: {
      main: ph(mainIdx),
      welcome: ph(idx(pm.welcome, n) ?? mainIdx),
      wishes: ph(idx(pm.wishes, n)),
      letter: list(pm.letter, n > 1 ? [1, 2].filter((i) => i < n) : []).map(ph),
      memories: (mem.length ? mem : n ? [0] : []).map(ph),
      finale: list(pm.finale, [0, 1, 2].filter((i) => i < n)).map(ph),
    },
    music: TRACK_RE.test(st.music?.track || "") ? st.music.track : "none",
    opts: d.opts || {},
    effects: st.fx || {},
  };
}

/** Sample data for gallery/hero previews. Clearly labelled sample content, never published. */
export const SAMPLE = {
  name: "Alex",
  from: "Sam",
  rel: "Best Friend",
  date: "2026-12-05",
  greeting: "Wishing you a year as bright as you are.",
  letter: "Dear Alex,\n\nEvery year with you has made the days better. Thank you for the laughs, the late-night talks and for always showing up.\n\nThis is sample content. Add your own words and photos in the editor.\n\nHappy birthday!",
  signature: "Always yours, Sam",
  photos: [1, 2, 3, 4, 5, 6].map((n) => ({ url: `res/samples/sample-${n}.svg`, x: 50, y: 50 })),
  opts: {},
  story: { captions: ["Always you", "Good times", "Golden hour", "Road trip", "Little moments", "Together"] },
};

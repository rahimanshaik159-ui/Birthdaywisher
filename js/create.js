import { T, CATS } from "./templates.js";
import { Player } from "./engine.js";
import { Sound } from "./audio.js";
import { DEFAULT_TEXT, SCENE_NAMES, TRACKS } from "./story.js";
import { API_URL, BASE } from "./config.js";

const $ = (s) => document.querySelector(s), V = (id) => $("#" + id).value.trim();
const titles = ["Choose a template", "Personal details", "Photographs", "Wording for every scene", "Scenes, music & style", "Review and publish"];
const LAST = 5;
const S = {
  tpl: T.find((t) => t.id == new URLSearchParams(location.search).get("t")) || T[0],
  photos: [], step: 0, cat: "", q: "",
  published: false,
  assign: { welcome: null, wishes: null, letter: null, memories: null, finale: null }, // null = automatic arrangement
  scenes: null, scenesTouched: false, accTouched: false,
};
const resetScenes = () => (S.scenes = S.tpl.spec.orderIds.map((id) => ({ id, on: true, label: "" })));
resetScenes();

const tzs = [...new Set(["UTC", ...(Intl.supportedValuesOf ? Intl.supportedValuesOf("timeZone") : [])])];
const tzOk = (z) => { try { new Intl.DateTimeFormat("en", { timeZone: z }); return !!z; } catch { return false; } };
$("#tzs").innerHTML = tzs.map((z) => `<option>${z}`).join("");
$("#tz").value = Intl.DateTimeFormat().resolvedOptions().timeZone;
$("#acc").value = S.tpl.spec.pal[2].slice(0, 7);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

// ---------- suggested wording (editable; whatever is in the field is what gets published) ----------
const FIELDS = { wishes: "wishes", wishPrompt: "wishPrompt", wishMadeTitle: "wishMadeTitle", wishMade: "wishMade", cutTitle: "cutTitle", cut: "cut", finalKicker: "finalKicker", final: "final" };
function suggest(all) {
  $("#greet").value = DEFAULT_TEXT.greeting;
  $("#letter").value = DEFAULT_TEXT.letter;
  for (const k in FIELDS) $("#t-" + k).value = DEFAULT_TEXT[FIELDS[k]];
  DEFAULT_TEXT.highlights.concat(["", ""]).forEach((h, i) => ($("#t-h" + i).value = h));
  if (all) { $("#t-welcomeKicker").value = ""; $("#t-cta").value = ""; }
}
suggest(true);
const placeholders = () => { $("#t-welcomeKicker").placeholder = S.tpl.spec.kick.replace("{rel}", "friend").replace("{from}", "…"); $("#t-cta").placeholder = S.tpl.spec.cta; };
placeholders();
$("#rl").onclick = () => { $("#letter").value = DEFAULT_TEXT.letter; refresh(); };
$("#rt").onclick = () => { suggest(false); refresh(); };

// ---------- data ----------
const eff = {
  welcome: () => (S.assign.welcome ?? (S.photos.length ? 0 : null)),
  wishes: () => S.assign.wishes,
  letter: () => S.assign.letter ?? (S.photos.length > 1 ? [1, 2].filter((i) => i < S.photos.length) : []),
  memories: () => S.assign.memories ?? (S.photos.length > 1 ? S.photos.map((_, i) => i).slice(1) : []),
  finale: () => S.assign.finale ?? [0, 1, 2].filter((i) => i < S.photos.length),
};
function story() {
  const text = {};
  const add = (k, v) => { if (v) text[k] = v; };
  add("welcomeKicker", V("t-welcomeKicker")); add("cta", V("t-cta"));
  for (const k in FIELDS) add(k, V("t-" + k));
  text.highlights = [0, 1, 2, 3, 4, 5].map((i) => V("t-h" + i)).filter(Boolean);
  const photos = {};
  for (const k of Object.keys(S.assign)) if (S.assign[k] !== null) photos[k] = S.assign[k]; // only explicit choices are stored
  return { text, scenes: S.scenes.map(({ id, on, label }) => ({ id, on, label })), photos, captions: S.photos.map((p) => p.cap || ""), music: { track: $("#music").value || "none" } };
}
const data = () => ({
  name: V("name"), from: V("from"), rel: $("#rel").value, nickname: V("nick"), greeting: V("greet"), letter: $("#letter").value,
  signature: V("sig"), template: S.tpl.id, date: $("#date").value, tz: V("tz"),
  opts: { accent: $("#accDef").checked ? null : $("#acc").value, font: $("#fnt").value === "" ? null : +$("#fnt").value, align: $("#aln").value || "center", anim: $("#ani").value, confetti: $("#cf").checked },
  photos: S.photos.map((p) => ({ url: p.url, x: p.x, y: p.y })),
  story: story(),
});
function endOfDayLabel() {
  const d = $("#date").value, z = V("tz");
  if (!d) return "";
  try { new Intl.DateTimeFormat("en", { timeZone: z }); return `Expires at 23:59:59 on ${d} (${z}). After that the page and photos stop being served and are deleted.`; } catch { return "Choose a valid timezone."; }
}

// ---------- live preview (one Player, updated in place: no reloads) ----------
let player = null, tmr = 0;
function mountPlayer() { player?.destroy(); player = new Player($("#pl"), { template: S.tpl.id, data: data(), mode: "preview" }); scn(); }
function scn(active) {
  const cur = active || player.current;
  $("#scn").innerHTML = player.m.scenes.map((s) => `<button type="button" data-g="${s.id}" aria-pressed="${s.id == cur}">${esc(s.label)}</button>`).join("");
}
function refresh() {
  clearTimeout(tmr);
  tmr = setTimeout(() => { player.update({ template: S.tpl.id, data: data() }); scn(); $("#exp").textContent = endOfDayLabel(); }, 120);
}
$("#scn").onclick = (e) => { const b = e.target.closest("[data-g]"); if (!b) return; player.go(b.dataset.g); scn(b.dataset.g); };
$(".seg").onclick = (e) => {
  const b = e.target.closest("button[data-w]"); if (!b) return;
  $("#frame").className = "frame " + b.dataset.w; document.querySelectorAll(".seg [data-w]").forEach((x) => x.setAttribute("aria-pressed", x == b));
};
let fplayer = null;
$("#full").onclick = () => { $("#fd").showModal(); fplayer = new Player($("#fdp"), { template: S.tpl.id, data: data(), mode: "full" }); };
$("#fdc").onclick = () => $("#fd").close();
$("#fd").addEventListener("close", () => { fplayer?.destroy(); fplayer = null; });

// ---------- template grid ----------
function grid() {
  const l = T.filter((t) => (!S.cat || t.category == S.cat) && (t.name + " " + t.category).toLowerCase().includes(S.q));
  $("#grid").innerHTML = l.map((t) => `<article class="card ${t.id == S.tpl.id ? "sel" : ""}"><img src="${t.preview}" alt="${esc(t.name)} preview" loading="lazy" width="800" height="500"><div class="in"><h3>${esc(t.name)}</h3><small>${esc(t.category)}</small><div class="row"><button class="btn ${t.id == S.tpl.id ? "pri" : ""} sm" type="button" data-t="${t.id}" aria-pressed="${t.id == S.tpl.id}">${t.id == S.tpl.id ? "Selected" : "Use This Template"}</button></div></div></article>`).join("") || "<p>No template matches your search.</p>";
}
$("#chips").innerHTML = ["All", ...CATS].map((c, i) => `<button type="button" class="chip" aria-pressed="${!i}" data-c="${i ? c : ""}">${c}</button>`).join("");
$("#chips").onclick = (e) => { const b = e.target.closest(".chip"); if (!b) return; S.cat = b.dataset.c; [...$("#chips").children].forEach((x) => x.setAttribute("aria-pressed", x == b)); grid(); };
$("#q").oninput = (e) => { S.q = e.target.value.toLowerCase(); grid(); };
$("#grid").onclick = (e) => {
  const b = e.target.closest("[data-t]"); if (!b) return;
  S.tpl = T.find((t) => t.id == b.dataset.t);
  if (!S.scenesTouched) resetScenes();
  if (!S.accTouched) $("#acc").value = S.tpl.spec.pal[2].slice(0, 7);
  placeholders(); grid(); sceneList(); refreshNow();
};
function refreshNow() { clearTimeout(tmr); player.update({ template: S.tpl.id, data: data() }); scn(); }

// ---------- photos ----------
function thumbs() {
  $("#th").innerHTML = S.photos.map((p, i) => `<div class="th"><img src="${p.url}" alt="Photo ${i + 1}"><strong>${i ? "Photo " + (i + 1) : "Main portrait"}</strong><div class="row"><button type="button" data-a="up" data-i="${i}" aria-label="Move photo ${i + 1} earlier">Up</button><button type="button" data-a="dn" data-i="${i}" aria-label="Move photo ${i + 1} later">Down</button><button type="button" data-a="rm" data-i="${i}" aria-label="Remove photo ${i + 1}">Remove</button></div><label>Focus X<input type="range" data-a="x" data-i="${i}" value="${p.x}" aria-label="Horizontal focus, photo ${i + 1}"></label><label>Focus Y<input type="range" data-a="y" data-i="${i}" value="${p.y}" aria-label="Vertical focus, photo ${i + 1}"></label><input type="text" data-a="cap" data-i="${i}" value="${esc(p.cap || "")}" maxlength="60" placeholder="Caption (optional)" aria-label="Caption for photo ${i + 1}"></div>`).join("") || "<p>No photos yet. Add at least one to continue.</p>";
  assignUI(); refresh();
}
function ck(key, max) {
  const sel = new Set(eff[key]());
  return `<div class="ck" data-k="${key}">${S.photos.map((p, i) => `<label><input type="checkbox" value="${i}" ${sel.has(i) ? "checked" : ""} ${!sel.has(i) && sel.size >= max ? "disabled" : ""}><img src="${p.url}" alt="Photo ${i + 1}"><span>#${i + 1}</span></label>`).join("")}</div>`;
}
function assignUI() {
  if (!S.photos.length) { $("#asg").innerHTML = "<p>Add photos to choose where they appear.</p>"; return; }
  const opts = (sel, none) => (none ? `<option value="">None</option>` : "") + S.photos.map((_, i) => `<option value="${i}" ${sel === i ? "selected" : ""}>Photo ${i + 1}${i ? "" : " (main)"}</option>`).join("");
  $("#asg").innerHTML = `<div class="two"><div class="fld"><label for="as-welcome">Welcome portrait</label><select id="as-welcome">${opts(eff.welcome())}</select></div><div class="fld"><label for="as-wishes">Photo in the wishes scene</label><select id="as-wishes">${opts(eff.wishes(), true)}</select></div></div><p><strong>Letter photos</strong> (max 3)</p>${ck("letter", 3)}<p><strong>Memories gallery</strong> (max 10)</p>${ck("memories", 10)}<p><strong>Finale photos</strong> (max 3)</p>${ck("finale", 3)}<button class="btn sm" type="button" id="ra">Back to automatic arrangement</button>`;
}
$("#asg").addEventListener("change", (e) => {
  const t = e.target;
  if (t.id === "as-welcome") S.assign.welcome = +t.value;
  else if (t.id === "as-wishes") S.assign.wishes = t.value === "" ? null : +t.value;
  else if (t.type === "checkbox") { const g = t.closest("[data-k]"); S.assign[g.dataset.k] = [...g.querySelectorAll("input:checked")].map((c) => +c.value); assignUI(); }
  refresh();
});
$("#asg").addEventListener("click", (e) => { if (e.target.id === "ra") { for (const k in S.assign) S.assign[k] = null; assignUI(); refresh(); } });
$("#files").onchange = (e) => {
  const errs = [];
  for (const f of e.target.files) {
    if (!["image/jpeg", "image/png", "image/webp"].includes(f.type)) errs.push(`${f.name}: use JPEG, PNG or WebP.`);
    else if (f.size > 5 * 1024 * 1024) errs.push(`${f.name}: larger than 5 MB.`);
    else if (S.photos.length >= 10) errs.push("Maximum 10 photos.");
    else S.photos.push({ file: f, url: URL.createObjectURL(f), x: 50, y: 50, cap: "" });
  }
  e.target.value = ""; $("#err").textContent = errs.join(" "); thumbs();
};
const swapIdx = (i, j) => { for (const k of Object.keys(S.assign)) { const v = S.assign[k]; if (v === null) continue; const m = (x) => (x === i ? j : x === j ? i : x); S.assign[k] = Array.isArray(v) ? v.map(m) : m(v); } };
$("#th").addEventListener("click", (e) => {
  const b = e.target.closest("button"); if (!b) return;
  const i = +b.dataset.i, a = b.dataset.a;
  if (a == "rm") {
    URL.revokeObjectURL(S.photos[i].url); S.photos.splice(i, 1);
    for (const k of Object.keys(S.assign)) { const v = S.assign[k]; if (v === null) continue; S.assign[k] = Array.isArray(v) ? v.filter((x) => x !== i).map((x) => (x > i ? x - 1 : x)) : v === i ? null : v > i ? v - 1 : v; }
  } else { const j = a == "up" ? i - 1 : i + 1; if (S.photos[j]) { [S.photos[i], S.photos[j]] = [S.photos[j], S.photos[i]]; swapIdx(i, j); } }
  thumbs();
});
$("#th").addEventListener("input", (e) => {
  const r = e.target, i = +r.dataset.i; if (!S.photos[i]) return;
  if (r.type == "range") S.photos[i][r.dataset.a] = +r.value; else if (r.dataset.a == "cap") S.photos[i].cap = r.value;
  refresh();
});

// ---------- scenes ----------
function sceneList() {
  $("#scl").innerHTML = S.scenes.map((s, i) => `<li class="${s.on ? "" : "off"}"><span class="nm">${SCENE_NAMES[s.id]}</span><input type="text" data-i="${i}" value="${esc(s.label)}" placeholder="Name: ${esc(S.tpl.spec.labels[s.id] || SCENE_NAMES[s.id])}" maxlength="40" aria-label="Display name for ${SCENE_NAMES[s.id]} scene"><label><input type="checkbox" data-t="${i}" ${s.on ? "checked" : ""}> Show</label><button type="button" data-u="${i}" aria-label="Move ${SCENE_NAMES[s.id]} earlier" ${i ? "" : "disabled"}>↑</button><button type="button" data-d="${i}" aria-label="Move ${SCENE_NAMES[s.id]} later" ${i < S.scenes.length - 1 ? "" : "disabled"}>↓</button></li>`).join("");
}
$("#scl").addEventListener("click", (e) => {
  const b = e.target.closest("button"); if (!b) return;
  const i = +(b.dataset.u ?? b.dataset.d), j = b.dataset.u !== undefined ? i - 1 : i + 1;
  if (S.scenes[j]) { [S.scenes[i], S.scenes[j]] = [S.scenes[j], S.scenes[i]]; S.scenesTouched = true; sceneList(); refresh(); }
});
$("#scl").addEventListener("input", (e) => {
  const t = e.target;
  if (t.type === "text") S.scenes[+t.dataset.i].label = t.value; else if (t.dataset.t !== undefined) { S.scenes[+t.dataset.t].on = t.checked; t.closest("li").classList.toggle("off", !t.checked); }
  S.scenesTouched = true; refresh();
});
$("#rs").onclick = () => { resetScenes(); S.scenesTouched = false; sceneList(); refresh(); };

// ---------- music ----------
$("#music").innerHTML = Object.entries(TRACKS).map(([k, v]) => `<option value="${k}" ${k == "musicbox" ? "selected" : ""}>${v}</option>`).join("");
(async () => { // optional licensed files listed in res/audio/manifest.json
  try {
    const r = await fetch("res/audio/manifest.json"); if (!r.ok) return; const files = await r.json();
    if (Array.isArray(files)) $("#music").insertAdjacentHTML("beforeend", files.filter((f) => /^[A-Za-z0-9_.-]{1,60}$/.test(f.file || "")).map((f) => `<option value="file:${esc(f.file)}">${esc(f.title || f.file)} (your file)</option>`).join(""));
  } catch { /* optional */ }
})();
let tsound = null;
const stopTry = () => { tsound?.destroy(); tsound = null; $("#tm").textContent = "▶ Try this music"; $("#tm").setAttribute("aria-pressed", "false"); };
$("#tm").onclick = async () => {
  if (tsound) return stopTry();
  const t = $("#music").value; if (t === "none") { $("#tm").textContent = "No music selected"; return; }
  tsound = new Sound(); tsound.setTrack(t); const ok = await tsound.play();
  if (!ok) { stopTry(); $("#tm").textContent = "Music unavailable on this device"; return; }
  $("#tm").textContent = "■ Stop"; $("#tm").setAttribute("aria-pressed", "true");
};
$("#music").addEventListener("change", () => { stopTry(); refresh(); });
addEventListener("pagehide", () => { stopTry(); player?.destroy(); });

// ---------- form events ----------
$("#acc").addEventListener("input", () => { S.accTouched = true; $("#accDef").checked = false; });
$("#accDef").addEventListener("change", () => { if ($("#accDef").checked) { S.accTouched = false; $("#acc").value = S.tpl.spec.pal[2].slice(0, 7); } });
document.querySelector("#f").addEventListener("input", (e) => {
  clearErr(e.target);
  if (e.target.id != "files" && e.target.type != "range" && !e.target.closest("#scl") && !e.target.closest("#th")) refresh();
});

// ---------- validation with inline messages ----------
function clearErr(el) { if (!el || !el.id) return; el.removeAttribute("aria-invalid"); el.removeAttribute("aria-describedby"); document.getElementById("e-" + el.id)?.remove(); }
function bad(id, msg) {
  const el = $("#" + id); if (!el) return; clearErr(el); el.setAttribute("aria-invalid", "true"); el.setAttribute("aria-describedby", "e-" + id);
  const p = document.createElement("span"); p.className = "ferr"; p.id = "e-" + id; p.setAttribute("role", "alert"); p.textContent = msg; el.parentElement.appendChild(p);
}
function validate(s) {
  const e = [], fail = (id, m) => { e.push(m); bad(id, m); };
  if (s == 1) {
    if (!V("from")) fail("from", "Enter your name.");
    if (!V("name")) fail("name", "Enter the birthday person's name.");
    const d = $("#date").value;
    if (!d) fail("date", "Choose the birthday date."); else if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || isNaN(new Date(d + "T12:00:00"))) fail("date", "Birthday date is invalid.");
    else if (d < new Date(Date.now() - 864e5).toISOString().slice(0, 10)) fail("date", "Pick today or a future date: pages expire at the end of the birthday.");
    if (!tzOk(V("tz"))) fail("tz", "Enter a valid timezone, e.g. Asia/Kolkata or UTC.");
  }
  if (s == 2 && !S.photos.length) e.push("Add at least one photo.");
  return e;
}
function show(n) {
  S.step = n; document.querySelectorAll("[data-s]").forEach((x) => (x.hidden = +x.dataset.s != n));
  $("#st").textContent = titles[n]; [...$("#prog").children].forEach((l, i) => (l.className = i <= n ? "on" : ""));
  const nav = $("#wizard-nav");
  (n === 0 ? $(".template-toolbar") : document.querySelector(`[data-s="${n}"]`)).append(nav);
  $("#bk").hidden = false; $("#nx").hidden = n == LAST && !S.published; $("#err").textContent = ""; stopTry();
  if (n == LAST) {
    const d = data(), m = player.m;
    $("#sum").innerHTML = `<p><strong>${esc(S.tpl.name)}</strong> for ${esc(d.name)} from ${esc(d.from)} with ${S.photos.length} photo(s).</p><p>Scenes: ${m.scenes.map((s) => esc(s.label)).join(" → ")}.</p><p>Music: ${esc(TRACKS[d.story.music.track] || d.story.music.track)}.</p><p>${endOfDayLabel()}</p><p class="tag">Privacy: photos and text are stored on the BirthdayWisher backend until expiry, then deleted. Anyone with the link can view the page until then.</p><button class="btn pri" id="pub" type="button">Publish page</button>`;
  }
  scrollTo({ top: 0, behavior: "smooth" });
}
$("#nx").onclick = () => {
  if (S.step === LAST && S.published) {
    location.href = `${BASE}/index.html`;
    return;
  }
  const e = validate(S.step); if (e.length) { $("#err").textContent = e.join(" "); document.querySelector("[aria-invalid=true]")?.focus(); return; } show(S.step + 1);
};
$("#bk").onclick = () => {
  if (S.step === 0) {
    location.href = `${BASE}/index.html`;
    return;
  }
  if (S.step === LAST && S.published) {
    S.published = false;
    $("#res").replaceChildren();
    show(LAST);
    return;
  }
  show(S.step - 1);
};

// ---------- publish (API contract unchanged; `story` is an additive field) ----------
document.addEventListener("click", async (e) => {
  if (e.target.id != "pub") return;
  $("#perr").textContent = "";
  const e2 = [...validate(1), ...validate(2)];
  if (!$("#ok").checked) e2.push("Confirm that you want to publish.");
  if (e2.length) return ($("#perr").textContent = e2.join(" "));
  const b = e.target; b.disabled = true; b.textContent = "Publishing…";
  try {
    const fd = new FormData(); fd.append("data", JSON.stringify(data()));
    S.photos.forEach((p) => fd.append("photos", p.file));
    const r = await fetch(API_URL + "/api/pages", { method: "POST", body: fd });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || "Publishing failed.");
    const url = location.origin + BASE + "/birthday/" + j.slug;
    localStorage.setItem("bw-token-" + j.slug, j.editToken);
    $("#res").innerHTML = `<div class="ok"><h2>Published</h2><p>Your page is live:</p><code></code><p><button class="btn sm" id="cp" type="button">Copy link</button> <button class="btn sm" id="sh" type="button">Share</button> <a class="btn pri sm" target="_blank" rel="noopener">Open page</a></p><p>Expires: ${new Date(j.expiresAt).toLocaleString([], { timeZone: j.tz, timeZoneName: "short" })}.</p><p class="tag">Edit token (keep private, deletes the page early): <code></code></p></div>`;
    const [c1, c2] = $("#res").querySelectorAll("code"); c1.textContent = url; c2.textContent = j.editToken; $("#res a.btn").href = url;
    $("#cp").onclick = async () => { await navigator.clipboard.writeText(url); $("#cp").textContent = "Copied"; };
    if (navigator.share) $("#sh").onclick = () => navigator.share({ title: "Happy birthday!", text: V("share") || "Something for you:", url }); else $("#sh").hidden = true;
    S.published = true; b.hidden = true; $("#bk").hidden = false; $("#nx").hidden = false; $("#nx").textContent = "Next";
  } catch (x) {
    $("#perr").innerHTML = '<div class="bad"></div>';
    $("#perr div").textContent = x.message == "Failed to fetch" ? "Cannot reach the publishing server. Nothing was published. Check your connection or the API URL." : x.message;
    b.disabled = false; b.textContent = "Publish page";
  }
});

grid(); sceneList(); thumbs(); show(0); mountPlayer();

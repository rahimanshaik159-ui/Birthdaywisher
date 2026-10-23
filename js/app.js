import { T, CATS } from "./templates.js";
import { SAMPLE } from "./story.js";
const $ = (s) => document.querySelector(s);
let cat = "", q = "", sort = "n", all = false, player = null, last = null;
$("#menu").onclick = (e) => { const o = $("#links").classList.toggle("open"); e.target.setAttribute("aria-expanded", o); };
$("#links").onclick = () => $("#links").classList.remove("open");
$("#chips").innerHTML = ["All", ...CATS].map((c, i) => `<button class="chip" aria-pressed="${i == 0}" data-c="${i ? c : ""}">${c}</button>`).join("");
$("#chips").onclick = (e) => { const b = e.target.closest(".chip"); if (!b) return; cat = b.dataset.c; all = true; [...$("#chips").children].forEach((x) => x.setAttribute("aria-pressed", x == b)); draw(); };
$("#q").oninput = (e) => { q = e.target.value.toLowerCase().trim(); all = true; draw(); };
$("#sort").onchange = (e) => { sort = e.target.value; draw(); };
$("#all").onclick = () => { all = !all; draw(); };
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
function draw() {
  let l = T.filter((t) => (!cat || t.category == cat) && (t.name + " " + t.category).toLowerCase().includes(q));
  if (sort == "a") l = [...l].sort((a, b) => a.name.localeCompare(b.name));
  const filtered = cat || q, shown = all || filtered ? l : l.slice(0, 8);
  $("#empty").hidden = l.length > 0;
  $("#all").textContent = all || filtered ? "Show fewer" : "View All 50 Templates";
  $("#all").hidden = !!filtered;
  $("#grid").innerHTML = shown.map((t) => `<article class="card"><img src="${t.preview}" alt="${esc(t.name)} preview: welcome scene" loading="lazy" width="800" height="500"><div class="in"><h3>${esc(t.name)}</h3><small>${esc(t.category)} · ${t.scenes.length + 2} scenes</small><span>${esc(t.description)}</span><div class="row"><button class="btn sm" data-p="${t.id}" type="button">Preview Experience</button><a class="btn pri sm" href="create.html?t=${t.id}">Use This Template</a></div></div></article>`).join("");
}
async function open(id, trigger) {
  const t = T.find((x) => x.id == id); last = trigger;
  $("#dn").textContent = t.name + " (sample content)";
  $("#du").href = "create.html?t=" + t.id;
  $("#dseq").textContent = "Scene sequence: Welcome → " + t.scenes.map((s) => t.spec.labels[s] || s).join(" → ") + " → Finale. Try the buttons: candles, cake and the final replay are all interactive.";
  $("#dp").innerHTML = '<div class="pv"><div id="pv" style="width:100%;height:100%"></div></div>';
  $("#dlg").showModal();
  const { Player } = await import("./engine.js");
  player?.destroy();
  player = new Player($("#pv"), { template: t.id, data: SAMPLE, mode: "full" });
}
function close() { player?.destroy(); player = null; $("#dp").innerHTML = ""; last?.focus?.(); }
$("#grid").onclick = (e) => { const b = e.target.closest("[data-p]"); if (b) open(b.dataset.p, b); };
$("#dc").onclick = () => $("#dlg").close();
$("#dlg").addEventListener("close", close);
draw();

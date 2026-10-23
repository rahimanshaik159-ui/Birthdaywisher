// Scene markup. Each scene id has several layout variants; a template picks one per scene through its spec
// (W,S,L,M,C,X,F). Markup is plain HTML strings with all user text escaped. Behaviour lives in engine.js.
import { esc as E } from "./story.js";
import { cakeSVG } from "./cake.js";

let U = 0;
const sc = (n) => Array.from({ length: n }, (_, i) => i);
const rnd = (i, k) => { const x = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453; return x - Math.floor(x); };
/** Deterministic scatter positions for n items (percent coordinates). */
export function scatter(n) {
  // cell-centre positions in % of the board, plus rows/cols; CSS sizes each item from the board's real size (container units)
  const cols = Math.ceil(Math.sqrt(n * 1.5)), rows = Math.ceil(n / cols), out = [];
  for (let i = 0; i < n; i++) { const c = i % cols, r = Math.floor(i / cols); out.push({ x: ((c + 0.5) / cols) * 100 + (rnd(i, 1) - 0.5) * 3, y: ((r + 0.5) / rows) * 100 + (rnd(i, 2) - 0.5) * 2, r: (rnd(i, 3) - 0.5) * 14, cols, rows }); }
  return out;
}

export function buildScene(id, m, spec, o = {}) {
  const P = (p, cls = "", cap = true) => (p ? `<figure class="ph fr-${spec.fr} ${cls}"><i class="d1"></i><i class="d2"></i><img src="${E(p.url)}" alt="${E(p.cap || "Photo of " + m.display)}" loading="lazy" decoding="async" draggable="false" style="object-position:${+p.x || 50}% ${+p.y || 50}%">${cap && p.cap ? `<figcaption>${E(p.cap)}</figcaption>` : ""}</figure>` : `<figure class="ph fr-${spec.fr} ${cls} empty"><i class="d1"></i><i class="d2"></i><span>Your photo</span></figure>`);
  const nm = E(m.display), name = nm;
  const kickRaw = m.welcomeKicker || (/\{rel\}/.test(spec.kick) && !m.rel ? "A birthday surprise" : spec.kick.replace("{rel}", m.rel.toLowerCase()).replace("{from}", m.from || "someone special").replace("{name}", m.display));
  const kick = E(kickRaw);
  const nav = (next = "Next", extra = "") => `<div class="nv">${o.first ? "" : `<button type="button" class="bt back" data-act="back" aria-label="Previous scene"><span aria-hidden="true">←</span><span class="sr">Back</span></button>`}${extra}<button type="button" class="bt main" data-act="next">${E(next)} <span aria-hidden="true">→</span></button></div>`;
  const hb = `<h1 class="hb" id="h-${id}"><span class="a" data-rv>Happy Birthday</span><span class="nm" data-rv>${nm}</span></h1>`;
  const h2 = `<h2 class="hb2" id="h-${id}"><span data-rv>Happy Birthday,</span> <em data-rv>${nm}</em></h2>`;
  const main = m.ph.welcome, day = /^\d{4}-\d{2}-(\d{2})/.exec(m.date)?.[1];
  const hl = m.highlights, wmsg = `<p class="pr" data-rv>${E(m.wishes)}</p>`;
  const memo = m.ph.memories, wph = m.ph.wishes || main;
  const cap = (p, i) => (p?.cap ? E(p.cap) : "Memory " + (i + 1));
  const stageDeco = (v) => (v === "table" ? `<div class="tbl" aria-hidden="true"></div>` : v === "spot" ? `<div class="ped" aria-hidden="true"></div>` : v === "float" ? `<div class="flo" aria-hidden="true"><i></i><i></i><i></i></div>` : "");
  const sig = m.sig ? `<p class="sig" data-rv>${E(m.sig)}</p>` : "";
  const ps = m.letterParas.map((p) => `<p data-rv>${E(p)}</p>`).join("");
  const lph = m.ph.letter.map((p) => P(p, "sm", false)).join("");
  const ring = (t) => { const i = ++U; return `<svg class="ring" viewBox="0 0 400 400" aria-hidden="true"><defs><path id="rp${i}" d="M200,200m-172,0a172,172 0 1,1 344,0a172,172 0 1,1 -344,0"/></defs><text><textPath href="#rp${i}" textLength="1070" lengthAdjust="spacing">${E(t)}</textPath></text></svg>`; };

  const W = {
    type: () => `<div class="tx"><p class="k" data-rv>${kick}</p>${P(main, "sm", false)}${hb}<p class="pr" data-rv>${E(m.greeting)}</p>${CTA()}</div>`,
    split: () => `<div class="tx"><p class="k" data-rv>${kick}</p>${hb}<p class="pr" data-rv>${E(m.greeting)}</p>${CTA()}</div><div class="col">${P(main, "tall", false)}</div>`,
    arch: () => `<div class="col">${P(main, "hero", false)}</div><div class="tx"><p class="k" data-rv>${kick}</p>${hb}<p class="pr" data-rv>${E(m.greeting)}</p>${CTA()}</div>`,
    bleed: () => `<div class="bgp">${main ? `<img src="${E(main.url)}" alt="" decoding="async" style="object-position:${+main.x || 50}% ${+main.y || 50}%">` : ""}</div><div class="tx"><p class="k" data-rv>${kick}</p>${hb}<p class="pr" data-rv>${E(m.greeting)}</p>${CTA()}</div>`,
    orbit: () => `<div class="orb">${ring(`HAPPY BIRTHDAY • ${m.display.toUpperCase()} • HAPPY BIRTHDAY • ${m.display.toUpperCase()} • `)}${P(main, "round", false)}</div><div class="tx"><p class="k" data-rv>${kick}</p>${hb}<p class="pr" data-rv>${E(m.greeting)}</p>${CTA()}</div>`,
    drop: () => `<div class="col">${P(main, "pol", true)}</div><div class="tx"><p class="k" data-rv>${kick}</p>${hb}<p class="pr" data-rv>${E(m.greeting)}</p>${CTA()}</div>`,
    title: () => `<i class="lb t"></i><i class="lb b"></i><div class="tx"><p class="k" data-rv>${kick}</p>${hb}<p class="cred" data-rv>starring <b>${nm}</b>${m.from ? ` · with ${E(m.from)}` : ""}</p><p class="pr" data-rv>${E(m.greeting)}</p>${CTA()}</div><div class="col">${P(main, "tall", false)}</div>`,
    glass: () => `<div class="bgp blur">${main ? `<img src="${E(main.url)}" alt="" decoding="async">` : ""}</div><div class="glc"><div class="col">${P(main, "sm", false)}</div><div class="tx"><p class="k" data-rv>${kick}</p>${hb}<p class="pr" data-rv>${E(m.greeting)}</p>${CTA()}</div></div>`,
    ticket: () => `<div class="tkt"><div class="mn"><p class="k" data-rv>${kick}</p>${hb}<p class="pr" data-rv>${E(m.greeting)}</p>${CTA()}</div><div class="stub">${P(main, "sm", false)}<b>ADMIT ONE</b><span>${E(m.dateLabel || "Birthday")}</span></div></div>`,
    poster: () => `<div class="pst"><div class="big" aria-hidden="true">${day ? +day : "★"}</div><div class="tx"><p class="k" data-rv>${kick}${m.dateLabel ? ` · ${E(m.dateLabel)}` : ""}</p>${hb}<p class="pr" data-rv>${E(m.greeting)}</p>${CTA()}</div><div class="col">${P(main, "tall", false)}</div></div>`,
    sticker: () => `<div class="stk"><i class="burst" aria-hidden="true"></i>${P(main, "round", false)}</div><div class="tx"><p class="k" data-rv>${kick}</p>${hb}<p class="pr" data-rv>${E(m.greeting)}</p>${CTA()}</div>`,
    stack: () => `<div class="cards3">${[2, 1, 0].map((k) => P(m.photos[k] || (k ? null : main), "c c" + k, false)).join("")}</div><div class="tx"><p class="k" data-rv>${kick}</p>${hb}<p class="pr" data-rv>${E(m.greeting)}</p>${CTA()}</div>`,
  };
  function CTA() { return `<button type="button" class="bt main cta" data-act="start"><span>${E(m.cta || spec.cta)}</span></button>`; }

  const hlLi = (cls = "") => `<ul class="hl ${cls}">${hl.map((h, i) => `<li style="--i:${i}"><span data-rv>${E(h)}</span></li>`).join("")}</ul>`;
  const S = {
    quote: () => `<div class="tx">${h2}<p class="big" data-rv>${E(m.wishes)}</p>${hlLi("chips")}${nav()}</div>`,
    lines: () => `<div class="tx"><p class="k">${E(m.allScenes.find((s) => s.id === "wishes")?.label || "Wishes")}</p>${h2}${wmsg}${hlLi("chips")}${nav()}</div>`,
    photolist: () => `<div class="col">${P(wph, "tall")}</div><div class="tx">${h2}${wmsg}<ol class="hl num">${hl.map((h, i) => `<li style="--i:${i}"><span data-rv>${E(h)}</span></li>`).join("")}</ol>${nav()}</div>`,
    cols: () => `<div class="ca"><p class="k">${E(m.allScenes.find((s) => s.id === "wishes")?.label || "Wishes")}</p>${h2}</div><div class="cb">${wmsg}${hlLi("idx")}${nav()}</div>`,
    marquee: () => `<div class="mq" aria-hidden="true"><span>${`${nm} ★ HAPPY BIRTHDAY ★ `.repeat(6)}</span><span>${`HAPPY BIRTHDAY ★ ${nm} ★ `.repeat(6)}</span></div><div class="glc tx">${h2}${wmsg}${hlLi("chips")}${nav()}</div>`,
    bubbles: () => `<div class="tx">${h2}<div class="bub big-b"><p data-rv>${E(m.wishes)}</p></div><div class="bubs">${hl.map((h, i) => `<span class="bub b${i % 3}" style="--i:${i}">${E(h)}</span>`).join("")}</div>${nav()}</div>`,
    glass: () => `<div class="glc tx">${h2}${wmsg}${hlLi("pills")}${nav()}</div>`,
    ribbon: () => `<div class="tx"><div class="rib">${h2}</div>${wmsg}${hlLi("stars")}${nav()}</div>`,
    cards: () => `<div class="tx">${h2}${wmsg}<div class="deck">${hl.map((h, i) => `<div class="cd" style="--i:${i};--n:${hl.length}"><b>${String(i + 1).padStart(2, "0")}</b><span>${E(h)}</span></div>`).join("")}</div>${nav()}</div>`,
    term: () => `<div class="trm"><p class="ln" data-rv>$ wish --for "${nm}"</p><p class="ln" data-rv>${E(m.wishes)}</p>${hl.map((h) => `<p class="ln ok" data-rv>&gt; ${E(h)}</p>`).join("")}<p class="ln" data-rv>$ _</p>${nav()}</div>`,
    lower: () => `<div class="bgp">${wph ? `<img src="${E(wph.url)}" alt="" decoding="async" style="object-position:${+wph.x || 50}% ${+wph.y || 50}%">` : ""}</div><div class="lw tx">${h2}${wmsg}${hlLi("chips")}${nav()}</div>`,
    post: () => `<div class="pc"><div class="l tx">${h2}${wmsg}</div><div class="r"><div class="stamp" aria-hidden="true">★</div>${hlLi("lines")}${nav()}</div></div>`,
  };

  const L = {
    sheet: () => `<article class="sheet"><div class="lph">${lph}</div><div class="bd"><h2 class="lh" id="h-${id}">${E(m.allScenes.find((s) => s.id === "letter")?.label || "Letter")}</h2>${ps}${sig}</div></article>${nav("Continue")}`,
    envelope: () => `<div class="env" data-env><div class="back"></div><article class="paper"><div class="lph">${lph}</div><h2 class="lh" id="h-${id}">${E(m.allScenes.find((s) => s.id === "letter")?.label || "Letter")}</h2>${ps}${sig}</article><div class="flap"></div><div class="front"></div><button type="button" class="bt main open" data-act="env" aria-expanded="false">Open the letter</button></div>${nav("Continue")}`,
    type: () => `<article class="typ"><h2 class="lh" id="h-${id}">${E(m.allScenes.find((s) => s.id === "letter")?.label || "Letter")}</h2>${ps}${sig}${lph}</article>${nav("Continue")}`,
    glass: () => `<article class="glc lt"><h2 class="lh" id="h-${id}">${E(m.allScenes.find((s) => s.id === "letter")?.label || "Letter")}</h2>${ps}${sig}<div class="lph">${lph}</div></article>${nav("Continue")}`,
    journal: () => `<article class="jrn"><h2 class="lh" id="h-${id}">${E(m.allScenes.find((s) => s.id === "letter")?.label || "Letter")}</h2><div class="lph">${lph}</div>${ps}${sig}</article>${nav("Continue")}`,
    scroll: () => `<article class="scr"><i class="rl t"></i><div class="bd"><h2 class="lh" id="h-${id}">${E(m.allScenes.find((s) => s.id === "letter")?.label || "Letter")}</h2>${ps}${sig}</div><i class="rl b"></i></article>${nav("Continue")}`,
    credits: () => `<div class="cr" tabindex="0" aria-label="Letter"><div class="roll" style="--dur:${Math.round(14 + m.letterParas.join("").length / 22)}s"><h2 class="lh" id="h-${id}">${E(m.allScenes.find((s) => s.id === "letter")?.label || "Letter")}</h2>${ps}${sig}<div class="lph">${lph}</div></div></div>${nav("Continue")}`,
    book: () => `<div class="book"><div class="pg l"><h2 class="lh" id="h-${id}">${E(m.allScenes.find((s) => s.id === "letter")?.label || "Letter")}</h2><div class="lph">${lph}</div></div><div class="pg r">${ps}${sig}</div></div>${nav("Continue")}`,
    column: () => `<article class="colm"><h2 class="lh" id="h-${id}">${E(m.allScenes.find((s) => s.id === "letter")?.label || "Letter")}</h2><div class="cols">${ps}</div>${sig}<div class="lph">${lph}</div></article>${nav("Continue")}`,
    post: () => `<article class="pcb"><div class="msg"><h2 class="lh" id="h-${id}">${E(m.allScenes.find((s) => s.id === "letter")?.label || "Letter")}</h2>${ps}</div><div class="adr"><div class="stamp" aria-hidden="true">★</div><p class="to">To: ${nm}</p>${sig}<div class="lph">${lph}</div></div></article>${nav("Continue")}`,
    chat: () => `<div class="chat"><h2 class="lh" id="h-${id}">${E(m.allScenes.find((s) => s.id === "letter")?.label || "Letter")}</h2>${m.letterParas.map((p, i) => `<p class="bb" style="--i:${i}">${E(p)}</p>`).join("")}${m.sig ? `<p class="bb me" style="--i:${m.letterParas.length}">${E(m.sig)}</p>` : ""}<div class="lph">${lph}</div></div>${nav("Continue")}`,
  };

  const lbItem = (p, i, cls = "") => `<button type="button" class="it ${cls}" data-lb="${i}" style="--i:${i}" aria-label="Open photo ${i + 1}">${P(p, "", false)}${p?.cap ? `<span class="cp">${E(p.cap)}</span>` : ""}</button>`;
  const M = {
    film: () => `<div class="tx top"><h2 class="hb2" id="h-${id}">${E(m.allScenes.find((s) => s.id === "memories")?.label || "Memories")}</h2></div><div class="strip hs" tabindex="0" aria-label="Photo strip, scroll sideways"><div class="track">${memo.map((p, i) => `<div class="fm" style="--i:${i}"><span class="no">${String(i + 1).padStart(2, "0")}</span>${lbItem(p, i)}</div>`).join("")}</div></div><div class="hint"><button type="button" class="bt ghost" data-hs="-1" aria-label="Scroll left">←</button><span>Swipe or scroll</span><button type="button" class="bt ghost" data-hs="1" aria-label="Scroll right">→</button></div>${nav("Continue")}`,
    scrap: () => `<h2 class="hb2 sr-top" id="h-${id}">${E(m.allScenes.find((s) => s.id === "memories")?.label || "Memories")}</h2>${(() => { const sp = scatter(memo.length); return `<div class="board" style="--cols:${sp[0]?.cols || 1};--rows:${sp[0]?.rows || 1}">${sp.map((s, i) => `<div class="slot" style="left:${s.x}%;top:${s.y}%;--r:${s.r}deg;--i:${i}">${lbItem(memo[i], i)}</div>`).join("")}</div>`; })()}${nav("Continue")}`,
    wall: () => `<h2 class="hb2" id="h-${id}">${E(m.allScenes.find((s) => s.id === "memories")?.label || "Memories")}</h2><div class="lines">${[memo.slice(0, Math.ceil(memo.length / (memo.length > 4 ? 2 : 1))), memo.slice(Math.ceil(memo.length / (memo.length > 4 ? 2 : 1)))].map((row, r) => (row.length ? `<div class="ln"><i class="str"></i>${row.map((p, i) => { const k = r * Math.ceil(memo.length / 2) + i; return `<div class="hg" style="--r:${(rnd(k, 5) - 0.5) * 9}deg;--i:${k}"><i class="pin"></i>${lbItem(p, k)}</div>`; }).join("")}</div>` : "")).join("")}</div>${nav("Continue")}`,
    editorial: () => `<h2 class="hb2" id="h-${id}">${E(m.allScenes.find((s) => s.id === "memories")?.label || "Memories")}</h2><div class="eg">${memo.map((p, i) => `<div class="g g${i % 6}" style="--i:${i}"><b class="n">${String(i + 1).padStart(2, "0")}</b>${lbItem(p, i)}</div>`).join("")}</div>${nav("Continue")}`,
    bento: () => `<h2 class="hb2" id="h-${id}">${E(m.allScenes.find((s) => s.id === "memories")?.label || "Memories")}</h2><div class="bn n${Math.min(memo.length, 8)}">${memo.map((p, i) => `<div class="t t${i % 8}" style="--i:${i}">${lbItem(p, i)}</div>`).join("")}</div>${nav("Continue")}`,
    timeline: () => `<h2 class="hb2" id="h-${id}">${E(m.allScenes.find((s) => s.id === "memories")?.label || "Memories")}</h2><div class="tl hs" tabindex="0" aria-label="Timeline, scroll sideways"><div class="track"><i class="axis"></i>${memo.map((p, i) => `<div class="ev ${i % 2 ? "dn" : "up"}" style="--i:${i}"><i class="node"></i><span class="when">${cap(p, i)}</span>${lbItem(p, i)}</div>`).join("")}</div></div><div class="hint"><button type="button" class="bt ghost" data-hs="-1" aria-label="Scroll left">←</button><span>Swipe or scroll</span><button type="button" class="bt ghost" data-hs="1" aria-label="Scroll right">→</button></div>${nav("Continue")}`,
    coverflow: () => `<h2 class="hb2" id="h-${id}">${E(m.allScenes.find((s) => s.id === "memories")?.label || "Memories")}</h2><div class="cf" data-cf tabindex="0" aria-roledescription="carousel" aria-label="Photo carousel">${memo.map((p, i) => `<div class="cfi" data-i="${i}">${P(p, "", true)}</div>`).join("")}</div><div class="hint"><button type="button" class="bt ghost" data-cfn="-1" aria-label="Previous photo">←</button><span class="cnt">1 / ${memo.length}</span><button type="button" class="bt ghost" data-cfn="1" aria-label="Next photo">→</button></div>${nav("Continue")}`,
    stack: () => `<h2 class="hb2" id="h-${id}">${E(m.allScenes.find((s) => s.id === "memories")?.label || "Memories")}</h2><div class="stk" data-stack tabindex="0" aria-label="Photo stack. Swipe or press the button for the next photo.">${memo.map((p, i) => `<div class="sk" data-i="${i}">${P(p, "", true)}</div>`).join("")}</div><div class="hint"><span>Swipe the photo</span><button type="button" class="bt ghost" data-stk="1">Next photo</button></div>${nav("Continue")}`,
    gallery: () => `<h2 class="hb2" id="h-${id}">${E(m.allScenes.find((s) => s.id === "memories")?.label || "Memories")}</h2><div class="gl n${Math.min(memo.length, 6)}">${memo.map((p, i) => `<div class="mat" style="--i:${i}">${lbItem(p, i)}</div>`).join("")}</div>${nav("Continue")}`,
    contact: () => `<h2 class="hb2" id="h-${id}">${E(m.allScenes.find((s) => s.id === "memories")?.label || "Memories")}</h2><div class="cs">${memo.map((p, i) => `<div class="fr" style="--i:${i}"><span class="fn">${String(i + 1).padStart(2, "0")}A</span>${lbItem(p, i)}</div>`).join("")}</div>${nav("Continue")}`,
    kenburns: () => `<div class="kb" data-kb aria-roledescription="slideshow" aria-label="Memories slideshow">${memo.map((p, i) => `<figure class="sl${i ? "" : " on"}" data-i="${i}"><img src="${E(p.url)}" alt="${E(p.cap || "Memory " + (i + 1))}" loading="${i ? "lazy" : "eager"}" decoding="async" style="object-position:${+p.x || 50}% ${+p.y || 50}%"><figcaption>${cap(p, i)}</figcaption></figure>`).join("")}</div><div class="kbui tx"><h2 class="hb2" id="h-${id}">${E(m.allScenes.find((s) => s.id === "memories")?.label || "Memories")}</h2><div class="dots">${memo.map((_, i) => `<button type="button" data-kbi="${i}" aria-label="Photo ${i + 1}" ${i ? "" : 'aria-current="true"'}></button>`).join("")}</div></div>${nav("Continue")}`,
    orbit: () => `<div class="orbm"><h2 class="hb2 mid" id="h-${id}">${E(m.allScenes.find((s) => s.id === "memories")?.label || "Memories")}</h2><div class="rot" style="--n:${memo.length}">${memo.map((p, i) => `<div class="o" style="--k:${i}">${lbItem(p, i)}</div>`).join("")}</div></div>${nav("Continue")}`,
    comic: () => `<h2 class="hb2" id="h-${id}">${E(m.allScenes.find((s) => s.id === "memories")?.label || "Memories")}</h2><div class="cmx n${Math.min(memo.length, 6)}">${memo.map((p, i) => `<div class="pn p${i % 6}" style="--i:${i}">${lbItem(p, i)}<b class="bx">${["POW!", "WOW!", "YAY!", "ZAP!", "BOOM!", "HA!"][i % 6]}</b></div>`).join("")}</div>${nav("Continue")}`,
    mosaic: () => `<h2 class="hb2" id="h-${id}">${E(m.allScenes.find((s) => s.id === "memories")?.label || "Memories")}</h2><div class="mz">${memo.map((p, i) => `<div class="tile" style="--i:${i}">${lbItem(p, i)}</div>`).join("")}</div>${nav("Continue")}`,
  };

  const C = () => `<div class="stage st-${spec.C}">${stageDeco(spec.C)}<div class="msg"><p class="k" data-rv>${E(m.allScenes.find((s) => s.id === "cake")?.label || "Make a wish")}</p><h2 class="hb2" id="h-${id}"><span data-rv>Make a wish,</span> <em data-rv>${nm}</em></h2><p class="pr" data-rv>${E(m.wishPrompt)}</p></div><div class="cakewrap" data-cake>${cakeSVG(spec.cake, { candles: 5 })}</div><div class="ctl"><button type="button" class="bt main" data-act="blow">Blow the Candles</button><button type="button" class="bt ghost" data-act="mic" hidden>Use my microphone</button><p class="mic-st" role="status" aria-live="polite"></p></div><div class="done" hidden><h2 class="hb2">${E(m.wishMadeTitle)}</h2><p class="pr">${E(m.wishMade)}</p>${nav("Next", `<button type="button" class="bt ghost" data-act="relight">Relight candles</button>`)}</div></div>`;
  const X = () => `<div class="stage st-${spec.X}">${stageDeco(spec.X)}<div class="msg"><p class="k" data-rv>${E(m.allScenes.find((s) => s.id === "cut")?.label || "Cake")}</p><h2 class="hb2" id="h-${id}"><span data-rv>Time to cut the cake,</span> <em data-rv>${nm}</em></h2></div><div class="cakewrap" data-cake>${cakeSVG(spec.cake, { cut: true })}</div><div class="ctl"><button type="button" class="bt main" data-act="cut">Cut the Cake</button></div><div class="done" hidden><h2 class="hb2">${E(m.cutTitle)}</h2><p class="pr">${E(m.cut)}</p>${nav("Next", `<button type="button" class="bt ghost" data-act="recut">Cut again</button>`)}</div></div>`;

  const fp = m.ph.finale;
  const fin = `<p class="k" data-rv>${E(m.finalKicker)}</p>${hb.replace('id="h-' + id + '"', 'id="h-' + id + '"')}<p class="pr" data-rv>${E(m.final)}</p><div class="nv">${o.first ? "" : `<button type="button" class="bt back" data-act="back" aria-label="Previous scene"><span aria-hidden="true">←</span><span class="sr">Back</span></button>`}<button type="button" class="bt main" data-act="replay">↻ Replay Birthday Surprise</button></div>`;
  const F = {
    type: () => `<div class="tx">${fin}</div><div class="strip3">${fp.map((p) => P(p, "sm", false)).join("")}</div>`,
    trio: () => `<div class="tx">${fin}</div><div class="trio">${fp.map((p, i) => P(p, "t t" + i, false)).join("")}</div>`,
    bleed: () => `<div class="bgp">${fp[0] ? `<img src="${E(fp[0].url)}" alt="" decoding="async" style="object-position:${+fp[0].x || 50}% ${+fp[0].y || 50}%">` : ""}</div><div class="tx">${fin}</div>`,
    credits: () => `<div class="tx cr2">${fin}<p class="cast">Starring <b>${nm}</b>${m.from ? ` · Directed with love by <b>${E(m.from)}</b>` : ""}</p></div><div class="strip3">${fp.map((p) => P(p, "sm", false)).join("")}</div>`,
    badge: () => `<div class="bdg">${ring(`HAPPY BIRTHDAY • ${m.display.toUpperCase()} • HAPPY BIRTHDAY • ${m.display.toUpperCase()} • `)}${P(fp[0], "round", false)}</div><div class="tx">${fin}</div>`,
    neon: () => `<div class="tx neon">${fin}</div><div class="strip3">${fp.map((p) => P(p, "sm", false)).join("")}</div>`,
    post: () => `<div class="pcf"><div class="l tx">${fin}</div><div class="r"><div class="stamp" aria-hidden="true">★</div>${fp.slice(0, 2).map((p) => P(p, "sm", false)).join("")}</div></div>`,
    collage: () => `<div class="clg">${scatter(Math.max(3, fp.length)).slice(0, 3).map((s, i) => `<div class="cl" style="left:${[2, 62, 32][i]}%;top:${[8, 10, 62][i]}%;--r:${s.r * 1.3}deg;width:32%">${P(fp[i], "", false)}</div>`).join("")}</div><div class="tx glc">${fin}</div>`,
    gold: () => `<div class="gf"><i class="c1"></i><i class="c2"></i><i class="c3"></i><i class="c4"></i><div class="tx">${fin}</div></div><div class="strip3">${fp.map((p) => P(p, "sm", false)).join("")}</div>`,
    poster: () => `<div class="pst"><div class="col">${P(fp[0], "tall", false)}</div><div class="tx">${fin}</div><div class="col">${P(fp[1] || fp[0], "tall", false)}</div></div>`,
    sticker: () => `<div class="stk"><i class="burst" aria-hidden="true"></i>${P(fp[0], "round", false)}</div><div class="tx">${fin}</div>`,
    balloons: () => `<div class="bal" aria-hidden="true">${sc(7).map((i) => `<i style="--i:${i}"></i>`).join("")}</div><div class="tx">${fin}</div><div class="strip3">${fp.map((p) => P(p, "sm", false)).join("")}</div>`,
  };

  const table = { welcome: [W, spec.W], wishes: [S, spec.S], letter: [L, spec.L], memories: [M, spec.M] };
  let body;
  if (id === "cake") body = C(); else if (id === "cut") body = X(); else if (id === "finale") body = (F[spec.F] || F.type)(); else { const [t, v] = table[id]; body = (t[v] || Object.values(t)[0])(); }
  const variant = { welcome: spec.W, wishes: spec.S, letter: spec.L, memories: spec.M, cake: spec.C, cut: spec.X, finale: spec.F }[id];
  return `<section class="sc sc-${id} v-${variant}" data-scene="${id}" data-v="${variant}" aria-labelledby="h-${id}"><div class="scin">${body}</div></section>`;
}

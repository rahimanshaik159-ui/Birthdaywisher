// Parametric SVG birthday cake. Original artwork, no raster assets.
// cakeSVG(spec, {candles, cut}) -> SVG string. Geometry is real: tiers are cylinders in a fixed 3/4 projection
// (ry = 0.26 R), so the wedge cut, the exposed layered faces and the knife path are computed, not faked.
let uid = 0;
const clamp = (v) => Math.max(0, Math.min(255, v));
const rgb = (h) => { h = h.replace("#", ""); if (h.length === 3) h = [...h].map((c) => c + c).join(""); return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)); };
const hex = (a) => "#" + a.map((v) => clamp(Math.round(v)).toString(16).padStart(2, "0")).join("");
export const mix = (a, b, t) => { const x = rgb(a), y = rgb(b); return hex(x.map((v, i) => v + (y[i] - v) * t)); };
const lite = (c, t) => mix(c, "#ffffff", t), dark = (c, t) => mix(c, "#000000", t);
const seeded = (s) => () => ((s = (s * 16807) % 2147483647), (s - 1) / 2147483646);
const f = (n) => Math.round(n * 10) / 10;
const RY = 0.26;

export const CAKE_DEFAULT = { tiers: 2, body: "#f3d3a0", cream: "#fff3e0", frost: "#ffd0dc", drip: null, top: "berries", border: "rosette", mode: "real", plate: "#ffffff", accent: "#e63946", stand: false, candle: ["#ffffff", "#ff8fb1"], flame: "#ffb02e", sprinkles: false, outline: "#3b2340" };

function geom(n) {
  const Rs = [150, 106, 70].slice(0, n), hs = [[118], [92, 76], [78, 64, 52]][n - 1], cx = 220, base = 330;
  let y = base; const tiers = Rs.map((R, i) => { const yb = y, yt = y - hs[i]; y = yt; return { R, h: hs[i], yb, yt, ry: R * RY }; });
  return { cx, tiers, base, topY: y };
}

function fillDefs(id, c, mode) {
  const side = (n, col) =>
    mode === "real" || mode === "clay" || mode === "water"
      ? `<linearGradient id="${id}${n}" x1="0" x2="1"><stop offset="0" stop-color="${dark(col, 0.28)}"/><stop offset=".16" stop-color="${lite(col, 0.1)}"/><stop offset=".42" stop-color="${col}"/><stop offset=".78" stop-color="${dark(col, 0.14)}"/><stop offset="1" stop-color="${dark(col, 0.34)}"/></linearGradient>`
      : "";
  const top = (n, col) => (mode === "real" || mode === "clay" || mode === "water" ? `<radialGradient id="${id}${n}" cx=".4" cy=".35" r=".8"><stop offset="0" stop-color="${lite(col, 0.35)}"/><stop offset=".6" stop-color="${col}"/><stop offset="1" stop-color="${dark(col, 0.12)}"/></radialGradient>` : "");
  return side("fs", c.frost) + side("bs", c.body) + top("ft", c.frost) + side("ps", c.plate) +
    `<radialGradient id="${id}fg"><stop offset="0" stop-color="#fff" stop-opacity=".95"/><stop offset=".25" stop-color="${c.flame}" stop-opacity=".55"/><stop offset="1" stop-color="${c.flame}" stop-opacity="0"/></radialGradient>
     <linearGradient id="${id}fl" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#ff5a1f"/><stop offset=".55" stop-color="${c.flame}"/><stop offset="1" stop-color="#fff2a8"/></linearGradient>
     <linearGradient id="${id}kn" x1="0" x2="1"><stop offset="0" stop-color="#9aa3b2"/><stop offset=".45" stop-color="#f4f7fb"/><stop offset="1" stop-color="#8b93a3"/></linearGradient>
     <filter id="${id}sh" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="9"/></filter>
     <filter id="${id}gl" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3.2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
     <filter id="${id}wc"><feTurbulence type="fractalNoise" baseFrequency=".02" numOctaves="2" seed="4"/><feDisplacementMap in="SourceGraphic" scale="7"/></filter>`;
}

const band = (cx, R, ry, y1, y2, fill, extra = "") => `<path d="M${f(cx - R)},${f(y1)}A${f(R)} ${f(ry)} 0 0 0 ${f(cx + R)},${f(y1)}L${f(cx + R)},${f(y2)}A${f(R)} ${f(ry)} 0 0 1 ${f(cx - R)},${f(y2)}Z" fill="${fill}" ${extra}/>`;
const ell = (cx, cy, R, ry, fill, extra = "") => `<ellipse cx="${f(cx)}" cy="${f(cy)}" rx="${f(R)}" ry="${f(ry)}" fill="${fill}" ${extra}/>`;

function topping(kind, g, c, rand, mode, st) {
  const t = g.tiers[g.tiers.length - 1], cx = g.cx, cy = t.yt, R = t.R, ry = t.ry, out = [];
  const pos = (k, n, rr = 0.62) => { const a = (k / n) * Math.PI * 2 + 0.4; return [cx + Math.cos(a) * R * rr, cy + Math.sin(a) * ry * rr]; };
  const S = mode === "cartoon" || mode === "flat" ? `stroke="${c.outline}" stroke-width="${mode === "flat" ? 2.5 : 3}"` : "";
  if (kind === "berries") for (let i = 0; i < 7; i++) { const [x, y] = pos(i, 7), r = 9 + (i % 2) * 2; out.push(`<ellipse cx="${f(x)}" cy="${f(y - 4)}" rx="${r}" ry="${r * 0.9}" fill="${i % 3 === 2 ? "#4b2e83" : c.accent}" ${S}/><ellipse cx="${f(x - 3)}" cy="${f(y - 8)}" rx="2.4" ry="3.2" fill="#fff" opacity=".55"/><path d="M${f(x - 3)},${f(y - 13)}l3,-4 3,4z" fill="#3e8e41"/>`); }
  else if (kind === "flowers") for (let i = 0; i < 6; i++) { const [x, y] = pos(i, 6, 0.55), col = [c.accent, "#fff", "#ffc2d4", "#ffe08a"][i % 4]; out.push(`<g transform="translate(${f(x)} ${f(y - 4)})">${[0, 72, 144, 216, 288].map((a) => `<ellipse rx="5.5" ry="9" cy="-7" fill="${col}" transform="rotate(${a})" ${S}/>`).join("")}<circle r="4.2" fill="#ffc83d" ${S}/></g>`); }
  else if (kind === "stars") for (let i = 0; i < 6; i++) { const [x, y] = pos(i, 6, 0.6); out.push(`<path transform="translate(${f(x)} ${f(y - 6)}) scale(${0.8 + (i % 3) * 0.25})" d="M0,-11 3,-3.5 11,-3.5 4.7,1.3 7,9.5 0,4.6 -7,9.5 -4.7,1.3 -11,-3.5 -3,-3.5Z" fill="${i % 2 ? "#ffd84d" : c.accent}" ${S}/>`); }
  else if (kind === "macarons") for (let i = 0; i < 5; i++) { const [x, y] = pos(i, 5, 0.6), col = [c.accent, "#b8e0d2", "#ffe5a0", "#d9c2f0", "#ffc2d4"][i]; out.push(`<g transform="translate(${f(x)} ${f(y - 7)})"><ellipse rx="11" ry="5" cy="3.5" fill="${col}" ${S}/><rect x="-10" y="-1" width="20" height="4" rx="2" fill="#fff8ee" ${S}/><ellipse rx="11" ry="5" cy="-2" fill="${lite(col, 0.15)}" ${S}/></g>`); }
  else if (kind === "gold") for (let i = 0; i < 16; i++) { const [x, y] = pos(i, 16, 0.3 + rand() * 0.55); out.push(`<path d="M${f(x)},${f(y)}l${f(3 + rand() * 5)},-${f(2 + rand() * 4)} ${f(2 + rand() * 4)},${f(3 + rand() * 3)}z" fill="${i % 2 ? "#e8c35a" : "#fff0a8"}" opacity=".95"/>`); }
  else if (kind === "snow") for (let i = 0; i < 6; i++) { const [x, y] = pos(i, 6, 0.55); out.push(`<g transform="translate(${f(x)} ${f(y - 5)}) scale(${0.8 + (i % 2) * 0.4})" stroke="#fff" stroke-width="2" stroke-linecap="round" fill="none"><path d="M-9,0H9M-4.5,-7.8 4.5,7.8M-4.5,7.8 4.5,-7.8"/></g>`); }
  else if (kind === "leaves") for (let i = 0; i < 8; i++) { const [x, y] = pos(i, 8, 0.6); out.push(`<ellipse cx="${f(x)}" cy="${f(y - 4)}" rx="4" ry="11" transform="rotate(${i * 45 + 20} ${f(x)} ${f(y - 4)})" fill="${i % 2 ? "#5e9c4b" : "#7bb85f"}" ${S}/>`); }
  else if (kind === "planets") { out.push(`<g transform="translate(${cx - 34} ${cy - 10})"><circle r="13" fill="#f4a261" ${S}/><ellipse rx="22" ry="5" fill="none" stroke="#ffe6a0" stroke-width="3" transform="rotate(-18)"/></g><circle cx="${cx + 38}" cy="${cy - 8}" r="8" fill="#7ad7f0" ${S}/><path transform="translate(${cx + 4} ${cy - 22})" d="M0,-8 2.4,-2.4 8,-2.4 3.4,1 5,7 0,3.4 -5,7 -3.4,1 -8,-2.4 -2.4,-2.4Z" fill="#fff6b0"/>`); }
  else if (kind === "balloons") for (let i = 0; i < 3; i++) { const x = cx - 40 + i * 40, y = cy - 6; out.push(`<path d="M${x},${y}Q${x + 6},${y - 20} ${x + (i - 1) * 8},${y - 36}" stroke="${c.outline}" stroke-width="1.5" fill="none" opacity=".6"/><ellipse cx="${x + (i - 1) * 8}" cy="${y - 48}" rx="11" ry="13" fill="${[c.accent, "#ffd84d", "#6bd0f2"][i]}" ${S}/>`); }
  else if (kind === "sprinkles") { /* handled by sprinkles flag */ }
  if (c.sprinkles || kind === "sprinkles") for (let i = 0; i < 46; i++) { const a = rand() * 6.283, r = Math.sqrt(rand()) * 0.9, x = cx + Math.cos(a) * R * r, y = cy + Math.sin(a) * ry * r; out.push(`<rect x="${f(x)}" y="${f(y)}" width="5.5" height="1.9" rx=".9" fill="${["#ff6b8b", "#ffd84d", "#5ec8f2", "#8be08a", "#fff"][i % 5]}" transform="rotate(${(rand() * 180) | 0} ${f(x)} ${f(y)})"/>`); }
  return out.join("");
}

function tierBody(g, c, id, rand, mode, opts) {
  const { cx } = g, out = [], cart = mode === "cartoon" || mode === "flat", S = cart ? `stroke="${c.outline}" stroke-width="${mode === "flat" ? 2.5 : 3.2}" stroke-linejoin="round"` : "";
  const sideFill = (n, flat) => (mode === "real" || mode === "clay" || mode === "water" ? `url(#${id}${n})` : flat);
  const topFill = mode === "neon" ? "none" : mode === "real" || mode === "clay" || mode === "water" ? `url(#${id}ft)` : c.frost;
  g.tiers.forEach((t, i) => {
    const { R, ry, yt, yb, h } = t;
    if (mode === "neon") { const col = [c.accent, c.flame, "#7df9ff"][i % 3]; out.push(`<g fill="${c.frost}" fill-opacity=".05" stroke="${col}" stroke-width="3" filter="url(#${id}gl)"><path d="M${cx - R},${yt}L${cx - R},${yb}A${R} ${ry} 0 0 0 ${cx + R},${yb}L${cx + R},${yt}"/>${ell(cx, yt, R, ry, "none")}</g>`); return; }
    out.push(`<path d="M${cx - R},${yt}L${cx - R},${yb}A${R} ${ry} 0 0 0 ${cx + R},${yb}L${cx + R},${yt}Z" fill="${sideFill("fs", c.frost)}" ${S}/>`);
    if (opts.layers) { // sponge + cream bands show through a naked/semi-naked side
      const n = 3, bh = h / (n * 2 + 1); for (let k = 0; k < n * 2 + 1; k++) out.push(band(cx, R, ry, yt + k * bh, yt + (k + 1) * bh, k % 2 ? c.cream : sideFill("bs", c.body)));
      out.push(`<path d="M${cx - R},${yt}L${cx - R},${yb}A${R} ${ry} 0 0 0 ${cx + R},${yb}L${cx + R},${yt}" fill="none" ${S}/>`);
    }
    out.push(ell(cx, yt, R, ry, topFill, S));
    if (mode === "real") out.push(ell(cx - R * 0.12, yt - ry * 0.12, R * 0.72, ry * 0.62, "#fff", `opacity=".16"`));
    const dcol = c.drip;
    if (dcol && (i === 0 || opts.dripAll)) {
      const bandH = 12 + (i === 0 ? 4 : 0);
      out.push(band(cx, R, ry, yt, yt + bandH, mode === "real" ? `url(#${id}dg${i})` : dcol));
      const n = Math.max(5, Math.round(R / 20));
      for (let k = 0; k < n; k++) { const x = cx - R + (R * 2 * (k + 0.5)) / n, dx = (x - cx) / R, yy = yt + ry * Math.sqrt(Math.max(0, 1 - dx * dx)), len = 8 + rand() * (h * 0.36), w = 4.5 + rand() * 3; out.push(`<rect x="${f(x - w)}" y="${f(yy)}" width="${f(w * 2)}" height="${f(len + 6)}" rx="${f(w)}" fill="${mode === "real" ? `url(#${id}dg${i})` : dcol}" ${cart ? S : ""}/><ellipse cx="${f(x - w * 0.35)}" cy="${f(yy + len * 0.55)}" rx="1.4" ry="${f(len * 0.28)}" fill="#fff" opacity=".28"/>`); }
      out.push(ell(cx, yt, R, ry, dcol, S));
      if (mode === "real") out.push(ell(cx - R * 0.15, yt - ry * 0.1, R * 0.68, ry * 0.6, "#fff", `opacity=".14"`));
    }
    if (c.border !== "none") {
      const N = Math.round(R / 11);
      if (c.border === "rosette") for (let k = 0; k <= N; k++) { const x = cx - R + (R * 2 * k) / N, dx = (x - cx) / R, y = yt + ry * Math.sqrt(Math.max(0, 1 - dx * dx)); out.push(`<g transform="translate(${f(x)} ${f(y - 1)})"><circle r="6.6" fill="${lite(c.frost, 0.28)}" ${cart ? S : ""}/><path d="M-3.5,1Q0,-5 3.5,1" stroke="${dark(c.frost, 0.2)}" stroke-width="1.5" fill="none"/><circle cx="-2" cy="-2.4" r="1.5" fill="#fff" opacity=".7"/></g>`); }
      else if (c.border === "pearls") for (let k = 0; k <= N; k++) { const x = cx - R + (R * 2 * k) / N, dx = (x - cx) / R, y = yb + ry * Math.sqrt(Math.max(0, 1 - dx * dx)); out.push(`<circle cx="${f(x)}" cy="${f(y - 4)}" r="4.4" fill="#fff6e4" ${cart ? S : `stroke="${dark("#e9d9b8", 0.1)}" stroke-width=".7"`}/>`); }
    }
  });
  out.push(topping(c.top, g, c, rand, mode, S));
  return out.join("");
}

function candleSVG(g, c, id, n) {
  const t = g.tiers[g.tiers.length - 1], out = [], sp = Math.min(34, (t.R * 1.2) / Math.max(1, n - 1));
  for (let i = 0; i < n; i++) {
    const dx = (i - (n - 1) / 2) * sp, x = g.cx + dx, y = t.yt + t.ry * 0.12 * (1 - Math.pow(dx / t.R, 2)) + 2, hh = 50 + (i % 2) * 7, col = c.candle[i % c.candle.length];
    out.push(`<g class="candle" style="--i:${i}" data-i="${i}">
      <ellipse cx="${f(x)}" cy="${f(y)}" rx="5.4" ry="1.9" fill="#000" opacity=".22"/>
      <rect x="${f(x - 4.2)}" y="${f(y - hh)}" width="8.4" height="${hh}" rx="2" fill="${col}" stroke="${c.outline}" stroke-opacity="${c.mode === "cartoon" || c.mode === "flat" ? 1 : 0}" stroke-width="2"/>
      <path d="M${f(x - 4.2)},${f(y - hh * 0.2)}l8.4,-9M${f(x - 4.2)},${f(y - hh * 0.5)}l8.4,-9M${f(x - 4.2)},${f(y - hh * 0.8)}l8.4,-9" stroke="${c.accent}" stroke-width="2.2" opacity=".75"/>
      <rect x="${f(x - 1)}" y="${f(y - hh - 5)}" width="2" height="6" fill="#2b2b2b"/>
      <g class="flame" transform="translate(${f(x)} ${f(y - hh - 5)})"><circle class="halo" r="26" cy="-14" fill="url(#${id}fg)"/><g class="fl"><path d="M0,-32C7,-22 10,-13 10,-7 10,-1 5,4 0,4 -5,4 -10,-1 -10,-7 -10,-13 -7,-22 0,-32Z" fill="url(#${id}fl)"/><path d="M0,-20C3.6,-14 5,-9 5,-5.5 5,-1.5 2.6,1.5 0,1.5 -2.6,1.5 -5,-1.5 -5,-5.5 -5,-9 -3.6,-14 0,-20Z" fill="#fffbe0" opacity=".92"/></g></g>
      <path class="smoke" d="M${f(x)},${f(y - hh - 6)}c-7,-12 8,-20 0,-34s7,-22 2,-34" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" opacity="0"/>
      <path class="smoke s2" d="M${f(x)},${f(y - hh - 6)}c6,-10 -7,-22 1,-30s-6,-20 -2,-28" fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round" opacity="0"/></g>`);
  }
  return out.join("");
}

/** Slice icon (3/4 view) used after the cut: layers visible on the cut face. */
function sliceSVG(c, id, mode) {
  const cart = mode === "cartoon" || mode === "flat", S = cart ? `stroke="${c.outline}" stroke-width="3" stroke-linejoin="round"` : "", h = 64;
  const P0 = [0, 40], P1 = [150, 70], P2 = [176, 20], bands = [];
  const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  const n = 5, bh = h / n;
  for (let k = 0; k < n; k++) { const y1 = k * bh, y2 = (k + 1) * bh; bands.push(`<path d="M${P0[0]},${P0[1] + y1}L${P1[0]},${P1[1] + y1}L${P1[0]},${P1[1] + y2}L${P0[0]},${P0[1] + y2}Z" fill="${k % 2 ? c.cream : c.body}" ${cart ? "" : `stroke="${dark(c.body, 0.12)}" stroke-width=".6"`}/>`); }
  return `<g class="slice-art">
    <ellipse cx="95" cy="${P1[1] + h + 6}" rx="124" ry="22" fill="#000" opacity=".2"/><ellipse cx="95" cy="${P1[1] + h + 2}" rx="118" ry="20" fill="${mode === "neon" ? "none" : c.plate}" ${cart ? S : `stroke="${dark(c.plate, 0.18)}" stroke-width="1"`}/>
    <path d="M${P1[0]},${P1[1]}L${P2[0]},${P2[1]}L${P2[0]},${P2[1] + h}L${P1[0]},${P1[1] + h}Z" fill="${mode === "neon" ? "none" : dark(c.frost, 0.16)}" ${S}/>
    ${bands.join("")}
    <path d="M${P0[0]},${P0[1]}L${P1[0]},${P1[1]}L${P1[0]},${P1[1] + h}L${P0[0]},${P0[1] + h}Z" fill="none" ${S}/>
    <path d="M${P0[0]},${P0[1]}L${P1[0]},${P1[1]}L${P2[0]},${P2[1]}Z" fill="${mode === "neon" ? "none" : lite(c.frost, 0.12)}" ${S}/>
    ${c.drip ? `<path d="M${P0[0]},${P0[1]}L${P1[0]},${P1[1]}L${P1[0]},${P1[1] + 12}Q${P1[0] - 12},${P1[1] + 22} ${P1[0] - 24},${P1[1] + 12}Q${P1[0] - 40},${P1[1] + 28} ${P1[0] - 58},${P1[1] + 8}Q${P1[0] - 90},${P1[1] + 22} ${P0[0] + 26},${P0[1] + 12}L${P0[0]},${P0[1] + 10}Z" fill="${c.drip}" ${cart ? S : ""} opacity=".96"/>` : ""}
    ${c.top === "stars" ? `<path transform="translate(112 52) scale(1.1)" d="M0,-11 3,-3.5 11,-3.5 4.7,1.3 7,9.5 0,4.6 -7,9.5 -4.7,1.3 -11,-3.5 -3,-3.5Z" fill="#ffd84d" ${S}/>` : c.top === "flowers" || c.top === "macarons" ? `<circle cx="118" cy="48" r="9" fill="${c.accent}" ${S}/><circle cx="118" cy="48" r="3.5" fill="#ffc83d"/>` : `<ellipse cx="118" cy="46" rx="10" ry="9" fill="${c.accent}" ${S}/><ellipse cx="114" cy="42" rx="2.4" ry="3.2" fill="#fff" opacity=".55"/>`}
  </g>`;
}

export function cakeSVG(spec = {}, { candles = 0, cut = false } = {}) {
  const c = { ...CAKE_DEFAULT, ...spec }, id = "ck" + ++uid, g = geom(Math.max(1, Math.min(3, c.tiers))), rand = seeded(97), mode = c.mode, cx = g.cx;
  const t0 = g.tiers[0], pr = t0.R + 38, cart = mode === "cartoon" || mode === "flat";
  const layers = c.dripLayers !== undefined ? c.dripLayers : !!c.layers;
  const dg = c.drip ? g.tiers.map((_, i) => `<linearGradient id="${id}dg${i}" x1="0" x2="1"><stop offset="0" stop-color="${dark(c.drip, 0.25)}"/><stop offset=".3" stop-color="${lite(c.drip, 0.12)}"/><stop offset=".7" stop-color="${c.drip}"/><stop offset="1" stop-color="${dark(c.drip, 0.3)}"/></linearGradient>`).join("") : "";
  const plateY = t0.yb + 7;
  const plate = `<ellipse class="plate-shadow" cx="${cx}" cy="${plateY + 12}" rx="${pr + 8}" ry="${(pr + 8) * RY}" fill="#000" opacity=".28" filter="url(#${id}sh)"/>` +
    (c.stand ? `<path d="M${cx - 18},${plateY + 4}L${cx - 12},${plateY + 40}L${cx + 12},${plateY + 40}L${cx + 18},${plateY + 4}Z" fill="${mode === "real" ? `url(#${id}ps)` : c.plate}" ${cart ? `stroke="${c.outline}" stroke-width="3"` : ""}/>${ell(cx, plateY + 42, 62, 13, mode === "real" ? lite(c.plate, 0.1) : c.plate, cart ? `stroke="${c.outline}" stroke-width="3"` : `stroke="${dark(c.plate, 0.18)}" stroke-width="1"`)}` : "") +
    ell(cx, plateY, pr, pr * RY, mode === "neon" ? "none" : mode === "real" ? `url(#${id}ps)` : c.plate, mode === "neon" ? `stroke="${c.flame}" stroke-width="2.5" filter="url(#${id}gl)"` : cart ? `stroke="${c.outline}" stroke-width="3.2"` : `stroke="${dark(c.plate, 0.2)}" stroke-width="1"`) +
    (mode === "neon" ? "" : ell(cx, plateY - 1.5, pr * 0.88, pr * 0.88 * RY, "none", `stroke="${dark(c.plate, 0.1)}" stroke-width="1.2" opacity=".6"`));
  const body = `<g id="${id}body">${tierBody(g, c, id, rand, mode, { layers, dripAll: c.dripAll })}</g>`;
  const wc = mode === "water" ? ` filter="url(#${id}wc)"` : "";
  const vbH = (c.stand ? 410 : 385) + (cut ? 75 : 0), vw = cut ? 560 : 440;
  let inner;
  if (!cut) {
    inner = `${plate}<g${wc}>${body.replace(`id="${id}body"`, "")}</g>${candles ? `<g class="candles">${candleSVG(g, c, id, candles)}</g>` : ""}`;
  } else {
    // Wedge cut: sector centred on the front, half-angle phi, applied to every tier.
    const phi = (25 * Math.PI) / 180, th1 = Math.PI / 2 + phi, th2 = Math.PI / 2 - phi, pt = (t, th, y) => [cx + t.R * Math.cos(th), y + t.ry * Math.sin(th)];
    const arc = (t, y, a, b) => { const p = []; for (let k = 0; k <= 10; k++) { const th = a + ((b - a) * k) / 10; p.push(pt(t, th, y)); } return p; };
    const poly = (pts) => pts.map((p) => f(p[0]) + "," + f(p[1])).join(" ");
    const wedgePolys = g.tiers.map((t) => poly([[cx, t.yt], pt(t, th1, t.yt), pt(t, th1, t.yb), ...arc(t, t.yb, th1, th2), pt(t, th2, t.yb), pt(t, th2, t.yt)]));
    const polyEls = wedgePolys.map((p) => `<polygon points="${p}"/>`).join("");
    const faces = g.tiers.map((t) => {
      const nb = 5, out = [];
      [th1, th2].forEach((th, si) => {
        const [ex] = pt(t, th, t.yt), [, ey] = pt(t, th, t.yt), dy = ey - t.yt, k = nb * 2 + 1;
        for (let b = 0; b < k; b++) { const a1 = t.yt + (t.h * b) / k, a2 = t.yt + (t.h * (b + 1)) / k; out.push(`<polygon points="${cx},${f(a1)} ${f(ex)},${f(a1 + dy)} ${f(ex)},${f(a2 + dy)} ${cx},${f(a2)}" fill="${b % 2 ? c.cream : si ? dark(c.body, 0.1) : c.body}" ${cart ? "" : `stroke="${dark(c.body, 0.1)}" stroke-width=".5"`}/>`); }
        out.push(`<polygon points="${cx},${f(t.yt)} ${f(ex)},${f(ey)} ${f(ex)},${f(ey + t.h)} ${cx},${f(t.yb)}" fill="none" ${cart ? `stroke="${c.outline}" stroke-width="3" stroke-linejoin="round"` : `stroke="${dark(c.body, 0.3)}" stroke-width="1"`}/>`);
        out.push(`<polygon points="${cx},${f(t.yt)} ${f(ex)},${f(ey)} ${f(ex)},${f(ey + t.h)} ${cx},${f(t.yb)}" fill="#000" opacity="${si ? 0.18 : 0.08}"/>`);
      });
      return out.join("");
    }).join("");
    // cut-line paths follow the staircase profile of each vertical plane (outer edge from the top tier down to the plate)
    const line = (th) => { const pts = [[cx, g.tiers[g.tiers.length - 1].yt]]; for (let i = g.tiers.length - 1; i >= 0; i--) { const t = g.tiers[i]; pts.push(pt(t, th, t.yt), pt(t, th, t.yb)); } return pts; };
    const L1 = line(th1), L2 = line(th2), plen = (P) => P.slice(1).reduce((s, p, i) => s + Math.hypot(p[0] - P[i][0], p[1] - P[i][1]), 0);
    const pathD = (P) => "M" + P.map((p) => f(p[0]) + "," + f(p[1])).join("L");
    const sx = pt(t0, Math.PI / 2, t0.yb)[0];
    inner = `<g class="cake-all" transform="translate(60 0)">${plate}
      <g class="cake-full"${wc}>${body.replace(`id="${id}body"`, "")}</g>
      <g class="cake-rest"${wc}><mask id="${id}m" maskUnits="userSpaceOnUse" x="0" y="0" width="${vw}" height="${vbH}"><rect width="${vw}" height="${vbH}" fill="#fff"/><g fill="#000">${polyEls}</g></mask><g mask="url(#${id}m)">${body.replace(`id="${id}body"`, "")}</g></g>
      <g class="cut-faces" opacity="0"${wc}>${faces}</g>
      <g class="cut-wedge"${wc}><clipPath id="${id}c">${polyEls}</clipPath><g clip-path="url(#${id}c)">${body.replace(`id="${id}body"`, "")}</g></g>
      <path class="cut-line l1" d="${pathD(L1)}" fill="none" stroke="${c.outline}" stroke-opacity=".75" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="${f(plen(L1))}" stroke-dashoffset="${f(plen(L1))}" data-len="${f(plen(L1))}"/>
      <path class="cut-line l2" d="${pathD(L2)}" fill="none" stroke="${c.outline}" stroke-opacity=".75" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="${f(plen(L2))}" stroke-dashoffset="${f(plen(L2))}" data-len="${f(plen(L2))}"/>
      <g class="knife" opacity="0" data-p1='${JSON.stringify(L1.map((p) => p.map(f)))}' data-p2='${JSON.stringify(L2.map((p) => p.map(f)))}'><path d="M0,0L-5,-10L-6,-95L-1,-96L6,-92L5,-10Z" fill="url(#${id}kn)" stroke="#6c7384" stroke-width=".8"/><rect x="-7" y="-146" width="13" height="52" rx="5" fill="#3b2a24"/><rect x="-8" y="-98" width="15" height="6" rx="2" fill="#b8bfcc"/></g></g>
      <g class="slice" transform="translate(372 322) scale(.7)" opacity="0">${sliceSVG(c, id, mode)}</g>`;
  }
  return `<svg class="cake-svg${cut ? " cutmode" : ""}" viewBox="0 0 ${vw} ${vbH}" role="img" aria-label="${cut ? "Birthday cake ready to be cut" : "Birthday cake with candles"}" data-m="${mode}"><defs>${fillDefs(id, c, mode)}${dg}</defs>${inner}</svg>`;
}

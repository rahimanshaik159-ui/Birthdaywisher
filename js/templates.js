// Template metadata derived from the 50 specs in specs.js. The actual implementations live in
// specs.js (art direction + layout choices), art.js (backdrops), scenes.js (layouts) and cake.js.
import { SPECS, CATS } from "./specs.js";
export { CATS };
const WL = { type: "Typographic", split: "Split-portrait", arch: "Arched-window", bleed: "Full-bleed", orbit: "Orbiting-text", drop: "Polaroid", title: "Title-card", glass: "Glass-card", ticket: "Ticket-stub", poster: "Poster", sticker: "Sticker", stack: "Photo-stack" };
const ML = { film: "film strip", scrap: "scrapbook", wall: "string-lights wall", editorial: "editorial grid", bento: "bento grid", timeline: "timeline", coverflow: "3D carousel", stack: "swipe stack", gallery: "framed gallery", contact: "contact sheet", kenburns: "slideshow", orbit: "orbiting photos", comic: "comic panels", mosaic: "mosaic" };
const LL = { sheet: "paper letter", envelope: "envelope letter", type: "typewriter letter", glass: "glass note", journal: "journal letter", scroll: "scroll letter", credits: "credits crawl", book: "open-book letter", column: "editorial letter", post: "postcard letter", chat: "chat-style letter" };
const FL = { confetti: "confetti", rainConfetti: "confetti rain", fireworks: "fireworks", sparkle: "sparkle shower", balloons: "balloons", lanterns: "lanterns", petals: "petals", hearts: "hearts", snow: "snowfall", stars: "star burst" };
export const T = SPECS.map((s) => ({
  id: s.id, n: s.n, name: s.name, category: s.category, cat: s.cat, spec: s,
  preview: `res/template-previews/${s.id}.jpg`,
  scenes: s.orderIds, layouts: { welcome: s.W, wishes: s.S, letter: s.L, memories: s.M, cake: s.C, cut: s.X, finale: s.F },
  description: `${WL[s.W]} welcome · ${ML[s.M]} · ${LL[s.L]} · ${FL[s.fx]} finale`,
}));
export const byId = (id) => T.find((t) => t.id === id);

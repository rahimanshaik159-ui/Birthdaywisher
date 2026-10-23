// Minimal static server used by the preview generator and browser tests.
// It reproduces server.py's routing: /birthday/<slug> redirects to /birthday.html?s=<slug>.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".jpg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".woff2": "font/woff2", ".mp3": "audio/mpeg" };
export function serve(root, port = 0) {
  const srv = http.createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
    const m = /^\/birthday\/([^/]+)\/?$/.exec(p);
    if (m) { res.writeHead(302, { Location: `/birthday.html?s=${m[1]}` }); return res.end(); } // same as server.py
    if (p.endsWith("/")) p += "index.html";
    const f = path.join(root, path.normalize(p));
    if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404, { "Content-Type": "text/html" }); return res.end(fs.existsSync(path.join(root, "404.html")) ? fs.readFileSync(path.join(root, "404.html")) : "Not found"); }
    res.writeHead(200, { "Content-Type": TYPES[path.extname(f)] || "application/octet-stream", "Cache-Control": "no-store" });
    fs.createReadStream(f).pipe(res);
  });
  return new Promise((r) => srv.listen(port, () => r({ srv, url: `http://localhost:${srv.address().port}` })));
}

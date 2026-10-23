# BirthdayWisher (premium edition)

Build a personalised, multi-scene birthday surprise website and share it as a link. Pick one of 50 art-directed templates, add photos and wording, publish. The recipient opens the link and plays through the surprise one scene at a time:

**Welcome → Wishes → Letter → Memories → Candles (blow them out) → Cut the cake → Finale → Replay**

The scene order differs per template, and creators can reorder, hide and rename scenes.

- **Frontend:** static HTML/CSS/ES modules. No build step, no framework, no CDN.
- **Backend:** your existing Node.js + SQLite + Express API (publishing, uploads, slugs, server-side expiry, scheduled cleanup). Unchanged apart from one additive field (see [API](#api)).

## Contents
1. [Quick start (local)](#quick-start-local)
2. [Configuration](#configuration)
3. [How routing works](#routing)
4. [Deploy: backend](#deploy-the-backend)
5. [Deploy: GitHub Pages](#deploy-the-frontend-to-github-pages)
6. [API](#api)
7. [Project map](#project-map)
8. [Tests and verification status](#tests)
9. [Assets, fonts, audio](#assets)
10. [Known limitations](#known-limitations)

## Quick start (local)

Requirements: Node 18+ (22 tested), Python 3 (for the static server). Nothing is shipped in `node_modules`; install on your machine.

```bash
# 1. backend (terminal 1)
cd backend
npm install                 # compiles better-sqlite3 for YOUR platform
cp .env.example .env        # then edit (see Configuration)
npm start                   # API on http://localhost:8787

# 2. frontend (terminal 2, from the project root)
python server.py            # or: python3 server.py  -> http://localhost:5500
```

Open <http://localhost:5500>. Browse templates, use "Preview Experience" to play one, then "Use This Template" to create and publish. Published links look like `http://localhost:5500/birthday/<slug>`.

`server.py` is a tiny static server that also makes the pretty URL work (Python's built-in server would 404 on `/birthday/<slug>`): it redirects it to `/birthday.html?s=<slug>`. A Node equivalent used by the tests is `scripts/static-server.mjs`.

Microphone blow-detection needs a secure context: `http://localhost` and `https://` work; plain `http://192.168.x.x` does not (the button fallback still works).

## Configuration

| Where | Setting | Meaning |
|---|---|---|
| `backend/.env` | `PORT` | API port (default 8787) |
| | `ALLOWED_ORIGINS` | Comma-separated exact origins allowed by CORS, e.g. `https://you.github.io,http://localhost:5500` (no trailing slash, no path) |
| | `PUBLIC_API_URL` | Public base URL of the API; used to build photo URLs |
| | `DB_PATH`, `UPLOAD_DIR` | SQLite file and upload folder (must be on persistent storage in production) |
| | `CRON_SECRET` | Secret for `POST /api/cleanup` (optional external cron) |
| | `CLEANUP_INTERVAL_MS` | Built-in cleanup interval (default 60000) |
| | `PUBLISH_LIMIT` | Publishes per hour per IP (default 10) |
| `js/config.js` | API URL | `localhost`/`127.0.0.1` -> `http://localhost:8787`; otherwise the production URL in that file. You can also define `window.BW_API_URL` before the scripts. Edit the `YOUR-BACKEND.example.com` placeholder before deploying. |

`.env` is read with `node --env-file=.env` (see `npm start`). It is git-ignored and **not** included in the release ZIP; `backend/.env.example` is.

## Routing

- **Local:** `server.py` redirects `/birthday/<slug>` to `/birthday.html?s=<slug>`.
- **GitHub Pages:** Pages has no rewrites. The shipped `404.html` catches `/<repo>/birthday/<slug>`, and redirects to `/<repo>/birthday.html?s=<slug>`. This works, but the first hit returns an HTTP 404 status before the redirect (browsers follow it; crawlers/link-preview bots may not). Links in the form `birthday.html?s=<slug>` are always reliable. The viewer accepts both forms.
- **Netlify/Cloudflare Pages/nginx:** add a rewrite `/birthday/*` -> `/birthday.html` (status 200); the viewer reads the slug from the path.
- Asset URLs are relative, so a project-page sub-path (`/repo/`) works.

## Deploy the backend

Any Node host with a **persistent disk** works (a small VPS, Render/Railway/Fly with a volume).

1. Deploy the `backend/` folder. Build: `npm install`. Start: `node --env-file=.env server.js` (or set the env vars in the host's dashboard and run `node server.js`).
2. Set `PUBLIC_API_URL` to the public https URL, `ALLOWED_ORIGINS` to your GitHub Pages origin (e.g. `https://USER.github.io`), `DB_PATH` and `UPLOAD_DIR` onto the persistent volume, and a long random `CRON_SECRET`.
3. Put it behind https (needed for mixed-content rules from an https Pages site).
4. Cleanup runs in-process every `CLEANUP_INTERVAL_MS`. On hosts that sleep when idle, also call `POST /api/cleanup` with header `x-cron-secret: <CRON_SECRET>` from an external cron (see `backend/server.js`). Expired pages are refused with 410 regardless, because expiry is checked on every request.
5. Do not commit `.env`, `data/`, or `storage/` (uploads and private letters live there). `.gitignore` already excludes them.

## Deploy the frontend to GitHub Pages

1. Edit `js/config.js` with your backend URL.
2. Push the project root (without `backend/` if you prefer; it is not needed by Pages) to a repo and enable Pages for the branch root.
3. Open `https://USER.github.io/REPO/`. Published links: `https://USER.github.io/REPO/birthday/<slug>` (via `404.html`) or `.../birthday.html?s=<slug>`.
4. Never commit user photos or database files; per-page data is stored only on the backend. No GitHub commits are made per page.

## API

Unchanged contract: `POST /api/pages` (multipart: `data` JSON + `photos`), `GET /api/pages/:slug`, photo files under `/uploads/...`, `DELETE /api/pages/:slug` (header `x-edit-token`), `POST /api/cleanup` (header `x-cron-secret`), `GET /api/health`. Slugs are unique (collision tested), uploads are validated by content (fake images rejected), expiry is end-of-day in the birthday timezone (DST tested), expired pages return **410** and are deleted with their photos by the scheduled cleanup (failed deletions are retried).

**One additive field:** `data.story` (optional). The backend whitelists and clamps it (`cleanStory()` in `backend/server.js`) and stores it inside the existing JSON column, so **no schema change**. Pages published before this version have no `story` and render with sensible defaults.

```jsonc
"story": {
  "scenes": [{ "id": "memories", "on": true, "label": "Our pages" }, ...],   // middle scenes only; welcome first, finale last
  "text":   { "welcomeKicker": "", "cta": "", "wishes": "", "highlights": ["..."], "wishPrompt": "",
              "wishMadeTitle": "", "wishMade": "", "cutTitle": "", "cut": "", "finalKicker": "", "final": "" },
  "photos": { "welcome": 0, "wishes": null, "letter": [1,2], "memories": [1,2,3], "finale": [0,1,2] },  // indexes into uploaded photos
  "captions": ["", "Beach day"],
  "music": { "track": "musicbox" }   // none | musicbox | piano | pad | sparkle | file:<name in res/audio/>
}
```
Empty photo lists mean "automatic arrangement".

## Project map

```
index.html            gallery: search, category filter, previews, "Preview Experience" (plays the real sequence)
create.html           6-step wizard + live preview player (js/create.js)
birthday.html         published-page viewer: loading / error / expired states, server re-validation
404.html, server.py   routing helpers (unchanged behaviour)
js/specs.js           the 50 template specs (art, fonts, palette, layouts, frame, transition, particles, cake, order)
js/templates.js       metadata derived from specs (names, categories, preview paths)
js/engine.js          Player: state machine, transitions, candles, mic, cake cutting, carousels, HUD, audio
js/scenes.js          scene markup: 12 welcome, 12 wishes, 11 letter, 14 memories, 5+5 cake/cut stages, 12 finale layouts
js/art.js             original procedural SVG backdrops (about 40 generators)
js/cake.js            parametric SVG cake: tiers, frosting, drips, toppings, candles, flames, smoke, wedge cut, slice
js/fx.js              canvas ambient particles + 10 celebration types
js/audio.js           generated music + SFX, optional file tracks, permission-based blow detector
js/story.js           shared data model (normalize) used by wizard, gallery and viewer
css/experience.css, css/scenes.css, css/fonts.css, css/main.css
res/fonts, res/samples, res/template-previews (50 jpg), res/backdrops, res/audio
backend/              Express + SQLite API, tests/smoke.mjs + tests/story.mjs
scripts/              check.mjs, e2e.mjs, gen-previews.mjs, static-server.mjs, harness.html
```

To add a template: add an entry to `SPECS` in `js/specs.js` (copy a neighbour, change art/layout keys/palette/cake), then `npm run previews`.

## Tests

```bash
cd backend && npm install && npm test          # existing smoke tests + story tests
cd .. && npm install && npx playwright install chromium
npm run check                                  # static checks (no browser)
npm run previews                               # regenerate res/template-previews/*.jpg
node scripts/e2e.mjs                           # browser tests (see below)
RANGE=1-10 node scripts/e2e.mjs "all 50"       # heavy tests can be batched by template range
node scripts/e2e.mjs "microphone|music"        # or filtered by name (pipe = OR)
```

`e2e.mjs` starts its own static server, spawns the real backend with a throwaway DB/upload folder, and drives Chromium.

### Verification status (what was actually executed for this release)

Environment: Node 22, Playwright 1.56 / Chromium (headless), Linux sandbox.

| Area | Result |
|---|---|
| Backend `npm test` (10 original checks + 5 new story checks) | **Passed** (15/15) |
| `npm run check` (static) | **Passed** (11/11): 50 templates and names, unique art/cake/palette/layout, 50 distinct previews, HTML escaping across 350 scene renders, no remote assets, fonts present |
| Full journey on **each of the 50 templates** (welcome has no early reveal; one scene in DOM at a time; back/next; cake cannot be skipped; 5 candles go out; cake cut reveals layers and slice; finale; replay restarts at scene 1) | **Passed** 50/50 (run in 5 batches) |
| Real motion path on 10 templates (transitions incl. curtain/glitch/iris/shutter, knife cut, celebration canvas drawn) | **Passed** |
| Touch-only journey (390x844, tap) on 3 templates | **Passed** |
| No horizontal overflow, 50 templates x 7 scenes at 320x568, 390x844, 820x1180, 1440x900 | **Passed** (1,400 scene checks) |
| Microphone, using Chromium's *fake* audio capture device: breath-like noise blows candles out; a steady tone does not; permission denied and unsupported fall back to the button | **Passed** |
| Music: no AudioContext before tap, toggle/pause state, track switching, timers released on destroy, no-WebAudio and missing-file fallbacks | **Passed** |
| Reduced motion, keyboard (Tab/Enter/arrows, heading focus), missing photos, creator options | **Passed** |
| Gallery: 50 cards, search, category filter, per-template previews, full-experience dialog | **Passed** |
| Wizard: validation, live preview, 3 photo uploads, custom wording, scene reorder/rename, music try-out, publish to the real API | **Passed** |
| Published link: `/birthday/<slug>` redirect, template, every custom value, scene order, captions, photos from backend, accent colour, replay; phone overflow | **Passed** |
| Legacy payload (no `story`), viewer error states, expiry (410, open page switches to expired, DB row and photo files removed) | **Passed** |

**Not verified / limits of testing**
- Audio **output** was never heard. Tests prove the audio graph runs (context running, clock advancing, state UI) but not how it sounds. Microphone detection was tested with Chromium's synthetic input, not a real person blowing at a real microphone; real-world sensitivity may need tuning (`js/audio.js`, `BlowDetector`).
- Only Chromium was tested. Safari and Firefox are untested (the code avoids unusual APIs, but container queries, `:has()` and WebAudio behave differently across browsers and iOS has stricter audio rules).
- No physical phones or tablets: mobile = Chromium device emulation with touch.
- Deployed GitHub Pages and a hosted backend were not tested; only the local flow (static server + backend on localhost). Cross-origin CORS was exercised between `localhost:5611` and `localhost:8787`.
- Visual quality was judged by looking at screenshots of all 50 welcome scenes and a sample of other scenes, not every scene of every template.

## Assets

See [ASSETS.md](ASSETS.md). In short: all art, cakes and effects are original code; music is generated in the browser; 29 OFL fonts are bundled locally; the gallery uses clearly labelled placeholder images. **No stock photography is bundled**; ASSETS.md explains how to add licensed photographic backdrops and your own audio files.

## Known limitations

- Backdrops are vector art, not photographs (see above). Real photos supplied by the creator are the photography inside each scene.
- The previews show the welcome scene with placeholder portraits; templates that use the photo as a full-bleed background (e.g. 07, 17, 21) look moody and dark with the placeholder and will look different with real photos.
- Some playful and photo-frame effects (e.g. clay, watercolor) are approximations in CSS/SVG, not 3D renders.
- On GitHub Pages the first load of `/birthday/<slug>` passes through a 404 page (see Routing).
- The creator cannot edit a page after publishing (delete with the token and publish again). Edit-after-publish is unchanged from the original backend.

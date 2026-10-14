# Lost Cities: Mohenjo-daro

An interactive 3D reconstruction of Mohenjo-daro around 2500 BCE that shows how sure we are about every wall: excavated, inferred or imagined.

## Run
- Without the server: `npm run dev` → http://localhost:5173
- With the Worker: `npm run build` then `npx wrangler dev` → http://localhost:8787
- Skip the opening flight while testing: add `?skipintro` to the URL.
- Double-click (or double-tap) the landscape to glide back to the starting view.
- Walk: press **Walk** (top left). WASD or arrow keys, drag to look, Shift to hurry; on a phone, the circle bottom left. Esc or **Fly** to leave. `?view=walk` starts on First Street.
- Time and season: the button top right. For testing, add `&time=21` (sun time, 0–24) and `&season=cool|hot|monsoon|after` to the URL.
- Rain: "Monsoon rain" in the time panel, or add `&rain` to the URL.
- People: zoom in close to the lower town. `?view=craft` starts next to a workshop.

## Terrain
`public/terrain/mohenjo-daro.bin` is made from the Copernicus DEM tile by `tools/make-terrain.py` (Python, only needed if the terrain is ever rebuilt). Keep the raw tile in `data-raw/` (git-ignored).

## Tracing excavation plans
1. Keep plan scans in `data-raw/` (git-ignored; never commit them).
2. `npm run dev`, then open http://localhost:5173/tools/tracer/
3. Open a plan image, set the scale bar, the north arrow and an anchor point, then trace walls, drains and wells.
4. Download the JSON into `src/data/traced/`. The city loads every file there: traced walls are shown as excavated, and generated houses are left out where a trace covers.

The tracer is never built or deployed.

Known plates are listed in `tools/plates.json` (scale, placement, tracing settings). Opening one of them in the tracer fills in its calibration automatically.

First-pass tracing of all listed plates: `python tools/trace-plates.py` (needs numpy, scipy, pillow, opencv-python, scikit-image, and the scans in `data-raw/`). A trace you have reviewed by hand is never overwritten: in its JSON, set `"reviewed": true` inside `meta`.

## Deploy
Push to `main`. Cloudflare Workers Builds runs `npm run build` and `npx wrangler deploy`.

## Docs
- [docs/ROADMAP.md](docs/ROADMAP.md) — milestones
- [docs/SOURCES.md](docs/SOURCES.md) — sources and licences
- [CREDITS.md](CREDITS.md) — credits

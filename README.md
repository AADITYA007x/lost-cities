# Lost Cities: Mohenjo-daro

An interactive 3D reconstruction of Mohenjo-daro around 2500 BCE that shows how sure we are about every wall: excavated, inferred or imagined.

## Run
- Without the server: `npm run dev` → http://localhost:5173
- With the Worker: `npm run build` then `npx wrangler dev` → http://localhost:8787
- Skip the opening flight while testing: add `?skipintro` to the URL.
- Double-click (or double-tap) the landscape to glide back to the starting view.

## Terrain
`public/terrain/mohenjo-daro.bin` is made from the Copernicus DEM tile by `tools/make-terrain.py` (Python, only needed if the terrain is ever rebuilt). Keep the raw tile in `data-raw/` (git-ignored).

## Deploy
Push to `main`. Cloudflare Workers Builds runs `npm run build` and `npx wrangler deploy`.

## Docs
- [docs/ROADMAP.md](docs/ROADMAP.md) — milestones
- [docs/SOURCES.md](docs/SOURCES.md) — sources and licences
- [CREDITS.md](CREDITS.md) — credits

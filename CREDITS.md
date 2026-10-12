# Credits

## Code libraries
- [three.js](https://threejs.org/) — MIT License
- [Vite](https://vite.dev/) — MIT License
- [Wrangler](https://developers.cloudflare.com/workers/wrangler/) (Cloudflare) — MIT OR Apache-2.0

## Fonts
- [Cormorant Garamond](https://fonts.google.com/specimen/Cormorant+Garamond) by Christian Thalmann (Catharsis Fonts) — SIL Open Font License 1.1

## Archaeological sources (cited, not reproduced)
- Marshall, J. (ed.) 1931. *Mohenjo-daro and the Indus Civilization*. 3 vols. London: Arthur Probsthain.
- Mackay, E. J. H. 1938. *Further Excavations at Mohenjo-daro*. 2 vols. Delhi: Manager of Publications, Government of India.
  - Plate I (site plan): mound outlines, excavated areas and First Street, traced as coordinates.
  - Plate XVIII (DK area, G section, plan of the Intermediate I period): walls traced as coordinates, first with `tools/autotrace.py`, then reviewed in the plan tracer.
  - Scans: Archaeological Survey of India / Central Archaeological Library copy, via the Digital Library of India on Archive.org. The scans themselves are not included in this project.

## Data
- Elevation: Copernicus DEM GLO-30, tile N27 E068, processed with `tools/make-terrain.py` (smoothed, cropped to 8 × 8 km, mounds flattened into platforms, today's river used as a stand-in).
  - Produced using Copernicus WorldDEM-30 © DLR e.V. 2010-2014 and © Airbus Defence and Space GmbH 2014-2018 provided under COPERNICUS by the European Union and ESA; all rights reserved.
  - The organisations in charge of the Copernicus programme by law or by delegation do not incur any liability for any use of the Copernicus WorldDEM-30.

Every later source is listed here and next to the item it supports in the app.

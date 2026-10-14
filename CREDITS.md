# Credits

## Code libraries
- [three.js](https://threejs.org/) — MIT License
- [Vite](https://vite.dev/) — MIT License
- [Wrangler](https://developers.cloudflare.com/workers/wrangler/) (Cloudflare) — MIT OR Apache-2.0

## Fonts
- [Cormorant Garamond](https://fonts.google.com/specimen/Cormorant+Garamond) by Christian Thalmann (Catharsis Fonts) — SIL Open Font License 1.1

## Archaeological sources (cited, not reproduced)
- Marshall, J. (ed.) 1931. *Mohenjo-daro and the Indus Civilization*. 3 vols. London: Arthur Probsthain.
  - Vol. III plates, traced as coordinates: XXII (SD area, Great Bath: original structures only), XXX (L area), XXXIX (HR area, A and B sections), LIII (VS area, A and B sections).
  - Scan: Archaeological Survey of India copy (accession 48270), via the Digital Library of India on Archive.org (in.gov.ignca.48270). The scans themselves are not included in this project.
- Mackay, E. J. H. 1938. *Further Excavations at Mohenjo-daro*. 2 vols. Delhi: Manager of Publications, Government of India.
  - Plate I (site plan): mound outlines, excavated areas and First Street, traced as coordinates.
  - Plate XVIII (DK area, G section, plan of the Intermediate I period): walls traced as coordinates.
  - Plate XX (DK area, G section, plan of the Late I and II periods): walls traced as coordinates, for the late city in the time view.
  - Scans: Archaeological Survey of India / Central Archaeological Library copy, via the Digital Library of India on Archive.org. The scans themselves are not included in this project.

Walls were picked out of the plan scans by `tools/autotrace.py` and are reviewed by hand in the plan tracer. Each plate's scale and placement is recorded in `tools/plates.json`.

## Data
- Elevation: Copernicus DEM GLO-30, tile N27 E068, processed with `tools/make-terrain.py` (smoothed, cropped to 8 × 8 km, mounds flattened into platforms, today's river used as a stand-in).
  - Produced using Copernicus WorldDEM-30 © DLR e.V. 2010-2014 and © Airbus Defence and Space GmbH 2014-2018 provided under COPERNICUS by the European Union and ESA; all rights reserved.
  - The organisations in charge of the Copernicus programme by law or by delegation do not incur any liability for any use of the Copernicus WorldDEM-30.

Every later source is listed here and next to the item it supports in the app.

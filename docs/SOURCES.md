# Sources and licences (checked October 2026)

Not legal advice. This is a working summary so we make careful choices; when in doubt we link to a source instead of copying it.

## 1. Excavation plans (city layout)

### Marshall (ed.) 1931, *Mohenjo-daro and the Indus Civilization*, 3 vols, London: Arthur Probsthain
- What it is: the official account of the 1922–27 excavations. Vol. III holds the plates, including folding plans of the excavated areas (HR, VS, DK, SD, L, Stupa area).
- Where to read it: Vols I and II are on Archive.org (per harappa.com). Vol. III (plates) is not there, but scans of all volumes are hosted by the Indian Culture portal / NVLI (from the Archaeological Survey of India and the Central Secretariat Library).
- Copyright, by country:
  - Many contributors (Marshall, Mackay, Sahni, Gadd, Guha, Hemmy and others). Marshall died 1958.
  - India (life + 60) and Pakistan (life + 50): public domain.
  - UK (life + 70): Marshall's own text and plans stay protected until 1 Jan 2029.
  - USA (published 1931, 95 years): enters the public domain on **1 Jan 2027**, about 11 weeks from now.
- Our use: we **trace wall positions** (facts about where excavated walls stand) into our own new geometry and data. We do **not** put scans of the plates in the repo or app. We cite plate numbers and link to the online scans.

### Mackay 1938, *Further Excavations at Mohenjo-daro* (1927–31), 2 vols, Delhi: Manager of Publications, Government of India
- Where to read it: Archive.org (Digital Library of India / Public Resource uploads), BITS Pilani DSpace, Indian Culture portal.
- Copyright: a Government of India publication; Mackay died 1943. Public domain in India, Pakistan and the UK. US status is less clear (foreign works restored in 1996 may run to 2034).
- Our use: same rule. Trace geometry, cite plates, link, never redistribute scans.

### Later work (reference only, do not trace)
- Wheeler's 1950 citadel excavations, Dales 1964, and above all the **Aachen (RWTH) / IsMEO research project** led by Michael Jansen (1979 onward: Interim Reports, architectural documentation). These are the most accurate surveys of the standing remains and are still under copyright. We read them to check and correct our traces, and cite them, but don't copy their drawings.
- harappa.com (Kenoyer, Meadow and others): excellent photos and essays, all rights reserved. Link, never embed, unless we get permission.

### How accurate can our trace be?
- **Only part of the city is excavated.** The 1920s plans cover particular areas; most of the lower town is unexcavated, and a 2015 core-drilling survey showed the settlement extends beyond the dug area. So: traced walls become "excavated"; everything else is generated from rules and marked "inferred" or "imagined".
- **Phases are mixed.** The 1920s teams dug largely by depth, so walls of different building periods appear together on one plan. A single "height of the city, c. 2500 BCE" snapshot is itself a simplification. The app will say so.
- **Expected precision:** wall lines within roughly a metre inside one excavated area (after scaling each plate by its scale bar); a few metres between areas. Good enough for a reconstruction you walk through; not a survey.
- **Workflow (decided in Milestone 2):** scale each plate by its scale bar into one local metre grid, trace walls as polylines, store as JSON with `certainty`, `source` (book, plate) and `notes` per wall.

## 2. Elevation data (landscape)

### Copernicus DEM GLO-30 (recommended)
- 30 m resolution, free worldwide (except Armenia and Azerbaijan). Licence: "Licence for the use of the Copernicus WorldDEM-30". Commercial and non-commercial use allowed.
- Required notices (go in CREDITS.md and the app):
  - "produced using Copernicus WorldDEM-30 © DLR e.V. 2010-2014 and © Airbus Defence and Space GmbH 2014-2018 provided under COPERNICUS by the European Union and ESA; all rights reserved"
  - "The organisations in charge of the Copernicus programme by law or by delegation do not incur any liability for any use of the Copernicus WorldDEM-30."
- Tile needed: N27 E068 (Mohenjo-daro is near 27.33° N, 68.14° E). Free download from the AWS Open Data registry.
- Limits we must be honest about:
  - It is a *surface* model of **today**: modern fields, trees, buildings, and the excavated mounds as they are now.
  - At 30 m a pixel, it shows the mounds only as soft bumps, so the city itself is modelled by hand on top.
  - The plain has risen by several metres of river silt since 2500 BCE, and the Indus has shifted course. The ancient river's position is "inferred", not known exactly.

### SRTM (fallback)
- NASA/USGS, public domain, 30 m. Older and noisier; use only if a Copernicus tile has problems.

## 3. Images, models, script signs
- Wikimedia Commons: allowed per file licence (often CC BY-SA), credited per file.
- Museum photos (National Museum of Pakistan, National Museum New Delhi, Harappa.com): link only, unless the licence clearly allows reuse.
- Indus signs (Milestone 9): we will redraw signs ourselves as SVG and cite the sign lists we used; modern corpora (Mahadevan 1977, Parpola's CISI) are copyrighted and their numbering is cited, not copied wholesale.
- Default: generate procedurally.

## 4. Fonts and code
- Cormorant Garamond: SIL Open Font License, via Google Fonts.
- three.js: MIT. Vite: MIT. Wrangler: MIT OR Apache-2.0.

## 5. What we have used so far (October 2026)

- **Mackay 1938, Vol. II (plates)**, Archive.org scan (in.gov.ignca.9954). The fold-out plans are scanned small: about 1,100-1,650 px across a whole plan, so lettering is hard to read but solid walls are clear.
  - **Plate I, site plan.** Lined up with the elevation data using the stupa as anchor and the scale bar (1.408 m per scan pixel). The mounds on the plan match the elevation data to within about 15 m. Used for: mound outlines, excavated areas, First Street, the Great Bath position.
  - **Plate XVIII, DK-G southern portion, Intermediate I period.** Scale from its 100 ft survey grid (0.1555 m per px); placed by matching its outline to the site plan; First Street lands within about 1 m of the site plan's line. Walls extracted automatically (solid black only), to be reviewed by hand.
  - Plates VI, VII (SD area), XIII (DK-G northern portion) and XVI, XVII, XIX, XX (DK-G south at other levels) are not used yet. The other levels of DK-G are good material for the "city through time" slider.
- **Marshall 1931, Vol. III (plates)**: not available yet (the NVLI site did not respond). Needed for HR, VS and the citadel (SD, L).

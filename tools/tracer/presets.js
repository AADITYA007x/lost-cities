// Calibration already worked out for known plates, read from tools/plates.json
// (the same file the auto-tracer uses), so a known plate can be traced without
// setting the scale bar, north arrow and anchor by hand. See plates.json for how
// each plate was scaled and placed.

import config from '../plates.json';

export const PLATE_PRESETS = Object.fromEntries(
  config.plates.map((p) => [
    p.id,
    {
      label: p.label,
      file: p.file.split('/').pop(),
      source: p.source,
      plate: p.plate,
      page: p.page,
      area: p.area,
      calibration: {
        mPerPx: p.mPerPx,
        north: [[p.anchorPx[0], p.anchorPx[1] + 100], [p.anchorPx[0], p.anchorPx[1]]],
        anchor: { px: [...p.anchorPx], scene: [...p.anchorScene] },
      },
    },
  ])
);

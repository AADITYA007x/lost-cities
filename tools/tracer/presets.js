// Calibration already worked out for known plates, so they can be traced without
// setting the scale bar, north arrow and anchor by hand.
//
// How Plate XVIII was placed:
//  - scale from its own survey grid (100 ft squares, about 196 px apart) and scale bar: 0.1555 m per px
//  - north is straight up on the plate
//  - position: its outline matched by image correlation to the red "G Section (Southern Portion)"
//    on Mackay's site plan (Plate I), which is itself lined up with the elevation data
//  - check: First Street on the plate lands within about 1 m of First Street on the site plan
// Expected error: a few metres within the plate, about 15 m for the plate as a whole.

export const PLATE_PRESETS = {
  'mackay-xviii': {
    label: 'Mackay 1938 · Plate XVIII · DK-G south, Intermediate I',
    file: 'mackay-plate-XVIII-DK-G-south-intermediate-I.jpg',
    source: 'Mackay 1938',
    plate: 'XVIII',
    page: '50',
    area: 'DK-G',
    calibration: {
      mPerPx: 0.1555,
      north: [[680, 704], [680, 604]],
      anchor: { px: [680, 604], scene: [-98.5, -244.2] },
    },
  },
};

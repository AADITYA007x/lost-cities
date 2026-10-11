// "How true is this?" notes for the whole view. Plain language, sources listed.

export const LANDSCAPE_NOTE = {
  title: 'How true is this?',
  items: [
    {
      level: 'excavated',
      label: 'From real evidence',
      text: 'The two mounds sit where satellite elevation data puts them, with today’s Indus to the south-east. The Great Bath follows its excavated size: a pool about 12 × 7 m and 2.4 m deep, with stairs at the north and south ends, brick piers on three sides, and rooms to the east, one with a well. The brick podium of the Great Hall, the pillared hall in the south of the mound, the main streets and the street drains are all known from excavation.',
    },
    {
      level: 'inferred',
      label: 'Generated from rules',
      text: 'The houses are not yet traced from the excavation plans. They are generated from what excavated houses share: thick brick walls, rooms around an open courtyard, doors on side lanes rather than main streets, and wells in many courtyards. In the areas the excavators dug (HR, VS and DK, roughly placed), these houses stand in for real ones. Elsewhere the ground has not been excavated, and they are a reasonable guess.',
    },
    {
      level: 'inferred',
      label: 'Inferred',
      text: 'Upper storeys: many houses had brick staircases, so an upper floor is likely; how many and how tall is unknown. The platforms are drawn as clean rectangles; the real ones were less regular, and their sizes and heights here are approximate.',
    },
    {
      level: 'imagined',
      label: 'Imagined',
      text: 'Flat roofs of timber, reeds and mud are a reasonable guess, since no roof survives. The timber hall above the Great Hall’s brick blocks, and the ramps up to the platforms, are imagined.',
    },
    {
      level: 'inferred',
      label: 'Debated',
      text: 'What the Great Bath was for is not known. Ritual bathing is the most common view, not a proven fact. Wheeler called the Great Hall a “granary”, but there is no clear evidence that grain was stored there, and many archaeologists now prefer “Great Hall”. The name “College of Priests” for the building north-east of the bath is also a guess.',
    },
    {
      level: 'simplified',
      label: 'Left out',
      text: 'The Buddhist stupa that tops the citadel mound today was built about two and a half thousand years after this moment, so it is not shown.',
    },
    {
      level: 'inferred',
      label: 'The river',
      text: 'The Indus has changed course many times. It flowed near the city, but its channel in 2500 BCE is not known. We use today’s channel as a stand-in.',
    },
    {
      level: 'simplified',
      label: 'Simplified ground',
      text: 'The elevation data shows today’s ground. River floods have since laid several metres of silt across the plain, so the ancient plain lay lower than today’s fields. We don’t model that yet, and we smooth away modern roads and canals.',
    },
  ],
  sources: [
    'Marshall, J. (ed.) 1931. Mohenjo-daro and the Indus Civilization. London: Probsthain.',
    'Mackay, E. J. H. 1938. Further Excavations at Mohenjo-daro. Delhi: Government of India.',
    'Kenoyer, J. M. 1998. Ancient Cities of the Indus Valley Civilization. Karachi: Oxford University Press.',
    'Copernicus DEM GLO-30, tile N27 E068 (ESA / European Union).',
  ],
  dataNotice:
    'Produced using Copernicus WorldDEM-30 © DLR e.V. 2010–2014 and © Airbus Defence and Space GmbH 2014–2018 provided under COPERNICUS by the European Union and ESA; all rights reserved. The organisations in charge of the Copernicus programme by law or by delegation do not incur any liability for any use of the Copernicus WorldDEM-30.',
};

export const PLACE_LABELS = {
  citadel: 'Citadel mound',
  lowerTown: 'Lower town',
  river: 'Indus · position inferred',
  greatBath: 'Great Bath',
  greatHall: 'Great Hall (“granary”)',
  firstStreet: 'First Street',
};

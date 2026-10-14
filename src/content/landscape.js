// "How true is this?" notes for the whole view. Plain language, sources listed.

export const LANDSCAPE_NOTE = {
  title: 'How true is this?',
  items: [
    {
      level: 'excavated',
      label: 'From the excavation plans',
      text: 'The walls in the five areas the excavators dug most fully come from their published plans: HR, VS and L, and the buildings round the Great Bath (Marshall 1931), and DK-G (Mackay 1938). Each plan was scaled from its own scale bar and placed by matching its outline to Mackay\u2019s site plan, which lines up with the satellite elevation data to within about 15 m. The Great Bath\u2019s pool is about 12 \u00d7 7 m and 2.4 m deep.',
    },
    {
      level: 'simplified',
      label: 'Several periods at once',
      text: 'The city was rebuilt many times over several centuries. Mackay drew DK-G one building level at a time; we show his \u201cIntermediate I\u201d level. Marshall\u2019s plans of HR, VS and L show walls of different periods together, so some walls there never stood at the same time. For the Great Bath we use only what Marshall marked as original structures. \u201cAround 2500 BCE\u201d is an approximation.',
    },
    {
      level: 'inferred',
      label: 'Walls from the plan',
      text: 'A plan shows where walls stand, not how tall they are. Traced walls are shown a full storey high: the lower part is marked excavated, the rest inferred. The walls were picked out from the plan scans automatically and are being checked by hand; thin walls, wells and drains are still missing in places.',
    },
    {
      level: 'inferred',
      label: 'Generated from rules',
      text: 'Everywhere else the houses are generated from what excavated houses share: thick brick walls, rooms around a courtyard, doors on side lanes, wells in many courtyards. Most of the city has never been excavated, so these are a reasonable guess.',
    },
    {
      level: 'inferred',
      label: 'Inferred',
      text: 'Upper storeys: many houses had brick staircases, so an upper floor is likely; how many and how tall is unknown. The platforms follow the outer contours of the mounds on the site plan, simplified; their heights here are approximate.',
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
      level: 'inferred',
      label: 'Sun and seasons',
      text: 'The sun\u2019s path is calculated for Mohenjo-daro\u2019s latitude, with the Earth\u2019s tilt as it was around 2500 BCE (about 24\u00b0, a little more than today\u2019s 23.4\u00b0). Times are sun times, not clock times. The seasons follow today\u2019s pattern at the site: a cool winter, a very hot early summer, the summer monsoon, and the clear months after it. Climate studies suggest the summer monsoon was somewhat stronger then and weakened over the following centuries; how much is debated. The colours of sky and haze are an impression, not a measurement.',
    },
    {
      level: 'imagined',
      label: 'People',
      text: 'The crafts shown are known from finds at Mohenjo-daro: stone beads, shell bangles, pottery, seals, cotton thread, copper and bronze, grinding grain, drawing water. Where each workshop stands, who did the work, how many people walked the streets and how they looked are imagined. The figures are deliberately simple stand-ins.',
    },
    {
      level: 'inferred',
      label: 'Monsoon',
      text: 'The city\u2019s covered drains are well known: brick channels along the streets, fed by drains from the houses, with soak pits to catch silt. In the rain, water is drawn running along the street drains so you can see it; in reality most of it ran under the covers. The direction of flow in each drain is inferred. The Indus flooded every summer, which is one reason the city stood on high platforms; the river rising here by about a metre is an illustration, not a model of a real flood.',
    },
    {
      level: 'imagined',
      label: 'At night',
      text: 'The small lamps in courtyards are imagined: how homes were lit after dark is not well known. The stars are a generic field, not a map of the sky in 2500 BCE, when the star nearest the north celestial pole was Thuban, not today\u2019s Pole Star.',
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
  traced: 'walls from the excavation plan',
};

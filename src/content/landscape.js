// "How true is this?" notes for the landscape view. Plain language, sources per item.

export const LANDSCAPE_NOTE = {
  title: 'How true is this landscape?',
  items: [
    {
      level: 'excavated',
      label: 'From real data',
      text: 'The shape of the land, the positions of the two mounds, and the course of today’s Indus come from satellite elevation data (Copernicus DEM, 30 m per pixel).',
    },
    {
      level: 'inferred',
      label: 'Inferred',
      text: 'The city stood on raised platforms: a high western mound (the “citadel”) and a larger lower town to the east. We show both as smooth, flat-topped platforms. Today the citadel mound stands about 12 m high, including a much later Buddhist stupa; the heights we show for 2500 BCE are approximate.',
    },
    {
      level: 'inferred',
      label: 'Inferred',
      text: 'The Indus has changed course many times. It flowed near the city, but its exact channel in 2500 BCE is not known. We use today’s channel as a stand-in.',
    },
    {
      level: 'simplified',
      label: 'Simplified',
      text: 'The data shows today’s ground. Since the city was built, river floods have laid several metres of silt across the plain, so the ancient plain lay lower than today’s fields. We don’t model that difference yet, and we smooth away modern roads, canals and fields.',
    },
    {
      level: 'simplified',
      label: 'Simplified',
      text: 'The city itself, its streets, houses and the Great Bath, arrives in the next step. The 30 m data is far too coarse to show buildings.',
    },
  ],
  sources: [
    'Copernicus DEM GLO-30, tile N27 E068 (ESA / European Union).',
    'Marshall, J. (ed.) 1931. Mohenjo-daro and the Indus Civilization. London: Probsthain.',
  ],
  dataNotice:
    'Produced using Copernicus WorldDEM-30 © DLR e.V. 2010–2014 and © Airbus Defence and Space GmbH 2014–2018 provided under COPERNICUS by the European Union and ESA; all rights reserved. The organisations in charge of the Copernicus programme by law or by delegation do not incur any liability for any use of the Copernicus WorldDEM-30.',
};

export const PLACE_LABELS = {
  citadel: 'Citadel mound',
  lowerTown: 'Lower town',
  river: 'Indus · position inferred',
};

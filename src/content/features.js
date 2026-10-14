// Notes for the info panel: what each feature was, what we know, what is debated,
// and what the visitor is actually looking at. Plain language; sources per item.

import { CRAFT_FEATURES, WALKERS_NOTE } from './crafts.js';

export const SOURCES = {
  marshall: 'Marshall, J. (ed.) 1931. Mohenjo-daro and the Indus Civilization. 3 vols. London: Probsthain.',
  mackay: 'Mackay, E. J. H. 1938. Further Excavations at Mohenjo-daro. 2 vols. Delhi: Government of India.',
  wheeler: 'Wheeler, M. 1968. The Indus Civilization. 3rd ed. Cambridge: Cambridge University Press.',
  kenoyer: 'Kenoyer, J. M. 1998. Ancient Cities of the Indus Valley Civilization. Karachi: Oxford University Press.',
  jansen: 'Jansen, M. 1993. Mohenjo-Daro: Water Splendour 4500 Years Ago. Bergisch Gladbach: Frontinus-Gesellschaft.',
  dales: 'Dales, G. F. 1964. The Mythical Massacre at Mohenjo-daro. Expedition 6 (3): 36–43.',
  harappa: 'Harappa.com (J. M. Kenoyer, R. H. Meadow and others): photographs and essays on Mohenjo-daro.',
  copernicus: 'Copernicus DEM GLO-30 (ESA / European Union): elevation data.',
};

export const FEATURES = {
  greatBath: {
    title: 'The Great Bath',
    kicker: 'Citadel mound · SD area',
    certainty: 'excavated',
    what: 'A sunken brick pool in a walled courtyard, with rooms and corridors around it.',
    known: [
      'The pool is about 12 m long, 7 m wide and 2.4 m deep, with a flight of steps at the north and south ends.',
      'Its floor and sides are finely fitted bricks set on edge in gypsum mortar, backed by a layer of bitumen to hold the water.',
      'A drain at one corner let it be emptied; a room to the east holds a well.',
    ],
    debated: 'What it was for. Ritual bathing for purity is the most common view, but no text survives to confirm it.',
    here: 'Walls traced from Marshall’s plan (Plate XXII), using only what he marked as original. The pool is built to its published size; the water is imagined.',
    sources: ['marshall', 'kenoyer', 'harappa'],
  },
  greatHall: {
    title: 'The Great Hall (“granary”)',
    kicker: 'Citadel mound, beside the Great Bath',
    certainty: 'inferred',
    what: 'A massive brick base divided into solid blocks by narrow passages.',
    known: [
      'Mortimer Wheeler investigated it in 1950.',
      'Only the brick base survives. Whatever stood on top, probably timber, is gone.',
    ],
    debated: 'Wheeler called it a granary, with the passages airing the grain. No stored grain has been found, and many archaeologists now prefer “Great Hall”.',
    here: 'Its eastern blocks appear on Marshall\u2019s plan of the bath (Plate XXII) and are traced; the rest is generated from published descriptions, so its size and shape are approximate. The roof on posts above the blocks is imagined.',
    sources: ['wheeler', 'kenoyer', 'harappa'],
  },
  college: {
    title: 'The so-called “College of Priests”',
    kicker: 'Citadel mound, north-east of the Great Bath',
    certainty: 'imagined',
    what: 'A large building of many rooms around a courtyard, across the street from the Great Bath.',
    known: ['Its name was the early excavators’ guess: they imagined priests living beside the bath.'],
    debated: 'Nothing found in it shows who used it or how. “College” and “priests” are guesses.',
    here: 'Not traced yet: shown as a generated courtyard building in roughly the right place.',
    sources: ['marshall', 'kenoyer'],
  },
  pillaredHall: {
    title: 'The pillared hall',
    kicker: 'Citadel mound · L area',
    certainty: 'excavated',
    what: 'A hall about 27.5 m square whose roof rested on twenty brick piers, in four rows of five.',
    known: [
      'Marshall dated it to the Intermediate period. Later walls divided it into smaller rooms.',
      'Only the two western rows of piers survived intact.',
    ],
    debated: 'Its use is unknown. Its size suggests a public building where many people gathered, but that is a guess.',
    here: 'Walls traced from Marshall’s plan of the L area (Plate XXX).',
    sources: ['marshall', 'harappa'],
  },
  firstStreet: {
    title: 'First Street',
    kicker: 'Lower town · main north–south street',
    certainty: 'excavated',
    what: 'The excavators’ name for the long north–south street through the DK-G, VS and HR areas.',
    known: [
      'About 7 m wide where Mackay drew it, lined by the blank outer walls of houses. Front doors usually opened onto side lanes.',
      'Covered brick drains ran along it, with soak pits where silt could settle.',
    ],
    debated: null,
    here: 'Its line joins the street as drawn on the DK-G and HR plans; between them it is inferred. Where the automatic tracing put lines across the middle of the street (mostly drains and cover stones on the old plans), they are left out so the street stays open.',
    sources: ['mackay', 'marshall', 'jansen'],
  },
  'area-HR': {
    title: 'HR area',
    kicker: 'Lower town, south',
    certainty: 'excavated',
    what: 'A dense quarter of houses, lanes and wells on both sides of First Street.',
    known: [
      'Excavated in 1925–27 and published by Marshall (1931).',
      'The bronze “Dancing Girl”, 10.5 cm tall, was found here in 1926, in a house in Block 7.',
      'Fourteen skeletons were found in one room of House V.',
    ],
    debated: 'Wheeler read skeletons like these as victims of a final massacre. Later study (Dales 1964) found they come from different times, with no evidence of a massacre.',
    here: 'Walls traced from Marshall’s Plate XXXIX. His plan shows walls of several periods together, so not all of them stood at once. Roofs over the rooms the plan encloses, and the few upper rooms, are imagined, so the quarter reads like the generated houses around it; switch to Evidence to see only the walls. Where the plan’s rectangle has no walls, generated houses fill the gap.',
    sources: ['marshall', 'dales', 'harappa'],
  },
  'area-VS': {
    title: 'VS area',
    kicker: 'Lower town, centre',
    certainty: 'excavated',
    what: 'Houses, lanes and wells beside First Street.',
    known: [
      'Excavated in the 1920s and published by Marshall (1931).',
      'Houses here had wells, bathrooms, and drains that ran out into First Street.',
    ],
    debated: null,
    here: 'Walls traced from Marshall’s Plate LIII (A and B sections). Several periods are shown together. The north-west part of VS is on another plate, not traced yet. Roofs over the rooms the plan encloses, and the few upper rooms, are imagined, so the quarter reads like the generated houses around it; switch to Evidence to see only the walls. Where the plan’s rectangle has no walls, generated houses fill the gap.',
    sources: ['marshall'],
  },
  'area-DK-G': {
    title: 'DK-G area',
    kicker: 'Lower town, north-west',
    certainty: 'excavated',
    what: 'Houses on narrow lanes off First Street.',
    known: [
      'Excavated by Ernest Mackay in 1927–31. He recorded the buildings level by level, more carefully than the earlier digs.',
      'Many houses had wells, bathrooms and drains.',
    ],
    debated: null,
    here: 'Walls traced from Mackay’s plan of one level, “Intermediate I” (Plate XVIII). Only the southern part of DK-G is traced; the rest is generated. Roofs over the rooms the plan encloses, and the few upper rooms, are imagined, so the quarter reads like the generated houses around it; switch to Evidence to see only the walls. Where the plan’s rectangle has no walls, generated houses fill the gap.',
    sources: ['mackay'],
  },
  'area-L': {
    title: 'L area',
    kicker: 'Citadel mound, south',
    certainty: 'excavated',
    what: 'Large buildings on the southern part of the citadel mound, including the pillared hall.',
    known: ['Excavated in 1926–27 and published by Marshall (1931).'],
    debated: 'What these large buildings were for is not known.',
    here: 'Walls traced from Marshall’s Plate XXX. Several periods are shown together. Roofs over the rooms the plan encloses, and the few upper rooms, are imagined, so the quarter reads like the generated houses around it; switch to Evidence to see only the walls. Where the plan’s rectangle has no walls, generated houses fill the gap.',
    sources: ['marshall'],
  },
  'area-SD': {
    title: 'SD area',
    kicker: 'Citadel mound, north',
    certainty: 'inferred',
    what: 'The northern part of the citadel mound: the Great Bath and the buildings around it.',
    known: [
      'Excavated in the 1920s and published by Marshall (1931).',
      'Much of it lies beneath a Buddhist stupa and monastery built more than two thousand years after the Indus city.',
    ],
    debated: null,
    here: 'Apart from the Great Bath, the buildings here are generated; Marshall’s other plans of this area are not traced yet.',
    sources: ['marshall'],
  },
  'area-DK': {
    title: 'DK area',
    kicker: 'Lower town, north and east',
    certainty: 'inferred',
    what: 'Excavated houses and workshops in the north and east of the lower town.',
    known: [
      'These parts (the A, B and C sections) were excavated in the 1920s and published by Marshall (1931).',
      'The steatite figure known as the “Priest-King” was found in the DK-B area in 1925–26.',
    ],
    debated: 'The name “Priest-King” is a modern guess. Nothing shows that the man it portrays was a priest or a king.',
    here: 'The plans of these sections are not traced yet. The houses here are generated, standing in for the excavated ones.',
    sources: ['marshall', 'harappa'],
  },
  houseInferred: {
    title: 'A house in an excavated area',
    kicker: 'Generated',
    certainty: 'inferred',
    what: 'Houses were found here, but the plan of this area is not traced yet.',
    known: [
      'Excavated houses usually have rooms around an open courtyard, thick brick walls and few openings to the street.',
      'Many had a well, a bathroom and a drain into the street.',
    ],
    debated: null,
    here: 'Generated as a stand-in for the excavated houses here.',
    sources: ['kenoyer', 'jansen'],
  },
  houseImagined: {
    title: 'A house in the unexcavated city',
    kicker: 'Generated',
    certainty: 'imagined',
    what: 'Most of Mohenjo-daro has never been dug. Houses like this one fill the gaps.',
    known: [
      'Excavated houses usually have rooms around an open courtyard, thick brick walls and few openings to the street.',
      'Doorways tend to open onto side lanes rather than main streets.',
      'Stairs in many houses suggest upper floors or roof terraces.',
    ],
    debated: null,
    here: 'Generated from those rules. Its size, plan and position are guesses.',
    sources: ['kenoyer', 'jansen'],
  },
  citadel: {
    title: 'The citadel mound',
    kicker: 'Western mound',
    certainty: 'inferred',
    what: 'A high mound west of the lower town, built up on massive platforms of mud brick and earth.',
    known: [
      'Its public buildings include the Great Bath, the Great Hall and the pillared hall.',
      'Today it stands about 12 m above the plain, crowned by a Buddhist stupa built more than two thousand years after the Indus city.',
    ],
    debated: '“Citadel” is a modern name, borrowed from walled strongholds elsewhere. Whether it was a seat of rulers, a ritual centre or something else is not known.',
    here: 'Outline from Mackay’s site plan, simplified; the height is approximate.',
    sources: ['mackay', 'kenoyer'],
  },
  lowerTown: {
    title: 'The lower town',
    kicker: 'Eastern mound',
    certainty: 'inferred',
    what: 'The larger, lower part of the city: blocks of houses and workshops divided by streets and lanes.',
    known: ['It was raised above the flood plain on platforms of earth and brick.'],
    debated: 'How many people lived here is uncertain; estimates vary widely.',
    here: 'Outline from Mackay’s site plan, simplified. Only the traced areas follow the excavation plans.',
    sources: ['mackay', 'kenoyer'],
  },
  river: {
    title: 'The Indus',
    kicker: 'River',
    certainty: 'inferred',
    what: 'The great river of the plain, whose floods brought both fertile silt and danger.',
    known: ['The city lay close to the river.'],
    debated: 'Where it ran in 2500 BCE is not known. It has shifted many times, so today’s channel is used here as a stand-in.',
    here: 'Today’s channel, from satellite elevation data.',
    sources: ['kenoyer', 'copernicus'],
  },
  plain: {
    title: 'The Indus plain',
    kicker: 'Landscape',
    certainty: 'inferred',
    what: 'Flat, fertile land laid down by the river.',
    known: ['Floods have since raised the plain by several metres, burying the lowest parts of the city.'],
    debated: null,
    here: 'Today’s ground from satellite elevation data, smoothed. The ancient plain lay lower.',
    sources: ['copernicus', 'kenoyer'],
  },
  drain: {
    title: 'A street drain',
    kicker: 'Water and drainage',
    certainty: 'inferred',
    what: 'A covered brick drain along a street.',
    known: [
      'Drains of brick, covered with bricks or stone slabs, ran along streets and lanes. Houses emptied into them.',
      'Soak pits along the way caught silt and could be cleaned out.',
    ],
    debated: null,
    here: 'Drawn as a raised line of darker cover bricks, with a soak pit every so often. Drains on the traced plans are drawn where the plan shows them; along First Street the drain is known; along the generated streets it is imagined, and the spacing of the soak pits is a guess. In the monsoon view, running water is drawn along the drain line so you can see it; in reality it ran under the covers. Which way it ran here is inferred: toward the end of the street nearer the river. In the Guide, “A street drain” marks every drain in gold for a moment.',
    sources: ['jansen', 'kenoyer'],
  },
  well: {
    title: 'A well',
    kicker: 'Water',
    certainty: 'excavated',
    what: 'A round shaft lined with wedge-shaped bricks.',
    known: ['Michael Jansen estimated that the city had over 700 wells, most of them inside private buildings.'],
    debated: null,
    here: 'Wells on the traced plans are where the plans show them; wells in generated houses are imagined. The paved floor around each well is common on the plans but drawn the same for every well here. In the Guide, “A well” marks every well in gold for a moment.',
    sources: ['jansen', 'harappa'],
  },
  cart: {
    title: 'An ox cart',
    kicker: 'Life in the city',
    certainty: 'imagined',
    what: 'A two-wheeled cart drawn by a humped ox, carrying sacks.',
    known: [
      'Terracotta models of carts with solid wheels, and figurines of humped cattle, are common finds at Mohenjo-daro and other Indus cities.',
      'Humped cattle (zebu) also appear on many seals.',
    ],
    debated: 'Real carts were wooden and have not survived, so their size and build are inferred from the toy-sized models. How much goods moved by cart, by boat on the river, or on people’s heads is not known.',
    here: 'Imagined: the carts, where they go and what they carry. They keep to the streets by day and stay in when it rains.',
    sources: ['kenoyer', 'marshall'],
  },
  fields: {
    title: 'Fields and trees on the plain',
    kicker: 'Landscape · imagined',
    certainty: 'imagined',
    what: 'Fields of wheat, barley and cotton around the city, with trees along the field edges and the river.',
    known: [
      'Plant remains from Indus sites show wheat and barley, grown through the cool season after the flood, and summer crops such as cotton and sesame.',
      'Traces of cotton cloth have been found at Mohenjo-daro.',
    ],
    debated: 'Where the fields lay, how large they were, and how they were watered (by the flood, wells or channels) is not known. Which trees grew here is not known either.',
    here: 'Imagined. The colours follow the seasons: young winter crops in the cool season, harvest gold in the hot season, cotton through the monsoon.',
    sources: ['kenoyer'],
  },
  ramp: {
    title: 'A ramp',
    kicker: 'Imagined',
    certainty: 'imagined',
    what: 'A way up onto the platform.',
    known: [],
    debated: 'How people climbed onto the platforms is not known.',
    here: 'Imagined.',
    sources: [],
  },
};

// One line about the exact piece that was clicked.
Object.assign(FEATURES, CRAFT_FEATURES, { walkers: WALKERS_NOTE });

// after the city: the mounds and the stupa (shown in the later moments of the time view)
Object.assign(FEATURES, {
  mound: {
    title: 'The mounds',
    kicker: 'After the city',
    certainty: 'inferred',
    what: 'Fallen brick, silt and windblown dust that slowly buried the abandoned city.',
    known: [
      'The two mounds still rise above the plain. Their surface is strewn with broken brick.',
      'River floods have also raised the plain around them by several metres since the city was built.',
    ],
    debated: null,
    here: 'The mounds follow the platforms\u2019 outline on the site plan; their shape and height are simplified.',
    sources: ['marshall', 'jansen', 'copernicus'],
  },
  stupa: {
    title: 'The stupa',
    kicker: 'Citadel mound · much later',
    certainty: 'inferred',
    what: 'A Buddhist stupa of mud brick and baked brick, with a monastery beside it, built on top of the high mound.',
    known: [
      'It is usually dated to the Kushan period, around the 2nd century CE: more than two thousand years after the city.',
      'Its ruin is what first drew R. D. Banerji to the site in 1922.',
    ],
    debated: 'A minority view argues that the mound under the stupa hides an older, Harappan building, and that the stupa is later work on top of it.',
    here: 'A simplified form placed where the stupa stands on Mackay\u2019s site plan. The monastery beside it is left out.',
    sources: ['marshall', 'kenoyer'],
  },
});

export function elementLine(kind, certainty, { traced = false } = {}) {
  const c = ['excavated', 'inferred', 'imagined'][certainty] ?? 'inferred';
  switch (kind) {
    case 'walls':
      if (c === 'excavated') return ['excavated', 'This wall is drawn on the excavation plan.'];
      if (traced) return ['inferred', 'The plan shows where this wall stood, not how tall it was: its upper part is inferred.'];
      if (c === 'inferred') return ['inferred', 'Houses were excavated here, but this wall belongs to a generated stand-in.'];
      return ['imagined', 'This wall is generated where nothing has been excavated.'];
    case 'roofs':
      if (c === 'inferred') return ['inferred', 'An upper floor: stairs in many houses suggest one; its form is a guess.'];
      return ['imagined', 'No roof survives. Flat roofs of timber, reeds and mud are a reasonable guess.'];
    case 'drains':
      return [c, c === 'excavated' ? 'This drain is drawn on the excavation plan.' : c === 'inferred' ? 'Drains like this ran along First Street; its exact line here is inferred.' : 'This drain continues the pattern of the excavated streets: imagined.'];
    case 'paving':
      return [c, c === 'imagined' ? 'This drain or paving is imagined.' : 'Paving and drains like this are known from the excavations.'];
    case 'ramps':
      return ['imagined', 'This ramp is imagined.'];
    case 'well':
      return [c, c === 'excavated' ? 'This well is on the excavation plan.' : 'This well is part of a generated house.'];
    case 'pool':
      return ['excavated', 'The pool’s size is published; the water in it is imagined.'];
    case 'craft':
      return ['imagined', 'The craft is known from finds here; this figure and where it works are imagined.'];
    case 'walker':
      return ['imagined', 'This figure is imagined.'];
    case 'platform':
      return ['inferred', 'The platform’s outline follows the site plan, simplified; its height is approximate.'];
    default:
      return null;
  }
}

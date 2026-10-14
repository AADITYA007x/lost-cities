// The guided tour: ten stops through the city. Each stop names a place (resolved to a
// camera view in main.js), the feature whose info panel "More about this" opens, and
// the moment in time and view it is best seen in. Every stop says what is debated.

export const TOUR = [
  {
    place: 'overview',
    kicker: 'Sindh, Pakistan · c. 2500 BCE',
    title: 'A city on the Indus plain',
    certainty: 'inferred',
    text: 'Mohenjo-daro was one of the largest cities of the Indus civilisation, part of the shared heritage of South Asia. It has two parts: a high mound to the west, now called the citadel, and a larger lower town to the east. How many people lived here is debated, and where the river ran then is not known: today’s channel stands in for it.',
    feature: 'river',
  },
  {
    place: 'citadel',
    kicker: 'Western mound',
    title: 'The high mound',
    certainty: 'inferred',
    text: 'It was raised on massive platforms of mud brick and earth, and carried some of the city’s largest buildings. “Citadel” is a modern name, borrowed from walled strongholds elsewhere. Whether it was a seat of rulers, a ritual centre or something else is not known.',
    feature: 'citadel',
  },
  {
    place: 'greatBath',
    kicker: 'Citadel mound',
    title: 'The Great Bath',
    certainty: 'excavated',
    text: 'A pool about 12 m long and 2.4 m deep, with steps at both ends, made watertight with finely fitted brick, gypsum mortar and a layer of bitumen. What it was for is debated. Ritual bathing for purity is the most common view, but no text survives to confirm it.',
    feature: 'greatBath',
  },
  {
    place: 'greatHall',
    kicker: 'Citadel mound',
    title: 'The Great Hall (“granary”)',
    certainty: 'inferred',
    text: 'A massive brick base cut by narrow passages. Mortimer Wheeler called it a granary in 1950, but no stored grain has been found, and many archaeologists now prefer “Great Hall”. Only the base survives; the timber building on top is imagined.',
    feature: 'greatHall',
  },
  {
    place: 'lowerTown',
    kicker: 'Eastern mound',
    title: 'The lower town',
    certainty: 'inferred',
    text: 'Blocks of houses and workshops on raised platforms, divided by straight streets and narrow lanes. Most of the city has never been excavated: where no plan exists, the houses you see are generated from the rules of excavated ones.',
    feature: 'lowerTown',
  },
  {
    place: 'firstStreet',
    kicker: 'Lower town',
    title: 'First Street',
    certainty: 'excavated',
    text: 'The main north–south street, about 7 m wide where Mackay drew it. It was lined by the blank outer walls of houses; front doors usually opened onto the side lanes. Covered brick drains ran along it.',
    feature: 'firstStreet',
  },
  {
    place: 'area-HR',
    kicker: 'Lower town, south',
    title: 'Houses of the HR area',
    certainty: 'excavated',
    text: 'Houses with rooms around courtyards, many with their own well, bathroom and drain. The bronze “Dancing Girl” was found here. Wheeler read skeletons found in this area as victims of a final massacre; later study found they come from different times, with no evidence of a massacre.',
    feature: 'area-HR',
  },
  {
    place: 'craft-beads',
    kicker: 'Life in the city',
    title: 'A bead maker',
    certainty: 'imagined',
    text: 'Long carnelian beads, drilled right through their length, are among the finest crafts of the city, and beads like these reached Mesopotamia. The craft is known from finds; this person, and where the workshop stands, are imagined. You can talk to them with “Talk to a resident”.',
    feature: 'craft-beads',
  },
  {
    place: 'evidence',
    kicker: 'How sure are we?',
    title: 'Excavated, inferred, imagined',
    certainty: 'inferred',
    mode: 'evidence',
    text: 'The Evidence view colours everything by how we know it. Walls drawn from excavation plans are excavated; stand-ins for excavated but untraced areas are inferred; the rest is imagined. Most of what you see is reconstruction. You can switch views at any time.',
    feature: null,
  },
  {
    place: 'afterCity',
    kicker: 'After the city',
    title: 'Ruins and the stupa',
    certainty: 'excavated',
    era: 'today',
    text: 'By about 1700 BCE the city was largely empty. Why it declined is debated: changes in rivers and climate, and shifts in trade, are the main ideas; the old story of an invasion is not supported by the evidence. Much later a Buddhist stupa was built on the high mound. Excavation began in 1922.',
    feature: 'stupa',
  },
];

// the places list: groups in the order shown, each entry an id in FEATURES (and a place)
export const PLACE_GROUPS = [
  { title: 'Citadel mound', ids: ['citadel', 'greatBath', 'greatHall', 'college', 'pillaredHall', 'area-SD', 'area-L'] },
  { title: 'Lower town', ids: ['lowerTown', 'firstStreet', 'area-HR', 'area-VS', 'area-DK-G', 'area-DK'] },
  { title: 'Water', ids: ['well', 'drain'] },
  { title: 'Life in the city', ids: ['cart', 'fields', 'craft-beads', 'craft-shell', 'craft-potter', 'craft-seals', 'craft-spinning', 'craft-metal'] },
  { title: 'Landscape and later times', ids: ['river', 'mound', 'stupa'] },
];

// extra words people may search for
export const SEARCH_WORDS = {
  greatBath: 'pool water ritual bathing',
  greatHall: 'granary grain wheeler',
  college: 'priests',
  'area-HR': 'dancing girl bronze skeletons massacre',
  'area-DK': 'priest-king priest king steatite statue',
  'craft-seals': 'script writing signs seal unicorn',
  'craft-beads': 'carnelian jewellery jewelry',
  'craft-shell': 'bangles conch',
  stupa: 'buddhist kushan monastery',
  mound: 'ruins buried',
  river: 'indus flood',
  firstStreet: 'road',
  well: 'water wells',
  drain: 'drains sewer soak pit water',
  cart: 'ox oxen bullock cattle zebu wheel',
  fields: 'crops wheat barley cotton farming trees',
};

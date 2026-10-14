// Crafts and daily work shown by the figures in the city. The crafts are attested by
// finds at Mohenjo-daro; where each workshop stands, who did the work and how people
// looked are imagined.

const WHERE =
  'Where this workshop stands is imagined. Workshops and finds from many crafts turn up across the city, in ordinary houses as well as larger buildings, rather than in one craft quarter.';
const WHO = 'Who did this work — men, women, children, families — is not known from the finds.';

export const CRAFTS = {
  beads: {
    label: 'Bead maker',
    title: 'Making stone beads',
    what: 'Drilling a long carnelian bead with a hard stone drill, turned by a bow.',
    known: [
      'Beads of carnelian, agate, jasper and other stones are found in great numbers. Long carnelian beads took great skill: each was drilled right through its length, from both ends.',
      'The drills were made of a very hard stone. Drill bits and unfinished beads show each stage of the work.',
      'Carnelian was heated to deepen its red. Beads like these reached Mesopotamia.',
    ],
    debated: null,
    sources: ['kenoyer', 'marshall', 'mackay'],
  },
  shell: {
    label: 'Shell worker',
    title: 'Cutting shell bangles',
    what: 'Sawing rings from a conch shell to make bangles.',
    known: [
      'Shell bangles were common. They were cut from large conch shells brought from the coast, hundreds of kilometres away.',
      'Saw marks show the shells were cut with fine bronze saws. Shell was also used for inlay and ladles.',
    ],
    debated: null,
    sources: ['kenoyer', 'marshall'],
  },
  potter: {
    label: 'Potter',
    title: 'Making pottery',
    what: 'Shaping a pot on a wheel.',
    known: [
      'Most everyday pottery was made on a wheel, much of it red with black painted designs.',
      'Kilns for firing pottery have been found at Mohenjo-daro.',
    ],
    debated: 'How the wheel was turned and how workshops were organised is still studied.',
    sources: ['kenoyer', 'marshall', 'mackay'],
  },
  seals: {
    label: 'Seal carver',
    title: 'Carving a seal',
    what: 'Cutting an animal and a line of signs into a small square of steatite (soapstone).',
    known: [
      'More than a thousand seals and sealings come from Mohenjo-daro. The most common animal on them is the "unicorn".',
      'Seals were carved in soft steatite, then heated, which made the surface hard and white.',
      'Most carry a short line of Indus signs. The script has not been deciphered.',
    ],
    debated: 'What the seals were used for — trade, office, identity, belief — is debated; probably several things.',
    sources: ['kenoyer', 'marshall', 'mackay'],
  },
  spinning: {
    label: 'Spinner',
    title: 'Spinning cotton',
    what: 'Spinning cotton into thread with a drop spindle: a stick with a clay whorl that turns as it hangs from the thread.',
    known: [
      'Traces of cotton cloth survived on a silver vessel found at Mohenjo-daro: among the earliest known cotton textiles in the world.',
      'Spindle whorls are common finds. Some cloth seems to have been dyed with madder, a red dye.',
    ],
    debated: null,
    sources: ['marshall', 'kenoyer'],
  },
  metal: {
    label: 'Metalworker',
    title: 'Casting copper',
    what: 'Melting copper in a small crucible over a charcoal fire.',
    known: [
      'Tools, vessels and ornaments of copper and bronze are found throughout the city.',
      'Some figures, like the "Dancing Girl", were cast by the lost-wax method.',
    ],
    debated: null,
    sources: ['kenoyer', 'marshall'],
  },
  grinding: {
    label: 'Grinding grain',
    title: 'Grinding grain',
    what: 'Grinding grain into flour on a flat stone.',
    known: [
      'Wheat and barley were the main grains. Grinding stones are found in houses.',
    ],
    debated: null,
    sources: ['kenoyer', 'marshall'],
  },
  farmer: {
    label: 'Farmer',
    title: 'Working the fields',
    what: 'Bent over the crop, weeding or cutting it by hand.',
    known: [
      'Wheat and barley were the main grains, grown through the cool season; cotton and sesame were among the summer crops.',
      'Long blades of chert (a hard stone) are common finds; some were probably used to cut crops.',
    ],
    debated: 'Where the city’s fields were, who worked them, and how they were watered are not known.',
    sources: ['kenoyer'],
  },
  water: {
    label: 'Drawing water',
    title: 'Drawing water',
    what: 'Pulling up a pot of water from a well.',
    known: [
      'Most houses had a well or used one nearby. Some well rims show grooves worn by ropes.',
    ],
    debated: null,
    sources: ['jansen', 'marshall'],
  },
};

// entries for the info panel, in the same shape as FEATURES
export const CRAFT_FEATURES = Object.fromEntries(
  Object.entries(CRAFTS).map(([id, c]) => [
    `craft-${id}`,
    {
      title: c.title,
      kicker: 'Life in the city',
      certainty: 'excavated',
      what: c.what,
      known: c.known,
      debated: c.debated,
      here: `${WHERE} ${WHO} The figures are simple stand-ins: how people dressed and wore their hair is known only from a few figurines, so their look is imagined.`,
      sources: c.sources,
      link: id === 'seals' ? { label: 'Explore the Indus script', event: 'open-script' } : null,
    },
  ])
);

export const WALKERS_NOTE = {
  title: 'People in the streets',
  kicker: 'Life in the city',
  certainty: 'imagined',
  what: 'People walking, some carrying pots or bundles.',
  known: [
    'A city this size was home to many thousands of people.',
  ],
  debated: 'How many people lived here is not known. Estimates for the whole city vary widely, often around 30,000 to 40,000, sometimes more.',
  here: 'Where people walk and how many there are is imagined, as is how they look. They head indoors when it rains or gets dark.',
  sources: ['kenoyer'],
};

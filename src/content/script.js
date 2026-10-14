// The Indus script explorer. The signs below are simple redrawings made for this app
// (100 x 100 boxes, strokes only), not copies of a published sign list. Their names are
// modern nicknames; what the signs meant is not known.

export const SIGNS = [
  { id: 'jar', name: 'Jar', d: 'M30 22 L30 64 Q50 88 70 64 L70 22 M20 22 L40 22 M60 22 L80 22', note: 'The most common sign: about one in ten of all signs written. It often stands at the end of an inscription (at the left).' },
  { id: 'fish', name: 'Fish', d: 'M18 50 Q46 22 74 50 Q46 78 18 50 Z M74 50 L88 38 M74 50 L88 62 M30 48 L31 49', note: 'One of the most discussed signs. In the Dravidian proposal it is read as “mīn”, a word for both fish and star. That is a proposal, not an established reading.' },
  { id: 'roof-fish', name: 'Fish with roof', d: 'M24 34 L50 16 L76 34 M20 58 Q46 34 72 58 Q46 82 20 58 Z M72 58 L84 48 M72 58 L84 68', note: 'Several signs look like the fish with marks added: a roof, dots or strokes. How they relate is part of the puzzle.' },
  { id: 'man', name: 'Standing figure', d: 'M50 12 a8 8 0 1 0 0.1 0 M50 28 L50 60 M30 40 L70 40 M50 60 L36 86 M50 60 L64 86', note: 'A human figure. Variants carry objects or have extra marks.' },
  { id: 'bearer', name: 'Figure with yoke', d: 'M50 22 a7 7 0 1 0 0.1 0 M50 36 L50 62 M24 40 L76 40 M24 40 L24 58 M76 40 L76 58 M50 62 L38 86 M50 62 L62 86', note: 'A figure carrying a pole across the shoulders, with loads hanging at each end, or so it looks to modern eyes.' },
  { id: 'two', name: 'Two strokes', d: 'M42 22 L42 78 M58 22 L58 78', note: 'Groups of short strokes are often thought to be numbers, but this is not certain.' },
  { id: 'three', name: 'Three strokes', d: 'M34 22 L34 78 M50 22 L50 78 M66 22 L66 78', note: 'Strokes appear in groups up to about seven or more; some groups are arranged in two rows.' },
  { id: 'ticks', name: 'Paired ticks', d: 'M38 30 L44 46 M56 30 L62 46', note: 'A small, very common sign. Its role is unknown.' },
  { id: 'arrow', name: 'Arrow', d: 'M50 14 L50 86 M36 70 L50 86 L64 70', note: 'A shape like an arrow or spearhead. Meaning unknown.' },
  { id: 'wheel', name: 'Wheel', d: 'M50 20 a30 30 0 1 0 0.1 0 M29 29 L71 71 M71 29 L29 71', note: 'A circle with crossing lines, often called the wheel or sun sign. Meaning unknown.' },
  { id: 'comb', name: 'Comb', d: 'M24 30 L76 30 M30 30 L30 72 M43 30 L43 72 M57 30 L57 72 M70 30 L70 72', note: 'A bar with teeth. Meaning unknown.' },
  { id: 'diamond', name: 'Diamond', d: 'M50 18 L76 50 L50 82 L24 50 Z', note: 'A diamond shape, sometimes with a mark inside. Meaning unknown.' },
  { id: 'cup', name: 'Cup', d: 'M30 30 L30 62 Q50 80 70 62 L70 30', note: 'Like the jar but plain. Whether jar and cup are one sign or two is the kind of question sign lists answer differently.' },
  { id: 'lattice', name: 'Lattice', d: 'M28 28 L72 28 L72 72 L28 72 Z M43 28 L43 72 M57 28 L57 72 M28 43 L72 43 M28 57 L72 57', note: 'A grid inside a square. Meaning unknown.' },
];

export const SIGN_BY_ID = Object.fromEntries(SIGNS.map((s) => [s.id, s]));

// an inscription for the example seal, in reading order (it is drawn right to left,
// so the jar sign ends the line at the left). An invented line of common signs: it
// copies no real seal.
export const EXAMPLE_LINE = ['man', 'two', 'fish', 'ticks', 'jar'];

export const FACTS = [
  { k: 'Several thousand', v: 'inscribed objects are known from Indus sites: seals, sealings, tablets, pots, tools. More than a thousand seals and sealings come from Mohenjo-daro.' },
  { k: 'About 400 to 700', v: 'different signs, depending on how scholars count variants of the same sign.' },
  { k: 'About 5 signs', v: 'in a typical inscription. Few have more than about 15. No long texts have been found.' },
  { k: 'Right to left', v: 'is the usual direction. Signs are often squeezed together at the left end, where the writer ran out of space.' },
];

export const IDEAS = [
  {
    title: 'Not deciphered',
    level: 'excavated',
    text: 'No one can read the Indus script today. The inscriptions are short, no bilingual text (the same words in a known script) has been found, and the language or languages spoken in the cities are unknown.',
  },
  {
    title: 'A Dravidian language',
    level: 'inferred',
    text: 'The most fully worked out proposal reads the signs as an early form of the Dravidian language family, today spoken mainly in South India, with a pocket (Brahui) in Pakistan. It builds on picture-puns such as fish and star. Many scholars find parts of it suggestive; it is not proven.',
  },
  {
    title: 'Other languages',
    level: 'inferred',
    text: 'Readings in early Indo-Aryan (related to Sanskrit), in Munda languages and in languages now lost have also been proposed. None has won wide acceptance.',
  },
  {
    title: 'Not a full writing system?',
    level: 'inferred',
    text: 'Some researchers argue the signs were symbols that did not write a spoken language. Others answer that the order of signs follows patterns typical of language. The debate continues.',
  },
];

export const SCRIPT_SOURCES = [
  'Parpola, A. 1994. Deciphering the Indus Script. Cambridge: Cambridge University Press.',
  'Mahadevan, I. 1977. The Indus Script: Texts, Concordance and Tables. New Delhi: Archaeological Survey of India.',
  'Wells, B. K. 2015. The Archaeology and Epigraphy of Indus Writing. Oxford: Archaeopress.',
  'Farmer, S., Sproat, R. and Witzel, M. 2004. The Collapse of the Indus-Script Thesis. Electronic Journal of Vedic Studies 11 (2).',
  'Rao, R. P. N. and others 2009. Entropic Evidence for Linguistic Structure in the Indus Script. Science 324: 1165.',
  'Kenoyer, J. M. 1998. Ancient Cities of the Indus Valley Civilization. Karachi: Oxford University Press.',
];

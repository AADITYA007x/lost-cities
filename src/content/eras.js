// The city through time: five moments, from the founding to today. All dates are
// approximate; radiocarbon dates for Mohenjo-daro are few, and the start and end of
// the city are debated.

export const ERAS = [
  {
    id: 'founding',
    bit: 1,
    date: 'c. 2600 BCE',
    short: '2600 BCE',
    title: 'A planned city begins',
    certainty: 'imagined',
    text: 'The great platforms of mud brick are raised above the flood plain, and the first houses go up along a planned grid of streets.',
    known: 'The earliest levels lie below today’s water table and have never been fully excavated, so the founding is the least known moment. Whether a village stood here before is not known.',
    shows: 'The platforms and streets, with a few houses scattered over them. Which houses stood first is imagined.',
  },
  {
    id: 'height',
    bit: 2,
    date: 'c. 2500–2200 BCE',
    short: '2500 BCE',
    title: 'The city at its height',
    certainty: 'inferred',
    text: 'One of the largest cities of its time, with brick houses, wells, covered drains and the Great Bath.',
    known: 'This is the city of the main excavated levels. How many people lived here is debated.',
    shows: 'The reconstruction as elsewhere in the app: walls from the plans where they exist, generated houses elsewhere.',
  },
  {
    id: 'late',
    bit: 4,
    date: 'c. 2000–1900 BCE',
    short: '1900 BCE',
    title: 'A changing city',
    certainty: 'inferred',
    text: 'In the late levels houses are rebuilt more roughly, often from reused bricks; some are divided up, kilns appear inside the town, and some houses stand empty.',
    known: 'In DK-G this view shows Mackay’s plan of the Late I and II levels. Why the city declined is debated: changes in rivers and climate, and shifts in trade, are the main ideas. The old story of an invasion is not supported by the evidence.',
    shows: 'In DK-G, walls traced from Mackay’s Late plan. Elsewhere about a third of the houses are shown as ruins; which ones is imagined.',
  },
  {
    id: 'buried',
    bit: 8,
    date: 'c. 1700 BCE – 1920 CE',
    short: 'Buried',
    title: 'Abandoned and buried',
    certainty: 'inferred',
    text: 'By about 1700 BCE the city is largely empty. Fallen brick, silt and windblown dust slowly turn it into mounds. Around the 2nd century CE a Buddhist stupa and monastery are built on top of the high mound.',
    known: 'The stupa is usually dated to the Kushan period. A minority view argues that the mound beneath it hides an older, Harappan building.',
    shows: 'The mounds are simplified: their outline follows the site plan, their heights are approximate. The stupa is a simplified form at its place on Mackay’s site plan.',
  },
  {
    id: 'today',
    bit: 16,
    date: '1922 – today',
    short: 'Today',
    title: 'Excavated',
    certainty: 'excavated',
    text: 'Excavations began in 1922 under R. D. Banerji and continued under John Marshall, Ernest Mackay and others; later work includes Mortimer Wheeler (1950) and George Dales (1964–65). Mohenjo-daro became a UNESCO World Heritage Site in 1980.',
    known: 'Today the walls stand exposed in the excavated areas. Salt rising from the ground water damages the bricks, and conserving them is a constant task.',
    shows: 'The excavated areas are opened in the mound, with walls cut to about the height that survives; the walls’ real surviving height varies a great deal. Elsewhere the city stays buried.',
  },
];

export const ERA_BY_ID = Object.fromEntries(ERAS.map((e) => [e.id, e]));

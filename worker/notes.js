// The curated notes the resident may draw on: built from the same content files the
// app shows, so the chat and the info panels never disagree.

import { FEATURES, SOURCES } from '../src/content/features.js';
import { LANDSCAPE_NOTE } from '../src/content/landscape.js';
import { ERAS } from '../src/content/eras.js';
import { CRAFTS } from '../src/content/crafts.js';
import { FACTS, IDEAS, SIGNS } from '../src/content/script.js';

const clean = (s) => String(s || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

function build() {
  const out = [];
  out.push('## How sure the reconstruction is');
  for (const item of LANDSCAPE_NOTE.items) out.push(`- [${item.level}] ${item.label}: ${clean(item.text)}`);

  out.push('\n## Places and things (from the info panels)');
  for (const f of Object.values(FEATURES)) {
    const parts = [`### ${clean(f.title)} (${f.certainty})`, clean(f.what)];
    if (f.known?.length) parts.push(`Known: ${f.known.map(clean).join(' ')}`);
    if (f.debated) parts.push(`Debated: ${clean(f.debated)}`);
    out.push(parts.join('\n'));
  }

  out.push('\n## Crafts known from finds');
  for (const c of Object.values(CRAFTS)) out.push(`- ${c.title}: ${clean(c.what)} ${c.known.map(clean).join(' ')}${c.debated ? ` Debated: ${clean(c.debated)}` : ''}`);

  out.push('\n## The city through time (dates approximate)');
  for (const e of ERAS) out.push(`- ${e.date}, ${e.title}: ${clean(e.text)} ${clean(e.known)}`);

  out.push('\n## The Indus script');
  for (const f of FACTS) out.push(`- ${f.k}: ${clean(f.v)}`);
  for (const i of IDEAS) out.push(`- ${i.title}: ${clean(i.text)}`);
  out.push(`- Sign nicknames used in the app (not meanings): ${SIGNS.map((s) => s.name).join(', ')}.`);

  out.push('\n## Sources behind these notes');
  for (const s of Object.values(SOURCES)) out.push(`- ${clean(s)}`);
  return out.join('\n');
}

export const NOTES = build();

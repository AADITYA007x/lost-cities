import { SIGNS, SIGN_BY_ID, EXAMPLE_LINE, FACTS, IDEAS, SCRIPT_SOURCES } from './content/script.js';

// The Indus script explorer: an example seal (as carved, and as pressed into clay),
// the common signs, what we know in numbers, and the main ideas about the script.

const LEVEL = { excavated: 'Known', inferred: 'Proposal', imagined: 'Imagined' };

const signSvg = (s, size = 48, extra = '') =>
  `<svg viewBox="0 0 100 100" width="${size}" height="${size}" aria-hidden="true" ${extra}><path d="${s.d}" fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

// a seal drawn for this app in the usual layout: a line of signs above, a one-horned
// animal facing a "standard" below. It copies no single real seal.
function sealSvg() {
  // read right to left: the first sign of the line sits at the right
  const n = EXAMPLE_LINE.length;
  const signs = EXAMPLE_LINE.map((id, i) => {
    const x = 160 - i * 30;
    return `<g class="seal-sign" data-sign="${id}" transform="translate(${x - 13} 16) scale(0.26)" tabindex="0" role="button" aria-label="${SIGN_BY_ID[id].name}">
      <rect x="-6" y="-6" width="112" height="112" fill="transparent"/>
      <path d="${SIGN_BY_ID[id].d}" fill="none" stroke="currentColor" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/></g>`;
  }).join('');
  void n;
  return `
  <svg viewBox="0 0 200 200" class="seal-svg" role="img" aria-label="A seal drawn in the usual Indus layout">
    <rect x="4" y="4" width="192" height="192" rx="10" class="seal-face"/>
    <g class="seal-art">
      ${signs}
      <g class="seal-animal" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M58 120 Q60 98 86 96 L124 96 Q140 96 146 104 L156 92 Q162 86 170 90 L176 98 Q178 104 170 106 L160 108 Q156 120 150 124 L148 128" />
        <path d="M58 120 Q54 128 60 132 L148 132 Q150 130 148 128" />
        <path d="M158 90 L176 66" />
        <path d="M66 132 L64 168 M78 132 L80 168 M126 132 L124 168 M140 130 L144 168" />
        <path d="M58 116 Q46 120 44 138 Q43 146 48 150" />
        <path d="M150 100 Q152 112 148 120" />
        <path d="M86 96 Q92 112 88 130 M104 96 Q110 112 106 130" stroke-width="1.6" />
      </g>
      <g class="seal-standard" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round">
        <path d="M184 176 L184 128 M176 128 L192 128 M177 122 Q184 114 191 122 M176 138 Q184 150 192 138" />
      </g>
    </g>
  </svg>`;
}

export function createScriptExplorer({ panel, button }) {
  panel.innerHTML = `
    <div class="script-head">
      <div>
        <p class="script-kicker">Writing</p>
        <h2>The Indus script</h2>
      </div>
      <button type="button" class="close" aria-label="Close">×</button>
    </div>
    <p class="chip excavated"><span></span>Undeciphered</p>
    <p class="script-lede">Short lines of signs on seals, tablets and pots. They are the only writing of the Indus cities, and no one can read them yet.</p>

    <section class="script-seal">
      <figure>
        <div class="seal-box">${sealSvg()}</div>
        <figcaption>
          <div class="seal-switch" role="radiogroup" aria-label="Show the seal or its impression">
            <button type="button" role="radio" data-face="impression" class="on" aria-checked="true">Impression</button>
            <button type="button" role="radio" data-face="seal" aria-checked="false">Seal</button>
          </div>
          <p class="seal-note"></p>
        </figcaption>
      </figure>
      <div class="sign-info" aria-live="polite"></div>
    </section>

    <h3>Common signs</h3>
    <div class="sign-grid">
      ${SIGNS.map((s) => `<button type="button" class="sign-cell" data-sign="${s.id}" aria-label="${s.name}">${signSvg(s, 40)}<span>${s.name}</span></button>`).join('')}
    </div>
    <p class="script-small">Simplified redrawings made for this app. The names are modern nicknames, not meanings.</p>

    <h3>In numbers</h3>
    <dl class="script-facts">${FACTS.map((f) => `<div><dt>${f.k}</dt><dd>${f.v}</dd></div>`).join('')}</dl>

    <h3>Ideas about the script</h3>
    <div class="script-ideas">
      ${IDEAS.map((i) => `<div class="idea"><p class="chip ${i.level}"><span></span>${LEVEL[i.level]}</p><h4>${i.title}</h4><p>${i.text}</p></div>`).join('')}
    </div>

    <h3>Sources</h3>
    <ul class="sources">${SCRIPT_SOURCES.map((s) => `<li>${s}</li>`).join('')}</ul>
  `;

  const box = panel.querySelector('.seal-box');
  const note = panel.querySelector('.seal-note');
  const info = panel.querySelector('.sign-info');
  let face = 'impression';

  function setFace(f) {
    face = f;
    box.classList.toggle('carved', f === 'seal');
    panel.querySelectorAll('[data-face]').forEach((b) => {
      const on = b.dataset.face === f;
      b.classList.toggle('on', on);
      b.setAttribute('aria-checked', String(on));
    });
    note.textContent =
      f === 'seal'
        ? 'The seal itself, carved in reverse into soft stone. Pressed into clay, it gives the impression the right way round.'
        : 'Pressed into clay. The line of signs is read from right to left, starting above the animal’s head.';
  }

  function showSign(id) {
    const s = SIGN_BY_ID[id];
    if (!s) return;
    info.innerHTML = `<div class="sign-big">${signSvg(s, 64)}</div><div><h4>${s.name}</h4><p>${s.note}</p></div>`;
    panel.querySelectorAll('[data-sign]').forEach((el) => el.classList.toggle('on', el.dataset.sign === id));
  }

  panel.addEventListener('click', (e) => {
    const f = e.target.closest('[data-face]');
    if (f) setFace(f.dataset.face);
    const s = e.target.closest('[data-sign]');
    if (s) showSign(s.dataset.sign);
  });
  panel.addEventListener('keydown', (e) => {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.closest?.('g[data-sign]')) {
      e.preventDefault();
      showSign(e.target.closest('g[data-sign]').dataset.sign);
    }
  });

  function open(on) {
    panel.classList.toggle('open', on);
    button?.setAttribute('aria-expanded', String(on));
    if (on) panel.scrollTop = 0;
  }
  panel.querySelector('.close').addEventListener('click', () => open(false));
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') open(false);
  });
  button?.addEventListener('click', () => open(!panel.classList.contains('open')));

  setFace('impression');
  showSign('jar');
  return { open };
}

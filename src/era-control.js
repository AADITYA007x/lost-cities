import { ERAS, ERA_BY_ID } from './content/eras.js';

// One control for the city through time: a button showing the moment, opening a
// panel with a slider of five moments, a short note on each, and a then-and-now split.

const LEVEL = { excavated: 'Excavated', inferred: 'Inferred', imagined: 'Imagined' };

export function createEraControl({ button, panel, splitEl, onChange, onSplit }) {
  panel.innerHTML = `
    <div class="era-head">
      <h2>The city through time</h2>
      <button type="button" class="close" aria-label="Close">×</button>
    </div>
    <input type="range" min="0" max="${ERAS.length - 1}" step="1" aria-label="Moment in time" />
    <div class="era-ticks" aria-hidden="true">${ERAS.map((e) => `<span>${e.short}</span>`).join('')}</div>
    <div class="era-card"></div>
    <button type="button" class="era-split" aria-pressed="false">Then and now</button>
  `;
  const slider = panel.querySelector('input');
  const card = panel.querySelector('.era-card');
  const splitButton = panel.querySelector('.era-split');
  const ticks = [...panel.querySelectorAll('.era-ticks span')];
  let split = false;
  let current = 'height';

  function open(on) {
    panel.classList.toggle('open', on);
    button.setAttribute('aria-expanded', String(on));
  }
  button.addEventListener('click', () => open(!panel.classList.contains('open')));
  panel.querySelector('.close').addEventListener('click', () => open(false));
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') open(false);
  });
  slider.addEventListener('input', () => onChange(ERAS[Number(slider.value)].id));
  ticks.forEach((t, i) => t.addEventListener('click', () => onChange(ERAS[i].id)));
  splitButton.addEventListener('click', () => {
    split = !split;
    onSplit(split);
    render();
  });

  // the divider of the split view can be dragged
  let dragging = false;
  let fraction = 0.5;
  const handle = splitEl.querySelector('.split-handle');
  handle.addEventListener('pointerdown', (e) => {
    dragging = true;
    handle.setPointerCapture(e.pointerId);
    e.stopPropagation();
  });
  handle.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    fraction = Math.min(0.92, Math.max(0.08, e.clientX / window.innerWidth));
    splitEl.style.setProperty('--split', `${fraction * 100}%`);
  });
  // a small close button on the line, and Esc, end the split view
  const closeSplit = () => {
    if (!split) return;
    split = false;
    onSplit(split);
    render();
  };
  splitEl.querySelector('.split-close').addEventListener('click', closeSplit);
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !panel.classList.contains('open')) closeSplit();
  });
  const stop = () => (dragging = false);
  handle.addEventListener('pointerup', stop);
  handle.addEventListener('pointercancel', stop);

  function render() {
    const e = ERA_BY_ID[current];
    slider.value = String(ERAS.indexOf(e));
    ticks.forEach((t, i) => t.classList.toggle('on', ERAS[i] === e));
    card.innerHTML = `
      <p class="era-date">${e.date}</p>
      <h3>${e.title}</h3>
      <p class="chip ${e.certainty}"><span></span>${LEVEL[e.certainty]}</p>
      <p>${e.text}</p>
      <p class="era-known">${e.known}</p>
      <p class="era-shows"><b>What you see:</b> ${e.shows}</p>
    `;
    button.textContent = e.short === 'Buried' || e.short === 'Today' ? e.short : `c. ${e.short}`;
    button.setAttribute('aria-label', `The city through time: ${e.date}`);
    splitButton.textContent = split ? 'Close then and now' : 'Then and now';
    splitButton.setAttribute('aria-pressed', String(split));
    splitEl.classList.toggle('on', split);
    splitEl.querySelector('.split-left').textContent = current === 'today' ? 'c. 2500 BCE' : e.date;
  }

  return {
    open,
    setSplit(on) {
      split = on;
      onSplit(split);
      render();
    },
    show(id) {
      current = id;
      render();
    },
    get split() {
      return split;
    },
    get fraction() {
      return fraction;
    },
  };
}

// The guide: a ten-stop tour, and a searchable list of places to fly to.
// One button opens the panel; the tour runs as a small card at the bottom.

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const LEVEL = { excavated: 'Excavated', inferred: 'Inferred', imagined: 'Imagined' };
// lower case, without accents or curly quotes, so "Marshall’s" matches "marshalls"
const fold = (s) =>
  String(s)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[“”"‘’'()]/g, '');

export function createGuide({ button, panel, card, tour, groups, features, searchWords = {}, onPlace, onHome, onStart, onStep, onMore, onEnd }) {
  // ---------- the panel ----------
  const entries = groups.map((g) => ({
    title: g.title,
    items: g.ids
      .filter((id) => features[id])
      .map((id) => {
        const f = features[id];
        const text = [f.title, f.kicker, f.what, ...(f.known || []), f.debated || '', searchWords[id] || ''].join(' ');
        return { id, f, text: fold(text) };
      }),
  }));

  panel.innerHTML = `
    <div class="guide-head">
      <div>
        <p class="guide-kicker">Guide</p>
        <h2>Explore the city</h2>
      </div>
      <button type="button" class="close" aria-label="Close">×</button>
    </div>
    <button type="button" class="guide-tour">
      <span>Take the tour</span>
      <small>${tour.length} stops · about ten minutes</small>
    </button>
    <button type="button" class="guide-home">View the whole city</button>
    <label class="guide-search">
      <span class="sr-only">Search places</span>
      <input type="search" placeholder="Search: bath, beads, seals…" autocomplete="off" />
    </label>
    <div class="guide-list"></div>
    <p class="guide-legend"><span class="guide-dot excavated"></span>Excavated <span class="guide-dot inferred"></span>Inferred <span class="guide-dot imagined"></span>Imagined</p>
  `;
  const list = panel.querySelector('.guide-list');
  const input = panel.querySelector('input');

  function renderList() {
    const words = fold(input.value).split(/\s+/).filter(Boolean);
    const match = (e) => words.every((w) => e.text.includes(w));
    const html = entries
      .map((g) => {
        const items = g.items.filter(match);
        if (!items.length) return '';
        return `<h3>${esc(g.title)}</h3><ul>${items
          .map(
            ({ id, f }) => `<li><button type="button" data-place="${esc(id)}">
              <span class="guide-dot ${f.certainty}" title="${LEVEL[f.certainty]}"></span>
              <span class="guide-name">${esc(f.title)}</span>
              <span class="guide-sub">${esc(f.kicker)}</span>
            </button></li>`
          )
          .join('')}</ul>`;
      })
      .join('');
    list.innerHTML = html || '<p class="guide-empty">Nothing found. Try “bath”, “street” or “beads”.</p>';
  }
  renderList();
  input.addEventListener('input', renderList);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') panel.querySelector('[data-place]')?.click();
  });
  list.addEventListener('click', (e) => {
    const b = e.target.closest('[data-place]');
    if (!b) return;
    stopTour();
    open(false);
    onPlace(b.dataset.place);
  });
  panel.querySelector('.guide-home').addEventListener('click', () => {
    stopTour();
    open(false);
    onHome?.();
  });
  panel.querySelector('.guide-tour').addEventListener('click', () => {
    open(false);
    startTour();
  });
  // keys typed here are for the search, not for walking
  panel.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') e.stopPropagation();
  });

  function open(on) {
    panel.classList.toggle('open', on);
    button.setAttribute('aria-expanded', String(on));
    if (on && !matchMedia('(pointer: coarse)').matches) setTimeout(() => input.focus({ preventScroll: true }), 250);
  }
  button.addEventListener('click', () => open(!panel.classList.contains('open')));
  panel.querySelector('.close').addEventListener('click', () => open(false));

  // ---------- the tour ----------
  let step = -1;
  card.innerHTML = `
    <div class="tour-top">
      <p class="tour-kicker"></p>
      <button type="button" class="close" aria-label="End the tour">×</button>
    </div>
    <h2></h2>
    <p class="chip"><span></span><b></b></p>
    <p class="tour-text"></p>
    <div class="tour-nav">
      <button type="button" class="tour-back">Back</button>
      <button type="button" class="tour-more">More about this</button>
      <button type="button" class="tour-next">Next</button>
    </div>
    <div class="tour-dots" aria-hidden="true">${tour.map(() => '<i></i>').join('')}</div>
  `;
  const q = (s) => card.querySelector(s);

  function show(i) {
    step = Math.max(0, Math.min(tour.length - 1, i));
    const s = tour[step];
    q('.tour-kicker').textContent = `${step + 1} of ${tour.length} · ${s.kicker}`;
    q('h2').textContent = s.title;
    q('.chip').className = `chip ${s.certainty}`;
    q('.chip b').textContent = LEVEL[s.certainty];
    q('.tour-text').textContent = s.text;
    q('.tour-back').disabled = step === 0;
    q('.tour-more').hidden = !s.feature;
    q('.tour-next').textContent = step === tour.length - 1 ? 'Finish' : 'Next';
    card.querySelectorAll('.tour-dots i').forEach((d, k) => d.classList.toggle('on', k === step));
    onStep(s, step);
  }

  function startTour() {
    if (step < 0) onStart?.();
    card.classList.add('open');
    document.body.classList.add('touring');
    show(0);
    setTimeout(() => q('.tour-next').focus({ preventScroll: true }), 50);
  }

  function stopTour() {
    if (step < 0) return;
    step = -1;
    card.classList.remove('open');
    document.body.classList.remove('touring');
    onEnd();
  }

  q('.tour-back').addEventListener('click', () => show(step - 1));
  q('.tour-next').addEventListener('click', () => (step === tour.length - 1 ? stopTour() : show(step + 1)));
  q('.tour-more').addEventListener('click', () => onMore(tour[step].feature));
  q('.close').addEventListener('click', stopTour);

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (panel.classList.contains('open')) open(false);
      return;
    }
    // arrow keys step through the tour, unless typing somewhere
    if (step < 0 || e.target.closest?.('input, textarea')) return;
    if (e.key === 'ArrowRight') q('.tour-next').click();
    if (e.key === 'ArrowLeft' && step > 0) show(step - 1);
  });

  return {
    open,
    startTour,
    stopTour,
    get touring() {
      return step >= 0;
    },
  };
}

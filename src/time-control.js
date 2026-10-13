import { SEASONS } from './daylight.js';

// One control for time: a button that opens a small panel with the hour of the day,
// the season, and a way to let the day pass on its own.

const hourText = (h) => {
  const hh = Math.floor(h) % 24;
  const mm = Math.floor((h - Math.floor(h)) * 60);
  const ap = hh < 12 ? 'am' : 'pm';
  const h12 = hh % 12 === 0 ? 12 : hh % 12;
  return `${h12}:${String(mm).padStart(2, '0')} ${ap}`;
};

export function createTimeControl({ button, panel, state, onChange }) {
  panel.innerHTML = `
    <div class="time-head">
      <h2>Time and season</h2>
      <button type="button" class="close" aria-label="Close">×</button>
    </div>
    <label class="time-row">
      <span class="time-now"></span>
      <input type="range" min="0" max="24" step="0.05" aria-label="Time of day" />
    </label>
    <div class="time-ticks" aria-hidden="true"><span>Night</span><span>Dawn</span><span>Noon</span><span>Dusk</span><span>Night</span></div>
    <button type="button" class="time-play" aria-pressed="false">Let the day pass</button>
    <div class="season-switch" role="radiogroup" aria-label="Season">
      ${Object.entries(SEASONS)
        .map(([k, s]) => `<button type="button" role="radio" data-season="${k}" aria-checked="false">${s.label}<small>${s.note}</small></button>`)
        .join('')}
    </div>
    <p class="time-note">Sun times are for the site itself, by the sun, not the clock. The night lamps are imagined.</p>
  `;
  const slider = panel.querySelector('input');
  const now = panel.querySelector('.time-now');
  const play = panel.querySelector('.time-play');
  const seasonButtons = [...panel.querySelectorAll('[data-season]')];

  function open(on) {
    panel.classList.toggle('open', on);
    button.setAttribute('aria-expanded', String(on));
  }
  button.addEventListener('click', () => open(!panel.classList.contains('open')));
  panel.querySelector('.close').addEventListener('click', () => open(false));
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') open(false);
  });

  slider.addEventListener('input', () => {
    state.hour = Number(slider.value);
    onChange();
  });
  play.addEventListener('click', () => {
    state.playing = !state.playing;
    onChange();
  });
  for (const b of seasonButtons) {
    b.addEventListener('click', () => {
      state.season = b.dataset.season;
      onChange();
    });
  }

  return {
    open,
    // refresh what the controls show
    show({ phrase, dark }) {
      button.classList.toggle('dark', Boolean(dark));
      if (document.activeElement !== slider) slider.value = String(state.hour);
      now.textContent = `${phrase} · ${hourText(state.hour)}`;
      button.innerHTML = `<span class="time-dot" aria-hidden="true"></span>${phrase}`;
      button.setAttribute('aria-label', `Time and season: ${phrase}, ${SEASONS[state.season].label}`);
      play.textContent = state.playing ? 'Pause' : 'Let the day pass';
      play.setAttribute('aria-pressed', String(state.playing));
      for (const b of seasonButtons) {
        const on = b.dataset.season === state.season;
        b.classList.toggle('on', on);
        b.setAttribute('aria-checked', String(on));
      }
    },
  };
}

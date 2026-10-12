// Plan tracer: trace excavated walls from a scanned plan into JSON the city can load.
// Runs only with `npm run dev` (http://localhost:5173/tools/tracer/). Nothing here is deployed.

import { makeTransform, isCalibrated, FEET } from '../../src/city/trace-transform.js';
import { EXCAVATED_AREAS } from '../../src/city/layout.js';
import { PLATE_PRESETS } from './presets.js';

const $ = (id) => document.getElementById(id);
const canvas = $('canvas');
const ctx = canvas.getContext('2d');

const COLORS = {
  excavated: 'rgba(214, 120, 70, 0.75)',
  inferred: 'rgba(212, 178, 106, 0.55)',
  drain: 'rgba(90, 160, 170, 0.85)',
  well: 'rgba(90, 160, 170, 0.95)',
  draft: 'rgba(255, 230, 160, 0.95)',
  selected: 'rgba(255, 255, 255, 0.95)',
};

const state = {
  image: null,
  imageName: '',
  view: { x: 0, y: 0, scale: 1 },
  mode: 'none',
  draft: [],
  clicks: [],
  walls: [],
  drains: [],
  wells: [],
  calibration: { mPerPx: 0, north: null, anchor: { px: null, scene: null } },
  selected: null,
  hover: null,
  nextId: 1,
};

// ---------- defaults for where each area sits in the scene (refined later) ----------
function defaultAnchor(area) {
  const a = EXCAVATED_AREAS.find((e) => e.id === area || e.id.startsWith(area));
  return a ? [Math.round((a.x0 + a.x1) / 2), Math.round((a.z0 + a.z1) / 2)] : [0, 0];
}

// ---------- view ----------
function resize() {
  const r = canvas.getBoundingClientRect();
  canvas.width = r.width * devicePixelRatio;
  canvas.height = r.height * devicePixelRatio;
  draw();
}

function toImage(clientX, clientY) {
  const r = canvas.getBoundingClientRect();
  const sx = (clientX - r.left) * devicePixelRatio;
  const sy = (clientY - r.top) * devicePixelRatio;
  return [(sx - state.view.x) / state.view.scale, (sy - state.view.y) / state.view.scale];
}

function fitImage() {
  if (!state.image) return;
  const s = Math.min(canvas.width / state.image.width, canvas.height / state.image.height) * 0.95;
  state.view.scale = s;
  state.view.x = (canvas.width - state.image.width * s) / 2;
  state.view.y = (canvas.height - state.image.height * s) / 2;
}

// ---------- geometry helpers ----------
function northUnit() {
  const n = state.calibration.north;
  if (!n) return [0, -1];
  const dx = n[1][0] - n[0][0];
  const dy = n[1][1] - n[0][1];
  const l = Math.hypot(dx, dy) || 1;
  return [dx / l, dy / l];
}

// keep a segment along or across the north arrow
function snap(from, to) {
  const [nx, ny] = northUnit();
  const ex = -ny;
  const ey = nx;
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const a = dx * nx + dy * ny;
  const b = dx * ex + dy * ey;
  return Math.abs(a) > Math.abs(b) ? [from[0] + a * nx, from[1] + a * ny] : [from[0] + b * ex, from[1] + b * ey];
}

function distToSegment(p, a, b) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const l2 = dx * dx + dy * dy || 1;
  let t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}

function widthPx(m) {
  return state.calibration.mPerPx ? m / state.calibration.mPerPx : 6;
}

// ---------- drawing ----------
function strokeLine(points, color, width) {
  if (points.length < 2) return;
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineJoin = 'miter';
  ctx.lineCap = 'square';
  ctx.beginPath();
  ctx.moveTo(points[0][0], points[0][1]);
  for (const p of points.slice(1)) ctx.lineTo(p[0], p[1]);
  ctx.stroke();
}

function draw() {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#0d0b09';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!state.image) return;

  const { x, y, scale } = state.view;
  ctx.setTransform(scale, 0, 0, scale, x, y);
  ctx.imageSmoothingEnabled = scale < 2;
  ctx.drawImage(state.image, 0, 0);

  const px = 1 / scale;

  for (const w of state.walls) {
    const sel = state.selected === w || state.hover === w;
    strokeLine(w.points, sel ? COLORS.selected : COLORS[w.certainty], Math.max(widthPx(w.width), 2 * px));
  }
  for (const d of state.drains) {
    strokeLine(d.points, state.selected === d || state.hover === d ? COLORS.selected : COLORS.drain, Math.max(widthPx(0.5), 2 * px));
  }
  for (const w of state.wells) {
    ctx.strokeStyle = state.selected === w || state.hover === w ? COLORS.selected : COLORS.well;
    ctx.lineWidth = 2 * px;
    ctx.beginPath();
    ctx.arc(w.point[0], w.point[1], Math.max(widthPx(0.85), 4 * px), 0, Math.PI * 2);
    ctx.stroke();
  }

  // draft line
  if (state.draft.length) {
    const pts = state.hoverPoint ? [...state.draft, state.hoverPoint] : state.draft;
    strokeLine(pts, COLORS.draft, Math.max(state.mode === 'wall' ? widthPx(+$('width').value || 0.9) : widthPx(0.5), 2 * px));
  }

  // calibration marks
  const c = state.calibration;
  ctx.lineWidth = 2 * px;
  if (c.scaleLine) strokeLine(c.scaleLine, 'rgba(120, 200, 255, 0.9)', 2 * px);
  if (c.north) {
    strokeLine(c.north, 'rgba(255, 120, 120, 0.9)', 2 * px);
    ctx.fillStyle = 'rgba(255, 120, 120, 0.9)';
    ctx.font = `${16 * px}px Georgia`;
    ctx.fillText('N', c.north[1][0] + 6 * px, c.north[1][1]);
  }
  if (c.anchor.px) {
    ctx.strokeStyle = 'rgba(160, 255, 160, 0.95)';
    const [ax, ay] = c.anchor.px;
    ctx.beginPath();
    ctx.moveTo(ax - 10 * px, ay);
    ctx.lineTo(ax + 10 * px, ay);
    ctx.moveTo(ax, ay - 10 * px);
    ctx.lineTo(ax, ay + 10 * px);
    ctx.stroke();
  }
  if (state.clicks.length === 1 && state.cursorPoint) {
    strokeLine([state.clicks[0], state.cursorPoint], state.mode === 'north' ? 'rgba(255, 120, 120, 0.9)' : 'rgba(120, 200, 255, 0.9)', 2 * px);
  }
  for (const p of state.clicks) {
    ctx.fillStyle = COLORS.draft;
    ctx.beginPath();
    ctx.arc(p[0], p[1], 4 * px, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ---------- status ----------
const HINTS = {
  none: 'Step 1 of 4 \u00b7 Open a plan image (or pick a plate preset).',
  scale: 'Step 2 of 4 \u00b7 Scale: click the left end of the scale bar, then its right end.',
  north: 'Step 3 of 4 \u00b7 North: click the tail of the north arrow, then its tip.',
  anchor: 'Step 4 of 4 \u00b7 Anchor: type the scene x and z on the left, then click that point on the plan.',
  wall: 'Wall: click along the middle of a wall, corner by corner. Enter finishes the line.',
  drain: 'Drain: click along a drain. Enter finishes the line.',
  well: 'Well: click the centre of each well.',
  select: 'Select: click a line or well. Delete removes it.',
};

function hintText() {
  if (state.clicks.length === 1 && state.mode === 'scale') return 'Scale: now click the other end of the scale bar.';
  if (state.clicks.length === 1 && state.mode === 'north') return 'North: now click the tip of the arrow.';
  if (state.draft.length) {
    const n = state.draft.length;
    return `${state.mode === 'wall' ? 'Wall' : 'Drain'}: ${n} point${n > 1 ? 's' : ''} \u00b7 Enter to finish \u00b7 Backspace removes a point \u00b7 Esc cancels`;
  }
  return HINTS[state.mode];
}

function refreshHint() {
  $('mode-hint').textContent = hintText();
}

function setMode(mode) {
  if (state.draft.length) finishDraft();
  state.mode = mode;
  state.clicks = [];
  document.querySelectorAll('button[data-mode]').forEach((b) => b.classList.toggle('active', b.dataset.mode === mode));
  refreshHint();
  draw();
}

// after each calibration step, move on to the next one that is missing
function nextStep() {
  const c = state.calibration;
  if (!c.mPerPx) setMode('scale');
  else if (!c.north) setMode('north');
  else if (!c.anchor || !c.anchor.px) setMode('anchor');
  else setMode('wall');
}

function updateStatus() {
  const c = state.calibration;
  const parts = [];
  parts.push(c.mPerPx ? `scale ${(c.mPerPx * 100).toFixed(2)} cm/px` : 'no scale');
  parts.push(c.north ? 'north set' : 'no north');
  parts.push(c.anchor.px ? 'anchor set' : 'no anchor');
  $('calib-status').textContent = parts.join(' · ');
  $('counts').textContent = `${state.walls.length} walls · ${state.drains.length} drains · ${state.wells.length} wells`;
  autosave();
}

// ---------- editing ----------
function finishDraft() {
  // drop repeated points (a double-click adds the last point twice)
  state.draft = state.draft.filter((p, i, a) => i === 0 || Math.hypot(p[0] - a[i - 1][0], p[1] - a[i - 1][1]) > 0.5);
  if (state.draft.length >= 2) {
    const base = { id: state.nextId++, points: state.draft.map((p) => [Math.round(p[0] * 10) / 10, Math.round(p[1] * 10) / 10]) };
    if (state.mode === 'wall') {
      state.walls.push({
        ...base,
        width: +$('width').value || 0.9,
        preserved: +$('preserved').value || 1.5,
        certainty: $('certainty').value,
        note: $('note').value || undefined,
      });
    } else if (state.mode === 'drain') {
      state.drains.push({ ...base, note: $('note').value || undefined });
    }
  }
  state.draft = [];
  state.hoverPoint = null;
  updateStatus();
  refreshHint();
  draw();
}

function pick(p) {
  const tol = 8 / state.view.scale * devicePixelRatio;
  for (const w of state.wells) if (Math.hypot(p[0] - w.point[0], p[1] - w.point[1]) < tol + widthPx(0.85)) return w;
  for (const list of [state.walls, state.drains]) {
    for (const o of list) {
      for (let i = 0; i < o.points.length - 1; i++) {
        if (distToSegment(p, o.points[i], o.points[i + 1]) < tol + widthPx(o.width || 0.5) / 2) return o;
      }
    }
  }
  return null;
}

function removeObject(o) {
  for (const key of ['walls', 'drains', 'wells']) state[key] = state[key].filter((x) => x !== o);
  if (state.selected === o) state.selected = null;
  updateStatus();
  draw();
}

function lastAdded() {
  const all = [...state.walls, ...state.drains, ...state.wells];
  return all.sort((a, b) => b.id - a.id)[0];
}

function onClick(e) {
  if (!state.image) return;
  let p = toImage(e.clientX, e.clientY);
  const c = state.calibration;

  if (state.mode === 'scale') {
    state.clicks.push(p);
    if (state.clicks.length === 2) {
      const answer = prompt('Length of that scale bar (e.g. "100 ft" or "30 m"):', '100 ft');
      const m = answer && answer.match(/([\d.]+)\s*(ft|feet|m|metres|meters)?/i);
      if (m) {
        const value = parseFloat(m[1]) * (/^f/i.test(m[2] || 'ft') ? FEET : 1);
        const [a, b] = state.clicks;
        c.mPerPx = value / Math.hypot(b[0] - a[0], b[1] - a[1]);
        c.scaleLine = [a, b];
        c.scaleText = answer;
      }
      state.clicks = [];
      updateStatus();
      if (c.mPerPx) nextStep();
    }
  } else if (state.mode === 'north') {
    state.clicks.push(p);
    if (state.clicks.length === 2) {
      c.north = [state.clicks[0], state.clicks[1]];
      state.clicks = [];
      updateStatus();
      nextStep();
    }
  } else if (state.mode === 'anchor') {
    const x = parseFloat($('anchor-x').value);
    const z = parseFloat($('anchor-z').value);
    c.anchor = { px: p, scene: [Number.isFinite(x) ? x : 0, Number.isFinite(z) ? z : 0] };
    updateStatus();
    nextStep();
  } else if (state.mode === 'wall' || state.mode === 'drain') {
    if (e.shiftKey && state.draft.length) p = snap(state.draft[state.draft.length - 1], p);
    state.draft.push(p);
  } else if (state.mode === 'well') {
    state.wells.push({ id: state.nextId++, point: [Math.round(p[0] * 10) / 10, Math.round(p[1] * 10) / 10], certainty: $('certainty').value });
    updateStatus();
  } else if (state.mode === 'select') {
    state.selected = pick(p);
  }
  refreshHint();
  draw();
}

// ---------- pan / zoom ----------
let panning = null;
let spaceDown = false;

canvas.addEventListener('pointerdown', (e) => {
  if (e.button === 2 || e.button === 1 || spaceDown) {
    panning = { x: e.clientX, y: e.clientY, vx: state.view.x, vy: state.view.y };
    canvas.setPointerCapture(e.pointerId);
    e.preventDefault();
  }
});
canvas.addEventListener('pointermove', (e) => {
  if (panning) {
    state.view.x = panning.vx + (e.clientX - panning.x) * devicePixelRatio;
    state.view.y = panning.vy + (e.clientY - panning.y) * devicePixelRatio;
    draw();
    return;
  }
  if (!state.image) return;
  let p = toImage(e.clientX, e.clientY);
  if (e.shiftKey && state.draft.length) p = snap(state.draft[state.draft.length - 1], p);
  state.hoverPoint = state.draft.length ? p : null;
  state.cursorPoint = p;
  state.hover = state.mode === 'select' ? pick(p) : null;
  const c = state.calibration;
  let text = `px ${p[0].toFixed(0)}, ${p[1].toFixed(0)}`;
  if (isCalibrated(c)) {
    const [sx, sz] = makeTransform(c)(p);
    text += ` · scene x ${sx.toFixed(1)} m, z ${sz.toFixed(1)} m`;
  }
  $('cursor').textContent = text;
  draw();
});
canvas.addEventListener('pointerup', (e) => {
  if (panning) {
    panning = null;
    return;
  }
  if (e.button === 0) onClick(e);
});
canvas.addEventListener('dblclick', () => finishDraft());
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
canvas.addEventListener(
  'wheel',
  (e) => {
    e.preventDefault();
    const r = canvas.getBoundingClientRect();
    const sx = (e.clientX - r.left) * devicePixelRatio;
    const sy = (e.clientY - r.top) * devicePixelRatio;
    const k = Math.exp(-e.deltaY * 0.0015);
    state.view.x = sx - (sx - state.view.x) * k;
    state.view.y = sy - (sy - state.view.y) * k;
    state.view.scale *= k;
    draw();
  },
  { passive: false }
);

window.addEventListener('keydown', (e) => {
  if (e.target.matches('input, select')) return;
  if (e.code === 'Space') {
    spaceDown = true;
    e.preventDefault();
  } else if (e.key === 'Enter') finishDraft();
  else if (e.key === 'Escape') {
    state.draft = [];
    state.clicks = [];
    draw();
  } else if (e.key === 'Backspace') {
    state.draft.pop();
    draw();
  } else if (e.key === 'Delete' && state.selected) removeObject(state.selected);
  else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
    const o = lastAdded();
    if (o) removeObject(o);
  } else if (e.key.toLowerCase() === 'w') setMode('wall');
  else if (e.key.toLowerCase() === 'd') setMode('drain');
  else if (e.key.toLowerCase() === 'o') setMode('well');
  else if (e.key.toLowerCase() === 's') setMode('select');
});
window.addEventListener('keyup', (e) => {
  if (e.code === 'Space') spaceDown = false;
});

// ---------- files ----------
function meta() {
  return {
    source: $('source').value,
    plate: $('plate').value,
    page: $('page').value,
    area: $('area').value,
    image: state.imageName,
  };
}

function toJSON() {
  const c = state.calibration;
  return {
    format: 'lost-cities-trace/1',
    meta: meta(),
    calibration: {
      mPerPx: c.mPerPx,
      scaleLine: c.scaleLine,
      scaleText: c.scaleText,
      north: c.north,
      anchor: c.anchor,
    },
    walls: state.walls,
    drains: state.drains,
    wells: state.wells,
    savedAt: new Date().toISOString(),
  };
}

function fromJSON(data) {
  const m = data.meta || {};
  $('source').value = m.source || 'Marshall 1931';
  $('plate').value = m.plate || '';
  $('page').value = m.page || '';
  $('area').value = m.area || 'HR';
  state.calibration = { anchor: { px: null, scene: null }, ...data.calibration };
  if (state.calibration.anchor?.scene) {
    $('anchor-x').value = state.calibration.anchor.scene[0];
    $('anchor-z').value = state.calibration.anchor.scene[1];
  }
  state.walls = data.walls || [];
  state.drains = data.drains || [];
  state.wells = data.wells || [];
  state.nextId = 1 + Math.max(0, ...[...state.walls, ...state.drains, ...state.wells].map((o) => o.id || 0));
  updateStatus();
  draw();
}

function storageKey() {
  return `tracer:${state.imageName}`;
}

function autosave() {
  if (!state.imageName) return;
  try {
    localStorage.setItem(storageKey(), JSON.stringify(toJSON()));
  } catch {
    /* storage full or unavailable: use Download JSON */
  }
}

function fileName() {
  const m = meta();
  const safe = (s) => String(s || '').replace(/[^\w-]+/g, '-').replace(/^-|-$/g, '');
  return `${safe(m.source.split(' ')[0]).toLowerCase()}-${safe(m.area)}-plate-${safe(m.plate) || 'x'}.json`;
}

$('save').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(toJSON(), null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = fileName();
  a.click();
  URL.revokeObjectURL(a.href);
});

$('json-input').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  fromJSON(JSON.parse(await file.text()));
});

function loadImage(src, name) {
  const img = new Image();
  img.onload = () => {
    state.image = img;
    state.imageName = name;
    $('empty').classList.add('hidden');
    fitImage();
    let restored = false;
    try {
      const saved = localStorage.getItem(storageKey());
      if (saved) {
        fromJSON(JSON.parse(saved));
        restored = true;
      }
    } catch {
      /* nothing saved */
    }
    const preset = presetForFile(name);
    if (preset && !isCalibrated(state.calibration)) {
      presetSelect.value = preset;
      applyPreset(preset);
    }
    if (restored) $('mode-hint').textContent = 'Your earlier work on this plan was restored.';
    updateStatus();
    nextStep();
  };
  img.onerror = () => alert('That file could not be opened as an image. Please use PNG or JPG.');
  img.src = src;
}

function loadFile(file) {
  if (!file) return;
  if (!file.type.startsWith('image/')) {
    alert('Please choose an image (PNG or JPG). For a PDF, export the plan page as an image first.');
    return;
  }
  loadImage(URL.createObjectURL(file), file.name);
}

$('image-input').addEventListener('change', (e) => loadFile(e.target.files[0]));
$('image-input-2').addEventListener('change', (e) => loadFile(e.target.files[0]));
$('sample').addEventListener('click', () => {
  $('plate').value = 'sample';
  loadImage(new URL('./sample-plan.png', import.meta.url).href, 'sample-plan.png');
});

const stage = document.querySelector('.stage');
stage.addEventListener('dragover', (e) => {
  e.preventDefault();
  $('empty').classList.add('drag');
});
stage.addEventListener('dragleave', () => $('empty').classList.remove('drag'));
stage.addEventListener('drop', (e) => {
  e.preventDefault();
  $('empty').classList.remove('drag');
  loadFile(e.dataTransfer.files[0]);
});

$('area').addEventListener('change', () => {
  const [x, z] = defaultAnchor($('area').value);
  $('anchor-x').value = x;
  $('anchor-z').value = z;
  if (state.calibration.anchor.px) {
    state.calibration.anchor.scene = [x, z];
    updateStatus();
  }
});
for (const id of ['anchor-x', 'anchor-z']) {
  $(id).addEventListener('change', () => {
    if (state.calibration.anchor.px) {
      state.calibration.anchor.scene = [parseFloat($('anchor-x').value) || 0, parseFloat($('anchor-z').value) || 0];
      updateStatus();
    }
  });
}

document.querySelectorAll('button[data-mode]').forEach((b) => b.addEventListener('click', () => setMode(b.dataset.mode)));

// ---------- plate presets: calibration already worked out for known plates ----------
const presetSelect = $('preset');
for (const [key, p] of Object.entries(PLATE_PRESETS)) {
  const o = document.createElement('option');
  o.value = key;
  o.textContent = p.label;
  presetSelect.appendChild(o);
}
function applyPreset(key) {
  const p = PLATE_PRESETS[key];
  if (!p) return;
  $('source').value = p.source;
  $('plate').value = p.plate;
  $('page').value = p.page;
  $('area').value = p.area;
  state.calibration = JSON.parse(JSON.stringify(p.calibration));
  $('anchor-x').value = p.calibration.anchor.scene[0];
  $('anchor-z').value = p.calibration.anchor.scene[1];
  updateStatus();
  if (state.image) nextStep();
  draw();
}
presetSelect.addEventListener('change', () => applyPreset(presetSelect.value));
// opening a known plate image picks its preset automatically
function presetForFile(name) {
  return Object.keys(PLATE_PRESETS).find((k) => PLATE_PRESETS[k].file === name);
}

// test hook: lets automated checks drive the tracer without a file dialog
window.__tracer = { state, fromJSON, toJSON, setMode, draw, fitImage };

const [ax, az] = defaultAnchor('DK-G');
$('anchor-x').value = ax;
$('anchor-z').value = az;
window.addEventListener('resize', resize);
resize();
setMode('none');

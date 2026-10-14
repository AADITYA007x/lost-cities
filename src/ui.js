import * as THREE from 'three';

// Quiet floating labels that follow places in the scene. Where two would overlap on
// screen, the more important one stays and the other fades out (priority: higher wins;
// on a tie, the nearer one).
export function createLabels(container, entries) {
  const items = entries.map(({ text, position, lift = 0, near = 0, far = 4200, priority = 1 }) => {
    const el = document.createElement('div');
    el.className = 'place-label';
    el.textContent = text;
    container.appendChild(el);
    return { el, near, far, priority, position: position.clone().add(new THREE.Vector3(0, lift, 0)), w: 0, h: 0, alpha: 0, want: 0, sx: 0, sy: 0, dist: 0 };
  });

  const v = new THREE.Vector3();
  let visible = false;
  let measured = false;
  const measure = () => {
    for (const it of items) {
      it.w = it.el.offsetWidth;
      it.h = it.el.offsetHeight;
    }
    measured = items.some((it) => it.w > 0);
  };
  window.addEventListener('resize', () => (measured = false));
  document.fonts?.ready.then(() => (measured = false));
  let last = performance.now();

  return {
    show(on) {
      visible = on;
      container.classList.toggle('on', on);
    },
    update(camera) {
      if (!visible) return;
      if (!measured) measure();
      const now = performance.now();
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const w = window.innerWidth;
      const h = window.innerHeight;
      for (const item of items) {
        v.copy(item.position).project(camera);
        const behind = v.z > 1;
        const dist = camera.position.distanceTo(item.position);
        const sx = ((v.x + 1) / 2) * w;
        const edge = Math.min(sx, w - sx) / 90;
        const range = Math.min((item.far - dist) / (item.far * 0.3), item.near ? (dist - item.near) / (item.near * 0.4) : 1);
        item.want = behind ? 0 : Math.min(1, Math.max(0, range), Math.max(0, edge));
        item.sx = sx;
        item.sy = ((1 - v.y) / 2) * h;
        item.dist = dist;
      }
      // keep the important labels; fade those that would overlap one already kept
      const order = items.filter((it) => it.want > 0.05).sort((a, b) => b.priority - a.priority || a.dist - b.dist);
      const kept = [];
      for (const it of order) {
        // the label's box: centred on sx, its bottom (with the little stem) at sy
        const box = { x0: it.sx - it.w / 2 - 6, x1: it.sx + it.w / 2 + 6, y0: it.sy - it.h - 2, y1: it.sy + 2 };
        if (kept.some((k) => box.x0 < k.x1 && box.x1 > k.x0 && box.y0 < k.y1 && box.y1 > k.y0)) it.want = 0;
        else kept.push(box);
      }
      for (const item of items) {
        // ease in and out, so labels do not flicker as the view moves
        item.alpha += (item.want - item.alpha) * Math.min(1, dt * 8);
        item.el.style.opacity = item.alpha < 0.01 ? '0' : item.alpha.toFixed(2);
        item.el.style.transform = `translate(-50%, -100%) translate(${item.sx.toFixed(1)}px, ${item.sy.toFixed(1)}px)`;
      }
    },
  };
}

// The "How true is this?" panel.
export function createNotePanel(button, panel, note) {
  const list = note.items
    .map(
      (item) => `
      <li class="note-item ${item.level}">
        <span class="note-tag">${item.label}</span>
        <p>${item.text}</p>
      </li>`
    )
    .join('');

  panel.innerHTML = `
    <div class="panel-head">
      <h2>${note.title}</h2>
      <button type="button" class="close" aria-label="Close">×</button>
    </div>
    <ul class="note-list">${list}</ul>
    <h3>Sources</h3>
    <ul class="sources">${note.sources.map((s) => `<li>${s}</li>`).join('')}</ul>
    <p class="notice">${note.dataNotice}</p>
  `;

  const open = (on) => {
    panel.classList.toggle('open', on);
    button.setAttribute('aria-expanded', String(on));
  };

  button.addEventListener('click', () => open(!panel.classList.contains('open')));
  panel.querySelector('.close').addEventListener('click', () => open(false));
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') open(false);
  });

  return { open };
}

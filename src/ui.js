import * as THREE from 'three';

// Quiet floating labels that follow places in the scene.
export function createLabels(container, entries) {
  const items = entries.map(({ text, position, lift = 0, near = 0, far = 4200 }) => {
    const el = document.createElement('div');
    el.className = 'place-label';
    el.textContent = text;
    container.appendChild(el);
    return { el, near, far, position: position.clone().add(new THREE.Vector3(0, lift, 0)) };
  });

  const v = new THREE.Vector3();
  let visible = false;

  return {
    show(on) {
      visible = on;
      container.classList.toggle('on', on);
    },
    update(camera) {
      if (!visible) return;
      const w = window.innerWidth;
      const h = window.innerHeight;
      for (const item of items) {
        v.copy(item.position).project(camera);
        const behind = v.z > 1;
        const dist = camera.position.distanceTo(item.position);
        const sx = ((v.x + 1) / 2) * w;
        const edge = Math.min(sx, w - sx) / 90;
        const range = Math.min((item.far - dist) / (item.far * 0.3), item.near ? (dist - item.near) / (item.near * 0.4) : 1);
        const fade = behind ? 0 : Math.min(1, Math.max(0, range), Math.max(0, edge));
        item.el.style.opacity = fade.toFixed(2);
        item.el.style.transform = `translate(-50%, -100%) translate(${((v.x + 1) / 2) * w}px, ${((1 - v.y) / 2) * h}px)`;
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

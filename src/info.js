import * as THREE from 'three';
import { FEATURES, SOURCES, elementLine } from './content/features.js';
import { EXCAVATED_AREAS, FIRST_STREET, pointInPolygon } from './city/layout.js';

const inRect = (r, x, z) => r && x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1;

function distanceToSegment(px, pz, [ax, az], [bx, bz]) {
  const dx = bx - ax;
  const dz = bz - az;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / (dx * dx + dz * dz)));
  return Math.hypot(px - (ax + t * dx), pz - (az + t * dz));
}

// Decide which feature a click landed on, and which outline to draw around it.
function lookup(city, hit) {
  const { x, z } = hit.point;
  const ud = hit.object.userData || {};
  const { plan, covered, rects } = city;
  const tracedAt = covered.find((c) => inRect(c, x, z));
  const rectShape = (r) => ({ rect: r });

  if (ud.kind === 'mound') return { id: 'mound', shape: null };
  if (ud.kind === 'stupa') return { id: 'stupa', shape: null };
  if (ud.kind === 'craft') return { id: `craft-${ud.craft}`, shape: null };
  if (ud.kind === 'walker') return { id: 'walkers', shape: null };
  if (ud.kind === 'pool' || inRect(plan.bath, x, z)) return { id: 'greatBath', shape: rectShape(plan.bath) };
  if (inRect(plan.hall, x, z)) return { id: 'greatHall', shape: rectShape(plan.hall) };
  if (inRect(plan.pillared, x, z)) return { id: 'pillaredHall', shape: rectShape(plan.pillared) };
  if (!tracedAt && inRect(plan.college, x, z)) return { id: 'college', shape: rectShape(plan.college) };
  if (ud.kind === 'well') return { id: 'well', shape: null };
  if (ud.kind === 'ramps') return { id: 'ramp', shape: null };
  if (ud.kind === 'water') return { id: 'river', shape: null };
  if (ud.kind === 'terrain') return { id: 'plain', shape: null };

  const onLower = pointInPolygon(x, z, rects.lowerTown.outline);
  const onCitadel = pointInPolygon(x, z, rects.citadel.outline);
  const nearFirst = distanceToSegment(x, z, FIRST_STREET.north, FIRST_STREET.south) < FIRST_STREET.width / 2 + 1.5;
  if (onLower && nearFirst && ud.kind !== 'walls') return { id: 'firstStreet', shape: { line: [FIRST_STREET.north, FIRST_STREET.south] } };
  if (ud.kind === 'paving' && onLower) return { id: 'drain', shape: null };

  if (tracedAt) {
    const id = `area-${tracedAt.area}`;
    return { id: FEATURES[id] ? id : 'houseInferred', shape: rectShape(tracedAt), traced: tracedAt };
  }
  const area = EXCAVATED_AREAS.find((a) => inRect(a, x, z));
  if (area) {
    if (ud.kind === 'platform') return { id: onCitadel ? 'citadel' : 'lowerTown', shape: { poly: onCitadel ? rects.citadel.outline : rects.lowerTown.outline } };
    if (area.id.startsWith('DK')) return { id: 'area-DK', shape: rectShape(area) };
    if (area.id === 'SD') return { id: 'area-SD', shape: rectShape(area) };
    return { id: 'houseInferred', shape: rectShape(area) };
  }
  if (ud.kind === 'platform' || (!ud.kind && (onLower || onCitadel))) {
    return { id: onCitadel ? 'citadel' : 'lowerTown', shape: { poly: onCitadel ? rects.citadel.outline : rects.lowerTown.outline } };
  }
  if (onLower || onCitadel) return { id: 'houseImagined', shape: null };
  return { id: 'plain', shape: null };
}

function certaintyOf(hit) {
  const ud = hit.object.userData || {};
  return ud.certainty ?? 1;
}

const LEVEL_LABEL = { excavated: 'Excavated', inferred: 'Inferred', imagined: 'Imagined' };

export function createInfo({ canvas, camera, scene, city, terrainMeshes, panel, groundAt }) {
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const targets = [...city.pickables, ...terrainMeshes];
  let hitFilter = () => true;

  // a soft gold outline around the chosen feature
  const outlineMat = new THREE.LineBasicMaterial({ color: '#e2bf72', transparent: true, opacity: 0, depthTest: false });
  let outline = null;
  let outlineFade = 0;
  // the outline is drawn through walls, which reads well from above but not at eye
  // level, so it is switched off while walking
  let outlinesOn = true;

  function setOutline(shape) {
    if (outline) {
      scene.remove(outline);
      outline.geometry.dispose();
      outline = null;
    }
    if (!shape || !outlinesOn) return;
    let pts = [];
    if (shape.rect) {
      const r = shape.rect;
      pts = [[r.x0, r.z0], [r.x1, r.z0], [r.x1, r.z1], [r.x0, r.z1]];
    } else if (shape.poly) {
      pts = shape.poly;
    } else if (shape.line) {
      pts = shape.line;
    }
    const v = pts.map(([x, z]) => new THREE.Vector3(x, Math.max(0, groundAt(x, z)) + 0.6, z));
    const geo = new THREE.BufferGeometry().setFromPoints(v);
    outline = shape.line ? new THREE.Line(geo, outlineMat) : new THREE.LineLoop(geo, outlineMat);
    outline.renderOrder = 10;
    scene.add(outline);
    outlineFade = 0;
  }

  function render(found, hit) {
    const f = FEATURES[found.id];
    if (!f) return;
    const [lvl, line] = elementLine(hit.object.userData?.kind, certaintyOf(hit), { traced: Boolean(found.traced) }) || [null, null];
    const list = (items) => items.map((t) => `<li>${t}</li>`).join('');
    panel.innerHTML = `
      <div class="info-head">
        <p class="info-kicker">${f.kicker}</p>
        <button type="button" class="close" aria-label="Close">×</button>
      </div>
      <h2>${f.title}</h2>
      <p class="chip ${f.certainty}"><span></span>${LEVEL_LABEL[f.certainty]}</p>
      <p class="info-what">${f.what}</p>
      ${f.known.length ? `<h3>What we know</h3><ul class="info-list">${list(f.known)}</ul>` : ''}
      ${f.debated ? `<h3>Debated</h3><p>${f.debated}</p>` : ''}
      <h3>What you see here</h3>
      <p>${f.here}</p>
      ${line ? `<p class="info-element ${lvl}"><span></span>${line}</p>` : ''}
      ${f.sources.length ? `<h3>Sources</h3><ul class="sources">${list(f.sources.map((k) => SOURCES[k]))}</ul>` : ''}
    `;
    panel.querySelector('.close').addEventListener('click', close);
    panel.classList.add('open');
    panel.scrollTop = 0;
  }

  function close() {
    panel.classList.remove('open');
    setOutline(null);
  }

  function pick(clientX, clientY) {
    const r = canvas.getBoundingClientRect();
    ndc.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    const hits = raycaster.intersectObjects(targets, false).filter((h) => h.object.visible && hitFilter(h));
    return hits[0] || null;
  }

  // a click is a short press without dragging (dragging moves the camera)
  let down = null;
  canvas.addEventListener('pointerdown', (e) => {
    if (e.isPrimary) down = { x: e.clientX, y: e.clientY, t: performance.now() };
  });
  canvas.addEventListener('pointerup', (e) => {
    if (!down || !e.isPrimary) return;
    const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
    const quick = performance.now() - down.t < 450;
    down = null;
    if (moved > 6 || !quick || !enabled) return;
    const hit = pick(e.clientX, e.clientY);
    if (!hit) return close();
    const found = lookup(city, hit);
    // whether the clicked piece lies on a traced plan matters for what we say about it
    if (!found.traced) found.traced = city.covered.find((c) => inRect(c, hit.point.x, hit.point.z)) || null;
    render(found, hit);
    setOutline(found.shape);
  });
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') close();
  });

  let enabled = false;
  return {
    enable(on) {
      enabled = on;
    },
    close,
    setHitFilter(fn) {
      hitFilter = fn;
    },
    addTargets(list) {
      targets.unshift(...list);
    },
    showOutlines(on) {
      outlinesOn = on;
      if (!on) setOutline(null);
    },
    update(dt) {
      if (!outline) return;
      outlineFade = Math.min(1, outlineFade + dt * 1.5);
      outlineMat.opacity = 0.85 * outlineFade;
    },
  };
}

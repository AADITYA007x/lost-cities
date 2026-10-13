// The certainty layer: one switch between the living city ("alive") and the
// evidence view, where excavated pieces stay solid, inferred ones turn to ghosts,
// and imagined ones become a faint sketch.

const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

export function createCertaintyLayer({ entries, mixUniform, extra = [] }) {
  // entries: [{ mesh, base, evidence }] for inferred / imagined meshes
  // extra: [{ object, hideInEvidence }] e.g. imagined wells
  let target = 0;
  let t = 0;
  let swapped = false;
  const duration = 1.1;

  function useEvidenceMaterials(on) {
    if (on === swapped) return;
    swapped = on;
    for (const e of entries) {
      e.mesh.material = on ? e.evidence : e.base;
      e.mesh.castShadow = !on;
    }
  }

  return {
    get mode() {
      return target ? 'evidence' : 'alive';
    },
    set(mode) {
      target = mode === 'evidence' ? 1 : 0;
      if (target) useEvidenceMaterials(true);
    },
    update(dt) {
      if (t === target && (target || !swapped)) return;
      t = target > t ? Math.min(target, t + dt / duration) : Math.max(target, t - dt / duration);
      mixUniform.value = ease(t);
      for (const x of extra) x.object.visible = !(x.hideInEvidence && t > 0.5);
      if (t === 0 && target === 0) useEvidenceMaterials(false);
    },
  };
}

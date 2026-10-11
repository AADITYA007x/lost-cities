import * as THREE from 'three';

const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

// Smoothly moves the camera and its look-at target together.
export function createFlight(camera, controls) {
  let active = null;

  return {
    get flying() {
      return active !== null;
    },
    to({ position, target, duration = 6 }, onDone) {
      active = {
        fromPos: camera.position.clone(),
        fromTarget: controls.target.clone(),
        toPos: position.clone(),
        toTarget: target.clone(),
        t: 0,
        duration,
        onDone,
      };
    },
    cancel() {
      active = null;
    },
    update(dt) {
      if (!active) return;
      active.t = Math.min(1, active.t + dt / active.duration);
      const k = ease(active.t);
      camera.position.lerpVectors(active.fromPos, active.toPos, k);
      // arc the path up a little so long moves feel like flight, not a slide
      camera.position.y += Math.sin(Math.PI * k) * active.fromPos.distanceTo(active.toPos) * 0.08;
      controls.target.lerpVectors(active.fromTarget, active.toTarget, k);
      camera.lookAt(controls.target);
      if (active.t >= 1) {
        const done = active.onDone;
        active = null;
        done?.();
      }
    },
  };
}

// Keeps the orbit target on the ground, inside the map, and the camera above the terrain.
export function createCameraLimits(camera, controls, heightAt, { radius = 2800, clearance = 25 } = {}) {
  const offset = new THREE.Vector3();
  return function limit() {
    const t = controls.target;
    const d = Math.hypot(t.x, t.z);
    if (d > radius) {
      offset.set(t.x, 0, t.z).multiplyScalar(radius / d - 1);
      t.add(offset);
      camera.position.add(offset);
    }
    t.y = heightAt(t.x, t.z);
    const ground = heightAt(camera.position.x, camera.position.z);
    if (camera.position.y < ground + clearance) camera.position.y = ground + clearance;
  };
}

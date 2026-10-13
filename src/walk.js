import * as THREE from 'three';

// Walking at eye height: WASD / arrow keys and drag-to-look on a computer,
// a thumb joystick and drag-to-look on a touch screen.

const EYE = 1.6;
const WALK = 1.4; // m/s, an unhurried pace
const HURRY = 3.6;
const RADIUS = 0.3;
const STEP_UP = 0.7; // higher than this is a wall or a platform edge

export function createWalk({ camera, canvas, groundAt, onPlatform, joystickEl }) {
  let collision = null;
  let active = false;
  let yaw = 0;
  let pitch = 0;
  const pos = new THREE.Vector3();
  let bob = 0;
  let speedNow = 0;
  const keys = new Set();
  const stick = { x: 0, y: 0, id: null, cx: 0, cy: 0 };
  let look = null;

  // ---------- keyboard ----------
  const keyMap = {
    KeyW: 'f', ArrowUp: 'f', KeyS: 'b', ArrowDown: 'b',
    KeyA: 'l', ArrowLeft: 'l', KeyD: 'r', ArrowRight: 'r',
    ShiftLeft: 'fast', ShiftRight: 'fast',
  };
  window.addEventListener('keydown', (e) => {
    if (!active || e.target.closest?.('input, textarea, select')) return;
    const k = keyMap[e.code];
    if (k) {
      keys.add(k);
      e.preventDefault();
    }
  });
  window.addEventListener('keyup', (e) => {
    const k = keyMap[e.code];
    if (k) keys.delete(k);
  });
  window.addEventListener('blur', () => keys.clear());

  // ---------- drag to look ----------
  canvas.addEventListener('pointerdown', (e) => {
    if (!active || e.pointerId === stick.id) return;
    look = { id: e.pointerId, x: e.clientX, y: e.clientY };
  });
  window.addEventListener('pointermove', (e) => {
    if (!active || !look || e.pointerId !== look.id) return;
    const dx = e.clientX - look.x;
    const dy = e.clientY - look.y;
    look.x = e.clientX;
    look.y = e.clientY;
    const k = e.pointerType === 'touch' ? 0.0055 : 0.0035;
    // the view turns the way the finger or mouse moves: drag left to look left
    yaw -= dx * k;
    pitch = THREE.MathUtils.clamp(pitch + dy * k, -1.2, 1.2);
  });
  const endLook = (e) => {
    if (look && e.pointerId === look.id) look = null;
  };
  window.addEventListener('pointerup', endLook);
  window.addEventListener('pointercancel', endLook);

  // ---------- joystick (touch) ----------
  const knob = joystickEl.querySelector('.knob');
  joystickEl.addEventListener('pointerdown', (e) => {
    stick.id = e.pointerId;
    const r = joystickEl.getBoundingClientRect();
    stick.cx = r.left + r.width / 2;
    stick.cy = r.top + r.height / 2;
    try {
      joystickEl.setPointerCapture(e.pointerId);
    } catch {
      // some browsers refuse capture for synthetic pointers; the stick still works
    }
    moveStick(e);
    e.stopPropagation();
  });
  joystickEl.addEventListener('pointermove', (e) => {
    if (e.pointerId === stick.id) moveStick(e);
  });
  const endStick = (e) => {
    if (e.pointerId !== stick.id) return;
    stick.id = null;
    stick.x = 0;
    stick.y = 0;
    knob.style.transform = '';
  };
  joystickEl.addEventListener('pointerup', endStick);
  joystickEl.addEventListener('pointercancel', endStick);
  function moveStick(e) {
    const max = 42;
    let dx = e.clientX - stick.cx;
    let dy = e.clientY - stick.cy;
    const d = Math.hypot(dx, dy);
    if (d > max) {
      dx *= max / d;
      dy *= max / d;
    }
    stick.x = dx / max;
    stick.y = dy / max;
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
  }

  // ---------- movement ----------
  function tryMove(nx, nz) {
    const here = groundAt(pos.x, pos.z);
    const ok = (x, z) => collision.free(x, z, RADIUS) && onPlatform(x, z) && Math.abs(groundAt(x, z) - here) < STEP_UP;
    if (ok(nx, nz)) {
      pos.x = nx;
      pos.z = nz;
      return;
    }
    // slide along walls
    if (ok(nx, pos.z)) pos.x = nx;
    else if (ok(pos.x, nz)) pos.z = nz;
  }

  const forward = new THREE.Vector3();
  const right = new THREE.Vector3();

  return {
    get active() {
      return active;
    },
    get position() {
      return pos;
    },
    get yaw() {
      return yaw;
    },
    setCollision(c) {
      collision = c;
    },
    // place the walker; returns the camera pose to fly to
    start(x, z, yawStart) {
      pos.set(x, groundAt(x, z), z);
      yaw = yawStart;
      pitch = -0.04;
      return this.pose();
    },
    pose() {
      const p = new THREE.Vector3(pos.x, pos.y + EYE, pos.z);
      const t = p.clone().add(new THREE.Vector3(-Math.sin(yaw) * Math.cos(pitch), -Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch)).multiplyScalar(5));
      return { position: p, target: t };
    },
    enable(on) {
      active = on;
      keys.clear();
      look = null;
      joystickEl.classList.toggle('on', on && matchMedia('(pointer: coarse)').matches);
    },
    update(dt) {
      if (!active || !collision) return;
      // input direction
      let f = 0;
      let s = 0;
      if (keys.has('f')) f += 1;
      if (keys.has('b')) f -= 1;
      if (keys.has('l')) s -= 1;
      if (keys.has('r')) s += 1;
      f -= stick.y;
      s += stick.x;
      const mag = Math.min(1, Math.hypot(f, s));
      const target = mag * (keys.has('fast') ? HURRY : WALK);
      speedNow += (target - speedNow) * Math.min(1, dt * 6);
      if (mag > 0.01 && speedNow > 0.01) {
        forward.set(-Math.sin(yaw), 0, -Math.cos(yaw));
        right.set(Math.cos(yaw), 0, -Math.sin(yaw));
        const step = speedNow * dt;
        const dx = ((forward.x * f + right.x * s) / Math.max(mag, 1e-6)) * step;
        const dz = ((forward.z * f + right.z * s) / Math.max(mag, 1e-6)) * step;
        // move in small sub-steps so fast walking cannot pass through thin walls
        const n = Math.ceil(Math.hypot(dx, dz) / 0.1);
        for (let i = 0; i < n; i++) tryMove(pos.x + dx / n, pos.z + dz / n);
        bob += step * 3.2;
      }
      // follow the ground smoothly
      const g = groundAt(pos.x, pos.z);
      pos.y += (g - pos.y) * Math.min(1, dt * 10);
      const sway = Math.sin(bob) * 0.025 * Math.min(1, speedNow / WALK);
      camera.position.set(pos.x, pos.y + EYE + sway, pos.z);
      camera.rotation.set(-pitch, yaw, 0, 'YXZ');
    },
  };
}
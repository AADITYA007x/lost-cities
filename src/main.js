import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { createBrickMaterial, createEarthMaterial } from './materials.js';

const isSmallScreen = Math.min(window.innerWidth, window.innerHeight) < 700;
const isTouch = matchMedia('(pointer: coarse)').matches;
const lowPower = isSmallScreen || isTouch;

// ---------- renderer ----------
const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: !lowPower, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, lowPower ? 1.5 : 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;

const scene = new THREE.Scene();
const haze = new THREE.Color('#d9b48c');
scene.fog = new THREE.Fog(haze, 30, 140);

const portrait = () => window.innerWidth < window.innerHeight;
const camera = new THREE.PerspectiveCamera(portrait() ? 62 : 42, window.innerWidth / window.innerHeight, 0.1, 600);
camera.position.set(19, 8.5, 21);

// ---------- sky ----------
const sky = new THREE.Mesh(
  new THREE.SphereGeometry(400, 32, 16),
  new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      uTop: { value: new THREE.Color('#6f86a3') },
      uMid: { value: new THREE.Color('#e7b98e') },
      uLow: { value: haze },
    },
    vertexShader: `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `
      uniform vec3 uTop;
      uniform vec3 uMid;
      uniform vec3 uLow;
      varying vec3 vDir;
      void main() {
        float h = vDir.y;
        vec3 c = mix(uLow, uMid, smoothstep(-0.02, 0.12, h));
        c = mix(c, uTop, smoothstep(0.12, 0.7, h));
        gl_FragColor = vec4(c, 1.0);
        #include <colorspace_fragment>
      }`,
  })
);
scene.add(sky);

// ---------- light ----------
const hemi = new THREE.HemisphereLight('#f3d6b4', '#6b4a33', 0.9);
scene.add(hemi);

const sun = new THREE.DirectionalLight('#ffd2a0', 2.6);
sun.position.set(-22, 13, 9);
sun.castShadow = true;
sun.shadow.mapSize.set(lowPower ? 1024 : 2048, lowPower ? 1024 : 2048);
sun.shadow.camera.left = -22;
sun.shadow.camera.right = 22;
sun.shadow.camera.top = 22;
sun.shadow.camera.bottom = -22;
sun.shadow.camera.near = 1;
sun.shadow.camera.far = 80;
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.03;
sun.shadow.radius = 4;
scene.add(sun);

// ---------- ground ----------
const ground = new THREE.Mesh(
  new THREE.CircleGeometry(300, 64),
  createEarthMaterial()
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

// ---------- a lane corner (placeholder, not yet a traced plan) ----------
const brick = createBrickMaterial();
const brickDark = createBrickMaterial({ tone: '#9a6440' });

function block(w, h, d, x, y, z, material = brick) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  mesh.position.set(x, y + h / 2, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);
  return mesh;
}

const H = 3.6; // wall height (ground storey)
const T = 0.9; // wall thickness

// North house: blank wall along the lane, broken by a side lane at x = 2..3.6
block(14, H, T, -5, 0, -2.2);
block(8, H, T, 7.6, 0, -2.2);
// Side lane walls running north
block(T, H, 9, 1.55, 0, -7.1);
block(T, H, 9, 4.05, 0, -7.1);

// South house: long wall with a doorway into the courtyard house
block(9, H, T, -7.5, 0, 2.2);
block(13, H, T, 6.5, 0, 2.2);
// doorway gap between x = -3 and x = 0, with a timber lintel (imagined: wood does not survive)
const lintel = new THREE.Mesh(
  new THREE.BoxGeometry(3.2, 0.22, T * 0.8),
  new THREE.MeshStandardMaterial({ color: '#5c3d27', roughness: 0.85 })
);
lintel.position.set(-1.5, 2.35, 2.2);
lintel.castShadow = true;
scene.add(lintel);
block(3.0, H - 2.46, T, -1.5, 2.46, 2.2);
// courtyard walls behind the door
block(T, H, 8, -12.45, 0, 6.2);
block(T, H, 8, 12.55, 0, 6.2);

// Covered drain along the lane: a low brick channel with a gap showing the water course
block(26, 0.06, 0.55, 0, 0, 1.25, brickDark);

// A low brick bench/platform at the foot of the wall (common outside houses)
block(3.2, 0.45, 0.7, 6.2, 0, -1.4, brickDark);

// ---------- controls ----------
const controls = new OrbitControls(camera, canvas);
controls.target.set(0, 1.2, 0);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.minDistance = 8;
controls.maxDistance = 70;
controls.maxPolarAngle = Math.PI * 0.47;
controls.autoRotate = true;
controls.autoRotateSpeed = 0.25;
controls.enabled = false;

// ?view=eye starts at human eye height in the lane (for testing what a walker sees)
if (new URLSearchParams(location.search).get('view') === 'eye') {
  camera.position.set(10, 1.6, 0.2);
  controls.target.set(-6, 1.6, -0.3);
  controls.minDistance = 0.5;
  controls.autoRotate = false;
}
controls.update();

// ---------- opening ----------
const opening = document.getElementById('opening');
const status = document.getElementById('status');
const serverStatus = document.getElementById('server-status');

function savePreference(sound) {
  try {
    localStorage.setItem('md-sound', sound);
  } catch {
    /* storage unavailable: preference lives for this visit only */
  }
}

opening.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-sound]');
  if (!button) return;
  savePreference(button.dataset.sound);
  opening.classList.add('gone');
  controls.enabled = true;
  status.hidden = false;
  checkServer();
});

async function checkServer() {
  try {
    const response = await fetch('/api/health', { cache: 'no-store' });
    const data = await response.json();
    if (data.ok) {
      serverStatus.textContent = 'server: ok';
      serverStatus.classList.add('ok');
      return;
    }
    throw new Error('not ok');
  } catch {
    serverStatus.textContent = 'server: not running (fine with npm run dev)';
  }
}

// stop the slow orbit once the visitor takes the camera
canvas.addEventListener('pointerdown', () => {
  if (controls.enabled) controls.autoRotate = false;
});

// ---------- loop ----------
function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.fov = portrait() ? 62 : 42;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}
window.addEventListener('resize', onResize);

renderer.setAnimationLoop(() => {
  controls.update();
  renderer.render(scene, camera);
});

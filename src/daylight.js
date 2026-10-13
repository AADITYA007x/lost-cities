import * as THREE from 'three';

// Where the sun stands over Mohenjo-daro, and what the light looks like.
// The sun's position is computed for the site's latitude with the Earth's tilt
// of around 2500 BCE (about 24.0 degrees; today it is 23.44).

const LATITUDE = THREE.MathUtils.degToRad(27.33);
const TILT = THREE.MathUtils.degToRad(24.0);

export const SEASONS = {
  cool: { label: 'Cool season', day: 15, note: 'January' },
  hot: { label: 'Hot season', day: 135, note: 'May' },
  monsoon: { label: 'Monsoon', day: 227, note: 'August' },
  after: { label: 'After the rains', day: 288, note: 'October' },
};

// sun direction in the scene (north is -z, east is +x) for a day of the year and a
// local sun time in hours (12 = the sun at its highest)
export function sunDirectionAt(day, hour, out = new THREE.Vector3()) {
  const lambda = (2 * Math.PI * (day - 80)) / 365.25; // roughly, the sun's place on its yearly path
  const dec = Math.asin(Math.sin(TILT) * Math.sin(lambda));
  const H = THREE.MathUtils.degToRad((hour - 12) * 15);
  const sinEl = Math.sin(LATITUDE) * Math.sin(dec) + Math.cos(LATITUDE) * Math.cos(dec) * Math.cos(H);
  const el = Math.asin(sinEl);
  const az = Math.atan2(-Math.sin(H), Math.tan(dec) * Math.cos(LATITUDE) - Math.sin(LATITUDE) * Math.cos(H));
  return out.set(Math.cos(el) * Math.sin(az), Math.sin(el), -Math.cos(el) * Math.cos(az));
}

// the turning of the night sky: the celestial pole stands due north, as high as the latitude
export const POLE = new THREE.Vector3(0, Math.sin(LATITUDE), -Math.cos(LATITUDE));

// Light at a few sun heights (degrees); everything between is blended.
const C = (h) => new THREE.Color(h);
const KEYS = [
  { el: -18, top: C('#070b16'), mid: C('#0d1424'), low: C('#141a28'), sun: C('#8fa3c8'), sunI: 0, hemiSky: C('#5d6f9c'), hemiGround: C('#211c17'), hemiI: 1.15, exposure: 1.3, stars: 1, glow: 1 },
  { el: -8, top: C('#121c36'), mid: C('#2a3150'), low: C('#3a3a4c'), sun: C('#ff9a6a'), sunI: 0, hemiSky: C('#6f7ea8'), hemiGround: C('#2c231b'), hemiI: 1.1, exposure: 1.2, stars: 0.55, glow: 0.85 },
  { el: -2, top: C('#3a4a72'), mid: C('#c78a78'), low: C('#9c7c78'), sun: C('#ff9058'), sunI: 0.15, hemiSky: C('#b0a2b4'), hemiGround: C('#43322a'), hemiI: 0.95, exposure: 1.1, stars: 0.1, glow: 0.5 },
  { el: 4, top: C('#5f78a0'), mid: C('#eba77a'), low: C('#d49a7c'), sun: C('#ffa868'), sunI: 2.0, hemiSky: C('#e0bfa8'), hemiGround: C('#54402e'), hemiI: 0.66, exposure: 1.0, stars: 0, glow: 0.15 },
  { el: 20, top: C('#7d93ad'), mid: C('#e9c29b'), low: C('#dcc0a0'), sun: C('#ffd3a0'), sunI: 2.9, hemiSky: C('#e9d6bd'), hemiGround: C('#5e4630'), hemiI: 0.75, exposure: 1.0, stars: 0, glow: 0 },
  { el: 50, top: C('#6f8fb4'), mid: C('#d9cdb8'), low: C('#ddd0bc'), sun: C('#fff0dc'), sunI: 3.1, hemiSky: C('#e6e2d6'), hemiGround: C('#6a5038'), hemiI: 0.8, exposure: 0.9, stars: 0, glow: 0 },
];

// How each season changes the air.
const AIR = {
  cool: { haze: C('#d6c3aa'), hazeAmount: 0.15, density: 0.85, sun: 1.0, blue: 0.12 },
  hot: { haze: C('#ddc6a2'), hazeAmount: 0.3, density: 1.2, sun: 1.0, blue: -0.12 },
  monsoon: { haze: C('#aeb0a8'), hazeAmount: 0.65, density: 1.35, sun: 0.25, blue: -0.6 },
  after: { haze: C('#d8c6ad'), hazeAmount: 0.1, density: 0.9, sun: 1.0, blue: 0.08 },
};

const tmp = new THREE.Color();

export function lightAt(sunDir, season, rain = 0) {
  const el = THREE.MathUtils.radToDeg(Math.asin(THREE.MathUtils.clamp(sunDir.y, -1, 1)));
  let i = 0;
  while (i < KEYS.length - 2 && el > KEYS[i + 1].el) i++;
  const a = KEYS[i];
  const b = KEYS[i + 1];
  const t = THREE.MathUtils.clamp((el - a.el) / (b.el - a.el), 0, 1);
  const lerpC = (k) => a[k].clone().lerp(b[k], t);
  const lerpN = (k) => a[k] + (b[k] - a[k]) * t;
  const out = {
    elevation: el,
    top: lerpC('top'),
    mid: lerpC('mid'),
    low: lerpC('low'),
    sun: lerpC('sun'),
    sunI: lerpN('sunI'),
    hemiSky: lerpC('hemiSky'),
    hemiGround: lerpC('hemiGround'),
    hemiI: lerpN('hemiI'),
    exposure: lerpN('exposure'),
    stars: lerpN('stars'),
    glow: lerpN('glow'),
  };

  const air = AIR[season] || AIR.cool;
  // daylight strength decides how much the season's haze shows
  const day = THREE.MathUtils.clamp((el + 4) / 14, 0, 1);
  out.low.lerp(tmp.copy(air.haze), air.hazeAmount * day);
  out.mid.lerp(tmp.copy(air.haze), air.hazeAmount * 0.6 * day);
  // bluer or paler sky
  if (air.blue < 0) out.top.lerp(tmp.copy(air.haze).multiplyScalar(0.95), -air.blue * day);
  else out.top.lerp(tmp.setRGB(out.top.r * 0.85, out.top.g * 0.95, out.top.b * 1.08), air.blue * day);
  out.sunI *= air.sun;
  if (season === 'monsoon') {
    // an overcast sky spreads the light: weaker sun, stronger sky light, few stars
    out.hemiI *= 1 + 0.6 * day;
    out.hemiSky.lerp(tmp.set('#cfd2cc'), 0.5 * day);
    out.sun.lerp(tmp.set('#e6e4dc'), 0.5 * day);
    out.stars *= 0.35;
  }
  out.fogDensity = 0.00016 * air.density;
  if (rain > 0) {
    // rain clouds: a grey sky, little direct sun, thick air
    const cloud = new THREE.Color('#8f9391').multiplyScalar(0.12 + 0.88 * day);
    out.top.lerp(cloud, 0.75 * rain);
    out.mid.lerp(cloud, 0.65 * rain);
    out.low.lerp(cloud.clone().multiplyScalar(1.05), 0.6 * rain);
    out.hemiSky.lerp(tmp.set('#c9cdca'), 0.35 * rain * day);
    out.sunI *= 1 - 0.85 * rain;
    out.stars *= 1 - rain;
    out.fogDensity *= 1 + 1.3 * rain;
  }
  return out;
}

// "Late afternoon", "Night" ... from the sun's height and the time
export function describeTime(hour, elevation) {
  if (elevation < -12) return 'Night';
  if (elevation < -0.8) return hour < 12 ? 'Before dawn' : 'Dusk';
  if (elevation < 8) return hour < 12 ? 'Sunrise' : 'Sunset';
  if (hour < 10) return 'Morning';
  if (hour < 14) return 'Midday';
  return 'Afternoon';
}

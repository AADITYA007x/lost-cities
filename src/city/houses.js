import { CERTAINTY } from './batch.js';

// A courtyard house on one plot, built from the rules seen in excavated houses:
// thick outer walls, few openings to the street, rooms around an open courtyard,
// entrance from a side lane, stairs (and so an upper storey) in many houses.

const T = 0.9; // outer wall
const t = 0.6; // inner wall
const H0 = 3.3; // usual ground storey height
const DOOR = 1.1;

function wallWithDoor(batch, axis, a0, a1, fixed0, fixed1, y, h, door, cert) {
  // axis 'x': wall runs along x from a0 to a1, occupying z fixed0..fixed1
  if (door === null || a1 - a0 < door + 1.6) {
    if (axis === 'x') batch.box(a0, y, fixed0, a1, y + h, fixed1, cert);
    else batch.box(fixed0, y, a0, fixed1, y + h, a1, cert);
    return;
  }
  const d0 = Math.min(Math.max(door, a0 + 0.8), a1 - 0.8 - DOOR);
  const d1 = d0 + DOOR;
  const lintel = y + 2.2;
  if (axis === 'x') {
    batch.box(a0, y, fixed0, d0, y + h, fixed1, cert);
    batch.box(d1, y, fixed0, a1, y + h, fixed1, cert);
    batch.box(d0, lintel, fixed0, d1, y + h, fixed1, cert);
  } else {
    batch.box(fixed0, y, a0, fixed1, y + h, d0, cert);
    batch.box(fixed0, y, d1, fixed1, y + h, a1, cert);
    batch.box(fixed0, lintel, d0, fixed1, y + h, d1, cert);
  }
}

// lamps use their own random numbers from the plot position, so adding them does not
// change the houses themselves
const lampRand = (lot, k) => {
  const v = Math.sin(lot.x0 * 12.9898 + lot.z0 * 78.233 + k * 37.719) * 43758.5453;
  return v - Math.floor(v);
};

export function buildHouse(lot, y, rng, out, opts) {
  // tag every piece of this house with one number, so the time view can show only
  // some houses (a young city) or leave some as ruins (a late one)
  const saved = [out.walls.tag, out.roofs.tag];
  const tag = { era: 31, build: lampRand(lot, 7), base: y };
  out.walls.tag = tag;
  out.roofs.tag = tag;
  buildHouseInner(lot, y, rng, out, opts);
  [out.walls.tag, out.roofs.tag] = saved;
}

function buildHouseInner(lot, y, rng, out, { known, detail }) {
  const { walls, roofs, wells } = out;
  // storeys differ a little from house to house, as they do in the plans' wall widths
  const H = H0 - 0.25 + lampRand(lot, 9) * 0.5;
  const wallCert = known ? CERTAINTY.inferred : CERTAINTY.imagined;
  const upperCert = known ? CERTAINTY.inferred : CERTAINTY.imagined;
  const roofCert = CERTAINTY.imagined;

  const { x0, x1, z0, z1 } = lot;
  const w = x1 - x0;
  const d = z1 - z0;

  // entrance on a side that faces a lane or street
  const openSides = Object.entries(lot.open).filter(([, v]) => v).map(([k]) => k);
  const entrance = openSides.length ? rng.pick(openSides) : rng.pick(['n', 's', 'e', 'w']);
  const doorAlong = (len, start) => start + rng.range(0.15, 0.75) * len;

  // outer walls
  wallWithDoor(walls, 'x', x0, x1, z0, z0 + T, y, H, entrance === 'n' ? doorAlong(w, x0) : null, wallCert);
  wallWithDoor(walls, 'x', x0, x1, z1 - T, z1, y, H, entrance === 's' ? doorAlong(w, x0) : null, wallCert);
  wallWithDoor(walls, 'z', z0 + T, z1 - T, x0, x0 + T, y, H, entrance === 'w' ? doorAlong(d, z0) : null, wallCert);
  wallWithDoor(walls, 'z', z0 + T, z1 - T, x1 - T, x1, y, H, entrance === 'e' ? doorAlong(d, z0) : null, wallCert);

  const ix0 = x0 + T;
  const ix1 = x1 - T;
  const iz0 = z0 + T;
  const iz1 = z1 - T;
  const iw = ix1 - ix0;
  const id = iz1 - iz0;

  // small plots: one row of rooms beside a yard
  if (iw < 8.5 || id < 8.5) {
    const alongX = iw >= id;
    const split = alongX ? ix0 + iw * rng.range(0.4, 0.55) : iz0 + id * rng.range(0.4, 0.55);
    if (alongX) {
      wallWithDoor(walls, 'z', iz0, iz1, split - t / 2, split + t / 2, y, H, iz0 + id * 0.4, wallCert);
      roofs.box(ix0 - 0.2, y + H, iz0 - 0.2, split, y + H + 0.3, iz1 + 0.2, roofCert);
    } else {
      wallWithDoor(walls, 'x', ix0, ix1, split - t / 2, split + t / 2, y, H, ix0 + iw * 0.4, wallCert);
      roofs.box(ix0 - 0.2, y + H, iz0 - 0.2, ix1 + 0.2, y + H + 0.3, split, roofCert);
    }
    // an evening lamp in the open yard (imagined)
    if (out.lamps && lampRand(lot, 1) < 0.5) {
      out.lamps.push(alongX ? { x: (split + ix1) / 2, z: iz0 + 0.8, y: y + 1.5 } : { x: ix0 + 0.8, z: (split + iz1) / 2, y: y + 1.5 });
    }
    return;
  }

  // courtyard
  const cw = Math.max(3.2, iw * rng.range(0.34, 0.48));
  const cd = Math.max(3.2, id * rng.range(0.34, 0.48));
  const cx0 = ix0 + Math.max(2.6, (iw - cw) * rng.range(0.35, 0.65));
  const cz0 = iz0 + Math.max(2.6, (id - cd) * rng.range(0.35, 0.65));
  const cx1 = Math.min(cx0 + cw, ix1 - 2.6);
  const cz1 = Math.min(cz0 + cd, iz1 - 2.6);

  if (out.courts) out.courts.push({ x0: cx0, x1: cx1, z0: cz0, z1: cz1 });

  // walls around the courtyard, each with a doorway
  wallWithDoor(walls, 'x', cx0 - t, cx1 + t, cz0 - t, cz0, y, H, cx0 + (cx1 - cx0) * 0.4, wallCert);
  wallWithDoor(walls, 'x', cx0 - t, cx1 + t, cz1, cz1 + t, y, H, cx0 + (cx1 - cx0) * 0.5, wallCert);
  wallWithDoor(walls, 'z', cz0, cz1, cx0 - t, cx0, y, H, cz0 + (cz1 - cz0) * 0.45, wallCert);
  wallWithDoor(walls, 'z', cz0, cz1, cx1, cx1 + t, y, H, cz0 + (cz1 - cz0) * 0.35, wallCert);

  // partition walls dividing the ring of rooms
  if (detail) {
    walls.box(cx0 - t, y, iz0, cx0, y + H, cz0 - t, wallCert);
    walls.box(cx1, y, cz1 + t, cx1 + t, y + H, iz1, wallCert);
    walls.box(ix0, y, cz1, cx0 - t, y + H, cz1 + t, wallCert);
    walls.box(cx1 + t, y, cz0 - t, ix1, y + H, cz0, wallCert);
  }

  // roofs over the rooms (flat roofs of timber, reeds and mud are a reasonable guess)
  const strips = {
    n: [ix0, iz0, ix1, cz0 - t],
    s: [ix0, cz1 + t, ix1, iz1],
    w: [ix0, cz0 - t, cx0 - t, cz1 + t],
    e: [cx1 + t, cz0 - t, ix1, cz1 + t],
  };

  // upper storey over two neighbouring sides (stairs found in many houses suggest one)
  let upper = [];
  if (rng.chance(0.55)) {
    const pairs = [['n', 'w'], ['n', 'e'], ['s', 'w'], ['s', 'e']];
    upper = rng.pick(pairs);
  }

  for (const [side, [a0, b0, a1, b1]] of Object.entries(strips)) {
    const isUpper = upper.includes(side);
    roofs.box(a0 - 0.15, y + H, b0 - 0.15, a1 + 0.15, y + H + 0.3, b1 + 0.15, isUpper ? upperCert : roofCert);
    if (!isUpper) {
      // somewhere on the roof to dry cloth or grain (imagined)
      if (out.roofSpots && lampRand(lot, 10 + side.charCodeAt(0)) < 0.09 && a1 - a0 > 2 && b1 - b0 > 2) {
        out.roofSpots.push({ x: (a0 + a1) / 2, z: (b0 + b1) / 2, y: y + H + 0.3, w: a1 - a0, d: b1 - b0 });
      }
      continue;
    }
    const yu = y + H + 0.3;
    const hu = 2.9;
    const ut = 0.5;
    // outer shell of the upper rooms
    walls.box(a0, yu, b0, a0 + ut, yu + hu, b1, upperCert);
    walls.box(a1 - ut, yu, b0, a1, yu + hu, b1, upperCert);
    walls.box(a0, yu, b0, a1, yu + hu, b0 + ut, upperCert);
    walls.box(a0, yu, b1 - ut, a1, yu + hu, b1, upperCert);
    roofs.box(a0 - 0.15, yu + hu, b0 - 0.15, a1 + 0.15, yu + hu + 0.3, b1 + 0.15, roofCert);
  }

  // an evening lamp by a courtyard wall (imagined)
  if (out.lamps && lampRand(lot, 1) < 0.8) {
    const east = lampRand(lot, 2) < 0.5;
    out.lamps.push({ x: east ? cx1 - 0.6 : cx0 + 0.6, z: cz0 + 0.8 + lampRand(lot, 3) * Math.max(0, cz1 - cz0 - 1.6), y: y + 1.5 });
  }

  // a well in some courtyards (wells were common in houses)
  if (rng.chance(0.3)) {
    wells.push({
      x: rng.range(cx0 + 1, cx1 - 1),
      z: rng.range(cz0 + 1, cz1 - 1),
      y,
      cert: wallCert,
    });
  }
}

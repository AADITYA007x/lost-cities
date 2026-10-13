import { CERTAINTY } from './batch.js';
import { buildHouse } from './houses.js';
import { subdivide, overlaps, pointInPolygon, fromSitePlan, EXCAVATED_AREAS } from './layout.js';

const E = CERTAINTY.excavated;
const I = CERTAINTY.inferred;
const M = CERTAINTY.imagined;

// Public buildings on the citadel mound. Sizes follow published descriptions.
// The Great Bath is placed where Mackay's site plan (Plate I) marks it; the others are
// placed relative to it, approximately, until the SD plans are traced.
export function planCitadel(rect, { bathTraced = false } = {}) {
  // Great Bath complex, about 55 m north-south by 33 m east-west.
  const [bx, bz] = fromSitePlan(290, 463);
  const hallWest = rect.x0 + 10;
  // when Marshall's plan of the bath is traced, its pool sits exactly on the site plan's bath
  const bcx = bathTraced ? bx : Math.max(bx, hallWest + 46 + 8 + 16.5);
  const bath = { x0: bcx - 16.5, x1: bcx + 16.5, z0: bz - 27.5, z1: bz + 27.5 };
  // Court around the pool, and the pool itself: about 12 m x 7 m, 2.4 m deep.
  const court = { x0: bath.x0 + 4.9, x1: bath.x0 + 23.9, z0: bath.z0 + 13.5, z1: bath.z1 - 13.5 };
  const pcx = bathTraced ? bx : (court.x0 + court.x1) / 2;
  const pcz = bathTraced ? bz : (court.z0 + court.z1) / 2;
  const pool = { x0: pcx - 3.5, x1: pcx + 3.5, z0: pcz - 6, z1: pcz + 6, depth: 2.4 };

  // The "granary" or "Great Hall": a brick podium about 46 x 23 m crossed by narrow passages.
  // When the bath plan is traced, the hall's eastern blocks are on it (scene x about -488 to -474,
  // z -118 to -90); the generated hall continues them westward to the edge of the mound.
  const hall = bathTraced
    ? { x0: rect.x0 + 8, x1: -474, z0: -116, z1: -92 }
    : { x0: hallWest, x1: hallWest + 46, z0: bath.z0 + 22, z1: bath.z0 + 45 };

  // The so-called "College of Priests" across the lane, north-east of the bath.
  const college = { x0: bath.x1 - 6, x1: Math.min(rect.x1 - 6, bath.x1 + 64), z0: bath.z0 - 30, z1: bath.z0 - 6 };

  // Pillared hall in the L area, the southern part of the mound.
  const [px, pz] = fromSitePlan(300, 590);
  const pillared = { x0: px - 13.5, x1: px + 13.5, z0: pz - 13.5, z1: pz + 13.5 };

  return { bath, court, pool, hall, college, pillared, bathTraced };
}

export function buildCitadel(rect, plan, rng, out, { detail, covered = [] }) {
  const { walls, roofs, paving, wells } = out;
  const y = rect.y;
  const { bath, court, pool, hall, college, pillared } = plan;
  const covers = (r) => covered.some((c) => overlaps(r, c, 0));

  // the pool itself is always built: a plan shows its edge, the depth is published (2.4 m)
  const py0 = y + 0.3;
  const floor0 = py0 - pool.depth;
  paving.box(pool.x0, floor0 - 0.2, pool.z0, pool.x1, floor0, pool.z1, E);
  for (let i = 1; i <= 6; i++) {
    const top = py0 - i * 0.38;
    const run = (7 - i) * 0.32;
    paving.box(pool.x0 + 0.6, floor0, pool.z0, pool.x1 - 0.6, top, pool.z0 + run, E);
    paving.box(pool.x0 + 0.6, floor0, pool.z1 - run, pool.x1 - 0.6, top, pool.z1, E);
  }

  if (!plan.bathTraced) buildGeneratedBath();
  // generate the hall only where no traced plan covers it
  const tracedLeft = Math.min(...covered.filter((c) => overlaps(hall, c, 0)).map((c) => c.x0), hall.x1);
  buildHall(tracedLeft);
  if (!covers(college)) buildHouse({ ...college, open: { n: true, s: true, e: true, w: true } }, y, rng, out, { known: true, detail });
  if (!covers(pillared)) buildPillared();
  buildOthers();

  function buildGeneratedBath() {
    // ---------- Great Bath, generated from its published description ----------
    const BT = 1.4;
    const BH = 4.2;
    // outer walls; two doors in the south wall, others north and east
    walls.box(bath.x0, y, bath.z0, bath.x0 + 14, y + BH, bath.z0 + BT, E);
    walls.box(bath.x0 + 15.4, y, bath.z0, bath.x1, y + BH, bath.z0 + BT, E);
    walls.box(bath.x0, y, bath.z1 - BT, bath.x0 + 9, y + BH, bath.z1, E);
    walls.box(bath.x0 + 10.6, y, bath.z1 - BT, bath.x0 + 20, y + BH, bath.z1, E);
    walls.box(bath.x0 + 21.6, y, bath.z1 - BT, bath.x1, y + BH, bath.z1, E);
    walls.box(bath.x0, y, bath.z0 + BT, bath.x0 + BT, y + BH, bath.z1 - BT, E);
    walls.box(bath.x1 - BT, y, bath.z0 + BT, bath.x1, y + BH, bath.z0 + 26, E);
    walls.box(bath.x1 - BT, y, bath.z0 + 27.4, bath.x1, y + BH, bath.z1 - BT, E);

    // brick paving around the pool (the pool itself is cut into the platform)
    const py = py0;
    paving.box(court.x0, y, court.z0, court.x1, py, pool.z0, E);
    paving.box(court.x0, y, pool.z1, court.x1, py, court.z1, E);
    paving.box(court.x0, y, pool.z0, pool.x0, py, pool.z1, E);
    paving.box(pool.x1, y, pool.z0, court.x1, py, pool.z1, E);
    paving.box(bath.x0 + BT, y, bath.z0 + BT, bath.x1 - BT, py - 0.02, court.z0, E);
    paving.box(bath.x0 + BT, y, court.z1, bath.x1 - BT, py - 0.02, bath.z1 - BT, E);
    paving.box(bath.x0 + BT, y, court.z0, court.x0, py - 0.02, court.z1, E);
    paving.box(court.x1, y, court.z0, bath.x1 - BT, py - 0.02, court.z1, E);

    // colonnade of brick piers on the north, south and east sides of the court
    const pier = 1.0;
    const PH = 3.4;
    for (let x = court.x0 + 1; x <= court.x1 - 1.5; x += 2.7) {
      walls.box(x, py, court.z0 - pier, x + pier, py + PH, court.z0, E);
      walls.box(x, py, court.z1, x + pier, py + PH, court.z1 + pier, E);
    }
    for (let z = court.z0 + 1.5; z <= court.z1 - 2; z += 2.7) {
      walls.box(court.x1, py, z, court.x1 + pier, py + PH, z + pier, E);
    }
    walls.box(court.x0 - 0.8, py, court.z0, court.x0, py + 1.2, court.z1, I);

    // rooms along the east side; one held a well
    const roomX0 = court.x1 + 3.2;
    walls.box(roomX0, py, bath.z0 + BT, roomX0 + 0.7, py + BH - 0.3, bath.z1 - BT, E);
    for (let z = bath.z0 + 8; z < bath.z1 - 4; z += 6.5) {
      walls.box(roomX0 + 0.7, py, z, bath.x1 - BT, py + BH - 0.3, z + 0.6, E);
    }
    wells.push({ x: (roomX0 + bath.x1) / 2, z: bath.z0 + 25, y: py, cert: E });

    // roofs over galleries and rooms (imagined: no roof survives)
    const ry = py + PH;
    roofs.box(bath.x0 + 0.5, ry, bath.z0 + 0.5, bath.x1 - 0.5, ry + 0.3, court.z0 - pier, M);
    roofs.box(bath.x0 + 0.5, ry, court.z1 + pier, bath.x1 - 0.5, ry + 0.3, bath.z1 - 0.5, M);
    roofs.box(court.x1 + pier, ry, court.z0 - pier, bath.x1 - 0.5, ry + 0.3, court.z1 + pier, M);
  }

  function buildHall(clipX1) {
    // ---------- Great Hall ("granary"): brick podium with blocks and passages ----------
    if (clipX1 - hall.x0 < 4) return;
    const podiumTop = y + 1.4;
    walls.box(hall.x0, y, hall.z0, clipX1, podiumTop, hall.z1, I);
    const cols = 9;
    const rows = 3;
    const gap = 1.3;
    const bw = (hall.x1 - hall.x0 - gap * (cols + 1)) / cols;
    const bd = (hall.z1 - hall.z0 - gap * (rows + 1)) / rows;
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        const bx = hall.x0 + gap + i * (bw + gap);
        const bz = hall.z0 + gap + j * (bd + gap);
        if (bx + bw > clipX1) continue;
        walls.box(bx, podiumTop, bz, bx + bw, podiumTop + 1.7, bz + bd, I);
      }
    }
    // a timber hall above the blocks is a guess; shown as a light roof on posts
    const hallRoof = podiumTop + 1.7 + 3.2;
    for (let i = 0; i <= cols; i += 3) {
      for (let j = 0; j <= rows; j += 3) {
        const px = hall.x0 + gap / 2 + i * (bw + gap) - 0.2;
        const pz = hall.z0 + gap / 2 + j * (bd + gap) - 0.2;
        roofs.box(px, podiumTop + 1.7, pz, px + 0.4, hallRoof, pz + 0.4, M);
      }
    }
    roofs.box(hall.x0 - 0.5, hallRoof, hall.z0 - 0.5, hall.x1 + 0.5, hallRoof + 0.3, hall.z1 + 0.5, M);
  }

  function buildPillared() {
    // ---------- Pillared hall ----------
    const WT = 1.2;
    const WH = 3.6;
    walls.box(pillared.x0, y, pillared.z0, pillared.x1, y + WH, pillared.z0 + WT, E);
    walls.box(pillared.x0, y, pillared.z1 - WT, pillared.x0 + 11, y + WH, pillared.z1, E);
    walls.box(pillared.x0 + 13, y, pillared.z1 - WT, pillared.x1, y + WH, pillared.z1, E);
    walls.box(pillared.x0, y, pillared.z0 + WT, pillared.x0 + WT, y + WH, pillared.z1 - WT, E);
    walls.box(pillared.x1 - WT, y, pillared.z0 + WT, pillared.x1, y + WH, pillared.z1 - WT, E);
    for (let i = 0; i < 5; i++) {
      for (let j = 0; j < 4; j++) {
        const px = pillared.x0 + 3.6 + i * 4.6;
        const pz = pillared.z0 + 4.2 + j * 5.6;
        walls.box(px, y, pz, px + 1.5, y + WH - 0.4, pz + 1.5, E);
      }
    }
    roofs.box(pillared.x0 - 0.3, y + WH, pillared.z0 - 0.3, pillared.x1 + 0.3, y + WH + 0.35, pillared.z1 + 0.3, M);
  }

  function buildOthers() {
    // ---------- other buildings on the mound (positions imagined) ----------
    const reserved = [bath, hall, college, pillared, ...covered];
    const block = { x0: rect.x0 + 6, x1: rect.x1 - 6, z0: rect.z0 + 6, z1: rect.z1 - 6, open: { n: true, s: true, e: true, w: true } };
    const lots = subdivide(block, rng, { minLot: 12, maxLot: 30, laneChance: 0.7, laneWidth: [3, 5] });
    const inside = (l) =>
      [[l.x0, l.z0], [l.x1, l.z0], [l.x1, l.z1], [l.x0, l.z1]].every(([x, z]) => pointInPolygon(x, z, rect.outline));
    for (const lot of lots) {
      if (!inside(lot)) continue;
      if (reserved.some((r) => overlaps(lot, r, 5))) continue;
      if (rng.chance(0.45)) continue; // open courts and yards
      const cx = (lot.x0 + lot.x1) / 2;
      const cz = (lot.z0 + lot.z1) / 2;
      const known = EXCAVATED_AREAS.some((a) => cx >= a.x0 && cx <= a.x1 && cz >= a.z0 && cz <= a.z1);
      buildHouse(lot, y, rng, out, { known, detail });
    }
  }
}

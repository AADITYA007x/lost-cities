// Converts points traced on a plan image (pixels) into scene metres (x east, z south).
// Shared by the tracing page and the city builder.

export const FEET = 0.3048;

export function makeTransform(calibration) {
  const { mPerPx, north, anchor } = calibration;
  // north: [tail, head] in image pixels; image y points down
  let nx = north[1][0] - north[0][0];
  let ny = north[1][1] - north[0][1];
  const len = Math.hypot(nx, ny) || 1;
  nx /= len;
  ny /= len;
  const ex = -ny;
  const ey = nx;
  const [ax, ay] = anchor.px;
  const [sx, sz] = anchor.scene;

  return function toScene([px, py]) {
    const dx = px - ax;
    const dy = py - ay;
    return [sx + (dx * ex + dy * ey) * mPerPx, sz - (dx * nx + dy * ny) * mPerPx];
  };
}

export function isCalibrated(c) {
  return Boolean(c && c.mPerPx > 0 && c.north && c.anchor && c.anchor.px && c.anchor.scene);
}

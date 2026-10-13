import { PLATFORMS } from './city/layout.js';

// A small north-up map that follows the walker. Drawn from the collision grid
// (walls) on top of the platform outlines, 1 px per metre, then cropped around you.

export function createMinimap(canvasEl) {
  const ctx = canvasEl.getContext('2d');
  let base = null;
  let meta = null;
  const VIEW = 110; // metres shown across

  function build(collision) {
    const { bounds, cell, width, height, bits } = collision;
    const scale = 2; // px per metre in the base image
    const W = Math.ceil((bounds.x1 - bounds.x0) * scale);
    const H = Math.ceil((bounds.z1 - bounds.z0) * scale);
    const off = document.createElement('canvas');
    off.width = W;
    off.height = H;
    const c = off.getContext('2d');
    c.fillStyle = '#2a211a';
    c.fillRect(0, 0, W, H);
    // platforms
    c.fillStyle = '#5c4532';
    for (const p of Object.values(PLATFORMS)) {
      c.beginPath();
      p.outline.forEach(([x, z], i) => {
        const px = (x - bounds.x0) * scale;
        const pz = (z - bounds.z0) * scale;
        if (i) c.lineTo(px, pz);
        else c.moveTo(px, pz);
      });
      c.closePath();
      c.fill();
    }
    // walls from the collision grid
    const img = c.getImageData(0, 0, W, H);
    const step = 1 / (cell * scale); // grid cells per base pixel
    for (let y = 0; y < H; y++) {
      const gz = Math.floor(y * step);
      for (let x = 0; x < W; x++) {
        const gx = Math.floor(x * step);
        // a base pixel is wall if any of its grid cells is
        let hit = 0;
        for (let a = 0; a < Math.ceil(step) && !hit; a++) {
          for (let b = 0; b < Math.ceil(step) && !hit; b++) {
            const i = (gz + a) * width + (gx + b);
            if (gz + a < height && gx + b < width && (bits[i >> 5] >>> (i & 31)) & 1) hit = 1;
          }
        }
        if (hit) {
          const k = (y * W + x) * 4;
          img.data[k] = 226;
          img.data[k + 1] = 196;
          img.data[k + 2] = 150;
        }
      }
    }
    c.putImageData(img, 0, 0);
    base = off;
    meta = { bounds, scale };
  }

  function draw(x, z, yaw) {
    if (!base) return;
    const s = canvasEl.width;
    const { bounds, scale } = meta;
    const span = VIEW * scale;
    const sx = (x - bounds.x0) * scale - span / 2;
    const sz = (z - bounds.z0) * scale - span / 2;
    ctx.clearRect(0, 0, s, s);
    ctx.save();
    ctx.beginPath();
    ctx.arc(s / 2, s / 2, s / 2 - 1, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(base, sx, sz, span, span, 0, 0, s, s);
    ctx.restore();
    // the walker: a small arrow pointing where you look (north is up)
    ctx.save();
    ctx.translate(s / 2, s / 2);
    ctx.rotate(-yaw);
    ctx.fillStyle = '#e8c27a';
    ctx.beginPath();
    ctx.moveTo(0, -9);
    ctx.lineTo(6, 6);
    ctx.lineTo(0, 3);
    ctx.lineTo(-6, 6);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    // north mark
    ctx.fillStyle = 'rgba(239, 230, 216, 0.8)';
    ctx.font = `${Math.round(s * 0.09)}px Cormorant Garamond, Georgia, serif`;
    ctx.textAlign = 'center';
    ctx.fillText('N', s / 2, s * 0.12);
  }

  return { build, draw };
}

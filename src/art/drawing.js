import { CANVAS_SIZE, STAMP_SCALE, STAMP_SVG } from './stamps.js';

// Visible ink plus stamp bounds, in normalized canvas coordinates. This keeps
// a tiny doodle at the same readable scale as a generated resident.
export function drawingBounds(data, width, height, stamps = [], ink = {}) {
  let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;
  const include = (x0, y0, x1, y1) => {
    left = Math.min(left, x0); top = Math.min(top, y0);
    right = Math.max(right, x1); bottom = Math.max(bottom, y1);
  };
  if (data && width > 0 && height > 0) {
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] > 8) include(x / width, y / height, (x + 1) / width, (y + 1) / height);
    }
  }
  for (const stamp of stamps) {
    if (!stamp || ![stamp.x, stamp.y, stamp.size].every(Number.isFinite) || stamp.size <= 0) continue;
    const radians = (Number.isFinite(stamp.rotation) ? stamp.rotation : 0) * Math.PI / 180;
    const box = ink[stamp.kind] || { x: -30, y: -30, width: 60, height: 60 };
    const factor = stamp.size * STAMP_SCALE / CANVAS_SIZE / 60;
    for (const x of [box.x, box.x + box.width]) for (const y of [box.y, box.y + box.height]) {
      const px = stamp.x / CANVAS_SIZE + (x * Math.cos(radians) - y * Math.sin(radians)) * factor;
      const py = stamp.y / CANVAS_SIZE + (x * Math.sin(radians) + y * Math.cos(radians)) * factor;
      include(px, py, px, py);
    }
  }
  if (!Number.isFinite(left)) return null;
  return { x: left, y: top, width: Math.max(1 / CANVAS_SIZE, right - left), height: Math.max(1 / CANVAS_SIZE, bottom - top) };
}

export function drawingFrame(bounds) {
  if (!bounds || !['x', 'y', 'width', 'height'].every(k => Number.isFinite(bounds[k])) || bounds.width <= 0 || bounds.height <= 0) return null;
  const scale = Math.min(4, .82 / bounds.width, .88 / bounds.height);
  return { scale, left: .5 - (bounds.x + bounds.width / 2) * scale, top: .97 - (bounds.y + bounds.height) * scale };
}

const stampInk = Object.create(null);
// SVG viewboxes have large transparent margins. Measure the actual paths once
// per stamp kind so a body stamp sits on the plank just like freehand ink.
export function measureStampInk(stamps) {
  for (const stamp of stamps) {
    if (!stamp || stampInk[stamp.kind] || !Object.hasOwn(STAMP_SVG, stamp.kind)) continue;
    const host = document.createElement('div');
    host.style.cssText = 'position:fixed;left:-10000px;top:0;visibility:hidden;width:60px;height:60px;pointer-events:none';
    host.innerHTML = STAMP_SVG[stamp.kind];
    document.body.appendChild(host);
    try {
      const b = host.firstElementChild.getBBox();
      stampInk[stamp.kind] = { x: b.x - 1, y: b.y - 1, width: b.width + 2, height: b.height + 2 };
    } finally { host.remove(); }
  }
  return stampInk;
}

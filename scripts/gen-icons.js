// Generates branded PNG assets (icon, adaptive icon, splash logo) with no
// external dependencies — pure Node (zlib for PNG deflate). Re-run with:
//   node scripts/gen-icons.js
// Output: assets/icon.png, assets/adaptive-icon.png, assets/splash-icon.png
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// ---------- PNG encoder ----------
function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const t = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
  return Buffer.concat([len, t, data, crc]);
}
function encodePNG(w, h, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const stride = w * 4;
  const raw = Buffer.alloc((stride + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (stride + 1)] = 0; // filter: none
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

// ---------- canvas (straight alpha, drawn at hi-res then box-downsampled) ----------
function newCanvas(w, h) {
  return { w, h, d: new Float32Array(w * h * 4) };
}
function px(c, x, y, col) {
  x |= 0;
  y |= 0;
  if (x < 0 || y < 0 || x >= c.w || y >= c.h) return;
  const i = (y * c.w + x) * 4;
  const sa = col[3] / 255;
  const da = c.d[i + 3] / 255;
  const oa = sa + da * (1 - sa);
  if (oa <= 0) {
    c.d[i] = c.d[i + 1] = c.d[i + 2] = c.d[i + 3] = 0;
    return;
  }
  c.d[i] = (col[0] * sa + c.d[i] * da * (1 - sa)) / oa;
  c.d[i + 1] = (col[1] * sa + c.d[i + 1] * da * (1 - sa)) / oa;
  c.d[i + 2] = (col[2] * sa + c.d[i + 2] * da * (1 - sa)) / oa;
  c.d[i + 3] = oa * 255;
}
function fillRoundRect(c, x0, y0, x1, y1, r, col) {
  for (let y = Math.floor(y0); y <= Math.ceil(y1); y++) {
    for (let x = Math.floor(x0); x <= Math.ceil(x1); x++) {
      if (x < x0 || x > x1 || y < y0 || y > y1) continue;
      let inside = true;
      const cxL = x0 + r, cxR = x1 - r, cyT = y0 + r, cyB = y1 - r;
      if (x < cxL && y < cyT) inside = (x - cxL) ** 2 + (y - cyT) ** 2 <= r * r;
      else if (x > cxR && y < cyT) inside = (x - cxR) ** 2 + (y - cyT) ** 2 <= r * r;
      else if (x < cxL && y > cyB) inside = (x - cxL) ** 2 + (y - cyB) ** 2 <= r * r;
      else if (x > cxR && y > cyB) inside = (x - cxR) ** 2 + (y - cyB) ** 2 <= r * r;
      if (inside) px(c, x, y, col);
    }
  }
}
function fillCircle(c, cx, cy, r, col) {
  for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++)
    for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++)
      if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) px(c, x, y, col);
}
function thickLine(c, ax, ay, bx, by, w, col) {
  const minx = Math.min(ax, bx) - w, maxx = Math.max(ax, bx) + w;
  const miny = Math.min(ay, by) - w, maxy = Math.max(ay, by) + w;
  const dx = bx - ax, dy = by - ay, len2 = dx * dx + dy * dy || 1;
  for (let y = Math.floor(miny); y <= Math.ceil(maxy); y++)
    for (let x = Math.floor(minx); x <= Math.ceil(maxx); x++) {
      let t = ((x - ax) * dx + (y - ay) * dy) / len2;
      t = Math.max(0, Math.min(1, t));
      const px2 = ax + t * dx, py2 = ay + t * dy;
      if ((x - px2) ** 2 + (y - py2) ** 2 <= (w / 2) ** 2) px(c, x, y, col);
    }
}

const WHITE = [255, 255, 255, 255];
const BLUE = [37, 99, 235, 255];
const GRAY = [203, 213, 225, 255];
const GREEN = [22, 163, 74, 255];

function drawLogo(c, cx, cy, L) {
  const receiptW = 0.6 * L, receiptH = 0.8 * L;
  const rx0 = cx - receiptW / 2, rx1 = cx + receiptW / 2;
  const ry0 = cy - receiptH / 2;
  const toothH = 0.045 * L;
  const ry1base = cy + receiptH / 2 - toothH;
  const r = 0.12 * receiptW;
  const pad = 0.14 * receiptW;
  const nteeth = 7;
  const tw = (rx1 - rx0) / nteeth;

  // receipt body (white) with rounded top + zigzag bottom
  for (let y = Math.floor(ry0); y <= Math.ceil(ry1base + toothH); y++) {
    for (let x = Math.floor(rx0); x <= Math.ceil(rx1); x++) {
      if (x < rx0 || x > rx1) continue;
      const frac = ((x - rx0) % tw) / tw;
      const tooth = toothH * (1 - Math.abs(2 * frac - 1));
      if (y > ry1base + tooth) continue;
      let inside = true;
      if (y < ry0) inside = false;
      else if (x < rx0 + r && y < ry0 + r) inside = (x - (rx0 + r)) ** 2 + (y - (ry0 + r)) ** 2 <= r * r;
      else if (x > rx1 - r && y < ry0 + r) inside = (x - (rx1 - r)) ** 2 + (y - (ry0 + r)) ** 2 <= r * r;
      if (inside) px(c, x, y, WHITE);
    }
  }

  // header bar (blue)
  const hbx0 = rx0 + pad, hbx1 = rx1 - pad;
  const hby0 = ry0 + 0.13 * receiptH, hby1 = hby0 + 0.10 * receiptH;
  fillRoundRect(c, hbx0, hby0, hbx1, hby1, (hby1 - hby0) / 2, BLUE);

  // text lines (gray)
  const lw = hbx1 - hbx0;
  const rows = [
    [0.36, 1.0],
    [0.50, 1.0],
    [0.64, 0.62],
    [0.76, 0.84],
  ];
  for (const [fy, fw] of rows) {
    const ly0 = ry0 + fy * receiptH;
    const ly1 = ly0 + 0.05 * receiptH;
    fillRoundRect(c, hbx0, ly0, hbx0 + fw * lw, ly1, 0.025 * receiptH, GRAY);
  }

  // "paid" check badge (green circle + white tick), bottom-right
  const ccx = rx1 - 0.02 * L, ccy = ry1base - 0.0 * L, rc = 0.16 * L;
  fillCircle(c, ccx, ccy, rc, GREEN);
  const sw = 0.085 * L;
  thickLine(c, ccx - 0.45 * rc, ccy + 0.02 * rc, ccx - 0.1 * rc, ccy + 0.34 * rc, sw, WHITE);
  thickLine(c, ccx - 0.1 * rc, ccy + 0.34 * rc, ccx + 0.5 * rc, ccy - 0.34 * rc, sw, WHITE);
}

function render(size, blueBg, logoFrac) {
  const S = 3;
  const W = size * S;
  const c = newCanvas(W, W);
  if (blueBg) {
    for (let i = 0; i < W * W; i++) {
      c.d[i * 4] = 37;
      c.d[i * 4 + 1] = 99;
      c.d[i * 4 + 2] = 235;
      c.d[i * 4 + 3] = 255;
    }
  }
  drawLogo(c, W / 2, W / 2, logoFrac * W);
  const out = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let j = 0; j < S; j++)
        for (let i = 0; i < S; i++) {
          const k = ((y * S + j) * W + (x * S + i)) * 4;
          const aa = c.d[k + 3];
          r += c.d[k] * aa;
          g += c.d[k + 1] * aa;
          b += c.d[k + 2] * aa;
          a += aa;
        }
      const oi = (y * size + x) * 4;
      if (a > 0) {
        out[oi] = Math.round(r / a);
        out[oi + 1] = Math.round(g / a);
        out[oi + 2] = Math.round(b / a);
      }
      out[oi + 3] = Math.round(a / (S * S));
    }
  return encodePNG(size, size, out);
}

const dir = path.join(__dirname, '..', 'assets');
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, 'icon.png'), render(1024, true, 0.74));
fs.writeFileSync(path.join(dir, 'adaptive-icon.png'), render(1024, false, 0.6));
fs.writeFileSync(path.join(dir, 'splash-icon.png'), render(512, false, 0.78));
console.log('Wrote assets/icon.png, assets/adaptive-icon.png, assets/splash-icon.png');

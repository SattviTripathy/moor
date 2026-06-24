// Generates Moor PWA icons (violet tide-vessel) with no external deps.
// Pixels computed directly; PNG encoded via Node's built-in zlib.
const zlib = require("zlib");
const fs = require("fs");
const path = require("path");

const OUT = path.join(__dirname, "icons");

function hexToRgb(h) {
  return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
}
const C0 = hexToRgb("#A78BFA"); // gradient start
const C1 = hexToRgb("#6D28D9"); // gradient end
const WATER = [250, 249, 254];
const WHITE = [255, 255, 255];
const lerp = (a, b, t) => a + (b - a) * t;
const mix = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

// colour at a continuous point, in a `size`-space coordinate
function sample(fx, fy, size) {
  const k = size / 512;
  const t = (fx + fy) / (2 * size);
  let col = mix(C0, C1, Math.max(0, Math.min(1, t)));
  const cx = size / 2, cy = size / 2, r = 150 * k, rw = 14 * k;
  const dx = fx - cx, dy = fy - cy;
  const d = Math.sqrt(dx * dx + dy * dy);
  if (d <= r) {
    // wavy water surface (2 humps), fills below the surface line
    const left = cx - r - 12 * k, width = (r + 12 * k) * 2;
    const phase = ((fx - left) / width) * (2 * Math.PI * 2); // 2 humps
    const surface = 286 * k - 15 * k * Math.sin(phase);
    if (fy >= surface) col = mix(col, WATER, 0.93);
  }
  if (Math.abs(d - r) <= rw / 2) col = WHITE; // vessel ring on top
  return col;
}

function render(size, ss) {
  const buf = Buffer.alloc(size * size * 4);
  const inv = 1 / (ss * ss);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0;
      for (let sy = 0; sy < ss; sy++) {
        for (let sx = 0; sx < ss; sx++) {
          const fx = x + (sx + 0.5) / ss;
          const fy = y + (sy + 0.5) / ss;
          const c = sample(fx, fy, size);
          r += c[0]; g += c[1]; b += c[2];
        }
      }
      const o = (y * size + x) * 4;
      buf[o] = Math.round(r * inv);
      buf[o + 1] = Math.round(g * inv);
      buf[o + 2] = Math.round(b * inv);
      buf[o + 3] = 255;
    }
  }
  return buf;
}

// minimal PNG encoder (RGBA, filter 0)
function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let j = 0; j < 8; j++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const t = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
  return Buffer.concat([len, t, data, crc]);
}
function encodePng(size, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0; // filter: none
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk("IHDR", ihdr), chunk("IDAT", idat), chunk("IEND", Buffer.alloc(0))]);
}

const jobs = [
  ["icon-192.png", 192],
  ["icon-512.png", 512],
  ["icon-maskable-512.png", 512],
  ["apple-touch-icon.png", 180],
];
for (const [name, size] of jobs) {
  const png = encodePng(size, render(size, 4));
  fs.writeFileSync(path.join(OUT, name), png);
  console.log(name, size + "px", png.length + " bytes");
}

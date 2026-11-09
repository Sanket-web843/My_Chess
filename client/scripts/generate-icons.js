/**
 * generate-icons.js
 *
 * Creates placeholder PWA icons (icon-192.png and icon-512.png) using only
 * Node.js built-ins — no canvas, no sharp, no external deps.
 *
 * Each icon is a solid #0d0d1a square with a centred white chess-pawn "♟"
 * drawn as 1-bit run-length text pixels using a 7×5 bitmap font embedded
 * inline. The result is a valid, Workbox-satisfying PNG file.
 *
 * Run: node scripts/generate-icons.js
 */

import { createWriteStream } from 'fs';
import { createDeflate }     from 'zlib';
import { resolve, dirname }  from 'path';
import { fileURLToPath }     from 'url';
import { mkdirSync }         from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR   = resolve(__dirname, '../public/icons');
mkdirSync(OUT_DIR, { recursive: true });

// ── CRC-32 table ────────────────────────────────────────────────────────────
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[i] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function u32be(n) {
  const b = Buffer.alloc(4);
  b.writeUInt32BE(n, 0);
  return b;
}

function chunk(type, data) {
  const typeBytes = Buffer.from(type, 'ascii');
  const payload   = Buffer.concat([typeBytes, data]);
  const crc       = u32be(crc32(payload));
  return Buffer.concat([u32be(data.length), payload, crc]);
}

// ── Simple 5×7 bitmap font for a chess pawn symbol ──────────────────────────
// Each character row is a bitmask for 5 columns (bit 4 = leftmost).
const PAWN_BITMAP = [
  0b01110,  // row 0  ─ head top
  0b11111,  // row 1  ─ head wide
  0b01110,  // row 2  ─ neck
  0b01110,  // row 3
  0b11111,  // row 4  ─ body
  0b01110,  // row 5  ─ stem
  0b11111,  // row 6  ─ base
];
const GLYPH_W = 5, GLYPH_H = 7;

// ── PNG generator ────────────────────────────────────────────────────────────
function buildPNG(size) {
  return new Promise((resolve, reject) => {
    // Background colour (#0d0d1a) and foreground (#ffffff)
    const BG = [0x0d, 0x0d, 0x1a];
    const FG = [0xff, 0xff, 0xff];

    // Scale the glyph so it occupies ~40% of the icon height
    const scale  = Math.max(1, Math.floor(size * 0.08));
    const pw     = GLYPH_W * scale;
    const ph     = GLYPH_H * scale;
    const offX   = Math.floor((size - pw) / 2);
    const offY   = Math.floor((size - ph) / 2);

    // Build raw RGBA rows (filter byte 0 = None prepended per PNG spec)
    const rows = [];
    for (let y = 0; y < size; y++) {
      const row = Buffer.alloc(1 + size * 3);
      row[0] = 0; // filter: None
      for (let x = 0; x < size; x++) {
        const gx = x - offX;
        const gy = y - offY;
        let lit = false;
        if (gx >= 0 && gx < pw && gy >= 0 && gy < ph) {
          const col = Math.floor(gx / scale);
          const row2 = Math.floor(gy / scale);
          lit = !!(PAWN_BITMAP[row2] & (1 << (GLYPH_W - 1 - col)));
        }
        const pixel = lit ? FG : BG;
        row[1 + x * 3]     = pixel[0];
        row[1 + x * 3 + 1] = pixel[1];
        row[1 + x * 3 + 2] = pixel[2];
      }
      rows.push(row);
    }

    const rawData = Buffer.concat(rows);

    // Compress with zlib
    const deflate = createDeflate({ level: 6 });
    const compressed = [];
    deflate.on('data', d => compressed.push(d));
    deflate.on('end', () => {
      const idat   = Buffer.concat(compressed);
      const ihdr   = Buffer.alloc(13);
      ihdr.writeUInt32BE(size, 0);
      ihdr.writeUInt32BE(size, 4);
      ihdr[8]  = 8;  // bit depth
      ihdr[9]  = 2;  // colour type: RGB
      ihdr[10] = 0;  // compression
      ihdr[11] = 0;  // filter
      ihdr[12] = 0;  // interlace

      const png = Buffer.concat([
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        chunk('IHDR', ihdr),
        chunk('IDAT', idat),
        chunk('IEND', Buffer.alloc(0)),
      ]);
      resolve(png);
    });
    deflate.on('error', reject);
    deflate.write(rawData);
    deflate.end();
  });
}

// ── Write both icons ─────────────────────────────────────────────────────────
for (const size of [192, 512]) {
  const buf  = await buildPNG(size);
  const file = resolve(OUT_DIR, `icon-${size}.png`);
  createWriteStream(file).end(buf, () =>
    console.log(`✅  Written ${file}  (${buf.length} bytes)`)
  );
}

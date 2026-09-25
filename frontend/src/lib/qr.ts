// Minimal dependency-free QR encoder: byte mode, EC level L, versions 1–10
// (up to 271 chars — plenty for invite URLs). Exposed as a boolean module
// matrix which callers render as SVG. Follows ISO/IEC 18004.

// [total data codewords, EC codewords per block, num blocks] for versions 1–10, level L.
const BLOCKS_L: Array<[number, number, number]> = [
  [19, 7, 1], [34, 10, 1], [55, 15, 1], [80, 20, 1], [108, 26, 1],
  [136, 18, 2], [156, 20, 2], [194, 24, 2], [232, 30, 2], [274, 18, 4],
];

// Alignment-pattern centre coordinates per ISO/IEC 18004 Table E.1.
function alignCenters(version: number): number[] {
  if (version === 1) return [];
  const intervals = version < 7 ? 2 : version < 14 ? 4 : version < 21 ? 5 : 6;
  const last = version * 4 + 10;
  const step = Math.ceil((last - 6) / (intervals * 2 - 2)) * 2;
  const out: number[] = [];
  for (let p = last; p >= 6; p -= step) out.unshift(p);
  return out;
}

function mulGF(a: number, b: number): number {
  let r = 0;
  while (b) {
    if (b & 1) r ^= a;
    a = a & 0x80 ? ((a << 1) ^ 0x11d) & 0xff : (a << 1) & 0xff;
    b >>= 1;
  }
  return r;
}

const GF_EXP = new Uint8Array(512);
const GF_LOG = new Uint8Array(256);
(() => {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    GF_EXP[i] = x;
    GF_LOG[x] = i;
    x = mulGF(x, 2);
  }
  for (let i = 255; i < 512; i++) GF_EXP[i] = GF_EXP[i - 255];
})();

function rsGenerator(degree: number): number[] {
  let poly = [1];
  for (let i = 0; i < degree; i++) {
    const next = new Array(poly.length + 1).fill(0);
    for (let j = 0; j < poly.length; j++) {
      next[j] ^= poly[j];
      next[j + 1] ^= mulGF(poly[j], GF_EXP[i]);
    }
    poly = next;
  }
  return poly;
}

function rsEncode(data: number[], ecLen: number): number[] {
  const gen = rsGenerator(ecLen);
  const rem = new Array(ecLen).fill(0);
  for (const d of data) {
    const factor = d ^ rem[0];
    rem.shift()!;
    rem.push(0);
    for (let i = 0; i < ecLen; i++) rem[i] ^= mulGF(gen[i + 1], factor);
  }
  return rem;
}

function pickVersion(byteLen: number): number {
  // Smallest version whose data-codeword bit-space holds the header + payload.
  for (let v = 1; v <= 10; v++) {
    const ccBits = v >= 10 ? 16 : 8;
    const needed = 4 + ccBits + byteLen * 8;
    if (needed <= BLOCKS_L[v - 1][0] * 8) return v;
  }
  throw new Error("QR content too long for versions 1-10");
}

function toBits(bytes: number[]): number[] {
  const bits: number[] = [];
  for (const b of bytes) for (let i = 7; i >= 0; i--) bits.push((b >> i) & 1);
  return bits;
}

function encodeData(value: string, version: number): number[] {
  const [totalData] = BLOCKS_L[version - 1];
  const payload = Array.from(new TextEncoder().encode(value));
  const ccBits = version >= 10 ? 16 : 8;
  const bits: number[] = [0, 1, 0, 0]; // byte mode
  const ccBytes = ccBits === 16 ? [(payload.length >> 8) & 0xff, payload.length & 0xff] : [payload.length];
  bits.push(...toBits(ccBytes).slice(0, ccBits));
  bits.push(...toBits(payload));
  const term = Math.min(4, totalData * 8 - bits.length);
  for (let i = 0; i < term; i++) bits.push(0);
  while (bits.length % 8) bits.push(0);
  const codewords: number[] = [];
  for (let i = 0; i < bits.length; i += 8) {
    let byte = 0;
    for (let k = 0; k < 8; k++) byte = (byte << 1) | (bits[i + k] ?? 0);
    codewords.push(byte);
  }
  const pad = [0xec, 0x11];
  let padIdx = 0;
  while (codewords.length < totalData) codewords.push(pad[padIdx++ % 2]);
  return codewords;
}

function interleave(codewords: number[], version: number): number[] {
  const [, ecLen, blocks] = BLOCKS_L[version - 1];
  const total = BLOCKS_L[version - 1][0];
  const shortLen = Math.floor(total / blocks);
  const numLong = total % blocks;
  const dataBlocks: number[][] = [];
  let off = 0;
  for (let b = 0; b < blocks; b++) {
    const len = shortLen + (b >= blocks - numLong ? 1 : 0);
    dataBlocks.push(codewords.slice(off, off + len));
    off += len;
  }
  const ecBlocks = dataBlocks.map((blk) => rsEncode(blk, ecLen));
  const out: number[] = [];
  for (let i = 0; i < shortLen + 1; i++)
    for (const blk of dataBlocks) if (i < blk.length) out.push(blk[i]);
  for (let i = 0; i < ecLen; i++)
    for (const blk of ecBlocks) out.push(blk[i]);
  // Structured-append tail can add up to 7 remainder bits; bit placement clamps.
  return out;
}

function buildBase(version: number): { modules: Uint8Array[]; reserved: Uint8Array[] } {
  const size = 17 + version * 4;
  const modules = Array.from({ length: size }, () => new Uint8Array(size));
  const reserved = Array.from({ length: size }, () => new Uint8Array(size));
  const setFn = (r: number, c: number, v: number) => {
    if (r < 0 || c < 0 || r >= size || c >= size) return;
    modules[r][c] = v;
    reserved[r][c] = 1;
  };
  const finder = (r0: number, c0: number) => {
    for (let r = -1; r <= 7; r++)
      for (let c = -1; c <= 7; c++) {
        const v = r === -1 || r === 7 || c === -1 || c === 7 ? 0
          : r === 0 || r === 6 || c === 0 || c === 6 || (r >= 2 && r <= 4 && c >= 2 && c <= 4) ? 1 : 0;
        setFn(r0 + r, c0 + c, v);
      }
  };
  finder(0, 0); finder(0, size - 7); finder(size - 7, 0);
  for (let i = 8; i < size - 8; i++) {
    setFn(6, i, i % 2 === 0 ? 1 : 0);
    setFn(i, 6, i % 2 === 0 ? 1 : 0);
  }
  for (const cr of alignCenters(version))
    for (const cc of alignCenters(version)) {
      if ((cr === 6 && cc === 6) || (cr === 6 && cc === size - 7) || (cr === size - 7 && cc === 6)) continue;
      for (let r = -2; r <= 2; r++)
        for (let c = -2; c <= 2; c++)
          setFn(cr + r, cc + c, Math.max(Math.abs(r), Math.abs(c)) !== 1 ? 1 : 0);
    }
  setFn(size - 8, 8, 1); // dark module
  // Reserve format areas (values written after masking).
  for (let i = 0; i <= 8; i++) { if (i !== 6) { reserved[8][i] = 1; reserved[i][8] = 1; } }
  for (let i = 0; i < 8; i++) { reserved[8][size - 1 - i] = 1; reserved[size - 1 - i][8] = 1; }
  if (version >= 7) // version info areas for v7+
    for (let i = 0; i < 18; i++) {
      const r = Math.floor(i / 3), c = size - 11 + (i % 3);
      reserved[r][c] = 1; reserved[c][r] = 1;
    }
  return { modules, reserved };
}

function placeData(modules: Uint8Array[], reserved: Uint8Array[], bits: number[]) {
  const size = modules.length;
  let idx = 0;
  for (let col = size - 1; col > 0; col -= 2) {
    if (col === 6) col--;
    for (let step = 0; step < size; step++) {
      for (let j = 0; j < 2; j++) {
        const c = col - j;
        // Pair number (size-1)>>1 .. 0 from the right; even pairs scan upward.
        const upward = (((col + 1) >> 1) & 1) === 0;
        const r = upward ? size - 1 - step : step;
        if (reserved[r][c]) continue;
        modules[r][c] = idx < bits.length ? bits[idx++] : 0;
      }
    }
  }
}

const MASK_FNS = [
  (r: number, c: number) => (r + c) % 2 === 0,
  (r: number) => r % 2 === 0,
  (_r: number, c: number) => c % 3 === 0,
  (r: number, c: number) => (r + c) % 3 === 0,
  (r: number, c: number) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
  (r: number, c: number) => ((r * c) % 2) + ((r * c) % 3) === 0,
  (r: number, c: number) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0,
  (r: number, c: number) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0,
];

function applyMask(modules: Uint8Array[], reserved: Uint8Array[], mask: number) {
  const size = modules.length;
  for (let r = 0; r < size; r++)
    for (let c = 0; c < size; c++)
      if (!reserved[r][c] && MASK_FNS[mask](r, c)) modules[r][c] ^= 1;
}

function penalty(m: Uint8Array[]): number {
  const size = m.length;
  let score = 0;
  const runPenalty = (line: Uint8Array) => {
    let run = 1;
    for (let i = 1; i < size; i++) {
      if (line[i] === line[i - 1]) run++;
      else { if (run >= 5) score += 3 + (run - 5); run = 1; }
    }
    if (run >= 5) score += 3 + (run - 5);
  };
  for (let i = 0; i < size; i++) {
    const row = m[i];
    const col = Uint8Array.from({ length: size }, (_, r) => m[r][i]);
    runPenalty(row); runPenalty(col);
  }
  for (let r = 0; r < size - 1; r++)
    for (let c = 0; c < size - 1; c++)
      if (m[r][c] === m[r][c + 1] && m[r][c] === m[r + 1][c] && m[r][c] === m[r + 1][c + 1]) score += 3;
  // 1:1:3:1:1 finder-like pattern with 4 light modules on either side
  const lineScore = (get: (i: number) => number, len: number) => {
    for (let i = 0; i + 11 <= len; i++) {
      let ok = true;
      const seq = [1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0];
      for (let k = 0; k < 11; k++) if (get(i + k) !== seq[k]) { ok = false; break; }
      if (ok) score += 40;
    }
    // also check reversed
    for (let i = 0; i + 11 <= len; i++) {
      let ok = true;
      const seq = [0, 0, 0, 0, 1, 0, 1, 1, 1, 0, 1];
      for (let k = 0; k < 11; k++) if (get(i + k) !== seq[k]) { ok = false; break; }
      if (ok) score += 40;
    }
  };
  for (let i = 0; i < size; i++) {
    lineScore((k) => m[i][k], size);
    lineScore((k) => m[k][i], size);
  }
  let dark = 0;
  for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) dark += m[r][c];
  const pct = (dark * 100) / (size * size);
  score += Math.floor(Math.abs(pct - 50) / 5) * 10;
  return score;
}

function bchRemainder(value: number, gen: number, genDegree: number): number {
  // Reduce (value << genDegree) by the generator polynomial (degree genDegree).
  let rem = value << genDegree;
  for (let i = 31 - Math.clz32(rem); i >= genDegree; i--) {
    if (rem & (1 << i)) rem ^= gen << (i - genDegree);
  }
  return rem & ((1 << genDegree) - 1);
}

function writeFormat(m: Uint8Array[], mask: number) {
  const size = m.length;
  const data = (0b01 << 3) | mask; // EC level L = 01
  const bits = ((data << 10) | bchRemainder(data, 0x537, 10)) ^ 0x5412;
  const mod = (i: number) => (bits >> i) & 1;
  for (let i = 0; i < 15; i++) {
    // vertical (column 8)
    if (i < 6) m[i][8] = mod(i);
    else if (i < 8) m[i + 1][8] = mod(i);
    else m[size - 15 + i][8] = mod(i);
    // horizontal (row 8)
    if (i < 8) m[8][size - i - 1] = mod(i);
    else if (i < 9) m[8][15 - i - 1 + 1] = mod(i);
    else m[8][15 - i - 1] = mod(i);
  }
  m[size - 8][8] = 1; // fixed dark module
}

function writeVersion(m: Uint8Array[], version: number) {
  if (version < 7) return;
  const size = m.length;
  const bits = (version << 12) | bchRemainder(version, 0x1f25, 12);
  for (let i = 0; i < 18; i++) {
    const b = (bits >> i) & 1;
    const r = Math.floor(i / 3), c = size - 11 + (i % 3);
    m[r][c] = b;
    m[c][r] = b;
  }
}

export function generateQr(value: string): Uint8Array[] {
  const bytes = new TextEncoder().encode(value);
  const version = pickVersion(bytes.length);
  const data = encodeData(value, version);
  const finalCw = interleave(data, version);
  const bits = finalCw.flatMap((b) => toBits([b]));
  const { modules, reserved } = buildBase(version);
  placeData(modules, reserved, bits);
  let best = { mask: 0, score: Infinity, snapshot: modules.map((r) => Uint8Array.from(r)) };
  for (let mask = 0; mask < 8; mask++) {
    applyMask(modules, reserved, mask);
    writeFormat(modules, mask);
    writeVersion(modules, version);
    const s = penalty(modules);
    if (s < best.score) best = { mask, score: s, snapshot: modules.map((r) => Uint8Array.from(r)) };
    applyMask(modules, reserved, mask); // un-apply (XOR is involutive); format rewritten next iter
  }
  return best.snapshot;
}

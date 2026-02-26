/**
 * @file
 * LAS/LAZ point cloud file parser.
 *
 * Parses LAS format point cloud files and extracts position
 * and color data for 3D visualization.
 *
 * MIT License
 *
 * Copyright (c) 2025 Banu Andrei & Mircea Levin-Constantin
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */
// Minimal LAS (uncompressed) parser supporting LAS 1.0 - 1.4 common point formats 0-3.
// Extracts XYZ using scale/offset, 16-bit intensity, and optional 16-bit RGB.

export type LasParseResult = {
  positions: Float32Array;
  colors?: Float32Array; // normalized 0..1 RGB if available or intensity-mapped
  intensities?: Float32Array; // raw 0..65535
  count: number;
};

function readString(view: DataView, offset: number, length: number) {
  let s = "";
  for (let i = 0; i < length; i++) {
    const c = view.getUint8(offset + i);
    if (c === 0) break;
    s += String.fromCharCode(c);
  }
  return s;
}

export function parseLAS(
  buffer: ArrayBuffer,
  options?: { maxPoints?: number },
): LasParseResult {
  const view = new DataView(buffer);
  // quick compression/html checks
  const b0 = view.getUint8(0);
  const b1 = view.getUint8(1);
  if (b0 === 0x1f && b1 === 0x8b) {
    throw new Error("Compressed (gzip/LAZ) content not supported in-browser");
  }
  if (b0 === 0x3c /* '<' */) {
    throw new Error("Received HTML/XML, not a LAS file (check URL/auth)");
  }

  // find LAS header signature; tolerate preambles by scanning up to 8MB
  let base = 0;
  let sig = readString(view, 0, 4);
  if (sig !== "LASF") {
    const limit = Math.min(buffer.byteLength - 4, 8 * 1024 * 1024);
    for (let i = 1; i < limit; i++) {
      if (
        view.getUint8(i + 0) === 0x4c && // 'L'
        view.getUint8(i + 1) === 0x41 && // 'A'
        view.getUint8(i + 2) === 0x53 && // 'S'
        view.getUint8(i + 3) === 0x46 // 'F'
      ) {
        base = i;
        sig = "LASF";
        break;
      }
    }
  }
  if (sig !== "LASF") {
    // surface first few chars to help diagnose (HTML/JSON/etc.)
    const peek = Array.from(new Uint8Array(buffer.slice(0, 16)))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join(" ");
    throw new Error(
      `Not a LAS file (signature not found in first ${Math.min(buffer.byteLength, 8 * 1024 * 1024)} bytes). First bytes: ${peek}`,
    );
  }

  const _versionMajor = view.getUint8(base + 24);
  const _versionMinor = view.getUint8(base + 25);
  const _headerSize = view.getUint16(base + 94, true);
  const offsetToPointData = view.getUint32(base + 96, true) + base; // offset relative to start
  const pointFormat = view.getUint8(base + 104);
  const pointRecordLength = view.getUint16(base + 105, true);
  let pointCount = view.getUint32(base + 107, true);

  // Extended headers may store 64-bit counts; for simplicity rely on legacy when present.
  if (pointCount === 0) {
    // Fallback estimate
    pointCount = Math.max(
      0,
      Math.floor((buffer.byteLength - offsetToPointData) / pointRecordLength),
    );
  }

  const xScale = view.getFloat64(base + 131, true);
  const yScale = view.getFloat64(base + 139, true);
  const zScale = view.getFloat64(base + 147, true);
  const xOffset = view.getFloat64(base + 155, true);
  const yOffset = view.getFloat64(base + 163, true);
  const zOffset = view.getFloat64(base + 171, true);

  const maxPoints = options?.maxPoints ?? pointCount;
  const step = Math.max(1, Math.floor(pointCount / maxPoints));
  const outCount = Math.ceil(pointCount / step);

  const positions = new Float32Array(outCount * 3);
  const intensities = new Float32Array(outCount);
  let colors: Float32Array | undefined;

  const hasRGB = pointFormat === 2 || pointFormat === 3;
  if (hasRGB) colors = new Float32Array(outCount * 3);

  let idx = 0;
  let minI = Infinity;
  let maxI = -Infinity;

  for (let i = 0; i < pointCount; i += step) {
    const pOffset = offsetToPointData + i * pointRecordLength;
    const X = view.getInt32(pOffset + 0, true);
    const Y = view.getInt32(pOffset + 4, true);
    const Z = view.getInt32(pOffset + 8, true);

    // Intensity at byte 12 (UInt16) for formats 0-3
    const intensity = view.getUint16(pOffset + 12, true);
    intensities[idx] = intensity;
    if (intensity < minI) minI = intensity;
    if (intensity > maxI) maxI = intensity;

    positions[idx * 3 + 0] = X * xScale + xOffset;
    positions[idx * 3 + 1] = Y * yScale + yOffset;
    positions[idx * 3 + 2] = Z * zScale + zOffset;

    if (hasRGB && colors) {
      // RGB is after base record; For format 2: offset 20; for 3: after GPS time (28)
      const rgbOffset = pointFormat === 2 ? pOffset + 20 : pOffset + 28;
      const r = view.getUint16(rgbOffset + 0, true);
      const g = view.getUint16(rgbOffset + 2, true);
      const b = view.getUint16(rgbOffset + 4, true);
      // Normalize 16-bit to 0..1
      colors[idx * 3 + 0] = r / 65535;
      colors[idx * 3 + 1] = g / 65535;
      colors[idx * 3 + 2] = b / 65535;
    }
    idx++;
  }

  // If no RGB, map intensity to a color gradient
  let outColors: Float32Array | undefined = colors;
  if (!colors) {
    const span = Math.max(1, maxI - minI);
    outColors = new Float32Array(outCount * 3);
    for (let i = 0; i < outCount; i++) {
      const t = (intensities[i] - minI) / span;
      const { r, g, b } = turboColor(t);
      outColors[i * 3 + 0] = r;
      outColors[i * 3 + 1] = g;
      outColors[i * 3 + 2] = b;
    }
  }

  return { positions, colors: outColors, intensities, count: outCount };
}

function turboColor(t: number) {
  // Approximate Turbo colormap (simple piecewise)
  t = Math.max(0, Math.min(1, t));
  let r = 0,
    g = 0,
    b = 0;
  if (t < 0.25) {
    const k = t / 0.25;
    r = 0;
    g = k;
    b = 1;
  } else if (t < 0.5) {
    const k = (t - 0.25) / 0.25;
    r = 0;
    g = 1;
    b = 1 - k;
  } else if (t < 0.75) {
    const k = (t - 0.5) / 0.25;
    r = k;
    g = 1;
    b = 0;
  } else {
    const k = (t - 0.75) / 0.25;
    r = 1;
    g = 1 - k;
    b = 0;
  }
  return { r, g, b };
}

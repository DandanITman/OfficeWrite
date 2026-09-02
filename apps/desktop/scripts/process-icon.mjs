/**
 * Builds app icons from icon-source.png (preferred) or embedded PNG in icon.svg.
 * Outputs PNG, ICO (multi-size for crisp Windows installer), and copies to public/.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import pngToIco from 'png-to-ico';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.join(__dirname, '..');
const buildDir = path.join(appDir, 'build');
const publicDir = path.join(appDir, 'public');
const sourcePath = path.join(buildDir, 'icon-source.png');
const svgPath = path.join(buildDir, 'icon.svg');
const iconPath = path.join(buildDir, 'icon.png');
const icon512Path = path.join(buildDir, 'icon-512.png');
const iconIcoPath = path.join(buildDir, 'icon.ico');
const ICO_SIZES = [16, 24, 32, 48, 64, 128, 256];

function isOuterWhite(r, g, b, a) {
  if (a < 10) return false;
  return r > 235 && g > 235 && b > 235;
}

async function removeOuterWhite(input) {
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  const pixels = new Uint8Array(data);
  const visited = new Uint8Array(width * height);
  const queue = [];

  const idx = (x, y) => (y * width + x) * channels;
  const visitKey = (x, y) => y * width + x;

  for (let x = 0; x < width; x++) {
    queue.push(x, 0, x, height - 1);
  }
  for (let y = 0; y < height; y++) {
    queue.push(0, y, width - 1, y);
  }

  while (queue.length) {
    const y = queue.pop();
    const x = queue.pop();
    if (x < 0 || y < 0 || x >= width || y >= height) continue;
    const key = visitKey(x, y);
    if (visited[key]) continue;
    visited[key] = 1;

    const i = idx(x, y);
    const r = pixels[i];
    const g = pixels[i + 1];
    const b = pixels[i + 2];
    const a = pixels[i + 3];

    if (!isOuterWhite(r, g, b, a)) continue;

    pixels[i + 3] = 0;

    queue.push(x - 1, y, x + 1, y, x, y - 1, x, y + 1);
  }

  return sharp(Buffer.from(pixels), { raw: { width, height, channels } }).png().toBuffer();
}

function loadPngFromSvg() {
  if (!fs.existsSync(svgPath)) return null;
  const svg = fs.readFileSync(svgPath, 'utf-8');
  const match = svg.match(/data:image\/png;base64,([^"]+)/);
  if (!match) return null;
  return Buffer.from(match[1], 'base64');
}

async function loadSourcePng() {
  if (fs.existsSync(sourcePath)) {
    return removeOuterWhite(fs.readFileSync(sourcePath));
  }
  const embedded = loadPngFromSvg();
  if (embedded) {
    console.log('Using embedded PNG from build/icon.svg (icon-source.png not found)');
    return embedded;
  }
  throw new Error('No icon source found. Add build/icon-source.png or build/icon.svg');
}

async function writeOutputs(transparent) {
  await sharp(transparent)
    .resize(1024, 1024, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(iconPath);

  await sharp(transparent)
    .resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(icon512Path);

  const pngBase64 = (await sharp(icon512Path).png().toBuffer()).toString('base64');
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 512 512" width="512" height="512">
  <image width="512" height="512" xlink:href="data:image/png;base64,${pngBase64}"/>
</svg>`;
  fs.writeFileSync(svgPath, svg);

  const icoDir = path.join(buildDir, 'ico-sizes');
  fs.mkdirSync(icoDir, { recursive: true });
  const icoPaths = [];
  for (const size of ICO_SIZES) {
    const sizePath = path.join(icoDir, `${size}.png`);
    await sharp(iconPath).resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toFile(sizePath);
    icoPaths.push(sizePath);
  }
  const icoBuffer = await pngToIco(icoPaths);
  fs.writeFileSync(iconIcoPath, icoBuffer);

  fs.mkdirSync(publicDir, { recursive: true });
  fs.copyFileSync(iconPath, path.join(publicDir, 'icon.png'));
  fs.copyFileSync(svgPath, path.join(publicDir, 'icon.svg'));

  console.log('Icon processed:');
  console.log(' ', iconPath);
  console.log(' ', iconIcoPath);
  console.log(' ', path.join(publicDir, 'icon.png'));
}

async function main() {
  const source = await loadSourcePng();
  await writeOutputs(source);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

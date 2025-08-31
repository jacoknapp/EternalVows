import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import pngToIco from 'png-to-ico';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const FAVICON_DIR = path.join(ROOT, 'favicon');
const SRC_SVG = path.join(FAVICON_DIR, 'wedding_bell.svg');

const pngSizes = [16, 32, 48, 64, 128, 180, 192, 256, 512];
const icoSizes = [16, 32, 48, 64];
const appleTouch = [76, 120, 152, 180];

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function renderPng(size, outPath) {
  const img = sharp(SRC_SVG).resize(size, size, { fit: 'contain' });
  await img.png({ compressionLevel: 9, quality: 90 }).toFile(outPath);
}

async function buildPngs() {
  await ensureDir(FAVICON_DIR);
  const outputs = [];
  for (const s of pngSizes) {
    const out = path.join(FAVICON_DIR, `wedding_bell_${s}x${s}.png`);
    await renderPng(s, out);
    outputs.push(out);
  }
  // Apple touch icons
  for (const s of appleTouch) {
    const out = path.join(FAVICON_DIR, `apple_touch_icon_${s}x${s}.png`);
    await renderPng(s, out);
    outputs.push(out);
  }
  return outputs;
}

async function buildIco() {
  // Create ICO from a subset of sizes
  const bufs = [];
  for (const s of icoSizes) {
    const buffer = await sharp(SRC_SVG).resize(s, s, { fit: 'contain' }).png().toBuffer();
    bufs.push(buffer);
  }
  const ico = await pngToIco(bufs);
  const icoPath = path.join(FAVICON_DIR, 'wedding_bell_favicon.ico');
  await fs.writeFile(icoPath, ico);
  return icoPath;
}

async function main() {
  try {
    await fs.access(SRC_SVG);
  } catch {
    throw new Error(`Source SVG not found: ${SRC_SVG}`);
  }
  const pngOuts = await buildPngs();
  const icoOut = await buildIco();
  console.log('Generated favicons:', [...pngOuts, icoOut].map(p => path.basename(p)).join(', '));
}

main().catch(err => { console.error(err); process.exit(1); });

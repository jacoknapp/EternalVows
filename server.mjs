// Dynamic server: serves site + live photo listing at /api/photos
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readdir } from 'node:fs/promises';
import { extname } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();

const ROOT = __dirname;
const CONFIG_DIR = path.join(ROOT, 'config');
const PHOTO_DIR = path.join(CONFIG_DIR, 'photos');
const FAVICON_DIR = path.join(ROOT, 'favicon');
const ALLOWED = new Set(['.jpg','.jpeg','.png','.webp','.avif']);

app.use(express.static(ROOT, { extensions: ['html'], etag: true, lastModified: true }));
app.use('/config', express.static(CONFIG_DIR, { etag: true, lastModified: true }));
// Serve favicons and related assets
app.use('/favicon', express.static(FAVICON_DIR, { etag: true, lastModified: true }));
app.get('/favicon.ico', (_req, res) => res.sendFile(path.join(FAVICON_DIR, 'wedding_bell_favicon.ico')));
app.get('/apple-touch-icon.png', (_req, res) => res.sendFile(path.join(FAVICON_DIR, 'apple_touch_icon_180x180.png')));
app.get('/site.webmanifest', (_req, res) => res.sendFile(path.join(FAVICON_DIR, 'site.webmanifest')));

app.get('/api/photos', async (_req, res) => {
  try {
    const primary = await readdir(PHOTO_DIR, { withFileTypes: true });
    const files = primary
      .filter(f => f.isFile() && ALLOWED.has(extname(f.name).toLowerCase()))
      .map(f => f.name)
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    res.set('Cache-Control', 'no-store');
    res.json({ files });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

const port = process.env.PORT || 5500;
app.listen(port, () => console.log(`Wedding site running at http://localhost:${port}`));

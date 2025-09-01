// Dynamic server: serves site + live photo listing at /api/photos
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readdir } from 'node:fs/promises';
import { extname } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();

// Simple structured logger with optional DEBUG
const LOG_LEVEL = (process.env.LOG_LEVEL || 'info').toLowerCase();
const isDebug = LOG_LEVEL === 'debug' || LOG_LEVEL === 'trace' || process.env.DEBUG === '1';
const ts = () => new Date().toISOString();
const info = (...args) => console.log(ts(), '[INFO]', ...args);
const warn = (...args) => console.warn(ts(), '[WARN]', ...args);
const error = (...args) => console.error(ts(), '[ERROR]', ...args);
const debug = (...args) => { if (isDebug) console.log(ts(), '[DEBUG]', ...args); };

const ROOT = __dirname;
const CONFIG_DIR = path.join(ROOT, 'config');
const PHOTO_DIR = path.join(CONFIG_DIR, 'photos');
const FAVICON_DIR = path.join(ROOT, 'favicon');
const ALLOWED = new Set(['.jpg','.jpeg','.png','.webp','.avif']);

// Request/response logger with timing
app.use((req, res, next) => {
  const start = process.hrtime.bigint();
  debug('Incoming request', { method: req.method, url: req.originalUrl || req.url, ip: req.ip });
  res.on('finish', () => {
    const durMs = Number(process.hrtime.bigint() - start) / 1e6;
    const msg = `${req.method} ${req.originalUrl || req.url} -> ${res.statusCode} ${Math.round(durMs)}ms`;
    if (res.statusCode >= 500) error(msg);
    else if (res.statusCode >= 400) warn(msg);
    else info(msg);
  });
  next();
});

app.use(express.static(ROOT, { extensions: ['html'], etag: true, lastModified: true }));
app.use('/config', express.static(CONFIG_DIR, { etag: true, lastModified: true }));
// Serve photos from config/photos under a stable /photos path used by the client
app.use('/photos', express.static(PHOTO_DIR, { etag: true, lastModified: true }));
// Serve favicons and related assets
app.use('/favicon', express.static(FAVICON_DIR, { etag: true, lastModified: true }));
app.get('/favicon.ico', (_req, res) => res.sendFile(path.join(FAVICON_DIR, 'wedding_bell_favicon.ico')));
app.get('/apple-touch-icon.png', (_req, res) => res.sendFile(path.join(FAVICON_DIR, 'apple_touch_icon_180x180.png')));
app.get('/site.webmanifest', (_req, res) => res.sendFile(path.join(FAVICON_DIR, 'site.webmanifest')));

app.get('/api/photos', async (_req, res) => {
  try {
    debug('Listing photos from', PHOTO_DIR, 'allowed extensions:', [...ALLOWED].join(','));
    const primary = await readdir(PHOTO_DIR, { withFileTypes: true });
    const files = primary
      .filter(f => f.isFile() && ALLOWED.has(extname(f.name).toLowerCase()))
      .map(f => f.name)
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    info(`/api/photos -> ${files.length} files`);
    res.set('Cache-Control', 'no-store');
    res.json({ files });
  } catch (e) {
    // If the photos directory doesn't exist yet, treat as empty set
    if (e && (e.code === 'ENOENT' || e.code === 'ENOTDIR')) {
      warn('Photos directory not found; returning empty list');
      return res.json({ files: [] });
    }
    error('Failed to list photos:', e && e.stack ? e.stack : e);
    res.status(500).json({ error: e.message });
  }
});

const port = process.env.PORT || 5500;
app.listen(port, () => {
  info(`Wedding site running at http://localhost:${port}`);
  info('Environment', { node: process.versions.node, platform: process.platform, arch: process.arch, logLevel: LOG_LEVEL });
  info('Paths', { ROOT, CONFIG_DIR, PHOTO_DIR, FAVICON_DIR });
});

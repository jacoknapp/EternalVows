// Dynamic server: serves site + live photo listing at /api/photos
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readdir, readFile } from 'node:fs/promises';
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

// Serve dynamic index with title/meta injected from config for better previews (no-JS crawlers)
async function getConfig() {
  try {
    const raw = await readFile(path.join(CONFIG_DIR, 'config.json'), 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    warn('Failed to read config.json; using defaults. Error:', e && e.message);
    return {};
  }
}

function buildMeta(cfg) {
  const title = cfg.ui?.title || cfg.title || cfg.coupleNames || 'Wedding';
  // Build a friendly description
  const date = cfg.dateDisplay ? String(cfg.dateDisplay) : '';
  const loc = cfg.locationShort ? String(cfg.locationShort) : '';
  const parts = [
    cfg.story && String(cfg.story).trim().slice(0, 140),
    [date, loc].filter(Boolean).join(' • ')
  ].filter(Boolean);
  const description = parts[0] || 'Join us for our wedding celebration.';
  return { title, description };
}

function injectHead(html, { title, description }) {
  let out = html;
  // Replace <title>
  out = out.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(title)}</title>`);
  // Replace meta description if present; else insert after title
  if (/<meta[^>]+name=["']description["'][^>]*>/i.test(out)) {
    out = out.replace(/<meta[^>]+name=["']description["'][^>]*>/i, `<meta name="description" content="${escapeHtml(description)}">`);
  } else {
    out = out.replace(/<title>[\s\S]*?<\/title>/i, m => `${m}\n  <meta name="description" content="${escapeHtml(description)}">`);
  }
  // Ensure OG/Twitter meta tags
  const ogTitle = `<meta property="og:title" content="${escapeHtml(title)}">`;
  const ogDesc = `<meta property="og:description" content="${escapeHtml(description)}">`;
  const twTitle = `<meta name="twitter:title" content="${escapeHtml(title)}">`;
  const twDesc = `<meta name="twitter:description" content="${escapeHtml(description)}">`;
  const ensure = (pattern, tag) => {
    if (!pattern.test(out)) {
      out = out.replace(/<head[^>]*>/i, m => `${m}\n  ${tag}`);
    }
  };
  ensure(/<meta[^>]+property=["']og:title["'][^>]*>/i, ogTitle);
  ensure(/<meta[^>]+property=["']og:description["'][^>]*>/i, ogDesc);
  ensure(/<meta[^>]+name=["']twitter:title["'][^>]*>/i, twTitle);
  ensure(/<meta[^>]+name=["']twitter:description["'][^>]*>/i, twDesc);
  return out;
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

app.get(['/', '/index.html'], async (_req, res) => {
  try {
    const [cfg, html] = await Promise.all([
      getConfig(),
      readFile(path.join(ROOT, 'index.html'), 'utf8')
    ]);
    const meta = buildMeta(cfg || {});
    const out = injectHead(html, meta);
    res.set('Cache-Control', 'no-store');
    res.type('html').send(out);
  } catch (e) {
    error('Failed to render index.html dynamically, falling back to static. Error:', e && e.stack ? e.stack : e);
    res.sendFile(path.join(ROOT, 'index.html'));
  }
});

// Static assets and routes
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

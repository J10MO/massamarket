import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cors from 'cors';
import catalogRoutes from './routes/catalog.js';
import authRoutes from './routes/auth.js';
import orderRoutes from './routes/orders.js';
import adminRoutes, { UPLOAD_DIR } from './routes/admin.js';
import { query } from './db.js';
import { ensureDefaultSettings } from './lib/settings.js';

// Apply schema changes (idempotent) and default settings on every start
await query(fs.readFileSync(new URL('./schema.sql', import.meta.url), 'utf8'));
await ensureDefaultSettings();

const app = express();
app.use(cors());
app.use(express.json({ limit: '100kb' }));

// Express 4 doesn't catch rejected promises from async handlers
const wrap = (router) => {
  for (const layer of router.stack) {
    for (const s of layer.route?.stack || []) {
      const fn = s.handle;
      if (fn.constructor.name === 'AsyncFunction') s.handle = (req, res, next) => fn(req, res, next).catch(next);
    }
  }
  return router;
};

app.use('/uploads', express.static(UPLOAD_DIR, { maxAge: '30d' }));
app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.use('/api', wrap(catalogRoutes));
app.use('/api/auth', wrap(authRoutes));
app.use('/api/orders', wrap(orderRoutes));
app.use('/api/admin', wrap(adminRoutes));

// Serve the built React app in production
const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../client/dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get(/^\/(?!api).*/, (_req, res) => res.sendFile(path.join(dist, 'index.html')));
}

app.use((err, _req, res, _next) => {
  if (err.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ error: 'حجم الصورة أكبر من 8MB' });
  console.error(err);
  res.status(500).json({ error: 'حدث خطأ في الخادم' });
});

const port = process.env.PORT || 5000;
app.listen(port, () => console.log(`API running on http://localhost:${port}`));

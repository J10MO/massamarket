import { Router } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import multer from 'multer';
import { query } from '../db.js';
import { requireAdmin } from '../middleware/auth.js';
import { importAllCategories, importFromPinterest } from '../lib/importer.js';
import { getSettings, saveSettings } from '../lib/settings.js';

export const UPLOAD_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (_req, file, cb) => cb(null, `${Date.now()}-${crypto.randomBytes(4).toString('hex')}${path.extname(file.originalname).toLowerCase() || '.jpg'}`),
  }),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => cb(null, /^image\/(jpeg|png|webp|gif|avif)$/.test(file.mimetype)),
});

const router = Router();
router.use(requireAdmin);

const bad = (res, msg, status = 400) => res.status(status).json({ error: msg });

/* ---------------- Dashboard ---------------- */
router.get('/dashboard', async (req, res) => {
  const days = Math.min(Math.max(parseInt(req.query.days) || 30, 7), 365);
  const since = `now() - interval '${days} days'`;
  const [kpi, daily, statuses, top, lowStock, recent, cities, cats] = await Promise.all([
    query(`SELECT
      COALESCE(sum(total) FILTER (WHERE status <> 'cancelled' AND created_at >= ${since}), 0) AS revenue,
      count(*) FILTER (WHERE created_at >= ${since})::int AS orders,
      count(*) FILTER (WHERE created_at >= date_trunc('day', now()))::int AS orders_today,
      COALESCE(sum(total) FILTER (WHERE status <> 'cancelled' AND created_at >= date_trunc('day', now())), 0) AS revenue_today,
      count(*) FILTER (WHERE status = 'pending')::int AS pending,
      COALESCE(avg(total) FILTER (WHERE status <> 'cancelled' AND created_at >= ${since}), 0) AS avg_order,
      count(DISTINCT phone) FILTER (WHERE created_at >= ${since})::int AS buyers
      FROM orders`),
    query(`SELECT to_char(d, 'YYYY-MM-DD') AS day,
        COALESCE(sum(o.total) FILTER (WHERE o.status <> 'cancelled'), 0) AS revenue, count(o.id)::int AS orders
      FROM generate_series(date_trunc('day', now()) - interval '${days - 1} days', date_trunc('day', now()), interval '1 day') d
      LEFT JOIN orders o ON date_trunc('day', o.created_at) = d
      GROUP BY d ORDER BY d`),
    query(`SELECT status, count(*)::int AS n FROM orders GROUP BY status`),
    query(`SELECT oi.product_id AS id, oi.name, max(oi.image_url) AS image_url, sum(oi.quantity)::int AS qty, sum(oi.quantity * oi.price) AS revenue
      FROM order_items oi JOIN orders o ON o.id = oi.order_id
      WHERE o.status <> 'cancelled' AND o.created_at >= ${since}
      GROUP BY oi.product_id, oi.name ORDER BY qty DESC LIMIT 5`),
    query(`SELECT id, name, image_url, stock FROM products WHERE is_active AND stock <= 5 ORDER BY stock, id LIMIT 8`),
    query(`SELECT id, customer_name, city, total, status, created_at FROM orders ORDER BY created_at DESC LIMIT 6`),
    query(`SELECT city, count(*)::int AS n, sum(total) AS revenue FROM orders
      WHERE status <> 'cancelled' AND created_at >= ${since} GROUP BY city ORDER BY n DESC LIMIT 6`),
    query(`SELECT
      (SELECT count(*)::int FROM products WHERE is_active) AS products,
      (SELECT count(*)::int FROM products WHERE NOT is_active) AS hidden,
      (SELECT count(*)::int FROM categories) AS categories,
      (SELECT count(*)::int FROM users WHERE role = 'customer') AS users`),
  ]);
  res.json({
    days,
    kpi: { ...kpi.rows[0], ...cats.rows[0] },
    daily: daily.rows,
    statuses: statuses.rows,
    top: top.rows,
    low_stock: lowStock.rows,
    recent: recent.rows,
    cities: cities.rows,
  });
});

/* ---------------- Orders ---------------- */
const STATUSES = ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'];
const ORDER_SELECT = `SELECT o.*, COALESCE(json_agg(oi ORDER BY oi.id) FILTER (WHERE oi.id IS NOT NULL), '[]') AS items
  FROM orders o LEFT JOIN order_items oi ON oi.order_id = o.id`;

router.get('/orders', async (req, res) => {
  const { status, q } = req.query;
  const limit = 30;
  const page = Math.max(parseInt(req.query.page) || 1, 1);
  const where = ['true'];
  const params = [];
  if (STATUSES.includes(status)) {
    params.push(status);
    where.push(`o.status = $${params.length}`);
  }
  if (q) {
    params.push(`%${q}%`);
    where.push(`(o.customer_name ILIKE $${params.length} OR o.phone ILIKE $${params.length} OR o.id::text = $${params.length + 1})`);
    params.push(q.replace('#', ''));
  }
  const w = where.join(' AND ');
  const [list, count] = await Promise.all([
    query(`${ORDER_SELECT} WHERE ${w} GROUP BY o.id ORDER BY o.created_at DESC LIMIT ${limit} OFFSET ${(page - 1) * limit}`, params),
    query(`SELECT count(*)::int AS n FROM orders o WHERE ${w}`, params),
  ]);
  res.json({ items: list.rows, total: count.rows[0].n, page, pages: Math.max(1, Math.ceil(count.rows[0].n / limit)) });
});

router.get('/orders/:id', async (req, res) => {
  const { rows } = await query(`${ORDER_SELECT} WHERE o.id = $1 GROUP BY o.id`, [parseInt(req.params.id) || 0]);
  if (!rows[0]) return bad(res, 'الطلب غير موجود', 404);
  res.json(rows[0]);
});

router.patch('/orders/:id', async (req, res) => {
  const { status } = req.body || {};
  if (!STATUSES.includes(status)) return bad(res, 'حالة غير صالحة');
  const { rows: before } = await query('SELECT status FROM orders WHERE id = $1', [req.params.id]);
  if (!before[0]) return bad(res, 'الطلب غير موجود', 404);
  // Return stock when an order is cancelled, take it again if un-cancelled
  const was = before[0].status;
  if (was !== status && (was === 'cancelled' || status === 'cancelled')) {
    const sign = status === 'cancelled' ? 1 : -1;
    await query(
      `UPDATE products p SET stock = GREATEST(0, p.stock + $1 * oi.quantity), sold_count = GREATEST(0, p.sold_count - $1 * oi.quantity)
       FROM order_items oi WHERE oi.order_id = $2 AND oi.product_id = p.id`,
      [sign, req.params.id]
    );
  }
  const { rows } = await query('UPDATE orders SET status = $1 WHERE id = $2 RETURNING *', [status, req.params.id]);
  res.json(rows[0]);
});

router.delete('/orders/:id', async (req, res) => {
  const { rowCount } = await query('DELETE FROM orders WHERE id = $1', [req.params.id]);
  if (!rowCount) return bad(res, 'الطلب غير موجود', 404);
  res.json({ ok: true });
});

/* ---------------- Products ---------------- */
router.get('/products', async (req, res) => {
  const { q, category, status, sort } = req.query;
  const limit = 24;
  const page = Math.max(parseInt(req.query.page) || 1, 1);
  const where = ['true'];
  const params = [];
  const add = (sql, v) => {
    params.push(v);
    where.push(sql.replaceAll('?', `$${params.length}`));
  };
  if (q) {
    params.push(`%${q}%`, q.replace('#', ''));
    where.push(`(p.name ILIKE $${params.length - 1} OR p.id::text = $${params.length})`);
  }
  if (category) add('p.category_id = ?', parseInt(category));
  if (status === 'active') where.push('p.is_active');
  if (status === 'hidden') where.push('NOT p.is_active');
  if (status === 'low') where.push('p.stock <= 5');
  if (status === 'featured') where.push('p.is_featured');
  const order = { price_asc: 'p.price', price_desc: 'p.price DESC', stock: 'p.stock', sold: 'p.sold_count DESC' }[sort] || 'p.id DESC';
  const w = where.join(' AND ');
  const [list, count] = await Promise.all([
    query(
      `SELECT p.*, c.name AS category_name FROM products p JOIN categories c ON c.id = p.category_id
       WHERE ${w} ORDER BY ${order} LIMIT ${limit} OFFSET ${(page - 1) * limit}`,
      params
    ),
    query(`SELECT count(*)::int AS n FROM products p WHERE ${w}`, params),
  ]);
  res.json({ items: list.rows, total: count.rows[0].n, page, pages: Math.max(1, Math.ceil(count.rows[0].n / limit)) });
});

router.get('/products/:id', async (req, res) => {
  const { rows } = await query('SELECT * FROM products WHERE id = $1', [parseInt(req.params.id) || 0]);
  if (!rows[0]) return bad(res, 'المنتج غير موجود', 404);
  res.json(rows[0]);
});

const PRODUCT_FIELDS = ['category_id', 'name', 'description', 'price', 'old_price', 'image_url', 'images', 'sizes',
  'colors', 'stock', 'badge', 'is_featured', 'is_active'];

function cleanProduct(body, partial) {
  const out = {};
  for (const k of PRODUCT_FIELDS) if (k in body) out[k] = body[k];
  for (const k of ['price', 'old_price', 'stock', 'category_id']) {
    if (k in out) out[k] = out[k] === '' || out[k] === null ? null : Number(out[k]);
  }
  if ('badge' in out && !['new', 'sale', 'hot'].includes(out.badge)) out.badge = null;
  for (const k of ['images', 'sizes', 'colors']) {
    if (k in out) out[k] = (Array.isArray(out[k]) ? out[k] : []).map((s) => String(s).trim()).filter(Boolean);
  }
  if (!partial || 'name' in out) if (!out.name?.trim()) return 'اسم المنتج مطلوب';
  if (!partial || 'price' in out) if (!(out.price >= 0)) return 'السعر غير صالح';
  if (!partial || 'category_id' in out) if (!out.category_id) return 'اختاري القسم';
  if (!partial || 'image_url' in out) if (!out.image_url) return 'أضيفي صورة رئيسية للمنتج';
  if ('stock' in out && (out.stock === null || out.stock < 0)) out.stock = 0;
  return out;
}

router.post('/products', async (req, res) => {
  const p = cleanProduct(req.body || {}, false);
  if (typeof p === 'string') return bad(res, p);
  const keys = Object.keys(p);
  const { rows } = await query(
    `INSERT INTO products (${keys.join(', ')}) VALUES (${keys.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING *`,
    keys.map((k) => p[k])
  );
  res.status(201).json(rows[0]);
});

router.patch('/products/:id', async (req, res) => {
  const p = cleanProduct(req.body || {}, true);
  if (typeof p === 'string') return bad(res, p);
  const keys = Object.keys(p);
  if (!keys.length) return bad(res, 'لا توجد تعديلات');
  const { rows } = await query(
    `UPDATE products SET ${keys.map((k, i) => `${k} = $${i + 1}`).join(', ')}, updated_at = now()
     WHERE id = $${keys.length + 1} RETURNING *`,
    [...keys.map((k) => p[k]), req.params.id]
  );
  if (!rows[0]) return bad(res, 'المنتج غير موجود', 404);
  res.json(rows[0]);
});

router.delete('/products/:id', async (req, res) => {
  const { rowCount } = await query('DELETE FROM products WHERE id = $1', [req.params.id]);
  if (!rowCount) return bad(res, 'المنتج غير موجود', 404);
  res.json({ ok: true });
});

/* ---------------- Uploads ---------------- */
router.post('/upload', upload.array('files', 10), (req, res) => {
  if (!req.files?.length) return bad(res, 'ارفعي صورة بصيغة JPG أو PNG أو WEBP (حتى 8MB)');
  res.json({ urls: req.files.map((f) => `/uploads/${f.filename}`) });
});

/* ---------------- Categories ---------------- */
router.get('/categories', async (_req, res) => {
  const { rows } = await query(`
    SELECT c.*, count(p.id)::int AS product_count, count(p.id) FILTER (WHERE p.is_active)::int AS active_count,
      COALESCE(c.image_url, (SELECT image_url FROM products WHERE category_id = c.id ORDER BY is_featured DESC, sold_count DESC LIMIT 1)) AS cover
    FROM categories c LEFT JOIN products p ON p.category_id = c.id
    GROUP BY c.id ORDER BY c.sort_order, c.id`);
  res.json(rows);
});

function cleanCategory(b) {
  const out = {};
  if ('name' in b) out.name = String(b.name || '').trim();
  if ('slug' in b) out.slug = String(b.slug || '').trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-|-$/g, '');
  if ('description' in b) out.description = String(b.description || '').trim() || null;
  if ('color' in b) out.color = /^#[0-9a-f]{6}$/i.test(b.color) ? b.color : '#0B1A3E';
  if ('sort_order' in b) out.sort_order = parseInt(b.sort_order) || 0;
  if ('image_url' in b) out.image_url = b.image_url || null;
  if ('pinterest_boards' in b) out.pinterest_boards = (b.pinterest_boards || []).map((s) => String(s).trim()).filter(Boolean);
  return out;
}

router.post('/categories', async (req, res) => {
  const c = cleanCategory(req.body || {});
  if (!c.name) return bad(res, 'اسم القسم مطلوب');
  if (!c.slug) c.slug = `cat-${Date.now().toString(36)}`;
  const keys = Object.keys(c);
  try {
    const { rows } = await query(
      `INSERT INTO categories (${keys.join(', ')}) VALUES (${keys.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING *`,
      keys.map((k) => c[k])
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return bad(res, 'الرابط المختصر (slug) مستخدم لقسم آخر', 409);
    throw err;
  }
});

router.patch('/categories/:id', async (req, res) => {
  const c = cleanCategory(req.body || {});
  if ('name' in c && !c.name) return bad(res, 'اسم القسم مطلوب');
  if ('slug' in c && !c.slug) return bad(res, 'الرابط المختصر مطلوب');
  const keys = Object.keys(c);
  if (!keys.length) return bad(res, 'لا توجد تعديلات');
  try {
    const { rows } = await query(
      `UPDATE categories SET ${keys.map((k, i) => `${k} = $${i + 1}`).join(', ')} WHERE id = $${keys.length + 1} RETURNING *`,
      [...keys.map((k) => c[k]), req.params.id]
    );
    if (!rows[0]) return bad(res, 'القسم غير موجود', 404);
    res.json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return bad(res, 'الرابط المختصر (slug) مستخدم لقسم آخر', 409);
    throw err;
  }
});

router.delete('/categories/:id', async (req, res) => {
  const { rows } = await query('SELECT count(*)::int AS n FROM products WHERE category_id = $1', [req.params.id]);
  if (rows[0].n > 0) return bad(res, `لا يمكن حذف القسم لأنه يحتوي على ${rows[0].n} منتج. انقلي المنتجات أو احذفيها أولاً.`, 409);
  await query('DELETE FROM categories WHERE id = $1', [req.params.id]);
  res.json({ ok: true });
});

/* ---------------- Customers ---------------- */
router.get('/customers', async (req, res) => {
  const q = req.query.q ? `%${req.query.q}%` : null;
  const [buyers, users] = await Promise.all([
    query(
      `SELECT phone, (array_agg(customer_name ORDER BY created_at DESC))[1] AS name,
         (array_agg(city ORDER BY created_at DESC))[1] AS city,
         count(*)::int AS orders, COALESCE(sum(total) FILTER (WHERE status <> 'cancelled'), 0) AS spent,
         max(created_at) AS last_order
       FROM orders ${q ? 'WHERE customer_name ILIKE $1 OR phone ILIKE $1' : ''}
       GROUP BY phone ORDER BY max(created_at) DESC LIMIT 200`,
      q ? [q] : []
    ),
    query(
      `SELECT u.id, u.name, u.email, u.phone, u.role, u.created_at, count(o.id)::int AS orders
       FROM users u LEFT JOIN orders o ON o.user_id = u.id
       ${q ? 'WHERE u.name ILIKE $1 OR u.email ILIKE $1 OR u.phone ILIKE $1' : ''}
       GROUP BY u.id ORDER BY u.created_at DESC LIMIT 200`,
      q ? [q] : []
    ),
  ]);
  res.json({ buyers: buyers.rows, users: users.rows });
});

router.patch('/users/:id', async (req, res) => {
  const { role } = req.body || {};
  if (!['customer', 'admin'].includes(role)) return bad(res, 'صلاحية غير صالحة');
  if (Number(req.params.id) === req.user.id) return bad(res, 'لا يمكنك تغيير صلاحية حسابك');
  const { rows } = await query('UPDATE users SET role = $1 WHERE id = $2 RETURNING id, name, email, role', [role, req.params.id]);
  if (!rows[0]) return bad(res, 'المستخدم غير موجود', 404);
  res.json(rows[0]);
});

/* ---------------- Settings ---------------- */
router.get('/settings', async (_req, res) => res.json(await getSettings()));
router.put('/settings', async (req, res) => res.json(await saveSettings(req.body || {})));

/* ---------------- Pinterest ---------------- */
router.post('/import', async (req, res) => {
  const { url, category_id } = req.body || {};
  if (!url) return bad(res, 'أدخلي رابط Pinterest');
  const { rows } = await query('SELECT * FROM categories WHERE id = $1', [category_id]);
  if (!rows[0]) return bad(res, 'اختاري القسم');
  try {
    res.json(await importFromPinterest(url, rows[0]));
  } catch (err) {
    bad(res, err.message);
  }
});

router.post('/import/refresh', async (_req, res) => {
  const log = [];
  const added = await importAllCategories((l) => log.push(l.trim()));
  res.json({ added, log });
});

export default router;

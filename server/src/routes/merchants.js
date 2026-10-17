// Merchants: dress shops that apply, get approved by the admin, then publish under their own name.
import { Router } from 'express';
import { query } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { getSettings } from '../lib/settings.js';

const router = Router();
const bad = (res, msg, status = 400) => res.status(status).json({ error: msg });

// Fields a shop shows publicly (contact details are public on purpose: it's a business)
export const PUBLIC_SHOP = `m.id, m.shop_name, m.slug, m.description, m.logo_url, m.cover_url, m.phone, m.whatsapp,
  m.instagram, m.website, m.city, m.address, m.map_url, m.hours, m.approved_at, m.user_id`;

async function shopStats(userId) {
  const { rows } = await query(
    `SELECT
      (SELECT count(*)::int FROM listings WHERE seller_id = $1 AND merchant_id IS NOT NULL AND status = 'active') AS active,
      (SELECT count(*)::int FROM market_orders WHERE seller_id = $1 AND status = 'completed') AS sold,
      (SELECT round(avg(rating), 1) FROM market_orders WHERE seller_id = $1 AND rating IS NOT NULL) AS rating,
      (SELECT count(*)::int FROM market_orders WHERE seller_id = $1 AND rating IS NOT NULL) AS reviews`,
    [userId]
  );
  return rows[0];
}

/* ---------- Public ---------- */
router.get('/', async (req, res) => {
  const params = [];
  let where = "m.status = 'approved'";
  if (req.query.city) {
    params.push(req.query.city);
    where += ` AND m.city = $${params.length}`;
  }
  if (req.query.q) {
    params.push(`%${req.query.q}%`);
    where += ` AND (m.shop_name ILIKE $${params.length} OR m.description ILIKE $${params.length})`;
  }
  const { rows } = await query(
    `SELECT ${PUBLIC_SHOP},
       (SELECT count(*)::int FROM listings l WHERE l.merchant_id = m.id AND l.status = 'active') AS active,
       (SELECT round(avg(rating), 1) FROM market_orders o WHERE o.seller_id = m.user_id AND o.rating IS NOT NULL) AS rating
     FROM merchants m WHERE ${where}
     ORDER BY active DESC, m.approved_at DESC LIMIT ${Math.min(parseInt(req.query.limit) || 60, 100)}`,
    params
  );
  res.json(rows);
});

router.get('/me', requireAuth, async (req, res) => {
  const { rows } = await query('SELECT * FROM merchants WHERE user_id = $1', [req.user.id]);
  res.json(rows[0] || null);
});

router.get('/:slug', async (req, res) => {
  const { rows } = await query(`SELECT ${PUBLIC_SHOP} FROM merchants m WHERE m.slug = $1 AND m.status = 'approved'`, [req.params.slug]);
  const shop = rows[0];
  if (!shop) return bad(res, 'المحل غير موجود', 404);
  const [stats, reviews] = await Promise.all([
    shopStats(shop.user_id),
    query(
      `SELECT rating, review, updated_at, title, split_part(buyer_name, ' ', 1) AS buyer FROM market_orders
       WHERE seller_id = $1 AND rating IS NOT NULL ORDER BY updated_at DESC LIMIT 20`,
      [shop.user_id]
    ),
  ]);
  res.json({ ...shop, stats, reviews: reviews.rows });
});

/* ---------- Apply / edit my shop ---------- */
const clean = (v, max = 200) => String(v ?? '').trim().slice(0, max) || null;
const url = (v) => {
  const s = clean(v, 300);
  if (!s) return null;
  return /^https?:\/\//i.test(s) ? s : `https://${s}`;
};
const image = (v) => (/^(\/uploads\/|https?:\/\/)/.test(v || '') ? v : null);

router.post('/me', requireAuth, async (req, res) => {
  const s = await getSettings();
  if (s.merchants_enabled === false) return bad(res, 'التسجيل كمحل متوقف حالياً', 503);
  const b = req.body || {};
  const shop = {
    shop_name: clean(b.shop_name, 80),
    description: clean(b.description, 1500),
    logo_url: image(b.logo_url),
    cover_url: image(b.cover_url),
    phone: clean(b.phone, 20)?.replace(/[^\d+]/g, '') || null,
    whatsapp: clean(b.whatsapp, 20)?.replace(/[^\d+]/g, '') || null,
    instagram: clean(b.instagram, 80)?.replace(/^@/, '').replace(/^https?:\/\/(www\.)?instagram\.com\//i, '').replace(/\/.*$/, '') || null,
    website: url(b.website),
    city: clean(b.city, 40),
    address: clean(b.address, 300),
    map_url: url(b.map_url),
    hours: clean(b.hours, 120),
  };
  if (!shop.shop_name || shop.shop_name.length < 2) return bad(res, 'اكتبي اسم المحل');
  if (!shop.phone || shop.phone.length < 10) return bad(res, 'أدخلي رقم هاتف المحل');
  if (!shop.city || (s.cities?.length && !s.cities.includes(shop.city))) return bad(res, 'اختاري محافظة المحل');
  if (!shop.logo_url) return bad(res, 'ارفعي شعار المحل');
  if (!b.agree) return bad(res, 'يجب الموافقة على شروط التجار');

  const { rows: existing } = await query('SELECT * FROM merchants WHERE user_id = $1', [req.user.id]);
  const current = existing[0];
  if (current?.status === 'suspended') return bad(res, 'حساب المحل موقوف. تواصلي مع الإدارة.', 403);

  // Shop link (english), unique; defaults to the Instagram handle or shop-<user>
  let slug = String(b.slug || shop.instagram || current?.slug || `shop-${req.user.id}`)
    .toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || `shop-${req.user.id}`;
  const { rows: taken } = await query('SELECT 1 FROM merchants WHERE slug = $1 AND user_id <> $2', [slug, req.user.id]);
  if (taken.length) {
    if (b.slug) return bad(res, 'رابط المحل مستخدم، اختاري رابطاً آخر');
    slug = `${slug}-${req.user.id}`;
  }

  const keys = Object.keys(shop);
  if (!current) {
    const { rows } = await query(
      `INSERT INTO merchants (user_id, slug, ${keys.join(', ')}) VALUES ($1, $2, ${keys.map((_, i) => `$${i + 3}`).join(', ')}) RETURNING *`,
      [req.user.id, slug, ...keys.map((k) => shop[k])]
    );
    return res.status(201).json(rows[0]);
  }
  // A rejected application goes back to review when resubmitted; an approved shop just updates its profile
  const status = current.status === 'rejected' ? 'pending' : current.status;
  const { rows } = await query(
    `UPDATE merchants SET slug = $1, status = $2, reject_reason = CASE WHEN $2 = 'pending' THEN NULL ELSE reject_reason END,
       ${keys.map((k, i) => `${k} = $${i + 4}`).join(', ')}, updated_at = now()
     WHERE id = $3 RETURNING *`,
    [slug, status, current.id, ...keys.map((k) => shop[k])]
  );
  res.json(rows[0]);
});

export default router;

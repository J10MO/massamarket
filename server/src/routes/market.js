// Used-dress marketplace: customers list their own dresses and sell them to other customers.
import { Router } from 'express';
import { pool, query } from '../db.js';
import { optionalAuth, requireAuth } from '../middleware/auth.js';
import { getSettings } from '../lib/settings.js';
import { upload, uploadHandler } from '../lib/upload.js';

const router = Router();
const bad = (res, msg, status = 400) => res.status(status).json({ error: msg });

export const CONDITIONS = ['new_tag', 'like_new', 'very_good', 'good'];
const PUBLIC_STATUSES = ['active', 'reserved', 'sold'];

const LISTING_SELECT = `
  SELECT l.*, c.name AS category_name, c.slug AS category_slug,
    u.name AS seller_name, (l.boosted_until IS NOT NULL AND l.boosted_until > now()) AS is_boosted
  FROM listings l
  JOIN users u ON u.id = l.seller_id
  LEFT JOIN categories c ON c.id = l.category_id`;

// Public card fields only — never the seller's phone
const card = (l) => ({
  id: l.id, title: l.title, price: l.price, original_price: l.original_price, image_url: l.images[0] || null,
  images_count: l.images.length, size: l.size, condition: l.condition, city: l.city, status: l.status,
  is_boosted: l.is_boosted, category_name: l.category_name, seller_name: l.seller_name, seller_id: l.seller_id,
  brand: l.brand, created_at: l.created_at,
});

async function sellerStats(sellerId) {
  const { rows } = await query(
    `SELECT u.id, u.name, u.created_at,
      (SELECT count(*)::int FROM market_orders WHERE seller_id = u.id AND status = 'completed') AS sold,
      (SELECT count(*)::int FROM listings WHERE seller_id = u.id AND status = 'active') AS active,
      (SELECT round(avg(rating), 1) FROM market_orders WHERE seller_id = u.id AND rating IS NOT NULL) AS rating,
      (SELECT count(*)::int FROM market_orders WHERE seller_id = u.id AND rating IS NOT NULL) AS reviews
     FROM users u WHERE u.id = $1`,
    [sellerId]
  );
  return rows[0] || null;
}

async function marketOn(res) {
  const s = await getSettings();
  if (s.market_enabled === false) {
    bad(res, 'سوق المستعمل متوقف حالياً', 503);
    return null;
  }
  return s;
}

/* ---------------- Uploads (any signed-in user) ---------------- */
router.post('/uploads', requireAuth, upload.array('files', 10), uploadHandler);

/* ---------------- Browse ---------------- */
router.get('/listings', async (req, res) => {
  const { q, category, size, condition, city, min, max, sort, boosted, seller } = req.query;
  const limit = Math.min(parseInt(req.query.limit) || 20, 60);
  const page = Math.max(parseInt(req.query.page) || 1, 1);
  const where = ["l.status IN ('active', 'reserved')"];
  const params = [];
  const add = (sql, v) => {
    params.push(v);
    where.push(sql.replaceAll('?', `$${params.length}`));
  };
  if (q) add('(l.title ILIKE ? OR l.brand ILIKE ? OR l.description ILIKE ?)', `%${q}%`);
  if (category) add('c.slug = ?', category);
  if (size) add('l.size = ?', size);
  if (CONDITIONS.includes(condition)) add('l.condition = ?', condition);
  if (city) add('l.city = ?', city);
  if (min) add('l.price >= ?', Number(min));
  if (max) add('l.price <= ?', Number(max));
  if (boosted) where.push('l.boosted_until > now()');
  if (seller) add('l.seller_id = ?', parseInt(seller));

  const boostFirst = '(l.boosted_until IS NOT NULL AND l.boosted_until > now()) DESC';
  const order = {
    price_asc: 'l.price ASC',
    price_desc: 'l.price DESC',
    popular: 'l.views DESC',
  }[sort] || `${boostFirst}, (l.status = 'active') DESC, l.created_at DESC`;
  const w = where.join(' AND ');

  const [list, count] = await Promise.all([
    query(`${LISTING_SELECT} WHERE ${w} ORDER BY ${order}, l.id DESC LIMIT ${limit} OFFSET ${(page - 1) * limit}`, params),
    query(`SELECT count(*)::int AS n FROM listings l LEFT JOIN categories c ON c.id = l.category_id WHERE ${w}`, params),
  ]);
  res.json({ items: list.rows.map(card), total: count.rows[0].n, page, pages: Math.max(1, Math.ceil(count.rows[0].n / limit)) });
});

router.get('/listings/:id', optionalAuth, async (req, res) => {
  const id = parseInt(req.params.id) || 0;
  const { rows } = await query(`${LISTING_SELECT} WHERE l.id = $1`, [id]);
  const l = rows[0];
  const isOwner = req.user && l && req.user.id === l.seller_id;
  if (!l || (!PUBLIC_STATUSES.includes(l.status) && !isOwner && req.user?.role !== 'admin')) {
    return bad(res, 'الإعلان غير موجود أو لم يُنشر بعد', 404);
  }
  if (!isOwner) await query('UPDATE listings SET views = views + 1 WHERE id = $1', [id]);

  const [seller, similar, myOrder] = await Promise.all([
    sellerStats(l.seller_id),
    query(
      `${LISTING_SELECT} WHERE l.status = 'active' AND l.id <> $1 AND (l.category_id = $2 OR l.size = $3)
       ORDER BY (l.boosted_until > now()) DESC NULLS LAST, random() LIMIT 8`,
      [id, l.category_id, l.size]
    ),
    req.user
      ? query(`SELECT id, status FROM market_orders WHERE listing_id = $1 AND buyer_id = $2 ORDER BY id DESC LIMIT 1`, [id, req.user.id])
      : { rows: [] },
  ]);
  res.json({
    ...l,
    is_owner: !!isOwner,
    seller,
    similar: similar.rows.map(card),
    my_order: myOrder.rows[0] || null,
  });
});

router.get('/sellers/:id', async (req, res) => {
  const seller = await sellerStats(parseInt(req.params.id) || 0);
  if (!seller) return bad(res, 'البائعة غير موجودة', 404);
  const [listings, reviews] = await Promise.all([
    query(`${LISTING_SELECT} WHERE l.seller_id = $1 AND l.status IN ('active', 'reserved', 'sold')
           ORDER BY (l.status = 'sold'), l.created_at DESC LIMIT 60`, [seller.id]),
    query(`SELECT o.rating, o.review, o.updated_at, o.title, split_part(o.buyer_name, ' ', 1) AS buyer
           FROM market_orders o WHERE o.seller_id = $1 AND o.rating IS NOT NULL ORDER BY o.updated_at DESC LIMIT 20`, [seller.id]),
  ]);
  res.json({ seller, listings: listings.rows.map(card), reviews: reviews.rows });
});

/* ---------------- Seller: create / edit ---------------- */
async function cleanListing(body) {
  const s = await getSettings();
  const out = {
    title: String(body.title || '').trim().slice(0, 120),
    description: String(body.description || '').trim().slice(0, 2000) || null,
    size: String(body.size || '').trim(),
    condition: body.condition,
    brand: String(body.brand || '').trim().slice(0, 60) || null,
    color: String(body.color || '').trim().slice(0, 40) || null,
    price: Number(body.price),
    original_price: body.original_price ? Number(body.original_price) : null,
    category_id: body.category_id ? parseInt(body.category_id) : null,
    city: String(body.city || '').trim(),
    images: (Array.isArray(body.images) ? body.images : []).map(String).filter((u) => /^(\/uploads\/|https?:\/\/)/.test(u)).slice(0, 8),
  };
  if (out.title.length < 3) return 'اكتبي عنواناً واضحاً للفستان';
  if (!out.size) return 'اختاري المقاس';
  if (!CONDITIONS.includes(out.condition)) return 'اختاري حالة الفستان';
  if (!(out.price > 0)) return 'أدخلي سعراً صحيحاً';
  if (out.original_price && out.original_price < out.price) out.original_price = null;
  if (!out.city || (s.cities?.length && !s.cities.includes(out.city))) return 'اختاري المحافظة';
  if (out.images.length < 2) return 'أضيفي صورتين على الأقل للفستان';
  if (!body.agree) return 'يجب الموافقة على شروط البيع';
  return out;
}

async function ensurePhone(userId, phone) {
  const { rows } = await query('SELECT phone FROM users WHERE id = $1', [userId]);
  const clean = String(phone || '').replace(/[^\d+]/g, '');
  if (clean.length >= 10) {
    await query('UPDATE users SET phone = $1 WHERE id = $2', [clean, userId]);
    return clean;
  }
  return rows[0]?.phone || null;
}

router.post('/listings', requireAuth, async (req, res) => {
  const s = await marketOn(res);
  if (!s) return;
  const limit = Number(s.commission_limit) || 0;
  if (limit > 0) {
    const due = await commissionDue(req.user.id);
    if (due >= limit) {
      return bad(res, `عليچ عمولات مستحقة بقيمة ${due.toLocaleString('en-US')} د.ع. سدّديها من مركز البائعة لتتمكني من نشر إعلانات جديدة.`, 402);
    }
  }
  const l = await cleanListing(req.body || {});
  if (typeof l === 'string') return bad(res, l);
  if (!(await ensurePhone(req.user.id, req.body.phone))) return bad(res, 'أدخلي رقم هاتفك ليتواصل معك المشترون');

  const status = s.market_auto_approve ? 'active' : 'pending';
  const keys = Object.keys(l);
  const { rows } = await query(
    `INSERT INTO listings (seller_id, status, ${keys.join(', ')})
     VALUES ($1, $2, ${keys.map((_, i) => `$${i + 3}`).join(', ')}) RETURNING *`,
    [req.user.id, status, ...keys.map((k) => l[k])]
  );
  res.status(201).json(rows[0]);
});

async function ownListing(req, res) {
  const { rows } = await query('SELECT * FROM listings WHERE id = $1', [parseInt(req.params.id) || 0]);
  if (!rows[0]) return bad(res, 'الإعلان غير موجود', 404), null;
  if (rows[0].seller_id !== req.user.id) return bad(res, 'هذا الإعلان ليس لكِ', 403), null;
  return rows[0];
}

router.put('/listings/:id', requireAuth, async (req, res) => {
  const s = await marketOn(res);
  if (!s) return;
  const current = await ownListing(req, res);
  if (!current) return;
  if (['reserved', 'sold'].includes(current.status)) return bad(res, 'لا يمكن تعديل إعلان محجوز أو مباع');
  const l = await cleanListing(req.body || {});
  if (typeof l === 'string') return bad(res, l);
  await ensurePhone(req.user.id, req.body.phone);

  // Edited listings go back to review unless auto-approve is on (hidden ones stay hidden)
  const status = current.status === 'hidden' ? 'hidden' : s.market_auto_approve ? 'active' : 'pending';
  const keys = Object.keys(l);
  const { rows } = await query(
    `UPDATE listings SET ${keys.map((k, i) => `${k} = $${i + 1}`).join(', ')}, status = $${keys.length + 1},
       reject_reason = NULL, updated_at = now() WHERE id = $${keys.length + 2} RETURNING *`,
    [...keys.map((k) => l[k]), status, current.id]
  );
  res.json(rows[0]);
});

// Seller quick actions: hide / show / mark sold (sold outside the site)
router.post('/listings/:id/status', requireAuth, async (req, res) => {
  const l = await ownListing(req, res);
  if (!l) return;
  const { action } = req.body || {};
  const s = await getSettings();
  const next = {
    hide: ['active', 'pending'].includes(l.status) && 'hidden',
    show: l.status === 'hidden' && (s.market_auto_approve ? 'active' : 'pending'),
    sold: ['active', 'hidden'].includes(l.status) && 'sold',
  }[action];
  if (!next) return bad(res, 'لا يمكن تنفيذ هذا الإجراء على حالة الإعلان الحالية');
  const { rows } = await query(
    `UPDATE listings SET status = $1, sold_at = CASE WHEN $1 = 'sold' THEN now() ELSE sold_at END, updated_at = now()
     WHERE id = $2 RETURNING *`,
    [next, l.id]
  );
  res.json(rows[0]);
});

router.delete('/listings/:id', requireAuth, async (req, res) => {
  const l = await ownListing(req, res);
  if (!l) return;
  if (l.status === 'reserved') return bad(res, 'الإعلان محجوز لطلب قائم. ألغي الطلب أولاً.');
  await query('DELETE FROM listings WHERE id = $1', [l.id]);
  res.json({ ok: true });
});

/* ---------------- My area ---------------- */
router.get('/my/listings', requireAuth, async (req, res) => {
  const { rows } = await query(
    `${LISTING_SELECT.replace('SELECT l.*,', `SELECT l.*,
       (SELECT count(*)::int FROM market_orders o WHERE o.listing_id = l.id AND o.status = 'pending') AS pending_orders,
       (SELECT row_to_json(p) FROM promotions p WHERE p.listing_id = l.id ORDER BY p.id DESC LIMIT 1) AS last_promotion,`)}
     WHERE l.seller_id = $1 ORDER BY l.created_at DESC`,
    [req.user.id]
  );
  res.json(rows);
});

router.get('/my/summary', requireAuth, async (req, res) => {
  const { rows } = await query(
    `SELECT
      (SELECT count(*)::int FROM listings WHERE seller_id = $1) AS listings,
      (SELECT count(*)::int FROM listings WHERE seller_id = $1 AND status = 'active') AS active,
      (SELECT count(*)::int FROM market_orders WHERE seller_id = $1 AND status = 'pending') AS incoming,
      (SELECT count(*)::int FROM market_orders WHERE buyer_id = $1 AND status IN ('pending', 'accepted')) AS purchases_open,
      (SELECT COALESCE(sum(price - commission), 0) FROM market_orders WHERE seller_id = $1 AND status = 'completed') AS earned,
      (SELECT COALESCE(sum(commission), 0) FROM market_orders
        WHERE seller_id = $1 AND status = 'completed' AND commission > 0 AND commission_status = 'unpaid') AS commission_due,
      (SELECT COALESCE(sum(commission), 0) FROM market_orders
        WHERE seller_id = $1 AND status = 'completed' AND commission_status = 'pending') AS commission_pending`,
    [req.user.id]
  );
  res.json(rows[0]);
});

const ORDER_WITH_PARTIES = `
  SELECT o.*, s.name AS seller_name, s.phone AS seller_phone, l.status AS listing_status
  FROM market_orders o
  LEFT JOIN users s ON s.id = o.seller_id
  LEFT JOIN listings l ON l.id = o.listing_id`;

router.get('/my/sales', requireAuth, async (req, res) => {
  const { rows } = await query(`${ORDER_WITH_PARTIES} WHERE o.seller_id = $1 ORDER BY o.created_at DESC LIMIT 100`, [req.user.id]);
  res.json(rows.map(({ seller_phone, ...o }) => o));
});

router.get('/my/purchases', requireAuth, async (req, res) => {
  const { rows } = await query(`${ORDER_WITH_PARTIES} WHERE o.buyer_id = $1 ORDER BY o.created_at DESC LIMIT 100`, [req.user.id]);
  // The seller's phone is shared only after she accepts the order
  res.json(rows.map((o) => ({ ...o, seller_phone: ['accepted', 'completed'].includes(o.status) ? o.seller_phone : null })));
});

/* ---------------- Buying ---------------- */
router.post('/listings/:id/order', requireAuth, async (req, res) => {
  const s = await marketOn(res);
  if (!s) return;
  const { buyer_name, buyer_phone, city, address, notes } = req.body || {};
  if (!buyer_name?.trim() || !buyer_phone?.trim() || !city?.trim() || !address?.trim()) {
    return bad(res, 'يرجى تعبئة الاسم ورقم الهاتف والمحافظة والعنوان');
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Atomically reserve: only one buyer can grab an active listing
    const { rows } = await client.query(
      `UPDATE listings SET status = 'reserved', updated_at = now()
       WHERE id = $1 AND status = 'active' AND seller_id <> $2 RETURNING *`,
      [parseInt(req.params.id) || 0, req.user.id]
    );
    const l = rows[0];
    if (!l) {
      await client.query('ROLLBACK');
      const { rows: chk } = await query('SELECT seller_id, status FROM listings WHERE id = $1', [req.params.id]);
      if (chk[0]?.seller_id === req.user.id) return bad(res, 'لا يمكنكِ شراء فستانك');
      return bad(res, 'عذراً، هذا الفستان لم يعد متاحاً (محجوز أو مباع)', 409);
    }
    const commission = Math.round((l.price * (Number(s.market_commission) || 0)) / 100);
    const { rows: o } = await client.query(
      `INSERT INTO market_orders (listing_id, seller_id, buyer_id, title, image_url, price, commission,
         buyer_name, buyer_phone, city, address, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [l.id, l.seller_id, req.user.id, l.title, l.images[0] || null, l.price, commission,
       buyer_name.trim(), buyer_phone.trim(), city.trim(), address.trim(), notes?.trim() || null]
    );
    await client.query('COMMIT');
    res.status(201).json(o[0]);
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
});

// Order workflow. Seller: accept / reject / complete / cancel. Buyer: cancel.
router.post('/orders/:id/action', requireAuth, async (req, res) => {
  const { action, note } = req.body || {};
  const { rows } = await query('SELECT * FROM market_orders WHERE id = $1', [parseInt(req.params.id) || 0]);
  const o = rows[0];
  if (!o) return bad(res, 'الطلب غير موجود', 404);
  const isSeller = o.seller_id === req.user.id;
  const isBuyer = o.buyer_id === req.user.id;
  if (!isSeller && !isBuyer) return bad(res, 'غير مصرح', 403);

  const rules = {
    accept: isSeller && o.status === 'pending' && { order: 'accepted', listing: 'reserved' },
    reject: isSeller && o.status === 'pending' && { order: 'rejected', listing: 'active' },
    complete: isSeller && o.status === 'accepted' && { order: 'completed', listing: 'sold' },
    cancel: (isSeller || isBuyer) && ['pending', 'accepted'].includes(o.status) && { order: 'cancelled', listing: 'active' },
  };
  const t = rules[action];
  if (!t) return bad(res, 'لا يمكن تنفيذ هذا الإجراء الآن');

  const { rows: updated } = await query(
    `UPDATE market_orders SET status = $1, seller_note = COALESCE($2, seller_note), updated_at = now() WHERE id = $3 RETURNING *`,
    [t.order, isSeller && note ? String(note).slice(0, 500) : null, o.id]
  );
  if (o.listing_id) {
    await query(
      `UPDATE listings SET status = $1, sold_at = CASE WHEN $1 = 'sold' THEN now() ELSE sold_at END, updated_at = now()
       WHERE id = $2 AND status IN ('reserved', 'active')`,
      [t.listing, o.listing_id]
    );
  }
  res.json(updated[0]);
});

router.post('/orders/:id/review', requireAuth, async (req, res) => {
  const rating = parseInt(req.body?.rating);
  if (!(rating >= 1 && rating <= 5)) return bad(res, 'اختاري تقييماً من 1 إلى 5');
  const { rows } = await query(
    `UPDATE market_orders SET rating = $1, review = $2, updated_at = now()
     WHERE id = $3 AND buyer_id = $4 AND status = 'completed' AND rating IS NULL RETURNING *`,
    [rating, String(req.body.review || '').trim().slice(0, 500) || null, req.params.id, req.user.id]
  );
  if (!rows[0]) return bad(res, 'يمكن التقييم مرة واحدة بعد اكتمال الطلب');
  res.json(rows[0]);
});

/* ---------------- Paid boosts ---------------- */
router.post('/listings/:id/promote', requireAuth, async (req, res) => {
  const s = await marketOn(res);
  if (!s) return;
  const l = await ownListing(req, res);
  if (!l) return;
  if (!['active', 'pending'].includes(l.status)) return bad(res, 'يمكن ترويج الإعلانات النشطة فقط');
  const plan = (s.boost_plans || []).find((p) => Number(p.days) === Number(req.body?.days));
  if (!plan) return bad(res, 'اختاري باقة الترويج');
  const method = (s.payment_methods || []).find((m) => m.name === req.body?.payment_method);
  if (!method) return bad(res, 'اختاري طريقة الدفع');
  const ref = String(req.body.payment_ref || '').trim().slice(0, 80);
  const receipt = /^\/uploads\//.test(req.body.receipt_url || '') ? req.body.receipt_url : null;
  if (!ref && !receipt) return bad(res, 'أدخلي رقم العملية أو ارفعي صورة الإيصال');

  const { rows: open } = await query(`SELECT 1 FROM promotions WHERE listing_id = $1 AND status = 'pending'`, [l.id]);
  if (open.length) return bad(res, 'لديكِ طلب ترويج قيد المراجعة لهذا الإعلان');

  const { rows } = await query(
    `INSERT INTO promotions (listing_id, user_id, days, amount, payment_method, payment_ref, receipt_url)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [l.id, req.user.id, plan.days, plan.price, method.name, ref || null, receipt]
  );
  res.status(201).json(rows[0]);
});

/* ---------------- Commission: sellers pay the site's cut of completed sales ---------------- */
async function commissionDue(sellerId) {
  const { rows } = await query(
    `SELECT COALESCE(sum(commission), 0) AS due FROM market_orders
     WHERE seller_id = $1 AND status = 'completed' AND commission > 0 AND commission_status = 'unpaid'`,
    [sellerId]
  );
  return Number(rows[0].due);
}

router.get('/my/commissions', requireAuth, async (req, res) => {
  const [orders, payments] = await Promise.all([
    query(
      `SELECT id, title, image_url, price, commission, commission_status, updated_at FROM market_orders
       WHERE seller_id = $1 AND status = 'completed' AND commission > 0 ORDER BY updated_at DESC LIMIT 100`,
      [req.user.id]
    ),
    query('SELECT * FROM commission_payments WHERE seller_id = $1 ORDER BY created_at DESC LIMIT 50', [req.user.id]),
  ]);
  const due = orders.rows.filter((o) => o.commission_status === 'unpaid').reduce((s, o) => s + Number(o.commission), 0);
  res.json({ due, orders: orders.rows, payments: payments.rows });
});

router.post('/commissions/pay', requireAuth, async (req, res) => {
  const s = await getSettings();
  const method = (s.payment_methods || []).find((m) => m.name === req.body?.payment_method);
  if (!method) return bad(res, 'اختاري طريقة الدفع');
  const ref = String(req.body.payment_ref || '').trim().slice(0, 80) || null;
  const receipt = /^\/uploads\//.test(req.body.receipt_url || '') ? req.body.receipt_url : null;
  if (!ref && !receipt) return bad(res, 'أدخلي رقم العملية أو ارفعي صورة الإيصال');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Bundle every unpaid commission of this seller into one payment for the admin to confirm
    const { rows } = await client.query(
      `UPDATE market_orders SET commission_status = 'pending'
       WHERE seller_id = $1 AND status = 'completed' AND commission > 0 AND commission_status = 'unpaid'
       RETURNING id, commission`,
      [req.user.id]
    );
    if (!rows.length) {
      await client.query('ROLLBACK');
      return bad(res, 'لا توجد عمولات مستحقة عليچ');
    }
    const amount = rows.reduce((sum, r) => sum + Number(r.commission), 0);
    const { rows: p } = await client.query(
      `INSERT INTO commission_payments (seller_id, amount, order_ids, payment_method, payment_ref, receipt_url)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [req.user.id, amount, rows.map((r) => r.id), method.name, ref, receipt]
    );
    await client.query('COMMIT');
    res.status(201).json(p[0]);
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
});

/* ---------------- Reports ---------------- */
router.post('/listings/:id/report', optionalAuth, async (req, res) => {
  const reason = String(req.body?.reason || '').trim();
  if (!reason) return bad(res, 'اختاري سبب البلاغ');
  const { rowCount } = await query(
    `INSERT INTO listing_reports (listing_id, user_id, reason, details)
     SELECT id, $2, $3, $4 FROM listings WHERE id = $1`,
    [parseInt(req.params.id) || 0, req.user?.id || null, reason.slice(0, 80), String(req.body.details || '').slice(0, 500) || null]
  );
  if (!rowCount) return bad(res, 'الإعلان غير موجود', 404);
  res.status(201).json({ ok: true });
});

export default router;

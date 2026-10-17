// Admin moderation for the used-dress marketplace
import { Router } from 'express';
import { query } from '../db.js';
import { requireAdmin } from '../middleware/auth.js';

const router = Router();
router.use(requireAdmin);
const bad = (res, msg, status = 400) => res.status(status).json({ error: msg });

const LISTING_STATUSES = ['pending', 'active', 'reserved', 'sold', 'rejected', 'hidden'];

router.get('/stats', async (_req, res) => {
  const { rows } = await query(`SELECT
    (SELECT count(*)::int FROM listings WHERE status = 'pending') AS pending_listings,
    (SELECT count(*)::int FROM listings WHERE status = 'active') AS active_listings,
    (SELECT count(*)::int FROM listings WHERE boosted_until > now()) AS boosted_now,
    (SELECT count(*)::int FROM promotions WHERE status = 'pending') AS pending_promotions,
    (SELECT COALESCE(sum(amount), 0) FROM promotions WHERE status = 'active') AS ads_revenue,
    (SELECT count(*)::int FROM market_orders WHERE status IN ('pending', 'accepted')) AS open_orders,
    (SELECT count(*)::int FROM market_orders WHERE status = 'completed') AS completed_orders,
    (SELECT COALESCE(sum(price), 0) FROM market_orders WHERE status = 'completed') AS gmv,
    (SELECT COALESCE(sum(commission), 0) FROM market_orders WHERE status = 'completed') AS commission,
    (SELECT COALESCE(sum(commission), 0) FROM market_orders WHERE status = 'completed' AND commission_status = 'paid') AS commission_collected,
    (SELECT COALESCE(sum(commission), 0) FROM market_orders WHERE status = 'completed' AND commission > 0 AND commission_status = 'unpaid') AS commission_due,
    (SELECT count(*)::int FROM commission_payments WHERE status = 'pending') AS pending_commissions,
    (SELECT count(*)::int FROM listing_reports WHERE status = 'open') AS open_reports`);
  res.json(rows[0]);
});

/* ---------- Listings ---------- */
router.get('/listings', async (req, res) => {
  const { status, q } = req.query;
  const limit = 30;
  const page = Math.max(parseInt(req.query.page) || 1, 1);
  const where = ['true'];
  const params = [];
  if (LISTING_STATUSES.includes(status)) {
    params.push(status);
    where.push(`l.status = $${params.length}`);
  } else if (status === 'boosted') {
    where.push('l.boosted_until > now()');
  }
  if (q) {
    params.push(`%${q}%`);
    where.push(`(l.title ILIKE $${params.length} OR u.name ILIKE $${params.length} OR u.phone ILIKE $${params.length} OR l.id::text = $${params.length + 1})`);
    params.push(String(q).replace('#', ''));
  }
  const w = where.join(' AND ');
  const [list, count, counts] = await Promise.all([
    query(
      `SELECT l.*, u.name AS seller_name, u.phone AS seller_phone, u.email AS seller_email, c.name AS category_name,
         (l.boosted_until > now()) AS is_boosted,
         (SELECT count(*)::int FROM listing_reports r WHERE r.listing_id = l.id AND r.status = 'open') AS reports
       FROM listings l JOIN users u ON u.id = l.seller_id LEFT JOIN categories c ON c.id = l.category_id
       WHERE ${w} ORDER BY (l.status = 'pending') DESC, l.created_at DESC LIMIT ${limit} OFFSET ${(page - 1) * limit}`,
      params
    ),
    query(`SELECT count(*)::int AS n FROM listings l JOIN users u ON u.id = l.seller_id WHERE ${w}`, params),
    query(`SELECT status, count(*)::int AS n FROM listings GROUP BY status`),
  ]);
  res.json({
    items: list.rows, total: count.rows[0].n, page, pages: Math.max(1, Math.ceil(count.rows[0].n / limit)),
    counts: Object.fromEntries(counts.rows.map((r) => [r.status, r.n])),
  });
});

// Approve / reject / hide / restore / grant a free boost
router.patch('/listings/:id', async (req, res) => {
  const { action, reason, days } = req.body || {};
  const id = parseInt(req.params.id) || 0;
  let sql;
  let params;
  switch (action) {
    case 'approve':
    case 'restore':
      sql = `UPDATE listings SET status = 'active', reject_reason = NULL, updated_at = now() WHERE id = $1 AND status IN ('pending', 'rejected', 'hidden') RETURNING *`;
      params = [id];
      break;
    case 'reject':
      if (!reason?.trim()) return bad(res, 'اكتبي سبب الرفض ليظهر للبائعة');
      sql = `UPDATE listings SET status = 'rejected', reject_reason = $2, updated_at = now() WHERE id = $1 AND status IN ('pending', 'active', 'hidden') RETURNING *`;
      params = [id, reason.trim().slice(0, 300)];
      break;
    case 'hide':
      sql = `UPDATE listings SET status = 'hidden', updated_at = now() WHERE id = $1 AND status IN ('active', 'pending') RETURNING *`;
      params = [id];
      break;
    case 'boost': {
      const d = Math.min(Math.max(parseInt(days) || 0, 1), 90);
      sql = `UPDATE listings SET boosted_until = GREATEST(COALESCE(boosted_until, now()), now()) + make_interval(days => $2)
             WHERE id = $1 RETURNING *`;
      params = [id, d];
      break;
    }
    case 'unboost':
      sql = `UPDATE listings SET boosted_until = NULL WHERE id = $1 RETURNING *`;
      params = [id];
      break;
    default:
      return bad(res, 'إجراء غير معروف');
  }
  const { rows } = await query(sql, params);
  if (!rows[0]) return bad(res, 'لا يمكن تنفيذ الإجراء على حالة الإعلان الحالية');
  res.json(rows[0]);
});

router.delete('/listings/:id', async (req, res) => {
  const { rowCount } = await query('DELETE FROM listings WHERE id = $1', [req.params.id]);
  if (!rowCount) return bad(res, 'الإعلان غير موجود', 404);
  res.json({ ok: true });
});

/* ---------- Orders between customers ---------- */
router.get('/orders', async (req, res) => {
  const { status } = req.query;
  const params = [];
  let where = 'true';
  if (['pending', 'accepted', 'rejected', 'completed', 'cancelled'].includes(status)) {
    params.push(status);
    where = 'o.status = $1';
  }
  const { rows } = await query(
    `SELECT o.*, s.name AS seller_name, s.phone AS seller_phone
     FROM market_orders o LEFT JOIN users s ON s.id = o.seller_id
     WHERE ${where} ORDER BY o.created_at DESC LIMIT 200`,
    params
  );
  res.json(rows);
});

/* ---------- Paid boosts ---------- */
router.get('/promotions', async (req, res) => {
  const { status } = req.query;
  const params = [];
  let where = 'true';
  if (['pending', 'active', 'rejected'].includes(status)) {
    params.push(status);
    where = 'p.status = $1';
  }
  const { rows } = await query(
    `SELECT p.*, l.title, l.images[1] AS image_url, l.status AS listing_status, l.boosted_until,
       u.name AS user_name, u.phone AS user_phone
     FROM promotions p JOIN listings l ON l.id = p.listing_id LEFT JOIN users u ON u.id = p.user_id
     WHERE ${where} ORDER BY (p.status = 'pending') DESC, p.created_at DESC LIMIT 200`,
    params
  );
  res.json(rows);
});

router.post('/promotions/:id', async (req, res) => {
  const { action, note } = req.body || {};
  const { rows } = await query(
    `SELECT p.*, l.boosted_until FROM promotions p JOIN listings l ON l.id = p.listing_id WHERE p.id = $1`,
    [parseInt(req.params.id) || 0]
  );
  const p = rows[0];
  if (!p) return bad(res, 'الطلب غير موجود', 404);
  if (p.status !== 'pending') return bad(res, 'تمت مراجعة هذا الطلب مسبقاً');

  if (action === 'approve') {
    // A new boost starts when any current boost ends
    const { rows: up } = await query(
      `UPDATE promotions SET status = 'active', admin_note = $2,
         starts_at = GREATEST(now(), COALESCE($3::timestamptz, now())),
         ends_at = GREATEST(now(), COALESCE($3::timestamptz, now())) + make_interval(days => days)
       WHERE id = $1 RETURNING *`,
      [p.id, note || null, p.boosted_until]
    );
    await query('UPDATE listings SET boosted_until = $1 WHERE id = $2', [up[0].ends_at, p.listing_id]);
    return res.json(up[0]);
  }
  if (action === 'reject') {
    if (!note?.trim()) return bad(res, 'اكتبي سبب الرفض (مثلاً: لم يصل المبلغ)');
    const { rows: up } = await query(
      `UPDATE promotions SET status = 'rejected', admin_note = $2 WHERE id = $1 RETURNING *`,
      [p.id, note.trim()]
    );
    return res.json(up[0]);
  }
  bad(res, 'إجراء غير معروف');
});

/* ---------- Commission payments ---------- */
router.get('/commissions', async (req, res) => {
  const { status } = req.query;
  const params = [];
  let where = 'true';
  if (['pending', 'approved', 'rejected'].includes(status)) {
    params.push(status);
    where = 'p.status = $1';
  }
  const [payments, debtors] = await Promise.all([
    query(
      `SELECT p.*, u.name AS seller_name, u.phone AS seller_phone
       FROM commission_payments p LEFT JOIN users u ON u.id = p.seller_id
       WHERE ${where} ORDER BY (p.status = 'pending') DESC, p.created_at DESC LIMIT 200`,
      params
    ),
    // Sellers who still owe commission and haven't sent a payment
    query(
      `SELECT u.id, u.name, u.phone, sum(o.commission) AS due, count(*)::int AS orders
       FROM market_orders o JOIN users u ON u.id = o.seller_id
       WHERE o.status = 'completed' AND o.commission > 0 AND o.commission_status = 'unpaid'
       GROUP BY u.id ORDER BY due DESC LIMIT 100`
    ),
  ]);
  res.json({ payments: payments.rows, debtors: debtors.rows });
});

router.post('/commissions/:id', async (req, res) => {
  const { action, note } = req.body || {};
  const { rows } = await query('SELECT * FROM commission_payments WHERE id = $1', [parseInt(req.params.id) || 0]);
  const p = rows[0];
  if (!p) return bad(res, 'الدفعة غير موجودة', 404);
  if (p.status !== 'pending') return bad(res, 'تمت مراجعة هذه الدفعة مسبقاً');
  if (action === 'reject' && !note?.trim()) return bad(res, 'اكتبي سبب الرفض (مثلاً: لم يصل المبلغ)');
  if (!['approve', 'reject'].includes(action)) return bad(res, 'إجراء غير معروف');

  const approved = action === 'approve';
  // Approved: the orders' commission is paid. Rejected: back to unpaid so the seller can pay again
  await query(
    `UPDATE market_orders SET commission_status = $1 WHERE id = ANY($2) AND commission_status = 'pending'`,
    [approved ? 'paid' : 'unpaid', p.order_ids]
  );
  const { rows: up } = await query(
    `UPDATE commission_payments SET status = $1, admin_note = $2 WHERE id = $3 RETURNING *`,
    [approved ? 'approved' : 'rejected', note?.trim() || null, p.id]
  );
  res.json(up[0]);
});

/* ---------- Reports ---------- */
router.get('/reports', async (_req, res) => {
  const { rows } = await query(
    `SELECT r.*, l.title, l.images[1] AS image_url, l.status AS listing_status, u.name AS reporter
     FROM listing_reports r JOIN listings l ON l.id = r.listing_id LEFT JOIN users u ON u.id = r.user_id
     ORDER BY (r.status = 'open') DESC, r.created_at DESC LIMIT 200`
  );
  res.json(rows);
});

router.patch('/reports/:id', async (req, res) => {
  const { rows } = await query(`UPDATE listing_reports SET status = 'resolved' WHERE id = $1 RETURNING *`, [req.params.id]);
  if (!rows[0]) return bad(res, 'البلاغ غير موجود', 404);
  res.json(rows[0]);
});

export default router;

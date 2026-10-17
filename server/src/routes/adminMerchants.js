// Admin review of shop applications
import { Router } from 'express';
import { query } from '../db.js';
import { requireAdmin } from '../middleware/auth.js';

const router = Router();
router.use(requireAdmin);
const bad = (res, msg, status = 400) => res.status(status).json({ error: msg });

router.get('/', async (req, res) => {
  const { status, q } = req.query;
  const params = [];
  const where = ['true'];
  if (['pending', 'approved', 'rejected', 'suspended'].includes(status)) {
    params.push(status);
    where.push(`m.status = $${params.length}`);
  }
  if (q) {
    params.push(`%${q}%`);
    where.push(`(m.shop_name ILIKE $${params.length} OR m.phone ILIKE $${params.length} OR u.email ILIKE $${params.length})`);
  }
  const [list, counts] = await Promise.all([
    query(
      `SELECT m.*, u.name AS owner_name, u.email AS owner_email,
         (SELECT count(*)::int FROM listings l WHERE l.merchant_id = m.id AND l.status = 'active') AS active_listings,
         (SELECT count(*)::int FROM market_orders o WHERE o.seller_id = m.user_id AND o.status = 'completed') AS sold
       FROM merchants m JOIN users u ON u.id = m.user_id
       WHERE ${where.join(' AND ')} ORDER BY (m.status = 'pending') DESC, m.created_at DESC LIMIT 200`,
      params
    ),
    query('SELECT status, count(*)::int AS n FROM merchants GROUP BY status'),
  ]);
  res.json({ items: list.rows, counts: Object.fromEntries(counts.rows.map((r) => [r.status, r.n])) });
});

router.patch('/:id', async (req, res) => {
  const { action, reason } = req.body || {};
  const id = parseInt(req.params.id) || 0;
  const rules = {
    approve: { from: ['pending', 'rejected'], to: 'approved' },
    reject: { from: ['pending'], to: 'rejected' },
    suspend: { from: ['approved'], to: 'suspended' },
    reactivate: { from: ['suspended'], to: 'approved' },
  };
  const r = rules[action];
  if (!r) return bad(res, 'إجراء غير معروف');
  if (['reject', 'suspend'].includes(action) && !reason?.trim()) return bad(res, 'اكتبي السبب ليظهر لصاحبة المحل');
  const { rows } = await query(
    `UPDATE merchants SET status = $1, reject_reason = $2,
       approved_at = CASE WHEN $1 = 'approved' AND approved_at IS NULL THEN now() ELSE approved_at END, updated_at = now()
     WHERE id = $3 AND status = ANY($4) RETURNING *`,
    [r.to, ['reject', 'suspend'].includes(action) ? reason.trim().slice(0, 300) : null, id, r.from]
  );
  if (!rows[0]) return bad(res, 'لا يمكن تنفيذ الإجراء على حالة المحل الحالية');
  res.json(rows[0]);
});

export default router;

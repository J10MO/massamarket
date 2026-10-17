import { Router } from 'express';
import { pool, query } from '../db.js';
import { optionalAuth, requireAuth } from '../middleware/auth.js';
import { getSettings } from '../lib/settings.js';

const router = Router();

router.post('/', optionalAuth, async (req, res) => {
  const { customer_name, phone, city, address, notes, items } = req.body || {};
  if (!customer_name?.trim() || !phone?.trim() || !city?.trim() || !address?.trim()) {
    return res.status(400).json({ error: 'يرجى تعبئة الاسم ورقم الهاتف والمحافظة والعنوان' });
  }
  if (!Array.isArray(items) || !items.length) return res.status(400).json({ error: 'السلة فارغة' });

  // Payment: cash on delivery, or a transfer to one of the store's e-payment accounts (confirmed by admin)
  const settings = await getSettings();
  let payment = { method: 'cod', status: 'cod', ref: null, receipt: null };
  const wanted = req.body.payment_method;
  if (wanted && wanted !== 'cod') {
    const m = settings.online_payment_enabled !== false && (settings.payment_methods || []).find((x) => x.name === wanted);
    if (!m) return res.status(400).json({ error: 'طريقة الدفع غير متاحة' });
    const ref = String(req.body.payment_ref || '').trim().slice(0, 80) || null;
    const receipt = /^\/uploads\//.test(req.body.payment_receipt || '') ? req.body.payment_receipt : null;
    if (!ref && !receipt) return res.status(400).json({ error: 'أدخلي رقم عملية التحويل أو ارفعي صورة الإيصال' });
    payment = { method: m.name, status: 'awaiting', ref, receipt };
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    let subtotal = 0;
    const lines = [];
    for (const item of items) {
      const qty = Math.max(1, Math.min(parseInt(item.quantity) || 1, 10));
      // Lock the row so concurrent orders can't oversell
      const { rows } = await client.query(
        'SELECT id, name, price, image_url, stock, sizes FROM products WHERE id = $1 AND is_active FOR UPDATE',
        [item.product_id]
      );
      const p = rows[0];
      if (!p) throw Object.assign(new Error('أحد المنتجات لم يعد متوفراً'), { status: 400 });
      if (p.stock < qty) throw Object.assign(new Error(`الكمية المتوفرة من "${p.name}" هي ${p.stock} فقط`), { status: 400 });
      if (item.size && !p.sizes.includes(item.size)) throw Object.assign(new Error('المقاس غير متوفر'), { status: 400 });
      subtotal += p.price * qty;
      lines.push({ p, qty, size: item.size || null });
    }

    const { shipping_fee: fee, free_shipping_over: freeOver } = settings;
    const shipping = freeOver && subtotal >= Number(freeOver) ? 0 : Number(fee) || 0;
    subtotal = Math.round(subtotal * 100) / 100;

    const { rows } = await client.query(
      `INSERT INTO orders (user_id, customer_name, phone, city, address, notes, subtotal, shipping, total,
         payment_method, payment_status, payment_ref, payment_receipt)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
      [req.user?.id || null, customer_name.trim(), phone.trim(), city.trim(), address.trim(),
       notes?.trim() || null, subtotal, shipping, subtotal + shipping,
       payment.method, payment.status, payment.ref, payment.receipt]
    );
    const order = rows[0];
    for (const { p, qty, size } of lines) {
      await client.query(
        'INSERT INTO order_items (order_id, product_id, name, image_url, price, size, quantity) VALUES ($1,$2,$3,$4,$5,$6,$7)',
        [order.id, p.id, p.name, p.image_url, p.price, size, qty]
      );
      await client.query('UPDATE products SET stock = stock - $1, sold_count = sold_count + $1 WHERE id = $2', [qty, p.id]);
    }
    await client.query('COMMIT');
    res.status(201).json(order);
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.status) return res.status(err.status).json({ error: err.message });
    throw err;
  } finally {
    client.release();
  }
});

router.get('/mine', requireAuth, async (req, res) => {
  const { rows } = await query(
    `SELECT o.*, COALESCE(json_agg(oi ORDER BY oi.id) FILTER (WHERE oi.id IS NOT NULL), '[]') AS items
     FROM orders o LEFT JOIN order_items oi ON oi.order_id = o.id
     WHERE o.user_id = $1 GROUP BY o.id ORDER BY o.created_at DESC`,
    [req.user.id]
  );
  res.json(rows);
});

export default router;

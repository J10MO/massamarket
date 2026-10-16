import { Router } from 'express';
import { query } from '../db.js';
import { getSettings } from '../lib/settings.js';

const router = Router();

const PRODUCT_FIELDS = `p.id, p.name, p.price, p.old_price, p.image_url, p.badge, p.rating,
  p.sold_count, p.stock, p.colors, p.sizes, c.slug AS category_slug, c.name AS category_name`;

router.get('/settings', async (_req, res) => {
  res.json(await getSettings());
});

router.get('/categories', async (_req, res) => {
  const { rows } = await query(`
    SELECT c.id, c.slug, c.name, c.description, c.color,
      count(p.id)::int AS product_count,
      COALESCE(c.image_url, (SELECT image_url FROM products WHERE category_id = c.id AND is_active
        ORDER BY is_featured DESC, sold_count DESC LIMIT 1)) AS image_url
    FROM categories c
    LEFT JOIN products p ON p.category_id = c.id AND p.is_active
    GROUP BY c.id ORDER BY c.sort_order`);
  res.json(rows);
});

const SORTS = {
  newest: 'p.created_at DESC, p.id DESC',
  price_asc: 'p.price ASC',
  price_desc: 'p.price DESC',
  popular: 'p.sold_count DESC',
  rating: 'p.rating DESC, p.sold_count DESC',
};

router.get('/products', async (req, res) => {
  const { category, q, badge, featured, min, max, size } = req.query;
  const limit = Math.min(parseInt(req.query.limit) || 20, 60);
  const page = Math.max(parseInt(req.query.page) || 1, 1);

  const where = ['p.is_active'];
  const params = [];
  const add = (sql, val) => {
    params.push(val);
    where.push(sql.replaceAll('?', `$${params.length}`));
  };
  if (category && category !== 'all') add('c.slug = ?', category);
  if (q) add('(p.name ILIKE ? OR c.name ILIKE ?)', `%${q}%`);
  if (badge) add('p.badge = ?', badge);
  if (featured) where.push('p.is_featured');
  if (min) add('p.price >= ?', Number(min));
  if (max) add('p.price <= ?', Number(max));
  if (size) add('? = ANY(p.sizes)', size);

  const whereSql = where.join(' AND ');
  const order = SORTS[req.query.sort] || SORTS.newest;

  const [items, count] = await Promise.all([
    query(
      `SELECT ${PRODUCT_FIELDS} FROM products p JOIN categories c ON c.id = p.category_id
       WHERE ${whereSql} ORDER BY ${order} LIMIT ${limit} OFFSET ${(page - 1) * limit}`,
      params
    ),
    query(`SELECT count(*)::int AS n FROM products p JOIN categories c ON c.id = p.category_id WHERE ${whereSql}`, params),
  ]);
  const total = count.rows[0].n;
  res.json({ items: items.rows, total, page, pages: Math.ceil(total / limit) });
});

router.get('/products/:id', async (req, res) => {
  const id = parseInt(req.params.id);
  if (!id) return res.status(404).json({ error: 'المنتج غير موجود' });
  const { rows } = await query(
    `SELECT ${PRODUCT_FIELDS}, p.description, p.source_url, p.category_id, p.images
     FROM products p JOIN categories c ON c.id = p.category_id WHERE p.id = $1 AND p.is_active`,
    [id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'المنتج غير موجود' });
  const related = await query(
    `SELECT ${PRODUCT_FIELDS} FROM products p JOIN categories c ON c.id = p.category_id
     WHERE p.category_id = $1 AND p.id <> $2 AND p.is_active ORDER BY random() LIMIT 8`,
    [rows[0].category_id, id]
  );
  res.json({ ...rows[0], related: related.rows });
});

export default router;

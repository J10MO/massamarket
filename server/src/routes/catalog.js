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

// The "new dresses" catalog = the store's own products + new items from approved shops.
// (Used dresses, including ones a shop posts as used, live in the market instead.)
const CATALOG = `
  SELECT 'product' AS kind, p.id, p.name, p.price, p.old_price, p.image_url, p.badge, p.rating, p.sold_count,
    p.stock, p.colors, p.sizes, c.slug AS category_slug, c.name AS category_name, p.created_at,
    p.is_featured AS featured, false AS is_boosted, NULL::jsonb AS shop, NULL AS city, NULL AS size_label, 'active' AS status
  FROM products p JOIN categories c ON c.id = p.category_id
  WHERE p.is_active
  UNION ALL
  SELECT 'listing', l.id, l.title, l.price, l.original_price, l.images[1],
    CASE WHEN l.original_price IS NOT NULL THEN 'sale' END, NULL, 0,
    l.stock, '{}', l.sizes, c.slug, c.name, l.created_at,
    (l.boosted_until IS NOT NULL AND l.boosted_until > now()), (l.boosted_until IS NOT NULL AND l.boosted_until > now()),
    jsonb_build_object('name', m.shop_name, 'slug', m.slug, 'logo', m.logo_url), l.city, l.size, l.status
  FROM listings l
  JOIN merchants m ON m.id = l.merchant_id AND m.status = 'approved'
  LEFT JOIN categories c ON c.id = l.category_id
  WHERE l.status = 'active'`;

const SORTS = {
  newest: 'x.is_boosted DESC, x.created_at DESC, x.id DESC',
  price_asc: 'x.price ASC',
  price_desc: 'x.price DESC',
  popular: 'x.is_boosted DESC, x.sold_count DESC',
  rating: 'x.rating DESC NULLS LAST, x.sold_count DESC',
};

// Shop items use the market card shape so the client can render them with the shop badge
const toItem = (r) =>
  r.kind === 'product'
    ? r
    : {
        kind: 'listing', id: r.id, title: r.name, price: r.price, original_price: r.old_price, image_url: r.image_url,
        sizes: r.sizes, size: r.size_label, stock: r.stock, condition: 'new', city: r.city, status: r.status,
        is_boosted: r.is_boosted, category_name: r.category_name, shop: r.shop,
      };

router.get('/products', async (req, res) => {
  const { category, q, badge, featured, min, max, size } = req.query;
  const limit = Math.min(parseInt(req.query.limit) || 20, 60);
  const page = Math.max(parseInt(req.query.page) || 1, 1);

  const where = ['true'];
  const params = [];
  const add = (sql, val) => {
    params.push(val);
    where.push(sql.replaceAll('?', `$${params.length}`));
  };
  if (category && category !== 'all') add('x.category_slug = ?', category);
  if (q) add('(x.name ILIKE ? OR x.category_name ILIKE ?)', `%${q}%`);
  if (badge) add('x.badge = ?', badge);
  if (featured) where.push('x.featured');
  if (min) add('x.price >= ?', Number(min));
  if (max) add('x.price <= ?', Number(max));
  if (size) add('? = ANY(x.sizes)', size);
  if (req.query.source === 'store') where.push("x.kind = 'product'");

  const whereSql = where.join(' AND ');
  const order = SORTS[req.query.sort] || SORTS.newest;

  const [items, count] = await Promise.all([
    query(
      `SELECT * FROM (${CATALOG}) x WHERE ${whereSql}
       ORDER BY ${order}, x.kind, x.id DESC LIMIT ${limit} OFFSET ${(page - 1) * limit}`,
      params
    ),
    query(`SELECT count(*)::int AS n FROM (${CATALOG}) x WHERE ${whereSql}`, params),
  ]);
  const total = count.rows[0].n;
  res.json({ items: items.rows.map(toItem), total, page, pages: Math.ceil(total / limit) });
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

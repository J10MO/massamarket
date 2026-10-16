import { query } from '../db.js';
import { fetchBoard, fetchPin, imageKey, isPinUrl } from './pinterest.js';
import { generateProduct } from './catalog.js';

async function insertPins(category, pins) {
  let added = 0;
  for (const pin of pins) {
    const key = imageKey(pin.image);
    const p = generateProduct(category.slug, key);
    const { rowCount } = await query(
      `INSERT INTO products
        (category_id, name, description, price, old_price, image_url, image_key, source_url,
         sizes, colors, stock, badge, is_featured, rating, sold_count)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
       ON CONFLICT (image_key) DO NOTHING`,
      [category.id, p.name, p.description, p.price, p.old_price, pin.image, key, pin.pinUrl,
       p.sizes, p.colors, p.stock, p.badge, p.is_featured, p.rating, p.sold_count]
    );
    added += rowCount;
  }
  return added;
}

/** Import a Pinterest board or single pin URL into a category. Returns { found, added }. */
export async function importFromPinterest(url, category) {
  const pins = isPinUrl(url) ? [await fetchPin(url)] : await fetchBoard(url);
  const added = await insertPins(category, pins);
  return { found: pins.length, added };
}

/** Pull the latest pins from every category's configured boards. */
export async function importAllCategories(log = console.log) {
  const { rows: categories } = await query('SELECT * FROM categories ORDER BY sort_order');
  let total = 0;
  for (const cat of categories) {
    for (const board of cat.pinterest_boards) {
      try {
        const { found, added } = await importFromPinterest(board, cat);
        total += added;
        log(`  ${cat.slug} <- ${board}: ${found} pins, ${added} new`);
      } catch (err) {
        log(`  ${cat.slug} <- ${board}: failed (${err.message})`);
      }
    }
  }
  return total;
}

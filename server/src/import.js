// Pull the latest pins from all configured Pinterest boards: `npm run import`
import { pool } from './db.js';
import { importAllCategories } from './lib/importer.js';

const added = await importAllCategories();
console.log(`Imported ${added} new products.`);
await pool.end();

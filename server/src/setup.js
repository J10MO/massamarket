// One-time setup: creates the database, tables, categories, admin user, and imports dresses from Pinterest.
import 'dotenv/config';
import fs from 'node:fs';
import pg from 'pg';
import bcrypt from 'bcryptjs';

const url = new URL(process.env.DATABASE_URL);
const dbName = url.pathname.slice(1);

// 1. Create the database only if it doesn't exist (hosted DBs like Neon already provide it)
const probe = new pg.Client({ connectionString: url.toString() });
try {
  await probe.connect();
  await probe.end();
} catch (err) {
  if (err.code !== '3D000') throw err; // 3D000 = database does not exist
  const adminUrl = new URL(url);
  adminUrl.pathname = '/postgres';
  const admin = new pg.Client({ connectionString: adminUrl.toString() });
  await admin.connect();
  await admin.query(`CREATE DATABASE "${dbName.replace(/"/g, '')}"`);
  await admin.end();
  console.log(`Created database ${dbName}`);
}

// Imported after the database exists, since db.js opens a pool on it
const { query, pool } = await import('./db.js');
const { CATEGORIES } = await import('./lib/catalog.js');
const { importAllCategories } = await import('./lib/importer.js');

// 2. Tables
await query(fs.readFileSync(new URL('./schema.sql', import.meta.url), 'utf8'));
console.log('Schema ready');

// 3. Categories
for (const [i, c] of CATEGORIES.entries()) {
  await query(
    `INSERT INTO categories (slug, name, description, color, sort_order, pinterest_boards)
     VALUES ($1,$2,$3,$4,$5,$6)
     ON CONFLICT (slug) DO UPDATE SET name=$2, description=$3, color=$4, sort_order=$5, pinterest_boards=$6`,
    [c.slug, c.name, c.description, c.color, i, c.boards]
  );
}
console.log(`${CATEGORIES.length} categories ready`);

// 4. Admin user
const email = (process.env.ADMIN_EMAIL || 'admin@dressshop.com').toLowerCase();
const hash = await bcrypt.hash(process.env.ADMIN_PASSWORD || 'admin12345', 10);
await query(
  `INSERT INTO users (name, email, password_hash, role) VALUES ('المدير', $1, $2, 'admin')
   ON CONFLICT (email) DO UPDATE SET role = 'admin'`,
  [email, hash]
);
console.log(`Admin user: ${email}`);

// 5. Products from Pinterest
console.log('Importing dresses from Pinterest...');
const added = await importAllCategories();
const { rows } = await query('SELECT count(*)::int AS n FROM products');
console.log(`Done. ${added} new products, ${rows[0].n} total.`);
await pool.end();

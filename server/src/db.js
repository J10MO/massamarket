import 'dotenv/config';
import pg from 'pg';

// Return NUMERIC columns as JS numbers instead of strings
pg.types.setTypeParser(1700, (v) => (v === null ? null : parseFloat(v)));

export const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

export const query = (text, params) => pool.query(text, params);

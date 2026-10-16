import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { query } from '../db.js';
import { requireAuth, signToken } from '../middleware/auth.js';

const router = Router();

const publicUser = (u) => ({ id: u.id, name: u.name, email: u.email, phone: u.phone, role: u.role });

router.post('/register', async (req, res) => {
  const { name, email, phone, password } = req.body || {};
  if (!name?.trim() || !email?.trim() || !password) return res.status(400).json({ error: 'جميع الحقول مطلوبة' });
  if (password.length < 6) return res.status(400).json({ error: 'كلمة المرور 6 أحرف على الأقل' });

  const hash = await bcrypt.hash(password, 10);
  try {
    const { rows } = await query(
      'INSERT INTO users (name, email, phone, password_hash) VALUES ($1,$2,$3,$4) RETURNING *',
      [name.trim(), email.trim().toLowerCase(), phone?.trim() || null, hash]
    );
    res.status(201).json({ token: signToken(rows[0]), user: publicUser(rows[0]) });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'البريد الإلكتروني مسجل مسبقاً' });
    throw err;
  }
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body || {};
  const { rows } = await query('SELECT * FROM users WHERE email = $1', [String(email || '').trim().toLowerCase()]);
  const user = rows[0];
  if (!user || !(await bcrypt.compare(String(password || ''), user.password_hash))) {
    return res.status(401).json({ error: 'البريد أو كلمة المرور غير صحيحة' });
  }
  res.json({ token: signToken(user), user: publicUser(user) });
});

router.get('/me', requireAuth, async (req, res) => {
  const { rows } = await query('SELECT * FROM users WHERE id = $1', [req.user.id]);
  if (!rows[0]) return res.status(401).json({ error: 'يجب تسجيل الدخول' });
  res.json(publicUser(rows[0]));
});

router.post('/password', requireAuth, async (req, res) => {
  const { current, next } = req.body || {};
  if (!next || next.length < 6) return res.status(400).json({ error: 'كلمة المرور الجديدة 6 أحرف على الأقل' });
  const { rows } = await query('SELECT * FROM users WHERE id = $1', [req.user.id]);
  if (!rows[0] || !(await bcrypt.compare(String(current || ''), rows[0].password_hash))) {
    return res.status(400).json({ error: 'كلمة المرور الحالية غير صحيحة' });
  }
  await query('UPDATE users SET password_hash = $1 WHERE id = $2', [await bcrypt.hash(next, 10), req.user.id]);
  res.json({ ok: true });
});

export default router;

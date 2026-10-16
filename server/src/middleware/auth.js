import jwt from 'jsonwebtoken';

if (!process.env.JWT_SECRET && process.env.NODE_ENV === 'production') {
  throw new Error('JWT_SECRET is not set in server/.env');
}
const SECRET = () => process.env.JWT_SECRET || 'dev-secret';

export const signToken = (user) =>
  jwt.sign({ id: user.id, role: user.role, name: user.name }, SECRET(), { expiresIn: '30d' });

function readUser(req) {
  const token = req.headers.authorization?.replace(/^Bearer /, '');
  if (!token) return null;
  try {
    return jwt.verify(token, SECRET());
  } catch {
    return null;
  }
}

export function optionalAuth(req, _res, next) {
  req.user = readUser(req);
  next();
}

export function requireAuth(req, res, next) {
  req.user = readUser(req);
  if (!req.user) return res.status(401).json({ error: 'يجب تسجيل الدخول' });
  next();
}

export function requireAdmin(req, res, next) {
  req.user = readUser(req);
  if (req.user?.role !== 'admin') return res.status(403).json({ error: 'غير مصرح' });
  next();
}

import { useEffect, useState } from 'react';
import { NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { api } from '../api.js';
import { useStore } from '../store.jsx';
import Dashboard from './Dashboard.jsx';
import Orders from './Orders.jsx';
import Products from './Products.jsx';
import Categories from './Categories.jsx';
import Customers from './Customers.jsx';
import Pinterest from './Pinterest.jsx';
import Settings from './Settings.jsx';
import Market from './Market.jsx';
import './admin.css';

const NAV = [
  { to: '/admin', label: 'لوحة المعلومات', icon: '◧', end: true },
  { to: '/admin/orders', label: 'الطلبات', icon: '🧾', badge: 'pending' },
  { to: '/admin/products', label: 'الفساتين والمنتجات', icon: '👗' },
  { to: '/admin/categories', label: 'الأقسام', icon: '🗂' },
  { to: '/admin/market', label: 'سوق المستعمل', icon: '♻', badge: 'market' },
  { to: '/admin/customers', label: 'العملاء', icon: '👥' },
  { to: '/admin/pinterest', label: 'استيراد من Pinterest', icon: '📌' },
  { to: '/admin/settings', label: 'الإعدادات', icon: '⚙' },
];

function AdminLogin() {
  const { login, user, logout } = useStore();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const { token, user: u } = await api('/auth/login', { method: 'POST', body: form });
      if (u.role !== 'admin') throw new Error('هذا الحساب ليس لديه صلاحية الإدارة');
      login(token, u);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="a-login">
      <form className="a-login-card" onSubmit={submit}>
        <img src="/logo-badge.png" alt="" width="84" height="84" />
        <h1>لوحة تحكم جُمان</h1>
        <p>سجّلي الدخول بحساب المدير</p>
        {user && user.role !== 'admin' && (
          <p className="a-error">
            أنتِ مسجّلة بحساب عميلة ({user.email}). <button type="button" className="a-link" onClick={logout}>تسجيل الخروج</button>
          </p>
        )}
        <label>البريد الإلكتروني<input className="a-input" type="email" dir="ltr" required autoComplete="username"
          value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
        <label>كلمة المرور<input className="a-input" type="password" dir="ltr" required autoComplete="current-password"
          value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></label>
        {error && <p className="a-error">{error}</p>}
        <button className="a-btn primary lg" disabled={busy}>{busy ? '...' : 'دخول'}</button>
        <a href="/" className="a-link">← العودة للمتجر</a>
      </form>
    </div>
  );
}

export default function AdminApp() {
  const { user, authReady, logout, toast } = useStore();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(0);
  const [marketPending, setMarketPending] = useState(0);
  const { pathname } = useLocation();

  useEffect(() => {
    document.title = 'لوحة التحكم — Juman';
  }, []);
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (user?.role !== 'admin') return;
    const load = () => {
      api('/admin/orders?status=pending').then((d) => setPending(d.total)).catch(() => {});
      api('/admin/market/stats').then((d) => setMarketPending(d.pending_listings + d.pending_promotions)).catch(() => {});
    };
    load();
    const t = setInterval(load, 60000); // new orders badge
    return () => clearInterval(t);
  }, [user, pathname]);

  if (!authReady) return <div className="spinner" />;
  if (user?.role !== 'admin') return <AdminLogin />;

  return (
    <div className="a-app">
      <aside className={`a-side ${open ? 'open' : ''}`}>
        <div className="a-brand">
          <img src="/logo-badge.png" alt="" width="42" height="42" />
          <div><b>جُمان</b><small>لوحة التحكم</small></div>
        </div>
        <nav>
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end}>
              <span className="a-nav-icon" aria-hidden="true">{n.icon}</span>
              {n.label}
              {n.badge === 'pending' && pending > 0 && <span className="a-count">{pending}</span>}
              {n.badge === 'market' && marketPending > 0 && <span className="a-count">{marketPending}</span>}
            </NavLink>
          ))}
        </nav>
        <div className="a-side-foot">
          <a href="/" target="_blank" rel="noreferrer">🛍 عرض المتجر ↗</a>
          <div className="a-me">
            <span className="a-avatar">{user.name?.[0]}</span>
            <div><b>{user.name}</b><small>{user.email}</small></div>
          </div>
          <button className="a-btn ghost" onClick={logout}>تسجيل الخروج</button>
        </div>
      </aside>
      {open && <div className="a-side-bg" onClick={() => setOpen(false)} />}

      <div className="a-main">
        <header className="a-top">
          <button className="a-icon" onClick={() => setOpen(true)} aria-label="القائمة">☰</button>
          <img src="/logo-badge.png" alt="" width="32" height="32" />
          <b>لوحة تحكم جُمان</b>
          {pending > 0 && <NavLink to="/admin/orders" className="a-count">{pending} طلب جديد</NavLink>}
        </header>
        <main className="a-content">
          <Routes>
            <Route path="/admin" element={<Dashboard />} />
            <Route path="/admin/orders" element={<Orders />} />
            <Route path="/admin/products" element={<Products />} />
            <Route path="/admin/categories" element={<Categories />} />
            <Route path="/admin/market" element={<Market />} />
            <Route path="/admin/customers" element={<Customers />} />
            <Route path="/admin/pinterest" element={<Pinterest />} />
            <Route path="/admin/settings" element={<Settings />} />
            <Route path="*" element={<Dashboard />} />
          </Routes>
        </main>
      </div>
      {toast && <div key={toast.id} className="toast" role="status">{toast.msg}</div>}
    </div>
  );
}

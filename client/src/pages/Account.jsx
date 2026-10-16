import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, ORDER_STATUS, price } from '../api.js';
import { useStore } from '../store.jsx';
import { Img } from '../components/ProductCard.jsx';

function AuthForm() {
  const { login, notify } = useStore();
  const [params] = useSearchParams();
  const [mode, setMode] = useState(params.get('mode') === 'register' ? 'register' : 'login');
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const { token, user } = await api(`/auth/${mode}`, { method: 'POST', body: form });
      login(token, user);
      // Admins get the full dashboard in its own window
      if (user.role === 'admin' && !window.open('/admin', 'massa-admin')) notify('اسمحي بالنوافذ المنبثقة لفتح لوحة التحكم');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="container page-narrow form auth" onSubmit={submit}>
      <div className="seg">
        <button type="button" className={mode === 'login' ? 'on' : ''} onClick={() => setMode('login')}>تسجيل الدخول</button>
        <button type="button" className={mode === 'register' ? 'on' : ''} onClick={() => setMode('register')}>حساب جديد</button>
      </div>
      {mode === 'register' && (
        <label>الاسم<input required value={form.name} onChange={set('name')} autoComplete="name" /></label>
      )}
      <label>البريد الإلكتروني<input required type="email" dir="ltr" value={form.email} onChange={set('email')} autoComplete="email" /></label>
      {mode === 'register' && (
        <label>رقم الجوال<input type="tel" dir="ltr" inputMode="tel" value={form.phone} onChange={set('phone')} autoComplete="tel" /></label>
      )}
      <label>
        كلمة المرور
        <input required type="password" dir="ltr" minLength={6} value={form.password} onChange={set('password')}
          autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />
      </label>
      {error && <p className="alert">{error}</p>}
      <button className="btn btn-primary btn-lg btn-block" disabled={busy}>
        {busy ? '...' : mode === 'login' ? 'دخول' : 'إنشاء الحساب'}
      </button>
    </form>
  );
}

export default function Account() {
  const { user, logout } = useStore();
  const [orders, setOrders] = useState(null);

  useEffect(() => {
    if (user) api('/orders/mine').then(setOrders).catch(() => setOrders([]));
  }, [user]);

  if (!user) return <AuthForm />;

  return (
    <div className="container page-narrow">
      <div className="profile">
        <div className="avatar-lg">{user.name[0]}</div>
        <div>
          <h1 className="h1">أهلاً {user.name} 👋</h1>
          <p className="muted">{user.email}</p>
        </div>
      </div>
      {user.role === 'admin' && (
        <a href="/admin" target="massa-admin" className="btn btn-primary btn-block">فتح لوحة التحكم ↗</a>
      )}

      <h2 className="h2">طلباتي</h2>
      {orders === null && <div className="spinner" />}
      {orders?.length === 0 && <p className="muted">لا توجد طلبات بعد. <Link to="/shop">ابدئي التسوق</Link></p>}
      {orders?.map((o) => (
        <div key={o.id} className="order-card">
          <div className="order-head">
            <b>طلب #{o.id}</b>
            <span className={`status st-${o.status}`}>{ORDER_STATUS[o.status]}</span>
          </div>
          <div className="order-thumbs">
            {o.items.map((i) => <Img key={i.id} src={i.image_url} alt={i.name} />)}
          </div>
          <div className="order-head muted">
            <small>{new Date(o.created_at).toLocaleDateString('ar-SA')}</small>
            <b>{price(o.total)}</b>
          </div>
        </div>
      ))}
      <button className="btn btn-outline btn-block" onClick={logout}>تسجيل الخروج</button>
    </div>
  );
}

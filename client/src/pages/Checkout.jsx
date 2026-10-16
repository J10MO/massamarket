import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useStore } from '../store.jsx';
import { Summary } from './Cart.jsx';

export default function Checkout() {
  const { cart, cartTotal, clearCart, user, settings } = useStore();
  const navigate = useNavigate();
  const [form, setForm] = useState({ customer_name: user?.name || '', phone: user?.phone || '', city: '', address: '', notes: '' });
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);

  if (!cart.length) return <Navigate to="/cart" replace />;

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setSending(true);
    try {
      const order = await api('/orders', {
        method: 'POST',
        body: { ...form, items: cart.map((i) => ({ product_id: i.id, size: i.size, quantity: i.qty })) },
      });
      clearCart();
      navigate(`/order/${order.id}`, { replace: true, state: order });
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <form className="container page-narrow form" onSubmit={submit}>
      <h1 className="h1">إتمام الطلب</h1>
      <label>
        الاسم الكامل
        <input required value={form.customer_name} onChange={set('customer_name')} autoComplete="name" />
      </label>
      <label>
        رقم الهاتف (واتساب)
        <input required type="tel" inputMode="tel" dir="ltr" placeholder="07XX XXX XXXX" pattern="[0-9+ ]{10,15}" value={form.phone} onChange={set('phone')} autoComplete="tel" />
      </label>
      <label>
        المحافظة
        <select required value={form.city} onChange={set('city')}>
          <option value="">اختاري المحافظة</option>
          {(settings.cities || []).map((c) => <option key={c}>{c}</option>)}
        </select>
      </label>
      <label>
        العنوان بالتفصيل
        <textarea required rows="2" placeholder="المنطقة، أقرب نقطة دالة، رقم الدار" value={form.address} onChange={set('address')} autoComplete="street-address" />
      </label>
      <label>
        ملاحظات (اختياري)
        <textarea rows="2" value={form.notes} onChange={set('notes')} />
      </label>

      <div className="pay-method">
        <input type="radio" checked readOnly id="cod" />
        <label htmlFor="cod"><b>الدفع عند الاستلام</b><small className="muted">ادفعي نقداً عند وصول الطلب لباب البيت</small></label>
      </div>

      <Summary subtotal={cartTotal} />
      {error && <p className="alert">{error}</p>}
      <div className="checkout-bar">
        <button className="btn btn-primary btn-lg btn-block" disabled={sending}>
          {sending ? 'جارٍ إرسال الطلب...' : 'تأكيد الطلب'}
        </button>
      </div>
    </form>
  );
}

import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { api, price } from '../api.js';
import { useStore } from '../store.jsx';
import { CONDITIONS, PhotoPicker, SIZES } from './shared.jsx';

const EMPTY = { title: '', category_id: '', size: '', condition: '', brand: '', color: '', price: '', original_price: '', city: '', description: '', images: [], phone: '', agree: false };

export default function Sell() {
  const { id } = useParams();
  const { user, authReady, settings, notify } = useStore();
  const navigate = useNavigate();
  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState(id ? null : EMPTY);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api('/categories').then(setCategories).catch(() => {});
  }, []);
  useEffect(() => {
    if (!id || !user) return;
    api(`/market/listings/${id}`)
      .then((l) => {
        if (!l.is_owner) throw new Error('لا يمكنكِ تعديل هذا الإعلان');
        setForm({ ...EMPTY, ...l, original_price: l.original_price || '', brand: l.brand || '', color: l.color || '', description: l.description || '', category_id: l.category_id || '', agree: true });
      })
      .catch((e) => setError(e.message));
  }, [id, user]);
  useEffect(() => {
    if (user && !id) setForm((f) => (f && !f.city ? { ...f, phone: user.phone || '' } : f));
  }, [user, id]);

  if (!authReady) return <div className="spinner" />;
  if (!user) return <Navigate to={`/account?next=${id ? `/sell/${id}` : '/sell'}`} replace />;
  if (!form) return <div className="container page-narrow">{error ? <p className="alert">{error}</p> : <div className="spinner" />}</div>;

  const set = (k) => (e) => setForm({ ...form, [k]: e?.target ? (e.target.type === 'checkbox' ? e.target.checked : e.target.value) : e });
  const commissionPct = Number(settings.market_commission) || 0;
  const p = Number(form.price) || 0;
  const net = p - Math.round((p * commissionPct) / 100);
  const orig = Number(form.original_price) || 0;
  // A competitive used price is usually 30–60% of the original
  const suggest = orig ? [Math.round((orig * 0.3) / 1000) * 1000, Math.round((orig * 0.6) / 1000) * 1000] : null;

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const saved = await api(id ? `/market/listings/${id}` : '/market/listings', { method: id ? 'PUT' : 'POST', body: form });
      notify(saved.status === 'active' ? 'تم نشر إعلانچ 🎉' : 'تم إرسال الإعلان للمراجعة ✓');
      navigate(`/my/listings?posted=${saved.id}`);
    } catch (err) {
      setError(err.message);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="container page-narrow form sell" onSubmit={submit}>
      <div className="sell-head">
        <h1 className="h1">{id ? 'تعديل الإعلان' : 'بيعي فستانچ'}</h1>
        <p className="muted">إعلان مجاني تماماً{commissionPct ? ` — عمولة ${commissionPct}% فقط عند إتمام البيع` : ''}.</p>
      </div>
      {error && <p className="alert">{error}</p>}

      <section className="sell-card">
        <h3>📷 الصور <small className="muted">(صورتان على الأقل، الأفضل صور حقيقية بإضاءة جيدة)</small></h3>
        <PhotoPicker value={form.images} onChange={set('images')} />
      </section>

      <section className="sell-card">
        <h3>معلومات الفستان</h3>
        <label>العنوان<input required maxLength={120} value={form.title} onChange={set('title')} placeholder="مثال: فستان سهرة ستان أحمر طويل — لُبس مرة" /></label>
        <label>القسم
          <select value={form.category_id} onChange={set('category_id')}>
            <option value="">اختاري القسم</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        <div>
          <span className="sell-label">المقاس</span>
          <div className="sizes">
            {SIZES.map((s) => <button type="button" key={s} className={form.size === s ? 'on' : ''} onClick={() => set('size')(s)}>{s}</button>)}
          </div>
        </div>
        <div>
          <span className="sell-label">حالة الفستان</span>
          <div className="cond-grid">
            {Object.entries(CONDITIONS).map(([k, c]) => (
              <button type="button" key={k} className={form.condition === k ? 'on' : ''} onClick={() => set('condition')(k)}>
                <b>{c.label}</b><small>{c.hint}</small>
              </button>
            ))}
          </div>
        </div>
        <div className="two">
          <label>الماركة (اختياري)<input value={form.brand} onChange={set('brand')} placeholder="Zara, Shein..." /></label>
          <label>اللون (اختياري)<input value={form.color} onChange={set('color')} placeholder="أحمر" /></label>
        </div>
        <label>الوصف<textarea rows="4" maxLength={2000} value={form.description} onChange={set('description')}
          placeholder="الخامة، الطول، كم مرة لُبس، هل فيه تعديل أو أي ملاحظة..." /></label>
      </section>

      <section className="sell-card">
        <h3>💰 السعر</h3>
        <div className="two">
          <label>سعرچ (د.ع)<input required type="number" min="1000" step="250" inputMode="numeric" value={form.price} onChange={set('price')} /></label>
          <label>سعره الأصلي (اختياري)<input type="number" min="0" step="250" inputMode="numeric" value={form.original_price} onChange={set('original_price')} /></label>
        </div>
        {suggest && <p className="m-note">💡 السعر التنافسي للمستعمل عادةً بين {price(suggest[0])} و {price(suggest[1])}. الأسعار المناسبة تُباع أسرع!</p>}
        {p > 0 && commissionPct > 0 && (
          <div className="sell-net"><span>يصلچ بعد البيع</span><b>{price(net)}</b><small>(عمولة الموقع {commissionPct}%)</small></div>
        )}
      </section>

      <section className="sell-card">
        <h3>📍 التواصل والموقع</h3>
        <label>المحافظة
          <select required value={form.city} onChange={set('city')}>
            <option value="">اختاري المحافظة</option>
            {(settings.cities || []).map((c) => <option key={c}>{c}</option>)}
          </select>
        </label>
        <label>رقم هاتفچ (واتساب)
          <input type="tel" dir="ltr" inputMode="tel" placeholder="07XX XXX XXXX" value={form.phone || ''} onChange={set('phone')} required={!user.phone} />
          <small className="muted">لا يظهر للعامة — يظهر فقط للمشترية بعد موافقتچ على طلبها.</small>
        </label>
      </section>

      <label className="check sell-agree">
        <input type="checkbox" checked={form.agree} onChange={set('agree')} />
        <span>أؤكد أن الفستان نظيف وبالحالة الموصوفة. {settings.market_terms}</span>
      </label>

      <div className="checkout-bar">
        <button className="btn btn-primary btn-lg btn-block" disabled={saving}>
          {saving ? 'جارٍ الحفظ...' : id ? 'حفظ التعديلات' : settings.market_auto_approve ? 'نشر الإعلان' : 'إرسال للمراجعة والنشر'}
        </button>
        <Link to="/market" className="btn btn-block">إلغاء</Link>
      </div>
    </form>
  );
}

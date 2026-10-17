import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useStore } from '../store.jsx';
import { Loading, PageHead, Tags, useApi, useNotify } from './ui.jsx';

function PasswordForm() {
  const notify = useNotify();
  const [form, setForm] = useState({ current: '', next: '', confirm: '' });
  const [error, setError] = useState('');
  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (form.next !== form.confirm) return setError('كلمتا المرور غير متطابقتين');
    try {
      await api('/auth/password', { method: 'POST', body: form });
      setForm({ current: '', next: '', confirm: '' });
      notify('تم تغيير كلمة المرور');
    } catch (err) {
      setError(err.message);
    }
  };
  return (
    <form className="a-card a-form" onSubmit={submit}>
      <h3>تغيير كلمة مرور المدير</h3>
      <p className="a-muted">كلمة المرور الافتراضية معروفة (admin12345) — غيّريها قبل نشر الموقع.</p>
      <section className="a-fields">
        <label className="span-2">كلمة المرور الحالية<input className="a-input" type="password" dir="ltr" required autoComplete="current-password" value={form.current} onChange={(e) => setForm({ ...form, current: e.target.value })} /></label>
        <label>الجديدة<input className="a-input" type="password" dir="ltr" required minLength={6} autoComplete="new-password" value={form.next} onChange={(e) => setForm({ ...form, next: e.target.value })} /></label>
        <label>تأكيد الجديدة<input className="a-input" type="password" dir="ltr" required minLength={6} autoComplete="new-password" value={form.confirm} onChange={(e) => setForm({ ...form, confirm: e.target.value })} /></label>
      </section>
      {error && <p className="a-error">{error}</p>}
      <div className="a-row end"><button className="a-btn primary">تغيير كلمة المرور</button></div>
    </form>
  );
}

export default function Settings() {
  const notify = useNotify();
  const { reloadSettings } = useStore();
  const { data, error } = useApi('/admin/settings');
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data) setForm(data);
  }, [data]);
  if (error) return <p className="a-error">{error}</p>;
  if (!form) return <Loading />;

  const set = (k) => (e) => setForm({ ...form, [k]: e?.target ? e.target.value : e });
  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const saved = await api('/admin/settings', {
        method: 'PUT',
        body: {
          ...form,
          shipping_fee: Number(form.shipping_fee) || 0,
          free_shipping_over: Number(form.free_shipping_over) || 0,
          market_commission: Number(form.market_commission) || 0,
          commission_limit: Number(form.commission_limit) || 0,
          boost_plans: (form.boost_plans || []).filter((p) => p.days > 0 && p.price >= 0).sort((a, b) => a.days - b.days),
          payment_methods: (form.payment_methods || []).filter((m) => m.name.trim()),
        },
      });
      setForm(saved);
      reloadSettings();
      notify('تم حفظ الإعدادات — تظهر في المتجر فوراً');
    } catch (err) {
      notify(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageHead title="الإعدادات" sub="معلومات المتجر، التوصيل، والواجهة الرئيسية" />
      <form className="a-form" onSubmit={save}>
        <div className="a-card">
          <h3>معلومات المتجر والتواصل</h3>
          <section className="a-fields">
            <label>اسم المتجر<input className="a-input" value={form.store_name} onChange={set('store_name')} /></label>
            <label>الشعار النصي<input className="a-input" value={form.tagline} onChange={set('tagline')} /></label>
            <label>رقم واتساب (بالصيغة الدولية)<input className="a-input" dir="ltr" placeholder="9647XXXXXXXXX" value={form.whatsapp} onChange={set('whatsapp')} /></label>
            <label>رابط إنستغرام<input className="a-input" dir="ltr" value={form.instagram} onChange={set('instagram')} /></label>
            <label>العملة<input className="a-input" value={form.currency} onChange={set('currency')} /></label>
            <label>هاتف إضافي (اختياري)<input className="a-input" dir="ltr" value={form.phone} onChange={set('phone')} /></label>
          </section>
        </div>

        <div className="a-card">
          <h3>التوصيل</h3>
          <section className="a-fields">
            <label>أجور التوصيل<input className="a-input" type="number" min="0" step="250" value={form.shipping_fee} onChange={set('shipping_fee')} /></label>
            <label>توصيل مجاني للطلبات فوق <small className="a-muted">(0 = بدون)</small><input className="a-input" type="number" min="0" step="1000" value={form.free_shipping_over} onChange={set('free_shipping_over')} /></label>
            <label className="span-2">المحافظات التي يتم التوصيل لها<Tags value={form.cities} onChange={set('cities')} placeholder="أضيفي محافظة ثم Enter" /></label>
          </section>
        </div>

        <div className="a-card">
          <h3>♻ سوق المستعمل والإعلانات المدفوعة</h3>
          <section className="a-fields">
            <div className="a-switches span-2">
              <label className="a-switch"><input type="checkbox" checked={form.market_enabled !== false} onChange={(e) => set('market_enabled')(e.target.checked)} /><span />تفعيل سوق المستعمل</label>
              <label className="a-switch"><input type="checkbox" checked={form.online_payment_enabled !== false} onChange={(e) => set('online_payment_enabled')(e.target.checked)} /><span />السماح بالدفع الإلكتروني في المتجر</label>
              <label className="a-switch"><input type="checkbox" checked={!!form.market_auto_approve} onChange={(e) => set('market_auto_approve')(e.target.checked)} /><span />نشر الإعلانات مباشرة بدون مراجعة</label>
            </div>
            <label>عمولة الموقع من كل بيع (%)<input className="a-input" type="number" min="0" max="50" step="0.5" value={form.market_commission} onChange={set('market_commission')} /></label>
            <label>إيقاف النشر عندما تصل العمولة غير المدفوعة إلى <small className="a-muted">(د.ع — 0 بدون حد)</small><input className="a-input" type="number" min="0" step="1000" value={form.commission_limit} onChange={set('commission_limit')} /></label>
            <label className="span-2">شروط البيع (تظهر للبائعة)<textarea className="a-input" rows="2" value={form.market_terms} onChange={set('market_terms')} /></label>
          </section>

          <h4 className="a-sub">باقات الترويج</h4>
          {(form.boost_plans || []).map((p, i) => (
            <div key={i} className="a-plan-row">
              <label>المدة (أيام)<input className="a-input" type="number" min="1" value={p.days} onChange={(e) => set('boost_plans')(form.boost_plans.map((x, j) => (j === i ? { ...x, days: Number(e.target.value) } : x)))} /></label>
              <label>السعر<input className="a-input" type="number" min="0" step="250" value={p.price} onChange={(e) => set('boost_plans')(form.boost_plans.map((x, j) => (j === i ? { ...x, price: Number(e.target.value) } : x)))} /></label>
              <button type="button" className="a-btn ghost danger" onClick={() => set('boost_plans')(form.boost_plans.filter((_, j) => j !== i))} aria-label="حذف">✕</button>
            </div>
          ))}
          <button type="button" className="a-btn sm" onClick={() => set('boost_plans')([...(form.boost_plans || []), { days: 7, price: 5000 }])}>+ باقة</button>

          <h4 className="a-sub">حسابات الدفع الإلكتروني <small className="a-muted">(للترويج، العمولات، والدفع في المتجر)</small></h4>
          {(form.payment_methods || []).map((m, i) => (
            <div key={i} className="a-plan-row pay">
              <label>الاسم<input className="a-input" value={m.name} onChange={(e) => set('payment_methods')(form.payment_methods.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} /></label>
              <label>الرقم / الحساب<input className="a-input" dir="ltr" value={m.details} onChange={(e) => set('payment_methods')(form.payment_methods.map((x, j) => (j === i ? { ...x, details: e.target.value } : x)))} /></label>
              <button type="button" className="a-btn ghost danger" onClick={() => set('payment_methods')(form.payment_methods.filter((_, j) => j !== i))} aria-label="حذف">✕</button>
            </div>
          ))}
          <button type="button" className="a-btn sm" onClick={() => set('payment_methods')([...(form.payment_methods || []), { name: '', details: '' }])}>+ طريقة دفع</button>
        </div>

        <div className="a-card">
          <h3>الواجهة الرئيسية</h3>
          <section className="a-fields">
            <label className="span-2">سطر العرض (فوق العنوان)<input className="a-input" value={form.hero_offer} onChange={set('hero_offer')} /></label>
            <label>العنوان<input className="a-input" value={form.hero_title} onChange={set('hero_title')} /></label>
            <label>العنوان (السطر الملوّن)<input className="a-input" value={form.hero_title_accent} onChange={set('hero_title_accent')} /></label>
            <label className="span-2">الوصف<input className="a-input" value={form.hero_subtitle} onChange={set('hero_subtitle')} /></label>
            <label className="span-2">رسائل الشريط العلوي<Tags value={form.announcements} onChange={set('announcements')} placeholder="اكتبي رسالة ثم Enter" /></label>
          </section>
        </div>

        <div className="a-row end sticky">
          <button className="a-btn primary lg" disabled={saving}>{saving ? 'جارٍ الحفظ...' : 'حفظ الإعدادات'}</button>
        </div>
      </form>

      <PasswordForm />
    </>
  );
}

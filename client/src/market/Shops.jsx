import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { api, uploadImages } from '../api.js';
import { useStore } from '../store.jsx';
import { waLink } from '../components/Layout.jsx';
import { InstagramIcon, WhatsappIcon } from '../components/Icons.jsx';
import { toIntl } from './SellerCenter.jsx';
import { ListingGrid, Stars, useSaved } from './shared.jsx';

export const SHOP_STATUS = {
  pending: { label: 'طلبچ قيد المراجعة', tone: 'wait' },
  approved: { label: 'محل موثّق ✓', tone: 'ok' },
  rejected: { label: 'لم تتم الموافقة', tone: 'bad' },
  suspended: { label: 'الحساب موقوف', tone: 'bad' },
};

export function VerifiedBadge() {
  return <span className="shop-verified" title="محل موثّق من جُمان">✓ محل موثّق</span>;
}

function ImageField({ label, value, onChange, wide }) {
  const input = useRef(null);
  const [busy, setBusy] = useState(false);
  const { notify } = useStore();
  const pick = async (file) => {
    if (!file) return;
    setBusy(true);
    try {
      onChange((await uploadImages([file], '/api/market/uploads'))[0]);
    } catch (e) {
      notify(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="img-field">
      <span className="sell-label">{label}</span>
      <button type="button" className={`img-drop ${wide ? 'wide' : ''}`} onClick={() => input.current.click()} disabled={busy}>
        {value ? <img src={value} alt="" referrerPolicy="no-referrer" /> : <span>{busy ? 'جارٍ الرفع...' : '📷 اختاري صورة'}</span>}
      </button>
      <input ref={input} type="file" accept="image/*" hidden onChange={(e) => pick(e.target.files[0])} />
    </div>
  );
}

const EMPTY = { shop_name: '', slug: '', description: '', logo_url: '', cover_url: '', phone: '', whatsapp: '', instagram: '', website: '', city: '', address: '', map_url: '', hours: '', agree: false };

/** Apply as a shop, see the review status, or edit an approved shop's profile */
export function MerchantApply() {
  const { user, authReady, settings, notify } = useStore();
  const [shop, setShop] = useState(undefined);
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    api('/merchants/me').then((m) => {
      setShop(m);
      if (m) setForm({ ...EMPTY, ...Object.fromEntries(Object.entries(m).map(([k, v]) => [k, v ?? ''])), agree: true });
      else setForm((f) => ({ ...f, phone: user.phone || '', whatsapp: user.phone || '' }));
    }).catch(() => setShop(null));
  }, [user]);

  if (!authReady) return <div className="spinner" />;
  if (!user) return <Navigate to="/account?mode=register&next=/shops/join" replace />;
  if (shop === undefined) return <div className="spinner" />;

  const set = (k) => (e) => setForm({ ...form, [k]: e?.target ? (e.target.type === 'checkbox' ? e.target.checked : e.target.value) : e });
  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const saved = await api('/merchants/me', { method: 'POST', body: form });
      setShop(saved);
      notify(saved.status === 'approved' ? 'تم حفظ بيانات المحل' : 'تم إرسال طلبچ للمراجعة ✓');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setError(err.message);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setSaving(false);
    }
  };

  const st = shop && SHOP_STATUS[shop.status];
  return (
    <form className="container page-narrow form sell" onSubmit={submit}>
      <div className="sell-head">
        <h1 className="h1">{shop?.status === 'approved' ? 'بيانات محلي' : 'انضمي كمحل أو تاجرة'}</h1>
        <p className="muted">اعرضي فساتين محلچ في جُمان باسم محلچ، مع صفحة خاصة فيها كل معلومات التواصل.</p>
      </div>

      {st && (
        <div className={`shop-status ${st.tone}`}>
          <b>{st.label}</b>
          {shop.status === 'pending' && <small>سنراجع بيانات محلچ ونفعّل الحساب قريباً. يمكنچ تعديل الطلب بأي وقت.</small>}
          {shop.status === 'rejected' && <small>السبب: {shop.reject_reason}. عدّلي البيانات وأعيدي الإرسال.</small>}
          {shop.status === 'suspended' && <small>{shop.reject_reason}</small>}
          {shop.status === 'approved' && (
            <div className="row-btns start">
              <Link to={`/shop/${shop.slug}`} className="btn btn-soft">صفحة محلي</Link>
              <Link to="/sell?shop=1" className="btn btn-primary">+ أضيفي فستاناً للمحل</Link>
            </div>
          )}
        </div>
      )}
      {!shop && (
        <ol className="m-steps light">
          <li><b>1</b><span>املئي بيانات المحل</span></li>
          <li><b>2</b><span>نراجع الطلب ونوافق</span></li>
          <li><b>3</b><span>انشري فساتينچ باسم المحل</span></li>
        </ol>
      )}
      {error && <p className="alert">{error}</p>}

      <section className="sell-card">
        <h3>🏬 هوية المحل</h3>
        <label>اسم المحل<input required maxLength={80} value={form.shop_name} onChange={set('shop_name')} placeholder="مثال: بوتيك ليلى" /></label>
        <div className="two">
          <ImageField label="الشعار (مطلوب)" value={form.logo_url} onChange={set('logo_url')} />
          <ImageField label="صورة الغلاف" value={form.cover_url} onChange={set('cover_url')} wide />
        </div>
        <label>نبذة عن المحل<textarea rows="3" maxLength={1500} value={form.description} onChange={set('description')} placeholder="نوع الفساتين، الماركات، الخدمات (تفصيل، تأجير...)" /></label>
        <label>رابط صفحة المحل (بالإنكليزي — اختياري)
          <div className="slug-input" dir="ltr"><span>/shop/</span><input value={form.slug} onChange={set('slug')} placeholder="layla-boutique" /></div>
        </label>
      </section>

      <section className="sell-card">
        <h3>📞 التواصل</h3>
        <div className="two">
          <label>هاتف المحل<input required type="tel" dir="ltr" inputMode="tel" placeholder="07XX XXX XXXX" value={form.phone} onChange={set('phone')} /></label>
          <label>واتساب<input type="tel" dir="ltr" inputMode="tel" placeholder="07XX XXX XXXX" value={form.whatsapp} onChange={set('whatsapp')} /></label>
        </div>
        <label>إنستغرام<input dir="ltr" placeholder="@shop_name" value={form.instagram} onChange={set('instagram')} /></label>
        <label>الموقع الإلكتروني (إن وجد)<input dir="ltr" type="text" inputMode="url" placeholder="www.example.com" value={form.website} onChange={set('website')} /></label>
      </section>

      <section className="sell-card">
        <h3>📍 العنوان</h3>
        <label>المحافظة
          <select required value={form.city} onChange={set('city')}>
            <option value="">اختاري المحافظة</option>
            {(settings.cities || []).map((c) => <option key={c}>{c}</option>)}
          </select>
        </label>
        <label>عنوان المحل (إن وجد)<input value={form.address} onChange={set('address')} placeholder="المنطقة، الشارع، قرب..." /></label>
        <label>رابط الموقع على خرائط Google (اختياري)<input dir="ltr" value={form.map_url} onChange={set('map_url')} placeholder="https://maps.app.goo.gl/..." /></label>
        <label>أوقات الدوام (اختياري)<input value={form.hours} onChange={set('hours')} placeholder="يومياً 10 صباحاً – 10 مساءً، الجمعة عطلة" /></label>
      </section>

      <label className="check sell-agree">
        <input type="checkbox" checked={!!form.agree} onChange={set('agree')} />
        <span>أؤكد صحة بيانات المحل، وأن الفساتين المعروضة جديدة وصورها حقيقية. أوافق على عمولة الموقع {settings.merchant_commission ?? 5}% من كل بيع مكتمل.</span>
      </label>
      <div className="checkout-bar">
        <button className="btn btn-primary btn-lg btn-block" disabled={saving || shop?.status === 'suspended'}>
          {saving ? 'جارٍ الحفظ...' : shop?.status === 'approved' ? 'حفظ بيانات المحل' : shop ? 'تحديث الطلب' : 'إرسال طلب الانضمام'}
        </button>
      </div>
    </form>
  );
}

export function ShopCard({ shop }) {
  return (
    <Link to={`/shop/${shop.slug}`} className="shop-card">
      <div className="shop-card-cover">{shop.cover_url && <img src={shop.cover_url} alt="" referrerPolicy="no-referrer" />}</div>
      <img className="shop-card-logo" src={shop.logo_url} alt="" referrerPolicy="no-referrer" />
      <b>{shop.shop_name}</b>
      <small className="muted">📍 {shop.city}{shop.rating ? ` · ★ ${shop.rating}` : ''}</small>
      <span className="shop-card-count">{shop.active} فستان</span>
    </Link>
  );
}

export function ShopsDirectory() {
  const { settings, user } = useStore();
  const [shops, setShops] = useState(null);
  const [city, setCity] = useState('');
  useEffect(() => {
    api(`/merchants?city=${encodeURIComponent(city)}`).then(setShops).catch(() => setShops([]));
  }, [city]);
  return (
    <div className="container section">
      <div className="shops-hero">
        <div>
          <h1>محلات وبوتيكات جُمان</h1>
          <p>محلات موثّقة تعرض أحدث الفساتين — تسوقي من المحل مباشرة.</p>
        </div>
        <Link to={user ? '/shops/join' : '/account?mode=register&next=/shops/join'} className="btn btn-rose">🏬 سجّلي محلچ</Link>
      </div>
      <div className="chips scroll-x">
        <button className={!city ? 'on' : ''} onClick={() => setCity('')}>كل المحافظات</button>
        {(settings.cities || []).map((c) => <button key={c} className={city === c ? 'on' : ''} onClick={() => setCity(c)}>{c}</button>)}
      </div>
      {!shops ? <div className="spinner" /> : !shops.length ? (
        <div className="empty"><h2>لا توجد محلات هنا بعد</h2><Link to="/shops/join" className="btn btn-primary">كوني أول محل</Link></div>
      ) : <div className="shops-grid">{shops.map((s) => <ShopCard key={s.id} shop={s} />)}</div>}
    </div>
  );
}

export function ShopContacts({ shop }) {
  const wa = shop.whatsapp || shop.phone;
  return (
    <div className="shop-contacts">
      {wa && <a className="btn wa-btn" href={waLink(toIntl(wa))} target="_blank" rel="noreferrer"><WhatsappIcon width="18" height="18" /> واتساب</a>}
      {shop.phone && <a className="btn btn-soft" href={`tel:${shop.phone}`}>📞 اتصال</a>}
      {shop.instagram && <a className="btn btn-soft" href={`https://www.instagram.com/${shop.instagram}/`} target="_blank" rel="noreferrer"><InstagramIcon width="18" height="18" /> إنستغرام</a>}
      {shop.website && <a className="btn btn-soft" href={shop.website} target="_blank" rel="noreferrer">🌐 الموقع</a>}
      {shop.map_url && <a className="btn btn-soft" href={shop.map_url} target="_blank" rel="noreferrer">🗺 الخريطة</a>}
    </div>
  );
}

export function ShopPage() {
  const { slug } = useParams();
  const saved = useSaved();
  const [shop, setShop] = useState(null);
  const [items, setItems] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    setShop(null);
    api(`/merchants/${slug}`).then(setShop).catch((e) => setError(e.message));
    api(`/market/listings?shop=${encodeURIComponent(slug)}&limit=60`).then((d) => setItems(d.items)).catch(() => setItems([]));
  }, [slug]);

  if (error) return <div className="container empty"><h2>{error}</h2><Link to="/shops" className="btn btn-primary">كل المحلات</Link></div>;
  if (!shop) return <div className="spinner" />;
  const s = shop.stats;
  return (
    <div className="container shop-page">
      <div className="shop-cover">{shop.cover_url && <img src={shop.cover_url} alt="" referrerPolicy="no-referrer" />}</div>
      <div className="shop-head">
        <img className="shop-logo" src={shop.logo_url} alt={shop.shop_name} referrerPolicy="no-referrer" />
        <div>
          <h1>{shop.shop_name}</h1>
          <VerifiedBadge />
          <p className="muted">
            {s.rating ? <><Stars value={s.rating} /> {s.rating} ({s.reviews}) · </> : ''}
            {s.active} فستان · بيع {s.sold}
          </p>
        </div>
      </div>
      {shop.description && <p className="shop-desc">{shop.description}</p>}
      <ShopContacts shop={shop} />
      <div className="shop-info">
        <div><small>المحافظة</small><b>{shop.city}</b></div>
        {shop.address && <div><small>العنوان</small><b>{shop.address}</b></div>}
        {shop.hours && <div><small>أوقات الدوام</small><b>{shop.hours}</b></div>}
      </div>

      <h2 className="h2">فساتين المحل</h2>
      {!items ? <div className="spinner" /> : items.length ? <ListingGrid items={items} saved={saved} /> : <p className="muted">لا توجد فساتين معروضة حالياً.</p>}

      {shop.reviews.length > 0 && (
        <>
          <h2 className="h2">آراء الزبونات</h2>
          <div className="scroll-x reviews">
            {shop.reviews.map((r, i) => (
              <figure key={i} className="review">
                <Stars value={r.rating} />
                {r.review && <blockquote>{r.review}</blockquote>}
                <figcaption><b>{r.buyer}</b> <small>· {r.title}</small></figcaption>
              </figure>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

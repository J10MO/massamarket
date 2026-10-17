import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, price } from '../api.js';
import { useStore } from '../store.jsx';
import { Gallery } from '../pages/Product.jsx';
import { BackIcon, CloseIcon, HeartIcon, WhatsappIcon } from '../components/Icons.jsx';
import { CONDITIONS, ListingCard, LISTING_STATUS, MARKET_ORDER_STATUS, savePct, Stars, timeAgo, useSaved } from './shared.jsx';

const REPORT_REASONS = ['صور غير حقيقية أو مأخوذة من الإنترنت', 'الفستان غير نظيف أو تالف', 'سعر مبالغ فيه أو احتيال', 'محتوى غير لائق', 'سبب آخر'];

function OrderSheet({ listing, onClose, onDone }) {
  const { user, settings } = useStore();
  const [form, setForm] = useState({ buyer_name: user?.name || '', buyer_phone: user?.phone || '', city: '', address: '', notes: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      onDone(await api(`/market/listings/${listing.id}/order`, { method: 'POST', body: form }));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <form className="sheet form" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <div className="sheet-head">
          <h3>طلب الفستان من البائعة</h3>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="إغلاق"><CloseIcon /></button>
        </div>
        <div className="m-mini">
          <img src={listing.images[0]} alt="" referrerPolicy="no-referrer" />
          <div><b>{listing.title}</b><span>{listing.size} · {price(listing.price)}</span></div>
        </div>
        <label>الاسم<input required value={form.buyer_name} onChange={set('buyer_name')} autoComplete="name" /></label>
        <label>رقم الهاتف (واتساب)<input required type="tel" dir="ltr" inputMode="tel" placeholder="07XX XXX XXXX" value={form.buyer_phone} onChange={set('buyer_phone')} /></label>
        <label>المحافظة
          <select required value={form.city} onChange={set('city')}>
            <option value="">اختاري المحافظة</option>
            {(settings.cities || []).map((c) => <option key={c}>{c}</option>)}
          </select>
        </label>
        <label>العنوان<textarea required rows="2" placeholder="المنطقة، أقرب نقطة دالة" value={form.address} onChange={set('address')} /></label>
        <label>ملاحظة للبائعة (اختياري)<textarea rows="2" placeholder="مثلاً: هل القياس مضبوط على طول 160؟" value={form.notes} onChange={set('notes')} /></label>
        <p className="m-note">💡 سيُحجز الفستان لكِ، وعند موافقة البائعة يظهر لكِ رقمها لترتيب التوصيل والدفع عند الاستلام.</p>
        {error && <p className="alert">{error}</p>}
        <button className="btn btn-primary btn-lg btn-block" disabled={busy}>{busy ? 'جارٍ الإرسال...' : `تأكيد الطلب — ${price(listing.price)}`}</button>
      </form>
    </div>
  );
}

function ReportSheet({ id, onClose }) {
  const { notify } = useStore();
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const send = async () => {
    try {
      await api(`/market/listings/${id}/report`, { method: 'POST', body: { reason, details } });
      notify('شكراً، تم إرسال البلاغ للإدارة');
      onClose();
    } catch (e) {
      notify(e.message);
    }
  };
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <h3>الإبلاغ عن الإعلان</h3>
          <button className="icon-btn" onClick={onClose} aria-label="إغلاق"><CloseIcon /></button>
        </div>
        <div className="m-radio-list">
          {REPORT_REASONS.map((r) => (
            <label key={r} className={reason === r ? 'on' : ''}>
              <input type="radio" name="reason" checked={reason === r} onChange={() => setReason(r)} /> {r}
            </label>
          ))}
        </div>
        <textarea className="m-select" rows="2" placeholder="تفاصيل إضافية (اختياري)" value={details} onChange={(e) => setDetails(e.target.value)} />
        <button className="btn btn-primary btn-block" disabled={!reason} onClick={send}>إرسال البلاغ</button>
      </div>
    </div>
  );
}

export default function Listing() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useStore();
  const saved = useSaved();
  const [l, setL] = useState(null);
  const [error, setError] = useState('');
  const [sheet, setSheet] = useState(null); // 'order' | 'report'

  const load = () => api(`/market/listings/${id}`).then(setL).catch((e) => setError(e.message));
  useEffect(() => {
    setL(null);
    load();
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (error) return <div className="container empty"><h2>{error}</h2><Link to="/market" className="btn btn-primary">العودة للمستعمل</Link></div>;
  if (!l) return <div className="container product"><div className="product-media skeleton" /></div>;

  const off = savePct(l);
  const s = l.seller;
  const canBuy = l.status === 'active' && !l.is_owner;
  const buy = () => (user ? setSheet('order') : navigate(`/account?next=/market/${l.id}`));
  const shareText = encodeURIComponent(`${l.title} — ${price(l.price)} على سوق جُمان للمستعمل\n${window.location.href}`);

  let cta;
  if (l.is_owner) cta = <Link to="/my/listings" className="btn btn-outline btn-lg">إدارة إعلانچ</Link>;
  else if (l.my_order && ['pending', 'accepted'].includes(l.my_order.status)) cta = <Link to="/my/purchases" className="btn btn-soft btn-lg">طلبچ: {MARKET_ORDER_STATUS[l.my_order.status]}</Link>;
  else if (l.status === 'reserved') cta = <button className="btn btn-soft btn-lg" disabled>محجوز لمشترية أخرى</button>;
  else if (l.status === 'sold') cta = <button className="btn btn-soft btn-lg" disabled>تم بيع هذا الفستان</button>;
  else if (canBuy) cta = <button className="btn btn-primary btn-lg" onClick={buy}>اطلبي الفستان الآن</button>;

  return (
    <>
      <div className="container product">
        <div className="product-media">
          <button className="float-btn back" onClick={() => navigate(-1)} aria-label="رجوع"><BackIcon /></button>
          <button className={`float-btn wish ${saved.isSaved(l.id) ? 'on' : ''}`} onClick={() => saved.toggle({ ...l, image_url: l.images[0] })} aria-label="حفظ">
            <HeartIcon filled={saved.isSaved(l.id)} />
          </button>
          <Gallery images={l.images} alt={l.title} />
          {l.is_boosted && <span className="l-boost big">✦ إعلان مميز</span>}
          {l.status !== 'active' && <span className={`l-ribbon big ${l.status}`}>{LISTING_STATUS[l.status]}</span>}
        </div>

        <div className="product-info">
          <div className="m-crumbs">
            <Link to="/market" className="crumb">سوق المستعمل</Link>
            {l.category_name && <><span>›</span><Link to={`/market?category=${l.category_slug}`} className="crumb">{l.category_name}</Link></>}
          </div>
          <h1>{l.title}</h1>
          <p className="muted m-meta">📍 {l.city} · {timeAgo(l.created_at)} · 👁 {l.views} مشاهدة</p>

          {l.is_owner && l.status === 'pending' && <p className="m-note">⏳ إعلانچ قيد المراجعة وسيظهر للجميع بعد الموافقة.</p>}
          {l.is_owner && l.status === 'rejected' && <p className="alert">تم رفض الإعلان: {l.reject_reason}</p>}

          <div className="product-price">
            <strong>{price(l.price)}</strong>
            {l.original_price && <del>{price(l.original_price)}</del>}
            {off > 0 && <span className="save">توفير {off}%</span>}
          </div>

          <div className="m-specs">
            <div><small>المقاس</small><b>{l.size}</b></div>
            <div><small>الحالة</small><b>{CONDITIONS[l.condition]?.label}</b></div>
            {l.brand && <div><small>الماركة</small><b>{l.brand}</b></div>}
            {l.color && <div><small>اللون</small><b>{l.color}</b></div>}
          </div>
          <p className="muted m-cond-hint">{CONDITIONS[l.condition]?.hint}</p>

          <div className="desktop-actions">{cta}</div>

          {l.description && (<><h4>الوصف</h4><p className="desc m-desc">{l.description}</p></>)}

          {s && (
            <Link to={`/seller/${s.id}`} className="m-seller">
              <span className="review-avatar big">{s.name?.[0]}</span>
              <div>
                <b>{s.name}</b>
                <small>
                  {s.rating ? <><Stars value={s.rating} /> {s.rating} ({s.reviews})</> : 'بائعة جديدة'} · باعت {s.sold} · {s.active} معروض
                </small>
              </div>
              <span className="m-link">الملف ←</span>
            </Link>
          )}

          <div className="m-safety">
            <b>🛡 نصائح للشراء الآمن</b>
            <ul>
              <li>اطلبي من البائعة صوراً أو فيديو إضافياً قبل الاستلام.</li>
              <li>افحصي الفستان عند الاستلام وادفعي بعد التأكد.</li>
              <li>لا تحوّلي مبالغ مسبقاً لأي شخص خارج الموقع.</li>
            </ul>
          </div>

          <div className="m-row-actions">
            <a href={`https://wa.me/?text=${shareText}`} target="_blank" rel="noreferrer" className="btn btn-soft"><WhatsappIcon width="18" height="18" /> مشاركة</a>
            {!l.is_owner && <button className="btn btn-soft" onClick={() => setSheet('report')}>⚑ إبلاغ</button>}
          </div>
        </div>
      </div>

      {l.similar.length > 0 && (
        <section className="container section">
          <h2 className="h2">فساتين مشابهة</h2>
          <div className="scroll-x deals-row">{l.similar.map((x) => <ListingCard key={x.id} listing={x} saved={saved} />)}</div>
        </section>
      )}

      {cta && (
        <div className="buy-bar">
          <div><small className="muted">{l.size} · {CONDITIONS[l.condition]?.label}</small><strong>{price(l.price)}</strong></div>
          {cta}
        </div>
      )}

      {sheet === 'order' && (
        <OrderSheet listing={l} onClose={() => setSheet(null)} onDone={() => { setSheet(null); navigate('/my/purchases?new=1'); }} />
      )}
      {sheet === 'report' && <ReportSheet id={l.id} onClose={() => setSheet(null)} />}
    </>
  );
}

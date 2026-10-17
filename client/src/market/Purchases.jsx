import { useEffect, useState } from 'react';
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom';
import { api, price } from '../api.js';
import { useStore } from '../store.jsx';
import { waLink } from '../components/Layout.jsx';
import { toIntl } from './SellerCenter.jsx';
import { ListingGrid, MARKET_ORDER_STATUS, Stars, timeAgo, useSaved } from './shared.jsx';

function Review({ order, onDone }) {
  const { notify } = useStore();
  const [rating, setRating] = useState(0);
  const [text, setText] = useState('');
  const send = async () => {
    try {
      await api(`/market/orders/${order.id}/review`, { method: 'POST', body: { rating, review: text } });
      notify('شكراً على تقييمچ 💕');
      onDone();
    } catch (e) {
      notify(e.message);
    }
  };
  return (
    <div className="review-box">
      <b>قيّمي تجربتچ مع البائعة</b>
      <div className="rate-stars">
        {[1, 2, 3, 4, 5].map((i) => (
          <button key={i} className={i <= rating ? 'on' : ''} onClick={() => setRating(i)} aria-label={`${i} نجوم`}>★</button>
        ))}
      </div>
      <input className="m-select" placeholder="اكتبي رأيچ (اختياري)" value={text} onChange={(e) => setText(e.target.value)} />
      <button className="btn btn-primary" disabled={!rating} onClick={send}>إرسال التقييم</button>
    </div>
  );
}

export function Purchases() {
  const { user, authReady, notify } = useStore();
  const [params] = useSearchParams();
  const [items, setItems] = useState(null);
  const load = () => api('/market/my/purchases').then(setItems).catch(() => setItems([]));
  useEffect(() => {
    if (user) load();
  }, [user]);

  if (!authReady) return <div className="spinner" />;
  if (!user) return <Navigate to="/account?next=/my/purchases" replace />;

  const cancel = async (o) => {
    if (!confirm('إلغاء طلبچ لهذا الفستان؟')) return;
    try {
      await api(`/market/orders/${o.id}/action`, { method: 'POST', body: { action: 'cancel' } });
      load();
    } catch (e) {
      notify(e.message);
    }
  };

  return (
    <div className="container page-narrow">
      <h1 className="h1">مشترياتي من المستعمل</h1>
      {params.get('new') && <p className="m-note">✓ تم إرسال طلبچ وحُجز الفستان. سنُعلمچ هنا عند موافقة البائعة ويظهر رقمها للتواصل.</p>}
      {!items ? <div className="spinner" /> : !items.length ? (
        <div className="empty"><h2>لا توجد مشتريات بعد</h2><Link to="/market" className="btn btn-primary">تصفحي المستعمل</Link></div>
      ) : (
        <ul className="my-list">
          {items.map((o) => (
            <li key={o.id} className="my-item order">
              <Link to={o.listing_id ? `/market/${o.listing_id}` : '#'}><img className="my-thumb" src={o.image_url} alt="" referrerPolicy="no-referrer" /></Link>
              <div className="my-body">
                <div className="my-top">
                  <span className={`m-pill mo-${o.status}`}>{MARKET_ORDER_STATUS[o.status]}</span>
                  <small className="muted">{timeAgo(o.created_at)}</small>
                </div>
                <b>{o.title}</b>
                <span className="my-price">{price(o.price)}</span>
                {o.seller_phone ? (
                  <div className="buyer-box">
                    <b>البائعة: {o.seller_name}</b>
                    <span dir="ltr">{o.seller_phone}</span>
                    <div className="my-actions">
                      <a className="wa" href={`${waLink(toIntl(o.seller_phone))}?text=${encodeURIComponent(`مرحباً، أنا ${o.buyer_name} طلبت "${o.title}" من سوق جُمان 🌸`)}`} target="_blank" rel="noreferrer">واتساب البائعة</a>
                      <a href={`tel:${o.seller_phone}`}>📞 اتصال</a>
                    </div>
                  </div>
                ) : o.status === 'pending' && <small className="muted">⏳ رقم البائعة يظهر بعد موافقتها على الطلب.</small>}
                {o.seller_note && <span className="m-note">💬 من البائعة: {o.seller_note}</span>}
                {['pending', 'accepted'].includes(o.status) && <div className="my-actions"><button className="danger" onClick={() => cancel(o)}>إلغاء الطلب</button></div>}
                {o.status === 'completed' && (o.rating ? <span className="muted">تقييمچ: <Stars value={o.rating} /></span> : <Review order={o} onDone={load} />)}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function Saved() {
  const saved = useSaved();
  return (
    <div className="container section">
      <h1 className="h1">الفساتين المحفوظة ({saved.saved.length})</h1>
      {!saved.saved.length ? (
        <div className="empty"><h2>لم تحفظي أي فستان بعد</h2><Link to="/market" className="btn btn-primary">تصفحي المستعمل</Link></div>
      ) : <ListingGrid items={saved.saved} saved={saved} />}
    </div>
  );
}

export function SellerProfile() {
  const { id } = useParams();
  const saved = useSaved();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    api(`/market/sellers/${id}`).then(setData).catch((e) => setError(e.message));
  }, [id]);

  if (error) return <div className="container empty"><h2>{error}</h2></div>;
  if (!data) return <div className="spinner" />;
  const s = data.seller;
  return (
    <div className="container section">
      <div className="seller-head">
        <span className="review-avatar xl">{s.name?.[0]}</span>
        <div>
          <h1 className="h1">{s.name}</h1>
          <p className="muted">
            {s.rating ? <><Stars value={s.rating} size={16} /> {s.rating} من {s.reviews} تقييم</> : 'بائعة جديدة'}
            {' · '}عضوة منذ {new Date(s.created_at).toLocaleDateString('ar-IQ', { month: 'long', year: 'numeric' })}
          </p>
          <div className="sc-stats inline">
            <div><b>{s.active}</b><small>معروض</small></div>
            <div><b>{s.sold}</b><small>تم بيعه</small></div>
          </div>
        </div>
      </div>
      <h2 className="h2">فساتينها</h2>
      {data.listings.length ? <ListingGrid items={data.listings} saved={saved} /> : <p className="muted">لا توجد فساتين معروضة حالياً.</p>}
      {data.reviews.length > 0 && (
        <>
          <h2 className="h2">آراء المشتريات</h2>
          <div className="scroll-x reviews">
            {data.reviews.map((r, i) => (
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

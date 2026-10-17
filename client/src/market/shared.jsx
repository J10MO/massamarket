import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { price, uploadImages } from '../api.js';
import { useStore } from '../store.jsx';
import { Img } from '../components/ProductCard.jsx';
import { HeartIcon } from '../components/Icons.jsx';

export const CONDITIONS = {
  new: { label: 'جديد', hint: 'قطعة جديدة من المحل' },
  new_tag: { label: 'جديد بالتاغ', hint: 'لم يُلبس أبداً والتاغ موجود' },
  like_new: { label: 'كالجديد', hint: 'لُبس مرة أو مرتين بدون أي أثر' },
  very_good: { label: 'جيد جداً', hint: 'استخدام خفيف وبحالة ممتازة' },
  good: { label: 'جيد', hint: 'آثار استخدام بسيطة موضحة بالصور' },
};

export const SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL', 'Free Size', '52', '54', '56', '58', '60'];

export const LISTING_STATUS = {
  pending: 'قيد المراجعة',
  active: 'منشور',
  reserved: 'محجوز',
  sold: 'مباع',
  rejected: 'مرفوض',
  hidden: 'مخفي',
};

export const MARKET_ORDER_STATUS = {
  pending: 'بانتظار موافقة البائعة',
  accepted: 'مقبول — جارٍ التسليم',
  rejected: 'مرفوض',
  completed: 'مكتمل',
  cancelled: 'ملغي',
};

export const savePct = (l) => (l.original_price ? Math.round((1 - l.price / l.original_price) * 100) : 0);

export const timeAgo = (d) => {
  const s = (Date.now() - new Date(d)) / 1000;
  if (s < 3600) return `قبل ${Math.max(1, Math.round(s / 60))} دقيقة`;
  if (s < 86400) return `قبل ${Math.round(s / 3600)} ساعة`;
  if (s < 86400 * 30) return `قبل ${Math.round(s / 86400)} يوم`;
  return new Date(d).toLocaleDateString('ar-IQ', { day: 'numeric', month: 'short' });
};

// Saved listings live in localStorage, separate from the store wishlist
const SAVED_KEY = 'massa_saved_listings';
export function useSaved() {
  const [saved, setSaved] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(SAVED_KEY)) || [];
    } catch {
      return [];
    }
  });
  const toggle = (l) => {
    setSaved((list) => {
      const next = list.some((x) => x.id === l.id) ? list.filter((x) => x.id !== l.id) : [...list, l];
      try {
        localStorage.setItem(SAVED_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  };
  return { saved, isSaved: (id) => saved.some((x) => x.id === id), toggle };
}

export function ListingCard({ listing: l, saved }) {
  const off = savePct(l);
  return (
    <article className={`card l-card ${l.is_boosted ? 'boosted' : ''}`}>
      <Link to={`/market/${l.id}`} className="card-media">
        <Img src={l.image_url} alt={l.title} />
        {l.is_boosted && <span className="l-boost">✦ إعلان مميز</span>}
        {l.status === 'reserved' && <span className="l-ribbon">{l.shop ? 'نفدت الكمية' : 'محجوز'}</span>}
        {l.status === 'sold' && <span className="l-ribbon sold">مباع</span>}
        <span className="l-cond">{CONDITIONS[l.condition]?.label}</span>
      </Link>
      {saved && (
        <button className={`wish-btn ${saved.isSaved(l.id) ? 'on' : ''}`} onClick={() => saved.toggle(l)} aria-label="حفظ">
          <HeartIcon filled={saved.isSaved(l.id)} width="18" height="18" />
        </button>
      )}
      <Link to={`/market/${l.id}`} className="card-body">
        {l.shop && (
          <span className="l-shop">
            {l.shop.logo && <img src={l.shop.logo} alt="" referrerPolicy="no-referrer" />}
            {l.shop.name} <i>✓</i>
          </span>
        )}
        <h3>{l.title}</h3>
        <div className="card-meta">
          <span className="l-size">{l.size}</span>
          <span className="muted">📍 {l.city}</span>
        </div>
        <div className="card-price">
          <strong>{price(l.price)}</strong>
          {l.original_price && <del>{price(l.original_price)}</del>}
          {off > 0 && <span className="l-off">-{off}%</span>}
        </div>
      </Link>
    </article>
  );
}

export function ListingGrid({ items, loading, saved, count = 8 }) {
  if (loading && !items.length) {
    return <div className="grid">{Array.from({ length: count }, (_, i) => <div key={i} className="card skeleton" />)}</div>;
  }
  return <div className="grid">{items.map((l) => <ListingCard key={l.id} listing={l} saved={saved} />)}</div>;
}

/** Photo uploader for sellers (store styling). value = array of urls */
export function PhotoPicker({ value, onChange, max = 8 }) {
  const input = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const { notify } = useStore();

  const onFiles = async (files) => {
    if (!files.length) return;
    setBusy(true);
    setError('');
    try {
      const urls = await uploadImages([...files].slice(0, max - value.length), '/api/market/uploads');
      onChange([...value, ...urls].slice(0, max));
      notify(`تم رفع ${urls.length} صورة`);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  };
  const makeMain = (i) => onChange([value[i], ...value.filter((_, j) => j !== i)]);

  return (
    <div>
      <div className="pp-grid">
        {value.map((src, i) => (
          <div key={src} className="pp-item">
            <img src={src} alt="" referrerPolicy="no-referrer" />
            {i === 0 ? <span className="pp-main">الغلاف</span> : (
              <button type="button" className="pp-make" onClick={() => makeMain(i)}>اجعليها الغلاف</button>
            )}
            <button type="button" className="pp-del" onClick={() => onChange(value.filter((_, j) => j !== i))} aria-label="حذف الصورة">×</button>
          </div>
        ))}
        {value.length < max && (
          <button type="button" className="pp-add" onClick={() => input.current.click()} disabled={busy}>
            {busy ? <span className="spinner sm" /> : <><b>📷</b><span>أضيفي صور</span><small>{value.length}/{max}</small></>}
          </button>
        )}
      </div>
      <input ref={input} type="file" accept="image/*" multiple hidden onChange={(e) => onFiles(e.target.files)} />
      {error && <p className="alert">{error}</p>}
    </div>
  );
}

export function Stars({ value, size = 14 }) {
  const v = Math.round(Number(value) || 0);
  return (
    <span className="stars-row" aria-label={`${value} من 5`} style={{ fontSize: size }}>
      {[1, 2, 3, 4, 5].map((i) => <span key={i} className={i <= v ? 'on' : ''}>★</span>)}
    </span>
  );
}

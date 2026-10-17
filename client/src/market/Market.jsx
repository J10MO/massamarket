import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import { useStore } from '../store.jsx';
import { CloseIcon, FilterIcon, SearchIcon } from '../components/Icons.jsx';
import { CONDITIONS, ListingCard, ListingGrid, SIZES, useSaved } from './shared.jsx';

const SORTS = [['', 'المميز والأحدث'], ['price_asc', 'الأقل سعراً'], ['price_desc', 'الأعلى سعراً'], ['popular', 'الأكثر مشاهدة']];
const PRICES = [['', '', 'الكل'], ['', '50000', 'أقل من 50 ألف'], ['50000', '100000', '50 - 100 ألف'], ['100000', '', 'أكثر من 100 ألف']];

export default function Market() {
  const { settings, user } = useStore();
  const saved = useSaved();
  const [params, setParams] = useSearchParams();
  const [categories, setCategories] = useState([]);
  const [boosted, setBoosted] = useState([]);
  const [items, setItems] = useState([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sheet, setSheet] = useState(false);
  const [q, setQ] = useState(params.get('q') || '');
  const sentinel = useRef(null);

  const category = params.get('category') || '';
  const filterCount = ['size', 'condition', 'city', 'min', 'max', 'sort'].filter((k) => params.get(k)).length;
  const update = (patch) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) (v ? next.set(k, v) : next.delete(k));
    setParams(next, { replace: true });
  };

  useEffect(() => {
    api('/categories').then(setCategories).catch(() => {});
    api('/market/listings?type=used&boosted=1&limit=12').then((d) => setBoosted(d.items)).catch(() => {});
  }, []);

  const load = (page) => {
    const qs = new URLSearchParams(params);
    qs.set('page', page);
    qs.set('type', 'used'); // new shop dresses are shown with the store's new dresses, not here
    setLoading(true);
    api(`/market/listings?${qs}`)
      .then((d) => {
        setItems((prev) => (page === 1 ? d.items : [...prev, ...d.items]));
        setMeta(d);
        setError('');
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };
  useEffect(() => {
    setItems([]);
    load(1);
  }, [params]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !loading && meta.page < meta.pages) load(meta.page + 1);
    }, { rootMargin: '600px' });
    io.observe(el);
    return () => io.disconnect();
  }, [loading, meta]); // eslint-disable-line react-hooks/exhaustive-deps

  if (settings.market_enabled === false) {
    return <div className="container empty"><h2>سوق المستعمل متوقف حالياً</h2><Link to="/shop" className="btn btn-primary">تسوقي من المتجر</Link></div>;
  }

  return (
    <div className="container market">
      <section className="m-hero">
        <div>
          <span className="m-tag">♻ سوق جُمان للمستعمل</span>
          <h1>فساتين بحالة ممتازة<br /><em>بأسعار تنافسية</em></h1>
          <p>اشتري من بنات بلدچ مباشرة، أو بيعي فستانچ اللي لبستيه مرة وحدة واستفيدي من سعره.</p>
          <div className="m-hero-actions">
            <Link to={user ? '/sell' : '/account?next=/sell'} className="btn btn-rose">+ بيعي فستانچ</Link>
            <a href="#how" className="btn m-ghost">كيف يعمل؟</a>
          </div>
        </div>
        <ol className="m-steps" id="how">
          <li><b>1</b><span>صوّري الفستان وأضيفي السعر</span></li>
          <li><b>2</b><span>نراجع الإعلان وننشره</span></li>
          <li><b>3</b><span>تصلچ الطلبات وتبيعين مباشرة</span></li>
        </ol>
      </section>

      <form className="m-search" onSubmit={(e) => { e.preventDefault(); update({ q: q.trim() }); }} role="search">
        <SearchIcon width="18" height="18" />
        <input type="search" placeholder="ابحثي في المستعمل: فستان سهرة، عباية، ماركة..." value={q} onChange={(e) => setQ(e.target.value)} enterKeyHint="search" />
        <button type="button" className="m-filter-btn" onClick={() => setSheet(true)} aria-label="تصفية">
          <FilterIcon width="18" height="18" />{filterCount > 0 && <span className="pill-count">{filterCount}</span>}
        </button>
      </form>

      {boosted.length > 0 && !params.toString() && (
        <section className="m-boosted">
          <div className="m-row-head">
            <h2>✦ إعلانات مميزة</h2>
            <Link to="/my/listings" className="m-link">روّجي فستانچ</Link>
          </div>
          <div className="scroll-x deals-row">
            {boosted.map((l) => <ListingCard key={l.id} listing={l} saved={saved} />)}
          </div>
        </section>
      )}

      <div className="chips scroll-x sticky-chips">
        <button className={!category ? 'on' : ''} onClick={() => update({ category: '' })}>الكل</button>
        {categories.map((c) => (
          <button key={c.slug} className={category === c.slug ? 'on' : ''} onClick={() => update({ category: c.slug })}>{c.name}</button>
        ))}
      </div>

      <div className="shop-head">
        <p className="muted">{meta.total} فستان معروض</p>
        <span className="m-head-links">
          <Link to="/shops" className="m-link">🏬 كل المحلات</Link>
          {saved.saved.length > 0 && <Link to="/my/saved" className="m-link">♡ المحفوظة ({saved.saved.length})</Link>}
        </span>
      </div>

      {error && <p className="alert">{error}</p>}
      {!loading && !items.length && !error && (
        <div className="empty">
          <h2>لا توجد فساتين مطابقة</h2>
          <p className="muted">كوني أول من يعرض فستاناً هنا!</p>
          <Link to="/sell" className="btn btn-primary">+ بيعي فستانچ</Link>
        </div>
      )}
      <ListingGrid items={items} loading={loading} saved={saved} />
      {loading && items.length > 0 && <div className="spinner" />}
      <div ref={sentinel} />

      <Link to={user ? '/sell' : '/account?next=/sell'} className="m-fab">+ بيعي</Link>

      {sheet && (
        <div className="sheet-backdrop" onClick={() => setSheet(false)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="تصفية">
            <div className="sheet-head">
              <h3>تصفية المستعمل</h3>
              <button className="icon-btn" onClick={() => setSheet(false)} aria-label="إغلاق"><CloseIcon /></button>
            </div>
            <h4>الترتيب</h4>
            <div className="chips wrap">
              {SORTS.map(([v, l]) => <button key={l} className={(params.get('sort') || '') === v ? 'on' : ''} onClick={() => update({ sort: v })}>{l}</button>)}
            </div>
            <h4>الحالة</h4>
            <div className="chips wrap">
              {Object.entries(CONDITIONS).map(([k, c]) => (
                <button key={k} className={params.get('condition') === k ? 'on' : ''} onClick={() => update({ condition: params.get('condition') === k ? '' : k })}>{c.label}</button>
              ))}
            </div>
            <h4>المقاس</h4>
            <div className="chips wrap">
              {SIZES.map((s) => <button key={s} className={params.get('size') === s ? 'on' : ''} onClick={() => update({ size: params.get('size') === s ? '' : s })}>{s}</button>)}
            </div>
            <h4>السعر</h4>
            <div className="chips wrap">
              {PRICES.map(([min, max, l]) => (
                <button key={l} className={(params.get('min') || '') === min && (params.get('max') || '') === max ? 'on' : ''} onClick={() => update({ min, max })}>{l}</button>
              ))}
            </div>
            <h4>المحافظة</h4>
            <select className="m-select" value={params.get('city') || ''} onChange={(e) => update({ city: e.target.value })}>
              <option value="">كل المحافظات</option>
              {(settings.cities || []).map((c) => <option key={c}>{c}</option>)}
            </select>
            <div className="sheet-actions">
              <button className="btn btn-outline" onClick={() => setParams(category ? { category } : {})}>مسح</button>
              <button className="btn btn-primary" onClick={() => setSheet(false)}>عرض {meta.total} فستان</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

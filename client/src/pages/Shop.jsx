import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import { ProductGrid } from '../components/ProductCard.jsx';
import { CloseIcon, FilterIcon } from '../components/Icons.jsx';

const SORTS = [
  ['newest', 'الأحدث'],
  ['popular', 'الأكثر مبيعاً'],
  ['price_asc', 'السعر: من الأقل'],
  ['price_desc', 'السعر: من الأعلى'],
  ['rating', 'الأعلى تقييماً'],
];
const SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '52', '54', '56', '58', '60'];
const PRICES = [['', '', 'الكل'], ['', '200', 'أقل من 200'], ['200', '500', '200 - 500'], ['500', '', 'أكثر من 500']];

export default function Shop() {
  const [params, setParams] = useSearchParams();
  const [categories, setCategories] = useState([]);
  const [items, setItems] = useState([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sheet, setSheet] = useState(false);
  const sentinel = useRef(null);

  const category = params.get('category') || 'all';
  const sort = params.get('sort') || 'newest';
  const q = params.get('q') || '';
  const filterCount = ['size', 'min', 'max', 'badge'].filter((k) => params.get(k)).length;

  const update = (patch) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) (v ? next.set(k, v) : next.delete(k));
    setParams(next, { replace: true });
  };

  useEffect(() => {
    api('/categories').then(setCategories).catch(() => {});
  }, []);

  const load = (page) => {
    const qs = new URLSearchParams(params);
    qs.set('page', page);
    qs.set('limit', 20);
    setLoading(true);
    api(`/products?${qs}`)
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

  // Infinite scroll
  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !loading && meta.page < meta.pages) load(meta.page + 1);
    }, { rootMargin: '600px' });
    io.observe(el);
    return () => io.disconnect();
  }, [loading, meta]); // eslint-disable-line react-hooks/exhaustive-deps

  const title = q ? `نتائج "${q}"` : params.get('badge') === 'sale' ? 'العروض' : categories.find((c) => c.slug === category)?.name || 'كل المنتجات';

  return (
    <div className="container shop">
      <div className="shop-head">
        <div>
          <h1>{title}</h1>
          <p className="muted">{meta.total} منتج</p>
        </div>
        <button className="btn btn-soft" onClick={() => setSheet(true)}>
          <FilterIcon width="18" height="18" /> فرز وتصفية {filterCount > 0 && <span className="pill-count">{filterCount}</span>}
        </button>
      </div>

      <div className="chips scroll-x sticky-chips">
        <button className={category === 'all' ? 'on' : ''} onClick={() => update({ category: '' })}>الكل</button>
        {categories.map((c) => (
          <button key={c.slug} className={category === c.slug ? 'on' : ''} onClick={() => update({ category: c.slug })}>
            {c.name}
          </button>
        ))}
      </div>

      {error && <p className="alert">{error}</p>}
      {!loading && !items.length && !error && (
        <div className="empty">
          <h2>لا توجد منتجات مطابقة</h2>
          <button className="btn btn-primary" onClick={() => setParams({})}>مسح الفلاتر</button>
        </div>
      )}
      <ProductGrid products={items} loading={loading} />
      {loading && items.length > 0 && <div className="spinner" />}
      <div ref={sentinel} />

      {sheet && (
        <div className="sheet-backdrop" onClick={() => setSheet(false)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="فرز وتصفية">
            <div className="sheet-head">
              <h3>فرز وتصفية</h3>
              <button className="icon-btn" onClick={() => setSheet(false)} aria-label="إغلاق"><CloseIcon /></button>
            </div>
            <h4>ترتيب حسب</h4>
            <div className="chips wrap">
              {SORTS.map(([v, l]) => (
                <button key={v} className={sort === v ? 'on' : ''} onClick={() => update({ sort: v === 'newest' ? '' : v })}>{l}</button>
              ))}
            </div>
            <h4>المقاس</h4>
            <div className="chips wrap">
              {SIZES.map((s) => (
                <button key={s} className={params.get('size') === s ? 'on' : ''} onClick={() => update({ size: params.get('size') === s ? '' : s })}>{s}</button>
              ))}
            </div>
            <h4>السعر</h4>
            <div className="chips wrap">
              {PRICES.map(([min, max, l]) => (
                <button key={l} className={(params.get('min') || '') === min && (params.get('max') || '') === max ? 'on' : ''} onClick={() => update({ min, max })}>{l}</button>
              ))}
            </div>
            <label className="check">
              <input type="checkbox" checked={params.get('badge') === 'sale'} onChange={(e) => update({ badge: e.target.checked ? 'sale' : '' })} />
              العروض والتخفيضات فقط
            </label>
            <div className="sheet-actions">
              <button className="btn btn-outline" onClick={() => setParams(category !== 'all' ? { category } : {})}>مسح</button>
              <button className="btn btn-primary" onClick={() => setSheet(false)}>عرض {meta.total} منتج</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

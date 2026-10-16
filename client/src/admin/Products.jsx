import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api, price } from '../api.js';
import { Empty, ImagePicker, Loading, Modal, PageHead, Pager, Tags, useApi, useNotify } from './ui.jsx';

const SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL', 'Free Size', '52', '54', '56', '58', '60'];
const COLORS = ['أسود', 'أبيض', 'أحمر', 'وردي', 'بيج', 'كحلي', 'زيتي', 'عنابي', 'ذهبي', 'فضي', 'سماوي', 'بني', 'ليلكي', 'أخضر'];
const BADGES = { '': 'بدون', new: 'جديد', sale: 'تخفيض', hot: 'الأكثر طلباً' };

const EMPTY = {
  name: '', category_id: '', price: '', old_price: '', stock: 10, badge: '', description: '',
  sizes: ['S', 'M', 'L', 'XL'], colors: [], is_featured: false, is_active: true, gallery: [],
};

export function ProductForm({ id, categories, onClose, onSaved }) {
  const notify = useNotify();
  const [form, setForm] = useState(id ? null : { ...EMPTY, category_id: categories[0]?.id || '' });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!id) return;
    api(`/admin/products/${id}`)
      .then((p) => setForm({ ...p, old_price: p.old_price ?? '', badge: p.badge || '', gallery: [p.image_url, ...(p.images || [])] }))
      .catch((e) => setError(e.message));
  }, [id]);

  if (!form) return <Modal title="تعديل المنتج" onClose={onClose}>{error ? <p className="a-error">{error}</p> : <Loading />}</Modal>;

  const set = (k) => (e) => setForm({ ...form, [k]: e?.target ? (e.target.type === 'checkbox' ? e.target.checked : e.target.value) : e });
  const discount = form.old_price && form.price ? Math.round((1 - form.price / form.old_price) * 100) : 0;

  const save = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.gallery.length) return setError('أضيفي صورة واحدة على الأقل');
    setSaving(true);
    const { gallery, ...rest } = form;
    const body = {
      name: rest.name, category_id: rest.category_id, price: rest.price, old_price: rest.old_price,
      stock: rest.stock, badge: rest.badge, description: rest.description, sizes: rest.sizes, colors: rest.colors,
      is_featured: rest.is_featured, is_active: rest.is_active, image_url: gallery[0], images: gallery.slice(1),
    };
    try {
      const saved = await api(id ? `/admin/products/${id}` : '/admin/products', { method: id ? 'PATCH' : 'POST', body });
      notify(id ? 'تم حفظ التعديلات' : 'تمت إضافة المنتج');
      onSaved(saved);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={id ? `تعديل: ${form.name}` : 'إضافة فستان / منتج جديد'} onClose={onClose} wide>
      <form className="a-form" onSubmit={save}>
        <section>
          <h4>الصور</h4>
          <p className="a-muted">الصورة الأولى هي الرئيسية. يمكنك رفع عدة صور وترتيبها.</p>
          <ImagePicker value={form.gallery} onChange={set('gallery')} />
        </section>

        <section className="a-fields">
          <label className="span-2">اسم المنتج<input className="a-input" required value={form.name} onChange={set('name')} placeholder="مثال: فستان سهرة ستان طويل" /></label>
          <label>القسم
            <select className="a-input" required value={form.category_id} onChange={set('category_id')}>
              <option value="">اختاري القسم</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <label>الشارة
            <select className="a-input" value={form.badge} onChange={set('badge')}>
              {Object.entries(BADGES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </label>
          <label>السعر (د.ع)<input className="a-input" type="number" min="0" step="250" required inputMode="numeric" value={form.price} onChange={set('price')} /></label>
          <label>السعر قبل الخصم <small className="a-muted">{discount > 0 ? `خصم ${discount}%` : 'اختياري'}</small>
            <input className="a-input" type="number" min="0" step="250" inputMode="numeric" value={form.old_price} onChange={set('old_price')} />
          </label>
          <label>الكمية في المخزون<input className="a-input" type="number" min="0" inputMode="numeric" value={form.stock} onChange={set('stock')} /></label>
          <div className="a-switches">
            <label className="a-switch"><input type="checkbox" checked={form.is_active} onChange={set('is_active')} /><span />ظاهر في المتجر</label>
            <label className="a-switch"><input type="checkbox" checked={form.is_featured} onChange={set('is_featured')} /><span />منتج مميز (يظهر في الواجهة)</label>
          </div>
        </section>

        <section className="a-fields">
          <label className="span-2">المقاسات المتوفرة<Tags value={form.sizes} onChange={set('sizes')} placeholder="اكتبي مقاساً واضغطي Enter" suggestions={SIZES} /></label>
          <label className="span-2">الألوان<Tags value={form.colors} onChange={set('colors')} placeholder="اكتبي لوناً واضغطي Enter" suggestions={COLORS} /></label>
          <label className="span-2">الوصف<textarea className="a-input" rows="4" value={form.description || ''} onChange={set('description')} placeholder="الخامة، القصة، المناسبة، تعليمات العناية..." /></label>
        </section>

        {error && <p className="a-error">{error}</p>}
        <div className="a-row end sticky">
          <button type="button" className="a-btn ghost" onClick={onClose}>إلغاء</button>
          <button className="a-btn primary" disabled={saving}>{saving ? 'جارٍ الحفظ...' : id ? 'حفظ التعديلات' : 'إضافة المنتج'}</button>
        </div>
      </form>
    </Modal>
  );
}

export default function Products() {
  const notify = useNotify();
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState('');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState(params.get('category') || '');
  const [status, setStatus] = useState(params.get('status') || '');
  const [sort, setSort] = useState('');
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState(null); // null | 'new' | id
  const cats = useApi('/admin/categories');
  const { data, loading, error, reload, setData } = useApi(
    `/admin/products?q=${encodeURIComponent(search)}&category=${category}&status=${status}&sort=${sort}&page=${page}`
  );

  useEffect(() => setPage(1), [search, category, status, sort]);
  useEffect(() => {
    if (params.get('new')) {
      setEditing('new');
      setParams({}, { replace: true });
    }
  }, [params, setParams]);

  const patch = async (p, body, msg) => {
    try {
      const updated = await api(`/admin/products/${p.id}`, { method: 'PATCH', body });
      setData((d) => ({ ...d, items: d.items.map((x) => (x.id === p.id ? { ...x, ...updated } : x)) }));
      if (msg) notify(msg);
    } catch (e) {
      notify(e.message);
    }
  };
  const remove = async (p) => {
    if (!confirm(`حذف "${p.name}" نهائياً؟\nإذا تريدين إخفاءه مؤقتاً استخدمي زر الإخفاء بدلاً من الحذف.`)) return;
    await api(`/admin/products/${p.id}`, { method: 'DELETE' });
    notify('تم حذف المنتج');
    reload();
  };

  return (
    <>
      <PageHead title="الفساتين والمنتجات" sub={data ? `${data.total} منتج` : ''}>
        <button className="a-btn primary" onClick={() => setEditing('new')}>+ إضافة منتج</button>
      </PageHead>

      <div className="a-toolbar wrap">
        <form onSubmit={(e) => { e.preventDefault(); setSearch(q.trim()); }} className="a-grow a-row">
          <input className="a-input" placeholder="ابحثي بالاسم أو رقم المنتج" value={q} onChange={(e) => setQ(e.target.value)} />
          <button className="a-btn">بحث</button>
        </form>
        <select className="a-input auto" value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">كل الأقسام</option>
          {cats.data?.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.product_count})</option>)}
        </select>
        <select className="a-input auto" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">كل الحالات</option>
          <option value="active">ظاهر</option>
          <option value="hidden">مخفي</option>
          <option value="featured">مميز</option>
          <option value="low">مخزون منخفض (≤5)</option>
        </select>
        <select className="a-input auto" value={sort} onChange={(e) => setSort(e.target.value)}>
          <option value="">الأحدث</option>
          <option value="sold">الأكثر مبيعاً</option>
          <option value="price_desc">الأعلى سعراً</option>
          <option value="price_asc">الأقل سعراً</option>
          <option value="stock">الأقل مخزوناً</option>
        </select>
      </div>

      {error && <p className="a-error">{error}</p>}
      {loading && !data ? <Loading /> : !data?.items.length ? <Empty>لا توجد منتجات مطابقة</Empty> : (
        <div className="a-products">
          {data.items.map((p) => (
            <article key={p.id} className={`a-product ${p.is_active ? '' : 'off'}`}>
              <button className="a-product-img" onClick={() => setEditing(p.id)} aria-label={`تعديل ${p.name}`}>
                <img src={p.image_url} alt="" loading="lazy" referrerPolicy="no-referrer" />
                {!p.is_active && <span className="a-flag">مخفي</span>}
                {p.is_featured && <span className="a-flag star">★ مميز</span>}
                {p.images?.length > 0 && <span className="a-flag count">{p.images.length + 1} صور</span>}
              </button>
              <div className="a-product-body">
                <small className="a-muted">#{p.id} · {p.category_name}</small>
                <b className="a-ellipsis">{p.name}</b>
                <div className="a-product-meta">
                  <span className="a-price">{price(p.price)}</span>
                  {p.old_price && <del>{price(p.old_price)}</del>}
                </div>
                <div className="a-product-meta">
                  <span className={p.stock === 0 ? 'a-danger' : p.stock <= 5 ? 'a-warn' : 'a-muted'}>المخزون: {p.stock}</span>
                  <span className="a-muted">بيع: {p.sold_count}</span>
                </div>
                <div className="a-product-actions">
                  <button onClick={() => setEditing(p.id)}>تعديل</button>
                  <button onClick={() => patch(p, { is_active: !p.is_active }, p.is_active ? 'تم إخفاء المنتج' : 'المنتج ظاهر الآن')}>
                    {p.is_active ? 'إخفاء' : 'إظهار'}
                  </button>
                  <button onClick={() => patch(p, { is_featured: !p.is_featured })} title="مميز">{p.is_featured ? '★' : '☆'}</button>
                  <button className="a-danger" onClick={() => remove(p)} title="حذف">🗑</button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
      {data && <Pager page={data.page} pages={data.pages} onPage={setPage} />}

      {editing && cats.data && (
        <ProductForm
          id={editing === 'new' ? null : editing}
          categories={cats.data}
          onClose={() => setEditing(null)}
          onSaved={() => { reload(); cats.reload(); }}
        />
      )}
    </>
  );
}

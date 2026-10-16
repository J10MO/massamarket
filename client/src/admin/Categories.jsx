import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { Empty, ImagePicker, Loading, Modal, PageHead, Tags, useApi, useNotify } from './ui.jsx';

const PALETTE = ['#0B1A3E', '#A8627D', '#9C8064', '#4A3B4F', '#7E5F7A', '#2F5D62', '#8C3B4A', '#5B6B8C'];

function CategoryForm({ cat, count, onClose, onSaved }) {
  const notify = useNotify();
  const [form, setForm] = useState({
    name: cat?.name || '', slug: cat?.slug || '', description: cat?.description || '', color: cat?.color || PALETTE[0],
    sort_order: cat?.sort_order ?? count, image: cat?.image_url ? [cat.image_url] : [], pinterest_boards: cat?.pinterest_boards || [],
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e?.target ? e.target.value : e });

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    const { image, ...rest } = form;
    try {
      await api(cat ? `/admin/categories/${cat.id}` : '/admin/categories', {
        method: cat ? 'PATCH' : 'POST',
        body: { ...rest, image_url: image[0] || null },
      });
      notify(cat ? 'تم حفظ القسم' : 'تمت إضافة القسم');
      onSaved();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={cat ? `تعديل قسم: ${cat.name}` : 'إضافة قسم جديد'} onClose={onClose}>
      <form className="a-form" onSubmit={save}>
        <section className="a-fields">
          <label className="span-2">اسم القسم<input className="a-input" required value={form.name} onChange={set('name')} placeholder="مثال: فساتين أعراس" /></label>
          <label>الرابط المختصر (بالإنكليزي)
            <input className="a-input" dir="ltr" value={form.slug} onChange={set('slug')} placeholder="wedding-dresses" />
          </label>
          <label>الترتيب<input className="a-input" type="number" value={form.sort_order} onChange={set('sort_order')} /></label>
          <label className="span-2">الوصف<input className="a-input" value={form.description} onChange={set('description')} placeholder="جملة قصيرة تظهر مع القسم" /></label>
          <div className="span-2">
            <span className="a-label">لون القسم</span>
            <div className="a-colors">
              {PALETTE.map((c) => (
                <button type="button" key={c} style={{ background: c }} className={form.color.toLowerCase() === c.toLowerCase() ? 'on' : ''} onClick={() => set('color')(c)} aria-label={c} />
              ))}
              <input type="color" value={form.color} onChange={set('color')} aria-label="لون مخصص" />
            </div>
          </div>
        </section>
        <section>
          <h4>صورة الغلاف <small className="a-muted">(اختياري — إن تُركت فارغة تُستخدم صورة أكثر منتج مبيعاً)</small></h4>
          <ImagePicker value={form.image} onChange={set('image')} max={1} />
        </section>
        <section>
          <h4>لوحات Pinterest لهذا القسم</h4>
          <p className="a-muted">عند الضغط على "تحديث كل الأقسام" تُستورد أحدث الصور من هذه اللوحات.</p>
          <Tags value={form.pinterest_boards} onChange={set('pinterest_boards')} placeholder="user/board أو رابط اللوحة ثم Enter" />
        </section>
        {error && <p className="a-error">{error}</p>}
        <div className="a-row end">
          <button type="button" className="a-btn ghost" onClick={onClose}>إلغاء</button>
          <button className="a-btn primary" disabled={saving}>{saving ? '...' : 'حفظ'}</button>
        </div>
      </form>
    </Modal>
  );
}

export default function Categories() {
  const notify = useNotify();
  const { data, loading, error, reload } = useApi('/admin/categories');
  const [editing, setEditing] = useState(null); // null | 'new' | category

  const move = async (i, d) => {
    const a = data[i];
    const b = data[i + d];
    await Promise.all([
      api(`/admin/categories/${a.id}`, { method: 'PATCH', body: { sort_order: i + d } }),
      api(`/admin/categories/${b.id}`, { method: 'PATCH', body: { sort_order: i } }),
    ]);
    reload();
  };
  const remove = async (c) => {
    if (!confirm(`حذف قسم "${c.name}"؟`)) return;
    try {
      await api(`/admin/categories/${c.id}`, { method: 'DELETE' });
      notify('تم حذف القسم');
      reload();
    } catch (e) {
      alert(e.message);
    }
  };

  return (
    <>
      <PageHead title="الأقسام" sub="تنظيم الفساتين في أقسام تظهر في المتجر">
        <button className="a-btn primary" onClick={() => setEditing('new')}>+ إضافة قسم</button>
      </PageHead>
      {error && <p className="a-error">{error}</p>}
      {loading && !data ? <Loading /> : !data?.length ? <Empty>لا توجد أقسام بعد</Empty> : (
        <div className="a-cats">
          {data.map((c, i) => (
            <article key={c.id} className="a-cat" style={{ '--c': c.color }}>
              <div className="a-cat-cover">
                {c.cover && <img src={c.cover} alt="" referrerPolicy="no-referrer" />}
                <span className="a-cat-order">
                  <button disabled={i === 0} onClick={() => move(i, -1)} aria-label="تقديم">▲</button>
                  <button disabled={i === data.length - 1} onClick={() => move(i, 1)} aria-label="تأخير">▼</button>
                </span>
              </div>
              <div className="a-cat-body">
                <b>{c.name}</b>
                <small className="a-muted" dir="ltr">/{c.slug}</small>
                {c.description && <p>{c.description}</p>}
                <div className="a-cat-stats">
                  <span><b>{c.active_count}</b> ظاهر</span>
                  <span><b>{c.product_count - c.active_count}</b> مخفي</span>
                  <span><b>{c.pinterest_boards.length}</b> لوحة</span>
                </div>
                <div className="a-product-actions">
                  <button onClick={() => setEditing(c)}>تعديل</button>
                  <Link to={`/admin/products?category=${c.id}`}>المنتجات</Link>
                  <a href={`/shop?category=${c.slug}`} target="_blank" rel="noreferrer">عرض ↗</a>
                  <button className="a-danger" onClick={() => remove(c)}>حذف</button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
      {editing && (
        <CategoryForm cat={editing === 'new' ? null : editing} count={data?.length || 0} onClose={() => setEditing(null)} onSaved={reload} />
      )}
    </>
  );
}

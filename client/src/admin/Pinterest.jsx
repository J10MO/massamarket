import { useState } from 'react';
import { api } from '../api.js';
import { Loading, PageHead, useApi } from './ui.jsx';

export default function Pinterest() {
  const cats = useApi('/admin/categories');
  const [url, setUrl] = useState('');
  const [cat, setCat] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  const run = async (fn) => {
    setBusy(true);
    setResult(null);
    try {
      setResult(await fn());
      cats.reload();
    } catch (e) {
      setResult({ error: e.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHead title="استيراد من Pinterest" sub="أضيفي فساتين بسرعة من لوحات أو دبابيس Pinterest العامة" />

      <div className="a-grid-2">
        <div className="a-card">
          <h3>استيراد من رابط</h3>
          <p className="a-muted">الصقي رابط لوحة (Board) لجلب آخر ~25 صورة، أو رابط دبوس (Pin) لصورة واحدة.</p>
          <form
            className="a-form"
            onSubmit={(e) => {
              e.preventDefault();
              run(async () => {
                const r = await api('/admin/import', { method: 'POST', body: { url, category_id: cat } });
                setUrl('');
                return { msg: `تم العثور على ${r.found} صورة، وأُضيف ${r.added} منتج جديد (المكرر يُتجاهل تلقائياً).` };
              });
            }}
          >
            <input className="a-input" required dir="ltr" placeholder="https://www.pinterest.com/user/board/" value={url} onChange={(e) => setUrl(e.target.value)} />
            <select className="a-input" required value={cat} onChange={(e) => setCat(e.target.value)}>
              <option value="">إلى أي قسم؟</option>
              {cats.data?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <button className="a-btn primary" disabled={busy}>{busy ? 'جارٍ الاستيراد...' : 'استيراد'}</button>
          </form>
        </div>

        <div className="a-card">
          <h3>تحديث كل الأقسام</h3>
          <p className="a-muted">يجلب أحدث الدبابيس من اللوحات المربوطة بكل قسم (من صفحة الأقسام).</p>
          {!cats.data ? <Loading /> : (
            <ul className="a-boards">
              {cats.data.map((c) => (
                <li key={c.id}><b>{c.name}</b><small dir="ltr">{c.pinterest_boards.join(' · ') || '—'}</small></li>
              ))}
            </ul>
          )}
          <button
            className="a-btn"
            disabled={busy}
            onClick={() => run(async () => {
              const r = await api('/admin/import/refresh', { method: 'POST' });
              return { msg: `تمت إضافة ${r.added} منتج جديد.`, log: r.log };
            })}
          >
            {busy ? 'جارٍ التحديث...' : '↻ تحديث الآن'}
          </button>
        </div>
      </div>

      {result && (
        <div className={`a-card ${result.error ? 'a-error' : 'a-success'}`}>
          <b>{result.error || result.msg}</b>
          {result.log && <pre className="a-log" dir="ltr">{result.log.join('\n')}</pre>}
        </div>
      )}

      <div className="a-card a-muted">
        <b>ملاحظة:</b> المنتجات المستوردة تأخذ اسماً وسعراً ومقاسات تلقائية. عدّليها من صفحة المنتجات قبل البيع،
        ويُفضّل استبدال الصور بصور منتجاتك الحقيقية لأن صور Pinterest تعود لأصحابها.
      </div>
    </>
  );
}

import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api, price } from '../api.js';
import { waLink } from '../components/Layout.jsx';
import { CONDITIONS, LISTING_STATUS, MARKET_ORDER_STATUS } from '../market/shared.jsx';
import { toIntl } from '../market/SellerCenter.jsx';
import { Empty, fmtDate, Loading, Modal, PageHead, Pager, useApi, useNotify } from './ui.jsx';

const REJECT_REASONS = ['الصور غير واضحة أو قليلة', 'الصور مأخوذة من الإنترنت', 'الفستان لا يبدو نظيفاً', 'السعر غير منطقي', 'المنتج غير مناسب للسوق'];

function ListingReview({ listing: l, onClose, onChanged }) {
  const notify = useNotify();
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const act = async (action, extra = {}) => {
    setBusy(true);
    try {
      await api(`/admin/market/listings/${l.id}`, { method: 'PATCH', body: { action, ...extra } });
      notify({ approve: 'تم نشر الإعلان', reject: 'تم رفض الإعلان', hide: 'تم إخفاء الإعلان', restore: 'تمت إعادة النشر', boost: 'تم تمييز الإعلان', unboost: 'تم إلغاء التمييز' }[action]);
      onChanged();
      onClose();
    } catch (e) {
      notify(e.message);
    } finally {
      setBusy(false);
    }
  };
  const remove = async () => {
    if (!confirm('حذف الإعلان نهائياً؟')) return;
    await api(`/admin/market/listings/${l.id}`, { method: 'DELETE' });
    notify('تم حذف الإعلان');
    onChanged();
    onClose();
  };

  return (
    <Modal title={`إعلان #${l.id}: ${l.title}`} onClose={onClose} wide>
      <div className="a-order">
        <div className="a-review-imgs">
          {l.images.map((src) => <a key={src} href={src} target="_blank" rel="noreferrer"><img src={src} alt="" referrerPolicy="no-referrer" /></a>)}
        </div>
        <div className="a-grid-2">
          <div className="a-box">
            <h4>الفستان</h4>
            <p className="a-sum"><span>السعر</span><b>{price(l.price)}</b></p>
            {l.original_price && <p className="a-sum"><span>السعر الأصلي</span><span>{price(l.original_price)}</span></p>}
            <p className="a-sum"><span>المقاس</span><span>{l.size}</span></p>
            <p className="a-sum"><span>الحالة</span><span>{CONDITIONS[l.condition]?.label}</span></p>
            <p className="a-sum"><span>القسم</span><span>{l.category_name || '—'}</span></p>
            {l.brand && <p className="a-sum"><span>الماركة</span><span>{l.brand}</span></p>}
            <p className="a-sum"><span>المحافظة</span><span>{l.city}</span></p>
            <p className="a-sum"><span>المشاهدات</span><span>{l.views}</span></p>
            {l.description && <p className="a-note">{l.description}</p>}
          </div>
          <div className="a-box">
            <h4>البائعة</h4>
            <p><b>{l.seller_name}</b></p>
            <p dir="ltr" className="a-right">{l.seller_phone || '—'}</p>
            <p className="a-muted" dir="ltr">{l.seller_email}</p>
            {l.seller_phone && (
              <div className="a-row">
                <a className="a-btn wa sm" href={waLink(toIntl(l.seller_phone))} target="_blank" rel="noreferrer">واتساب</a>
                <a className="a-btn sm" href={`tel:${l.seller_phone}`}>اتصال</a>
              </div>
            )}
            <p className="a-muted">نُشر {fmtDate(l.created_at, true)}</p>
            {l.reports > 0 && <p className="a-error">⚑ {l.reports} بلاغ مفتوح</p>}
            {l.is_boosted && <p className="a-success a-note">✦ مميز حتى {fmtDate(l.boosted_until, true)}</p>}
          </div>
        </div>

        {['pending', 'active', 'hidden'].includes(l.status) && (
          <div className="a-box">
            <h4>سبب الرفض (يظهر للبائعة)</h4>
            <div className="a-suggest">
              {REJECT_REASONS.map((r) => <button type="button" key={r} onClick={() => setReason(r)}>{r}</button>)}
            </div>
            <input className="a-input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="اكتبي السبب..." />
          </div>
        )}

        <div className="a-row end">
          <button className="a-btn danger ghost" onClick={remove} disabled={busy}>حذف</button>
          {['pending', 'active', 'hidden'].includes(l.status) && <button className="a-btn danger" disabled={busy || !reason.trim()} onClick={() => act('reject', { reason })}>رفض</button>}
          {['active', 'pending'].includes(l.status) && <button className="a-btn" disabled={busy} onClick={() => act('hide')}>إخفاء</button>}
          {l.is_boosted
            ? <button className="a-btn" disabled={busy} onClick={() => act('unboost')}>إلغاء التمييز</button>
            : ['active'].includes(l.status) && <button className="a-btn" disabled={busy} onClick={() => act('boost', { days: 7 })}>✦ تمييز مجاني 7 أيام</button>}
          {l.status === 'pending' && <button className="a-btn primary" disabled={busy} onClick={() => act('approve')}>✓ موافقة ونشر</button>}
          {['rejected', 'hidden'].includes(l.status) && <button className="a-btn primary" disabled={busy} onClick={() => act('restore')}>إعادة النشر</button>}
        </div>
      </div>
    </Modal>
  );
}

function Listings() {
  const [status, setStatus] = useState('pending');
  const [q, setQ] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(null);
  const { data, loading, error, reload } = useApi(`/admin/market/listings?status=${status}&q=${encodeURIComponent(search)}&page=${page}`);
  useEffect(() => setPage(1), [status, search]);
  const counts = data?.counts || {};

  return (
    <>
      <div className="a-tabs">
        {[['pending', 'بانتظار المراجعة'], ['active', 'منشور'], ['boosted', '✦ مميز'], ['reserved', 'محجوز'], ['sold', 'مباع'], ['rejected', 'مرفوض'], ['hidden', 'مخفي'], ['', 'الكل']].map(([k, label]) => (
          <button key={k} className={status === k ? 'on' : ''} onClick={() => setStatus(k)}>
            {label} {counts[k] > 0 && <span>{counts[k]}</span>}
          </button>
        ))}
      </div>
      <form className="a-toolbar" onSubmit={(e) => { e.preventDefault(); setSearch(q.trim()); }}>
        <input className="a-input" placeholder="ابحثي بالعنوان أو اسم/هاتف البائعة أو رقم الإعلان" value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="a-btn">بحث</button>
      </form>
      {error && <p className="a-error">{error}</p>}
      {loading && !data ? <Loading /> : !data?.items.length ? <Empty>لا توجد إعلانات هنا</Empty> : (
        <div className="a-products">
          {data.items.map((l) => (
            <article key={l.id} className="a-product">
              <button className="a-product-img" onClick={() => setOpen(l)}>
                <img src={l.images[0]} alt="" loading="lazy" referrerPolicy="no-referrer" />
                <span className={`a-flag ls-${l.status}`}>{LISTING_STATUS[l.status]}</span>
                {l.is_boosted && <span className="a-flag star">✦ مميز</span>}
                {l.reports > 0 && <span className="a-flag count a-danger-bg">⚑ {l.reports}</span>}
              </button>
              <div className="a-product-body">
                <small className="a-muted">#{l.id} · {l.shop_name ? `🏬 ${l.shop_name}` : l.seller_name} · {l.city}</small>
                <b className="a-ellipsis">{l.title}</b>
                <div className="a-product-meta"><span className="a-price">{price(l.price)}</span><span className="a-muted">{l.size} · {CONDITIONS[l.condition]?.label}</span></div>
                <div className="a-product-actions">
                  <button onClick={() => setOpen(l)}>{l.status === 'pending' ? 'مراجعة' : 'التفاصيل'}</button>
                  <a href={`/market/${l.id}`} target="_blank" rel="noreferrer">عرض ↗</a>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
      {data && <Pager page={data.page} pages={data.pages} onPage={setPage} />}
      {open && <ListingReview listing={open} onClose={() => setOpen(null)} onChanged={reload} />}
    </>
  );
}

function Promotions() {
  const notify = useNotify();
  const [status, setStatus] = useState('pending');
  const { data, loading, reload } = useApi(`/admin/market/promotions?status=${status}`);
  const decide = async (p, action) => {
    let note = '';
    if (action === 'reject') {
      note = prompt('سبب الرفض (يظهر للبائعة):', 'لم يصل المبلغ');
      if (!note) return;
    } else if (!confirm(`تأكيد استلام ${price(p.amount)} وتفعيل الترويج ${p.days} أيام؟`)) return;
    try {
      await api(`/admin/market/promotions/${p.id}`, { method: 'POST', body: { action, note } });
      notify(action === 'approve' ? 'تم تفعيل الترويج ✦' : 'تم رفض الطلب');
      reload();
    } catch (e) {
      notify(e.message);
    }
  };
  return (
    <>
      <div className="a-tabs">
        {[['pending', 'بانتظار تأكيد الدفع'], ['active', 'مفعّل'], ['rejected', 'مرفوض'], ['', 'الكل']].map(([k, l]) => (
          <button key={k} className={status === k ? 'on' : ''} onClick={() => setStatus(k)}>{l}</button>
        ))}
      </div>
      {loading && !data ? <Loading /> : !data?.length ? <Empty>لا توجد طلبات ترويج</Empty> : (
        <div className="a-card flush">
          <div className="a-table-wrap">
            <table className="a-table">
              <thead><tr><th>الإعلان</th><th>البائعة</th><th>الباقة</th><th>الدفع</th><th className="a-hide-sm">التاريخ</th><th>الحالة</th></tr></thead>
              <tbody>
                {data.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <div className="a-cell-img">
                        <img src={p.image_url} alt="" referrerPolicy="no-referrer" />
                        <a href={`/market/${p.listing_id}`} target="_blank" rel="noreferrer" className="a-link">{p.title}</a>
                      </div>
                    </td>
                    <td>{p.user_name}<small className="a-block" dir="ltr">{p.user_phone}</small></td>
                    <td><b>{p.days} أيام</b><small className="a-block">{price(p.amount)}</small></td>
                    <td>
                      {p.payment_method}
                      {p.payment_ref && <small className="a-block" dir="ltr">#{p.payment_ref}</small>}
                      {p.receipt_url && <a className="a-link" href={p.receipt_url} target="_blank" rel="noreferrer">🧾 الإيصال</a>}
                    </td>
                    <td className="a-hide-sm">{fmtDate(p.created_at, true)}</td>
                    <td>
                      {p.status === 'pending' ? (
                        <div className="a-row">
                          <button className="a-btn primary sm" onClick={() => decide(p, 'approve')}>✓ تأكيد</button>
                          <button className="a-btn danger sm" onClick={() => decide(p, 'reject')}>رفض</button>
                        </div>
                      ) : p.status === 'active' ? (
                        <span className="a-pill st-delivered">حتى {fmtDate(p.ends_at)}</span>
                      ) : <span className="a-pill st-cancelled" title={p.admin_note}>مرفوض</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}

function Orders() {
  const [status, setStatus] = useState('');
  const { data, loading } = useApi(`/admin/market/orders?status=${status}`);
  return (
    <>
      <div className="a-tabs">
        {[['', 'الكل'], ...Object.entries(MARKET_ORDER_STATUS)].map(([k, l]) => (
          <button key={k} className={status === k ? 'on' : ''} onClick={() => setStatus(k)}>{l}</button>
        ))}
      </div>
      {loading && !data ? <Loading /> : !data?.length ? <Empty>لا توجد طلبات بين العميلات بعد</Empty> : (
        <div className="a-card flush">
          <div className="a-table-wrap">
            <table className="a-table">
              <thead><tr><th>#</th><th>الفستان</th><th>البائعة</th><th>المشترية</th><th>السعر</th><th className="a-hide-sm">العمولة</th><th>الحالة</th></tr></thead>
              <tbody>
                {data.map((o) => (
                  <tr key={o.id}>
                    <td>#{o.id}<small className="a-block">{fmtDate(o.created_at)}</small></td>
                    <td><div className="a-cell-img"><img src={o.image_url} alt="" referrerPolicy="no-referrer" /><span>{o.title}</span></div></td>
                    <td>{o.seller_name}<small className="a-block" dir="ltr">{o.seller_phone}</small></td>
                    <td>{o.buyer_name}<small className="a-block" dir="ltr">{o.buyer_phone} · {o.city}</small></td>
                    <td><b>{price(o.price)}</b></td>
                    <td className="a-hide-sm">{price(o.commission)}</td>
                    <td><span className={`a-pill mo-${o.status}`}>{MARKET_ORDER_STATUS[o.status]}</span>{o.rating && <small className="a-block">{'★'.repeat(o.rating)}</small>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}

function Commissions() {
  const notify = useNotify();
  const [status, setStatus] = useState('pending');
  const { data, loading, reload } = useApi(`/admin/market/commissions?status=${status}`);
  const decide = async (p, action) => {
    let note = '';
    if (action === 'reject') {
      note = prompt('سبب الرفض (يظهر للبائعة):', 'لم يصل المبلغ');
      if (!note) return;
    } else if (!confirm(`تأكيد وصول ${price(p.amount)} من ${p.seller_name}؟`)) return;
    try {
      await api(`/admin/market/commissions/${p.id}`, { method: 'POST', body: { action, note } });
      notify(action === 'approve' ? 'تم تأكيد استلام العمولة' : 'تم رفض الدفعة');
      reload();
    } catch (e) {
      notify(e.message);
    }
  };
  return (
    <>
      <div className="a-tabs">
        {[['pending', 'بانتظار التأكيد'], ['approved', 'مستلمة'], ['rejected', 'مرفوضة'], ['', 'الكل']].map(([k, l]) => (
          <button key={k} className={status === k ? 'on' : ''} onClick={() => setStatus(k)}>{l}</button>
        ))}
      </div>
      {loading && !data ? <Loading /> : (
        <>
          {!data.payments.length ? <Empty>لا توجد دفعات هنا</Empty> : (
            <div className="a-card flush">
              <div className="a-table-wrap">
                <table className="a-table">
                  <thead><tr><th>البائعة</th><th>المبلغ</th><th>الدفع</th><th className="a-hide-sm">التاريخ</th><th>الحالة</th></tr></thead>
                  <tbody>
                    {data.payments.map((p) => (
                      <tr key={p.id}>
                        <td>{p.seller_name}<small className="a-block" dir="ltr">{p.seller_phone}</small></td>
                        <td><b>{price(p.amount)}</b><small className="a-block">{p.order_ids.length} بيع</small></td>
                        <td>
                          {p.payment_method}
                          {p.payment_ref && <small className="a-block" dir="ltr">#{p.payment_ref}</small>}
                          {p.receipt_url && <a className="a-link" href={p.receipt_url} target="_blank" rel="noreferrer">🧾 الإيصال</a>}
                        </td>
                        <td className="a-hide-sm">{fmtDate(p.created_at, true)}</td>
                        <td>
                          {p.status === 'pending' ? (
                            <div className="a-row">
                              <button className="a-btn primary sm" onClick={() => decide(p, 'approve')}>✓ وصل</button>
                              <button className="a-btn danger sm" onClick={() => decide(p, 'reject')}>لم يصل</button>
                            </div>
                          ) : p.status === 'approved' ? <span className="a-pill st-delivered">مستلمة</span>
                            : <span className="a-pill st-cancelled" title={p.admin_note}>مرفوضة</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {data.debtors.length > 0 && (
            <div className="a-card">
              <div className="a-card-head"><h3>عمولات لم تُدفع بعد</h3><span className="a-muted">{data.debtors.length} بائعة</span></div>
              <ul className="a-list">
                {data.debtors.map((d) => (
                  <li key={d.id}>
                    <span className="a-avatar">{d.name?.[0]}</span>
                    <div><b>{d.name}</b><small dir="ltr">{d.phone || '—'}</small></div>
                    <b>{price(d.due)}</b>
                    {d.phone && (
                      <a className="a-btn wa sm" target="_blank" rel="noreferrer"
                        href={`${waLink(toIntl(d.phone))}?text=${encodeURIComponent(`مرحباً ${d.name} 🌸 عليچ عمولة مبيعات بقيمة ${price(d.due)} في سوق جُمان. تقدرين تسددينها من مركز البائعة عبر الدفع الإلكتروني. شكراً لچ!`)}`}>
                        تذكير
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </>
  );
}

function Reports() {
  const notify = useNotify();
  const { data, loading, reload } = useApi('/admin/market/reports');
  const resolve = async (r) => {
    await api(`/admin/market/reports/${r.id}`, { method: 'PATCH' });
    notify('تم إغلاق البلاغ');
    reload();
  };
  return loading && !data ? <Loading /> : !data?.length ? <Empty>لا توجد بلاغات 👍</Empty> : (
    <ul className="a-list a-card">
      {data.map((r) => (
        <li key={r.id} className={r.status === 'resolved' ? 'a-dim' : ''}>
          <img src={r.image_url} alt="" referrerPolicy="no-referrer" />
          <div>
            <b>{r.reason}</b>
            <small>{r.title} · {r.reporter || 'زائرة'} · {fmtDate(r.created_at, true)}</small>
            {r.details && <small>{r.details}</small>}
          </div>
          <a className="a-btn sm" href={`/market/${r.listing_id}`} target="_blank" rel="noreferrer">عرض</a>
          {r.status === 'open' ? <button className="a-btn sm primary" onClick={() => resolve(r)}>تم الحل</button> : <span className="a-pill st-delivered">مغلق</span>}
        </li>
      ))}
    </ul>
  );
}

export default function Market() {
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') || 'listings';
  const stats = useApi('/admin/market/stats', [tab]);
  const s = stats.data;
  const TABS = [
    ['listings', 'الإعلانات', s?.pending_listings],
    ['promotions', 'الإعلانات المدفوعة', s?.pending_promotions],
    ['commissions', 'العمولات', s?.pending_commissions],
    ['orders', 'طلبات البيع', s?.open_orders],
    ['reports', 'البلاغات', s?.open_reports],
  ];
  return (
    <>
      <PageHead title="سوق المستعمل" sub="مراجعة إعلانات العميلات، الترويج المدفوع، والطلبات بينهن" />
      {s && (
        <div className="a-kpis">
          <div className="a-kpi"><small>بانتظار المراجعة</small><b>{s.pending_listings}</b><span>{s.active_listings} منشور</span></div>
          <div className="a-kpi"><small>ترويج بانتظار الدفع</small><b>{s.pending_promotions}</b><span>{s.boosted_now} مميز الآن</span></div>
          <div className="a-kpi"><small>إيرادات الإعلانات</small><b>{price(s.ads_revenue)}</b><span>مؤكدة</span></div>
          <div className="a-kpi"><small>مبيعات مكتملة</small><b>{s.completed_orders}</b><span>{price(s.gmv)}</span></div>
          <div className="a-kpi"><small>العمولات المستلمة</small><b>{price(s.commission_collected)}</b><span>مستحقة: {price(s.commission_due)}</span></div>
          <div className="a-kpi"><small>بلاغات مفتوحة</small><b>{s.open_reports}</b><span>{s.open_orders} طلب جارٍ</span></div>
        </div>
      )}
      <div className="a-seg wide">
        {TABS.map(([k, l, n]) => (
          <button key={k} className={tab === k ? 'on' : ''} onClick={() => setParams({ tab: k })}>
            {l} {n > 0 && <span className="a-count">{n}</span>}
          </button>
        ))}
      </div>
      {tab === 'listings' && <Listings />}
      {tab === 'promotions' && <Promotions />}
      {tab === 'commissions' && <Commissions />}
      {tab === 'orders' && <Orders />}
      {tab === 'reports' && <Reports />}
    </>
  );
}

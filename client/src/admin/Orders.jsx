import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api, ORDER_STATUS, price } from '../api.js';
import { useStore } from '../store.jsx';
import { waLink } from '../components/Layout.jsx';
import { Empty, fmtDate, Loading, Modal, PageHead, Pager, StatusPill, useApi, useNotify } from './ui.jsx';

// Iraqi numbers: 07xxxxxxxxx -> 9647xxxxxxxxx for WhatsApp
const toIntl = (phone) => {
  const d = String(phone).replace(/\D/g, '');
  return d.startsWith('0') ? `964${d.slice(1)}` : d;
};

function printInvoice(o, store) {
  const w = window.open('', '_blank', 'width=720,height=900');
  if (!w) return;
  const rows = o.items.map((i) => `<tr><td>${i.name}${i.size ? ` (${i.size})` : ''}</td><td>${i.quantity}</td><td>${price(i.price)}</td><td>${price(i.price * i.quantity)}</td></tr>`).join('');
  w.document.write(`<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><title>فاتورة #${o.id}</title>
  <style>body{font-family:Tahoma,Arial;padding:28px;color:#2b1b2a}h1{margin:0;color:#4a1d3f}table{width:100%;border-collapse:collapse;margin:18px 0}
  td,th{border-bottom:1px solid #ddd;padding:8px;text-align:right}.top{display:flex;justify-content:space-between;align-items:center}
  .tot td{font-weight:bold;border:0}img{width:70px;height:70px}</style></head><body>
  <div class="top"><div><h1>${store.store_name || 'Juman'}</h1><p>فاتورة طلب #${o.id}<br>${fmtDate(o.created_at, true)}</p></div><img src="/logo-badge.png"></div>
  <p><b>${o.customer_name}</b><br>${o.phone}<br>${o.city} — ${o.address}${o.notes ? `<br>ملاحظة: ${o.notes}` : ''}</p>
  <table><thead><tr><th>المنتج</th><th>الكمية</th><th>السعر</th><th>المجموع</th></tr></thead><tbody>${rows}</tbody>
  <tfoot><tr class="tot"><td colspan="3">المجموع الفرعي</td><td>${price(o.subtotal)}</td></tr>
  <tr class="tot"><td colspan="3">التوصيل</td><td>${o.shipping ? price(o.shipping) : 'مجاني'}</td></tr>
  <tr class="tot"><td colspan="3">الإجمالي (الدفع عند الاستلام)</td><td>${price(o.total)}</td></tr></tfoot></table>
  <p style="text-align:center">شكراً لتسوقك من جُمان 💎</p><script>onload=()=>print()</script></body></html>`);
  w.document.close();
}

function OrderDetail({ id, onClose, onChanged }) {
  const notify = useNotify();
  const { settings } = useStore();
  const { data: o, setData, error } = useApi(`/admin/orders/${id}`);

  const setStatus = async (status) => {
    try {
      const updated = await api(`/admin/orders/${id}`, { method: 'PATCH', body: { status } });
      setData((d) => ({ ...d, ...updated }));
      onChanged();
      notify(`تم تغيير الحالة إلى: ${ORDER_STATUS[status]}`);
    } catch (e) {
      notify(e.message);
    }
  };
  const remove = async () => {
    if (!confirm(`حذف الطلب #${id} نهائياً؟ لا يمكن التراجع.`)) return;
    await api(`/admin/orders/${id}`, { method: 'DELETE' });
    notify('تم حذف الطلب');
    onChanged();
    onClose();
  };

  const waMsg = o && encodeURIComponent(`مرحباً ${o.customer_name} 🌸\nمعك متجر جُمان بخصوص طلبك رقم #${o.id} بقيمة ${price(o.total)}.\nنود تأكيد الطلب والعنوان: ${o.city} - ${o.address}`);

  return (
    <Modal title={`الطلب #${id}`} onClose={onClose} wide>
      {error && <p className="a-error">{error}</p>}
      {!o ? <Loading /> : (
        <div className="a-order">
          <div className="a-order-top">
            <StatusPill status={o.status} />
            <span className="a-muted">{fmtDate(o.created_at, true)}</span>
          </div>

          <div className="a-status-steps">
            {Object.entries(ORDER_STATUS).map(([k, l]) => (
              <button key={k} className={o.status === k ? 'on' : ''} onClick={() => o.status !== k && setStatus(k)}>{l}</button>
            ))}
          </div>

          <div className="a-grid-2">
            <div className="a-box">
              <h4>بيانات العميلة</h4>
              <p><b>{o.customer_name}</b></p>
              <p dir="ltr" className="a-right">{o.phone}</p>
              <p>{o.city} — {o.address}</p>
              {o.notes && <p className="a-note">📝 {o.notes}</p>}
              <div className="a-row">
                <a className="a-btn" href={`tel:${o.phone}`}>📞 اتصال</a>
                <a className="a-btn wa" href={`${waLink(toIntl(o.phone))}?text=${waMsg}`} target="_blank" rel="noreferrer">واتساب</a>
              </div>
            </div>
            <div className="a-box">
              <h4>الملخص</h4>
              <p className="a-sum"><span>المجموع الفرعي</span><span>{price(o.subtotal)}</span></p>
              <p className="a-sum"><span>التوصيل</span><span>{o.shipping ? price(o.shipping) : 'مجاني'}</span></p>
              <p className="a-sum total"><span>الإجمالي</span><span>{price(o.total)}</span></p>
              <p className="a-muted">الدفع: عند الاستلام</p>
            </div>
          </div>

          <h4>المنتجات ({o.items.length})</h4>
          <ul className="a-list">
            {o.items.map((i) => (
              <li key={i.id}>
                <img src={i.image_url} alt="" referrerPolicy="no-referrer" />
                <div>
                  <b>{i.name}</b>
                  <small>{i.size && `المقاس: ${i.size} · `}الكمية: {i.quantity} · {price(i.price)}</small>
                </div>
                <b>{price(i.price * i.quantity)}</b>
              </li>
            ))}
          </ul>

          <div className="a-row end">
            <button className="a-btn danger ghost" onClick={remove}>حذف الطلب</button>
            <button className="a-btn primary" onClick={() => printInvoice(o, settings)}>🖨 طباعة الفاتورة</button>
          </div>
        </div>
      )}
    </Modal>
  );
}

export default function Orders() {
  const [params, setParams] = useSearchParams();
  const [status, setStatus] = useState('');
  const [q, setQ] = useState(params.get('q') || '');
  const [search, setSearch] = useState(params.get('q') || '');
  const [page, setPage] = useState(1);
  const openId = params.get('open');
  const { data, loading, error, reload } = useApi(`/admin/orders?status=${status}&q=${encodeURIComponent(search)}&page=${page}`);
  const counts = useApi('/admin/dashboard?days=7');

  useEffect(() => setPage(1), [status, search]);

  const statusCount = (s) => counts.data?.statuses.find((x) => x.status === s)?.n || 0;
  const open = (id) => setParams(id ? { open: id } : {});

  return (
    <>
      <PageHead title="الطلبات" sub={data ? `${data.total} طلب` : ''} />

      <div className="a-tabs">
        <button className={!status ? 'on' : ''} onClick={() => setStatus('')}>الكل</button>
        {Object.entries(ORDER_STATUS).map(([k, l]) => (
          <button key={k} className={status === k ? 'on' : ''} onClick={() => setStatus(k)}>
            {l} {statusCount(k) > 0 && <span>{statusCount(k)}</span>}
          </button>
        ))}
      </div>

      <form className="a-toolbar" onSubmit={(e) => { e.preventDefault(); setSearch(q.trim()); }}>
        <input className="a-input" placeholder="ابحثي بالاسم أو رقم الهاتف أو رقم الطلب" value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="a-btn">بحث</button>
      </form>

      {error && <p className="a-error">{error}</p>}
      {loading && !data ? <Loading /> : !data?.items.length ? <Empty>لا توجد طلبات مطابقة</Empty> : (
        <div className="a-card flush">
          <div className="a-table-wrap">
            <table className="a-table hover">
              <thead>
                <tr><th>#</th><th>العميلة</th><th className="a-hide-sm">المحافظة</th><th className="a-hide-sm">المنتجات</th><th className="a-hide-sm">التاريخ</th><th>الإجمالي</th><th>الحالة</th></tr>
              </thead>
              <tbody>
                {data.items.map((o) => (
                  <tr key={o.id} onClick={() => open(o.id)}>
                    <td><b>#{o.id}</b></td>
                    <td><b>{o.customer_name}</b><small className="a-block" dir="ltr">{o.phone}</small></td>
                    <td className="a-hide-sm">{o.city}</td>
                    <td className="a-hide-sm">
                      <div className="a-mini-thumbs">
                        {o.items.slice(0, 3).map((i) => <img key={i.id} src={i.image_url} alt="" referrerPolicy="no-referrer" />)}
                        {o.items.length > 3 && <span>+{o.items.length - 3}</span>}
                      </div>
                    </td>
                    <td className="a-hide-sm">{fmtDate(o.created_at, true)}</td>
                    <td><b>{price(o.total)}</b></td>
                    <td><StatusPill status={o.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {data && <Pager page={data.page} pages={data.pages} onPage={setPage} />}

      {openId && <OrderDetail id={openId} onClose={() => open(null)} onChanged={() => { reload(); counts.reload(); }} />}
    </>
  );
}

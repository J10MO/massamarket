import { useState } from 'react';
import { api } from '../api.js';
import { waLink } from '../components/Layout.jsx';
import { toIntl } from '../market/SellerCenter.jsx';
import { Empty, fmtDate, Loading, Modal, PageHead, useApi, useNotify } from './ui.jsx';

const STATUS = {
  pending: ['بانتظار المراجعة', 'st-pending'],
  approved: ['مفعّل', 'st-delivered'],
  rejected: ['مرفوض', 'st-cancelled'],
  suspended: ['موقوف', 'st-cancelled'],
};
const REJECT_REASONS = ['الشعار غير واضح', 'رقم الهاتف غير صحيح', 'بيانات المحل ناقصة', 'لم نتمكن من التحقق من المحل'];

function MerchantReview({ m, onClose, onChanged }) {
  const notify = useNotify();
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const act = async (action) => {
    setBusy(true);
    try {
      await api(`/admin/merchants/${m.id}`, { method: 'PATCH', body: { action, reason } });
      notify({ approve: 'تم تفعيل المحل ✓', reject: 'تم رفض الطلب', suspend: 'تم إيقاف المحل', reactivate: 'تمت إعادة تفعيل المحل' }[action]);
      onChanged();
      onClose();
    } catch (e) {
      notify(e.message);
    } finally {
      setBusy(false);
    }
  };
  const wa = m.whatsapp || m.phone;
  const row = (label, value, ltr) => value && <p className="a-sum"><span>{label}</span><b dir={ltr ? 'ltr' : undefined}>{value}</b></p>;

  return (
    <Modal title={`محل: ${m.shop_name}`} onClose={onClose} wide>
      <div className="a-order">
        <div className="a-shop-head">
          {m.cover_url && <img className="a-shop-cover" src={m.cover_url} alt="" referrerPolicy="no-referrer" />}
          <img className="a-shop-logo" src={m.logo_url} alt="" referrerPolicy="no-referrer" />
          <div>
            <h3>{m.shop_name}</h3>
            <span className={`a-pill ${STATUS[m.status][1]}`}>{STATUS[m.status][0]}</span>
            <small className="a-block">قُدّم {fmtDate(m.created_at, true)}{m.approved_at && ` · فُعّل ${fmtDate(m.approved_at)}`}</small>
          </div>
        </div>
        {m.description && <p className="a-note">{m.description}</p>}
        <div className="a-grid-2">
          <div className="a-box">
            <h4>التواصل</h4>
            {row('الهاتف', m.phone, true)}
            {row('واتساب', m.whatsapp, true)}
            {m.instagram && <p className="a-sum"><span>إنستغرام</span><a className="a-link" dir="ltr" href={`https://www.instagram.com/${m.instagram}/`} target="_blank" rel="noreferrer">@{m.instagram}</a></p>}
            {m.website && <p className="a-sum"><span>الموقع</span><a className="a-link" dir="ltr" href={m.website} target="_blank" rel="noreferrer">{m.website.replace(/^https?:\/\//, '')}</a></p>}
            <div className="a-row">
              {wa && <a className="a-btn wa sm" href={waLink(toIntl(wa))} target="_blank" rel="noreferrer">واتساب</a>}
              <a className="a-btn sm" href={`tel:${m.phone}`}>اتصال</a>
            </div>
          </div>
          <div className="a-box">
            <h4>العنوان والحساب</h4>
            {row('المحافظة', m.city)}
            {row('العنوان', m.address)}
            {row('الدوام', m.hours)}
            {m.map_url && <p className="a-sum"><span>الخريطة</span><a className="a-link" href={m.map_url} target="_blank" rel="noreferrer">فتح الموقع ↗</a></p>}
            {row('صاحبة الحساب', m.owner_name)}
            {row('البريد', m.owner_email, true)}
            {row('فساتين معروضة', String(m.active_listings))}
            {row('مبيعات مكتملة', String(m.sold))}
          </div>
        </div>
        {m.reject_reason && <p className="a-error">آخر سبب: {m.reject_reason}</p>}

        {['pending', 'approved'].includes(m.status) && (
          <div className="a-box">
            <h4>{m.status === 'pending' ? 'سبب الرفض' : 'سبب الإيقاف'} (يظهر لصاحبة المحل)</h4>
            {m.status === 'pending' && (
              <div className="a-suggest">{REJECT_REASONS.map((r) => <button type="button" key={r} onClick={() => setReason(r)}>{r}</button>)}</div>
            )}
            <input className="a-input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="اكتبي السبب..." />
          </div>
        )}

        <div className="a-row end">
          {m.status === 'approved' && <a className="a-btn" href={`/shop/${m.slug}`} target="_blank" rel="noreferrer">صفحة المحل ↗</a>}
          {m.status === 'pending' && <button className="a-btn danger" disabled={busy || !reason.trim()} onClick={() => act('reject')}>رفض</button>}
          {m.status === 'approved' && <button className="a-btn danger" disabled={busy || !reason.trim()} onClick={() => act('suspend')}>إيقاف المحل</button>}
          {['pending', 'rejected'].includes(m.status) && <button className="a-btn primary" disabled={busy} onClick={() => act('approve')}>✓ موافقة وتفعيل</button>}
          {m.status === 'suspended' && <button className="a-btn primary" disabled={busy} onClick={() => act('reactivate')}>إعادة التفعيل</button>}
        </div>
      </div>
    </Modal>
  );
}

export default function Merchants() {
  const [status, setStatus] = useState('pending');
  const [q, setQ] = useState('');
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(null);
  const { data, loading, error, reload } = useApi(`/admin/merchants?status=${status}&q=${encodeURIComponent(search)}`);
  const counts = data?.counts || {};

  return (
    <>
      <PageHead title="المحلات والتجار" sub="طلبات الانضمام، المحلات المفعّلة، والموقوفة" />
      <div className="a-tabs">
        {[['pending', 'طلبات جديدة'], ['approved', 'مفعّلة'], ['rejected', 'مرفوضة'], ['suspended', 'موقوفة'], ['', 'الكل']].map(([k, l]) => (
          <button key={k} className={status === k ? 'on' : ''} onClick={() => setStatus(k)}>{l} {counts[k] > 0 && <span>{counts[k]}</span>}</button>
        ))}
      </div>
      <form className="a-toolbar" onSubmit={(e) => { e.preventDefault(); setSearch(q.trim()); }}>
        <input className="a-input" placeholder="ابحثي باسم المحل أو الهاتف أو البريد" value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="a-btn">بحث</button>
      </form>
      {error && <p className="a-error">{error}</p>}
      {loading && !data ? <Loading /> : !data?.items.length ? <Empty>لا توجد محلات هنا</Empty> : (
        <div className="a-merchants">
          {data.items.map((m) => (
            <button key={m.id} className="a-merchant" onClick={() => setOpen(m)}>
              <img src={m.logo_url} alt="" referrerPolicy="no-referrer" />
              <div>
                <b>{m.shop_name}</b>
                <small>📍 {m.city} · <span dir="ltr">{m.phone}</span></small>
                <small>{m.owner_name} · {fmtDate(m.created_at)}</small>
              </div>
              <div className="a-merchant-side">
                <span className={`a-pill ${STATUS[m.status][1]}`}>{STATUS[m.status][0]}</span>
                {m.status === 'approved' && <small>{m.active_listings} فستان · بيع {m.sold}</small>}
              </div>
            </button>
          ))}
        </div>
      )}
      {open && <MerchantReview m={open} onClose={() => setOpen(null)} onChanged={reload} />}
    </>
  );
}

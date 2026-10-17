import { useEffect, useState } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { api, price } from '../api.js';
import { useStore } from '../store.jsx';
import { waLink } from '../components/Layout.jsx';
import PaymentBox, { paymentReady } from '../components/PaymentBox.jsx';
import { CloseIcon } from '../components/Icons.jsx';
import { LISTING_STATUS, MARKET_ORDER_STATUS, timeAgo } from './shared.jsx';

export const toIntl = (phone) => {
  const d = String(phone || '').replace(/\D/g, '');
  return d.startsWith('0') ? `964${d.slice(1)}` : d;
};

const firstMethod = (settings) => settings.payment_methods?.[0]?.name || '';

function CommissionSheet({ due, onClose, onDone }) {
  const { settings, notify } = useStore();
  const [pay, setPay] = useState({ method: firstMethod(settings), ref: '', receipt: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submit = async () => {
    setBusy(true);
    setError('');
    try {
      await api('/market/commissions/pay', { method: 'POST', body: { payment_method: pay.method, payment_ref: pay.ref, receipt_url: pay.receipt } });
      notify('تم إرسال الدفعة — شكراً لچ 💕');
      onDone();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="تسديد العمولة">
        <div className="sheet-head">
          <h3>تسديد عمولة الموقع</h3>
          <button className="icon-btn" onClick={onClose} aria-label="إغلاق"><CloseIcon /></button>
        </div>
        <p className="muted">عمولة الموقع {settings.market_commission}% من مبيعاتچ المكتملة. المبلغ المستحق حالياً:</p>
        <p className="commission-due">{price(due)}</p>
        <PaymentBox amount={due} value={pay} onChange={setPay} />
        {error && <p className="alert">{error}</p>}
        <button className="btn btn-primary btn-lg btn-block" disabled={busy || !paymentReady(pay)} onClick={submit}>إرسال الدفعة — {price(due)}</button>
      </div>
    </div>
  );
}

function CommissionBanner({ sum, onPaid }) {
  const { settings } = useStore();
  const [open, setOpen] = useState(false);
  const due = Number(sum?.commission_due) || 0;
  const pending = Number(sum?.commission_pending) || 0;
  const limit = Number(settings.commission_limit) || 0;
  if (!due && !pending) return null;
  return (
    <>
      <div className={`commission-banner ${limit && due > limit ? 'blocked' : ''}`}>
        <div>
          {due > 0 ? <b>عمولة مستحقة: {price(due)}</b> : <b>⏳ دفعة عمولة بانتظار التأكيد: {price(pending)}</b>}
          <small>
            {due > 0 && limit > 0 && due > limit
              ? 'تجاوزتِ الحد المسموح — سدّدي العمولة لتتمكني من نشر إعلانات جديدة.'
              : due > 0 ? 'سدّديها إلكترونياً بخطوة وحدة.' : 'سنؤكدها فور وصول التحويل.'}
          </small>
        </div>
        {due > 0 && <button className="btn btn-rose" onClick={() => setOpen(true)}>ادفعي الآن</button>}
      </div>
      {open && <CommissionSheet due={due} onClose={() => setOpen(false)} onDone={() => { setOpen(false); onPaid(); }} />}
    </>
  );
}

function BoostSheet({ listing, onClose, onDone }) {
  const { settings, notify } = useStore();
  const plans = settings.boost_plans || [];
  const [days, setDays] = useState(plans[1]?.days || plans[0]?.days);
  const [pay, setPay] = useState({ method: firstMethod(settings), ref: '', receipt: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const plan = plans.find((p) => Number(p.days) === Number(days));

  const submit = async () => {
    setBusy(true);
    setError('');
    try {
      await api(`/market/listings/${listing.id}/promote`, { method: 'POST', body: { days, payment_method: pay.method, payment_ref: pay.ref, receipt_url: pay.receipt } });
      notify('تم إرسال طلب الترويج — سيتفعّل بعد تأكيد الدفع');
      onDone();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="ترويج الإعلان">
        <div className="sheet-head">
          <h3>✦ روّجي إعلانچ</h3>
          <button className="icon-btn" onClick={onClose} aria-label="إغلاق"><CloseIcon /></button>
        </div>
        <p className="muted">الإعلان المميز يظهر <b>أول القائمة</b> وفي <b>الصفحة الرئيسية</b> مع شارة "مميز" — يوصل لمشاهدات أكثر ويُباع أسرع.</p>

        <h4>1. اختاري الباقة</h4>
        <div className="boost-plans">
          {plans.map((p, i) => (
            <button key={p.days} className={Number(days) === Number(p.days) ? 'on' : ''} onClick={() => setDays(p.days)}>
              {i === 1 && <span className="boost-pop">الأكثر طلباً</span>}
              <b>{p.days} أيام</b>
              <strong>{price(p.price)}</strong>
              <small>{price(Math.round(p.price / p.days))} / يوم</small>
            </button>
          ))}
        </div>

        <h4>2. ادفعي إلكترونياً</h4>
        <PaymentBox amount={plan?.price} value={pay} onChange={setPay} />
        {error && <p className="alert">{error}</p>}
        <button className="btn btn-primary btn-lg btn-block" disabled={busy || !paymentReady(pay)} onClick={submit}>
          إرسال طلب الترويج {plan && `— ${price(plan.price)}`}
        </button>
        <p className="muted center-text">تتم مراجعة الدفع عادةً خلال ساعات، ويبدأ الترويج فور التأكيد.</p>
      </div>
    </div>
  );
}

function PromoStatus({ l }) {
  const p = l.last_promotion;
  if (l.is_boosted) return <span className="m-badge boost">✦ مميز حتى {new Date(l.boosted_until).toLocaleDateString('ar-IQ', { day: 'numeric', month: 'short' })}</span>;
  if (p?.status === 'pending') return <span className="m-badge wait">⏳ الترويج بانتظار تأكيد الدفع</span>;
  if (p?.status === 'rejected') return <span className="m-badge bad">رُفض الترويج: {p.admin_note}</span>;
  return null;
}

function MyListings({ onCount }) {
  const { notify } = useStore();
  const [params] = useSearchParams();
  const [items, setItems] = useState(null);
  const [boost, setBoost] = useState(null);
  const load = () => api('/market/my/listings').then((d) => { setItems(d); onCount?.(); }).catch(() => setItems([]));
  useEffect(() => {
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const act = async (l, action) => {
    if (action === 'sold' && !confirm('تأكيد أن الفستان بيع خارج الموقع؟')) return;
    try {
      await api(`/market/listings/${l.id}/status`, { method: 'POST', body: { action } });
      load();
    } catch (e) {
      notify(e.message);
    }
  };
  const remove = async (l) => {
    if (!confirm(`حذف إعلان "${l.title}" نهائياً؟`)) return;
    try {
      await api(`/market/listings/${l.id}`, { method: 'DELETE' });
      notify('تم حذف الإعلان');
      load();
    } catch (e) {
      notify(e.message);
    }
  };

  if (!items) return <div className="spinner" />;
  if (!items.length) {
    return (
      <div className="empty">
        <h2>ما عندچ إعلانات بعد</h2>
        <p className="muted">عندچ فستان لبستيه مرة؟ اعرضيه وخلّي غيرچ تستفيد منه.</p>
        <Link to="/sell" className="btn btn-primary">+ أضيفي أول إعلان</Link>
      </div>
    );
  }
  return (
    <>
      {params.get('posted') && <p className="m-note">✓ تم حفظ الإعلان. {items.find((x) => String(x.id) === params.get('posted'))?.status === 'pending' && 'سيظهر للجميع بعد مراجعة الإدارة.'}</p>}
      <ul className="my-list">
        {items.map((l) => (
          <li key={l.id} className="my-item">
            <Link to={`/market/${l.id}`} className="my-thumb"><img src={l.images[0]} alt="" referrerPolicy="no-referrer" /></Link>
            <div className="my-body">
              <div className="my-top">
                <span className={`m-pill ls-${l.status}`}>{LISTING_STATUS[l.status]}</span>
                <small className="muted">👁 {l.views} · {timeAgo(l.created_at)}</small>
              </div>
              <Link to={`/market/${l.id}`}><b>{l.title}</b></Link>
              <span className="my-price">{price(l.price)} · {l.size}</span>
              {l.status === 'rejected' && <small className="error-text">السبب: {l.reject_reason}</small>}
              {l.pending_orders > 0 && <span className="m-badge new">🛍 {l.pending_orders} طلب جديد</span>}
              <PromoStatus l={l} />
              <div className="my-actions">
                {['active', 'pending'].includes(l.status) && !l.is_boosted && l.last_promotion?.status !== 'pending' && (
                  <button className="boost-btn" onClick={() => setBoost(l)}>✦ روّجي</button>
                )}
                {!['reserved', 'sold'].includes(l.status) && <Link to={`/sell/${l.id}`}>تعديل</Link>}
                {['active', 'pending'].includes(l.status) && <button onClick={() => act(l, 'hide')}>إخفاء</button>}
                {l.status === 'hidden' && <button onClick={() => act(l, 'show')}>إظهار</button>}
                {['active', 'hidden'].includes(l.status) && <button onClick={() => act(l, 'sold')}>بيع خارجياً</button>}
                {l.status !== 'reserved' && <button className="danger" onClick={() => remove(l)}>حذف</button>}
              </div>
            </div>
          </li>
        ))}
      </ul>
      {boost && <BoostSheet listing={boost} onClose={() => setBoost(null)} onDone={() => { setBoost(null); load(); }} />}
    </>
  );
}

function Sales({ onCount }) {
  const { notify } = useStore();
  const [items, setItems] = useState(null);
  const load = () => api('/market/my/sales').then((d) => { setItems(d); onCount?.(); }).catch(() => setItems([]));
  useEffect(() => {
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const act = async (o, action) => {
    const msgs = { reject: 'رفض الطلب؟ سيعود الفستان متاحاً للجميع.', cancel: 'إلغاء الطلب؟ سيعود الفستان متاحاً.', complete: 'تأكيد أن الفستان سُلّم واستلمتِ المبلغ؟' };
    if (msgs[action] && !confirm(msgs[action])) return;
    try {
      await api(`/market/orders/${o.id}/action`, { method: 'POST', body: { action } });
      notify(action === 'accept' ? 'تم قبول الطلب — تواصلي مع المشترية' : 'تم التحديث');
      load();
    } catch (e) {
      notify(e.message);
    }
  };

  if (!items) return <div className="spinner" />;
  if (!items.length) return <div className="empty"><h2>لا توجد طلبات شراء بعد</h2><p className="muted">روّجي إعلاناتچ لتصلچ طلبات أكثر ✦</p></div>;
  return (
    <ul className="my-list">
      {items.map((o) => {
        const msg = encodeURIComponent(`مرحباً ${o.buyer_name} 🌸 معچ البائعة من سوق جُمان بخصوص طلبچ "${o.title}" بسعر ${price(o.price)}. متى يناسبچ الاستلام؟`);
        return (
          <li key={o.id} className="my-item order">
            <img className="my-thumb" src={o.image_url} alt="" referrerPolicy="no-referrer" />
            <div className="my-body">
              <div className="my-top">
                <span className={`m-pill mo-${o.status}`}>{MARKET_ORDER_STATUS[o.status]}</span>
                <small className="muted">#{o.id} · {timeAgo(o.created_at)}</small>
              </div>
              <b>{o.title}</b>
              <span className="my-price">{price(o.price)}{Number(o.commission) > 0 && <small className="muted"> · صافي {price(o.price - o.commission)}</small>}</span>
              <div className="buyer-box">
                <b>👤 {o.buyer_name}</b>
                <span dir="ltr">{o.buyer_phone}</span>
                <span>📍 {o.city} — {o.address}</span>
                {o.notes && <span className="m-note">💬 {o.notes}</span>}
              </div>
              <div className="my-actions">
                {o.status === 'pending' && <>
                  <button className="primary" onClick={() => act(o, 'accept')}>✓ قبول الطلب</button>
                  <button className="danger" onClick={() => act(o, 'reject')}>رفض</button>
                </>}
                {o.status === 'accepted' && <>
                  <button className="primary" onClick={() => act(o, 'complete')}>✓ تم التسليم والبيع</button>
                  <button className="danger" onClick={() => act(o, 'cancel')}>إلغاء</button>
                </>}
                {['pending', 'accepted'].includes(o.status) && <>
                  <a className="wa" href={`${waLink(toIntl(o.buyer_phone))}?text=${msg}`} target="_blank" rel="noreferrer">واتساب</a>
                  <a href={`tel:${o.buyer_phone}`}>📞 اتصال</a>
                </>}
                {o.rating && <span className="muted">تقييم المشترية: {'★'.repeat(o.rating)}</span>}
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export default function SellerCenter() {
  const { user, authReady } = useStore();
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') || 'listings';
  const [sum, setSum] = useState(null);
  const loadSum = () => api('/market/my/summary').then(setSum).catch(() => {});
  useEffect(() => {
    if (user) loadSum();
  }, [user]);

  if (!authReady) return <div className="spinner" />;
  if (!user) return <Navigate to="/account?next=/my/listings" replace />;

  return (
    <div className="container page-narrow">
      <div className="sc-head">
        <h1 className="h1">مركز البائعة</h1>
        <Link to="/sell" className="btn btn-primary">+ إعلان جديد</Link>
      </div>
      {sum && (
        <div className="sc-stats">
          <div><b>{sum.active}</b><small>منشور</small></div>
          <div><b>{sum.incoming}</b><small>طلبات جديدة</small></div>
          <div><b>{price(sum.earned)}</b><small>أرباحچ</small></div>
        </div>
      )}
      <CommissionBanner sum={sum} onPaid={loadSum} />
      <div className="seg">
        <button className={tab === 'listings' ? 'on' : ''} onClick={() => setParams({ tab: 'listings' })}>إعلاناتي {sum ? `(${sum.listings})` : ''}</button>
        <button className={tab === 'sales' ? 'on' : ''} onClick={() => setParams({ tab: 'sales' })}>
          طلبات الشراء {sum?.incoming > 0 && <span className="pill-count">{sum.incoming}</span>}
        </button>
      </div>
      {tab === 'sales' ? <Sales onCount={loadSum} /> : <MyListings onCount={loadSum} />}
    </div>
  );
}

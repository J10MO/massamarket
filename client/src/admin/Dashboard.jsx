import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ORDER_STATUS, price } from '../api.js';
import { Empty, fmtDate, Loading, PageHead, StatusPill, useApi } from './ui.jsx';

const compact = (n) => (n >= 1e6 ? `${+(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${Math.round(n / 1e3)}K` : String(Math.round(n)));

// Round the y-axis max up to a clean number
function niceMax(v) {
  if (v <= 0) return 1000;
  const p = 10 ** Math.floor(Math.log10(v));
  const n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p;
}

function SalesChart({ data }) {
  const box = useRef(null);
  const [w, setW] = useState(640);
  const [hover, setHover] = useState(null);
  const [asTable, setAsTable] = useState(false);

  useEffect(() => {
    const ro = new ResizeObserver(([e]) => setW(Math.max(280, e.contentRect.width)));
    ro.observe(box.current);
    return () => ro.disconnect();
  }, []);

  const H = 220;
  const pad = { l: 44, r: 8, t: 12, b: 26 };
  const max = niceMax(Math.max(...data.map((d) => Number(d.revenue))));
  const plotW = w - pad.l - pad.r;
  const plotH = H - pad.t - pad.b;
  const slot = plotW / data.length;
  const bw = Math.max(2, Math.min(24, slot - 2)); // ≤24px bars, 2px gap
  const y = (v) => pad.t + plotH - (v / max) * plotH;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * max);
  const labelEvery = Math.ceil(data.length / Math.floor(plotW / 56));
  const total = data.reduce((s, d) => s + Number(d.revenue), 0);

  // 4px rounded data-end, square at the baseline
  const bar = (x, top, bottom) => {
    const h = bottom - top;
    if (h <= 0) return '';
    const r = Math.min(4, h, bw / 2);
    return `M${x} ${bottom}V${top + r}Q${x} ${top} ${x + r} ${top}H${x + bw - r}Q${x + bw} ${top} ${x + bw} ${top + r}V${bottom}Z`;
  };

  return (
    <div className="a-card">
      <div className="a-card-head">
        <div>
          <h3>المبيعات اليومية</h3>
          <p className="a-muted">الإجمالي: <b>{price(total)}</b> · بدون الطلبات الملغية</p>
        </div>
        <button className="a-link" onClick={() => setAsTable((v) => !v)}>{asTable ? 'عرض كرسم' : 'عرض كجدول'}</button>
      </div>
      <div ref={box} className="a-chart" dir="ltr" style={{ display: asTable ? 'none' : 'block' }}>
        <svg width={w} height={H} role="img" aria-label="رسم بياني للمبيعات اليومية">
          {ticks.map((t) => (
            <g key={t}>
              <line x1={pad.l} x2={w - pad.r} y1={y(t)} y2={y(t)} className="a-grid" />
              <text x={pad.l - 8} y={y(t) + 4} textAnchor="end" className="a-axis">{compact(t)}</text>
            </g>
          ))}
          {data.map((d, i) => {
            const x = pad.l + i * slot + (slot - bw) / 2;
            const v = Number(d.revenue);
            return (
              <g key={d.day} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} onClick={() => setHover(i)}>
                <rect x={pad.l + i * slot} y={pad.t} width={slot} height={plotH} fill="transparent" />
                <path d={bar(x, y(v), y(0))} className={`a-bar ${hover === i ? 'on' : ''}`} />
                {i % labelEvery === 0 && (
                  <text x={x + bw / 2} y={H - 8} textAnchor="middle" className="a-axis">
                    {new Date(d.day).toLocaleDateString('ar-IQ', { day: 'numeric', month: 'numeric' })}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
        {hover !== null && (
          <div
            className="a-tip"
            style={{ left: Math.min(w - 150, Math.max(0, pad.l + hover * slot + slot / 2 - 75)), top: Math.max(0, y(Number(data[hover].revenue)) - 64) }}
            dir="rtl"
          >
            <small>{new Date(data[hover].day).toLocaleDateString('ar-IQ', { weekday: 'long', day: 'numeric', month: 'long' })}</small>
            <b>{price(data[hover].revenue)}</b>
            <small>{data[hover].orders} طلب</small>
          </div>
        )}
      </div>
      {asTable && (
        <div className="a-table-wrap small">
          <table className="a-table">
            <thead><tr><th>اليوم</th><th>الطلبات</th><th>المبيعات</th></tr></thead>
            <tbody>
              {[...data].reverse().map((d) => (
                <tr key={d.day}><td>{fmtDate(d.day)}</td><td>{d.orders}</td><td>{price(d.revenue)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Kpi({ label, value, sub, to }) {
  const body = (
    <>
      <small>{label}</small>
      <b>{value}</b>
      {sub && <span>{sub}</span>}
    </>
  );
  return to ? <Link to={to} className="a-kpi link">{body}</Link> : <div className="a-kpi">{body}</div>;
}

export default function Dashboard() {
  const [days, setDays] = useState(30);
  const { data, error, loading } = useApi(`/admin/dashboard?days=${days}`);
  const market = useApi('/admin/market/stats');

  if (error) return <p className="a-error">{error}</p>;
  if (!data) return <Loading />;
  const k = data.kpi;
  const statusTotal = data.statuses.reduce((s, x) => s + x.n, 0);
  const cityMax = Math.max(1, ...data.cities.map((c) => c.n));

  return (
    <>
      <PageHead title="لوحة المعلومات" sub="نظرة شاملة على أداء المتجر">
        <div className="a-seg">
          {[7, 30, 90].map((d) => (
            <button key={d} className={days === d ? 'on' : ''} onClick={() => setDays(d)}>{d} يوم</button>
          ))}
        </div>
      </PageHead>
      {loading && <div className="a-loading-bar" />}

      <div className="a-kpis">
        <Kpi label={`المبيعات (${days} يوم)`} value={price(k.revenue)} sub={`اليوم: ${price(k.revenue_today)}`} />
        <Kpi label="الطلبات" value={k.orders} sub={`اليوم: ${k.orders_today}`} to="/admin/orders" />
        <Kpi label="بانتظار المراجعة" value={k.pending} sub={k.awaiting_payment ? `${k.awaiting_payment} دفع إلكتروني للتأكيد` : 'تحتاج تأكيد'} to="/admin/orders" />
        <Kpi label="متوسط قيمة الطلب" value={price(k.avg_order)} sub={`${k.buyers} مشترية`} />
        <Kpi label="المنتجات المعروضة" value={k.products} sub={`${k.hidden} مخفي · ${k.categories} أقسام`} to="/admin/products" />
        <Kpi label="الحسابات المسجلة" value={k.users} sub="عميلات" to="/admin/customers" />
      </div>

      {market.data && (market.data.pending_listings > 0 || market.data.pending_promotions > 0 || market.data.pending_commissions > 0) && (
        <div className="a-card a-alert-card">
          <div>
            <h3>♻ سوق المستعمل يحتاج انتباهچ</h3>
            <p>{market.data.pending_listings} إعلان بانتظار المراجعة · {market.data.pending_promotions} طلب ترويج · {market.data.pending_commissions} دفعة عمولة بانتظار التأكيد</p>
          </div>
          <Link to={`/admin/market?tab=${market.data.pending_listings ? 'listings' : market.data.pending_promotions ? 'promotions' : 'commissions'}`} className="a-btn">مراجعة الآن</Link>
        </div>
      )}

      <div className="a-grid-2 wide-first">
        <SalesChart data={data.daily} />

        <div className="a-card">
          <div className="a-card-head"><h3>حالة الطلبات</h3><span className="a-muted">{statusTotal} طلب</span></div>
          {!statusTotal && <Empty>لا توجد طلبات بعد</Empty>}
          <ul className="a-hbars">
            {Object.keys(ORDER_STATUS).map((s) => {
              const n = data.statuses.find((x) => x.status === s)?.n || 0;
              return (
                <li key={s}>
                  <StatusPill status={s} />
                  <span className="a-hbar"><i style={{ width: `${statusTotal ? (n / statusTotal) * 100 : 0}%` }} /></span>
                  <b>{n}</b>
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      <div className="a-grid-3">
        <div className="a-card">
          <div className="a-card-head"><h3>الأكثر مبيعاً</h3></div>
          {!data.top.length && <Empty>لا مبيعات في هذه الفترة</Empty>}
          <ul className="a-list">
            {data.top.map((p, i) => (
              <li key={p.id ?? i}>
                <span className="a-rank">{i + 1}</span>
                <img src={p.image_url} alt="" referrerPolicy="no-referrer" />
                <div><b>{p.name}</b><small>{p.qty} قطعة · {price(p.revenue)}</small></div>
              </li>
            ))}
          </ul>
        </div>

        <div className="a-card">
          <div className="a-card-head"><h3>مخزون منخفض</h3><Link to="/admin/products?status=low" className="a-link">الكل</Link></div>
          {!data.low_stock.length && <Empty>كل المنتجات متوفرة ✓</Empty>}
          <ul className="a-list">
            {data.low_stock.map((p) => (
              <li key={p.id}>
                <img src={p.image_url} alt="" referrerPolicy="no-referrer" />
                <div><b>{p.name}</b><small className={p.stock === 0 ? 'a-danger' : 'a-warn'}>{p.stock === 0 ? 'نفدت الكمية' : `متبقي ${p.stock}`}</small></div>
              </li>
            ))}
          </ul>
        </div>

        <div className="a-card">
          <div className="a-card-head"><h3>أكثر المحافظات طلباً</h3></div>
          {!data.cities.length && <Empty>لا توجد بيانات بعد</Empty>}
          <ul className="a-hbars">
            {data.cities.map((c) => (
              <li key={c.city}>
                <span className="a-hbar-label">{c.city}</span>
                <span className="a-hbar"><i style={{ width: `${(c.n / cityMax) * 100}%` }} /></span>
                <b>{c.n}</b>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="a-card">
        <div className="a-card-head"><h3>آخر الطلبات</h3><Link to="/admin/orders" className="a-link">كل الطلبات</Link></div>
        {!data.recent.length && <Empty>لا توجد طلبات بعد</Empty>}
        <div className="a-table-wrap">
          <table className="a-table">
            <tbody>
              {data.recent.map((o) => (
                <tr key={o.id}>
                  <td><Link to={`/admin/orders?open=${o.id}`} className="a-link">#{o.id}</Link></td>
                  <td>{o.customer_name}</td>
                  <td className="a-hide-sm">{o.city}</td>
                  <td className="a-hide-sm">{fmtDate(o.created_at, true)}</td>
                  <td><b>{price(o.total)}</b></td>
                  <td><StatusPill status={o.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api, price } from '../api.js';
import { useStore } from '../store.jsx';
import { waLink } from '../components/Layout.jsx';
import { Empty, fmtDate, Loading, PageHead, useApi, useNotify } from './ui.jsx';

const toIntl = (phone) => {
  const d = String(phone).replace(/\D/g, '');
  return d.startsWith('0') ? `964${d.slice(1)}` : d;
};

export default function Customers() {
  const notify = useNotify();
  const { user: me } = useStore();
  const [tab, setTab] = useState('buyers');
  const [q, setQ] = useState('');
  const [search, setSearch] = useState('');
  const { data, loading, error, setData } = useApi(`/admin/customers?q=${encodeURIComponent(search)}`);

  const setRole = async (u, role) => {
    if (!confirm(role === 'admin' ? `منح ${u.name} صلاحية الإدارة الكاملة؟` : `إزالة صلاحية الإدارة من ${u.name}؟`)) return;
    try {
      const updated = await api(`/admin/users/${u.id}`, { method: 'PATCH', body: { role } });
      setData((d) => ({ ...d, users: d.users.map((x) => (x.id === u.id ? { ...x, ...updated } : x)) }));
      notify('تم تحديث الصلاحية');
    } catch (e) {
      notify(e.message);
    }
  };

  return (
    <>
      <PageHead title="العملاء" sub="المشتريات حسب رقم الهاتف، والحسابات المسجلة" />
      <div className="a-tabs">
        <button className={tab === 'buyers' ? 'on' : ''} onClick={() => setTab('buyers')}>المشتريات {data && <span>{data.buyers.length}</span>}</button>
        <button className={tab === 'users' ? 'on' : ''} onClick={() => setTab('users')}>الحسابات المسجلة {data && <span>{data.users.length}</span>}</button>
      </div>
      <form className="a-toolbar" onSubmit={(e) => { e.preventDefault(); setSearch(q.trim()); }}>
        <input className="a-input" placeholder="ابحثي بالاسم أو الهاتف أو البريد" value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="a-btn">بحث</button>
      </form>
      {error && <p className="a-error">{error}</p>}
      {loading && !data ? <Loading /> : tab === 'buyers' ? (
        !data.buyers.length ? <Empty>لا توجد طلبات بعد</Empty> : (
          <div className="a-card flush">
            <div className="a-table-wrap">
              <table className="a-table">
                <thead><tr><th>العميلة</th><th className="a-hide-sm">المحافظة</th><th>الطلبات</th><th>مجموع المشتريات</th><th className="a-hide-sm">آخر طلب</th><th /></tr></thead>
                <tbody>
                  {data.buyers.map((b) => (
                    <tr key={b.phone}>
                      <td><b>{b.name}</b><small className="a-block" dir="ltr">{b.phone}</small></td>
                      <td className="a-hide-sm">{b.city}</td>
                      <td><Link className="a-link" to={`/admin/orders?q=${encodeURIComponent(b.phone)}`}>{b.orders} طلب</Link></td>
                      <td><b>{price(b.spent)}</b></td>
                      <td className="a-hide-sm">{fmtDate(b.last_order)}</td>
                      <td><a className="a-btn sm wa" href={waLink(toIntl(b.phone))} target="_blank" rel="noreferrer">واتساب</a></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      ) : !data.users.length ? <Empty>لا توجد حسابات</Empty> : (
        <div className="a-card flush">
          <div className="a-table-wrap">
            <table className="a-table">
              <thead><tr><th>الاسم</th><th className="a-hide-sm">البريد</th><th>الطلبات</th><th className="a-hide-sm">تاريخ التسجيل</th><th>الصلاحية</th></tr></thead>
              <tbody>
                {data.users.map((u) => (
                  <tr key={u.id}>
                    <td><b>{u.name}</b><small className="a-block" dir="ltr">{u.phone || u.email}</small></td>
                    <td className="a-hide-sm" dir="ltr">{u.email}</td>
                    <td>{u.orders}</td>
                    <td className="a-hide-sm">{fmtDate(u.created_at)}</td>
                    <td>
                      {u.id === me.id ? <span className="a-pill st-confirmed">مدير (أنتِ)</span> : (
                        <select className="a-input auto sm" value={u.role} onChange={(e) => setRole(u, e.target.value)}>
                          <option value="customer">عميلة</option>
                          <option value="admin">مدير</option>
                        </select>
                      )}
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

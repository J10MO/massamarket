import { useState } from 'react';
import { price, uploadImages } from '../api.js';
import { useStore } from '../store.jsx';

/**
 * Manual e-payment (e.g. Super Qi): pick an account, transfer `amount`, then send
 * the transaction number and/or a receipt photo. value = { method, ref, receipt }.
 */
export default function PaymentBox({ amount, value, onChange }) {
  const { settings, user, notify } = useStore();
  const methods = settings.payment_methods || [];
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const m = methods.find((x) => x.name === value.method) || methods[0];
  const set = (patch) => onChange({ ...value, method: m?.name, ...patch });

  const upload = async (file) => {
    if (!file) return;
    setBusy(true);
    setError('');
    try {
      set({ receipt: (await uploadImages([file], '/api/market/uploads'))[0] });
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  if (!m) return <p className="alert">لا توجد طريقة دفع إلكتروني مفعّلة حالياً.</p>;
  return (
    <div className="paybox">
      {methods.length > 1 && (
        <div className="chips wrap">
          {methods.map((x) => (
            <button type="button" key={x.name} className={m.name === x.name ? 'on' : ''} onClick={() => set({ method: x.name })}>{x.name}</button>
          ))}
        </div>
      )}
      <div className="pay-box">
        <span>حوّلي {amount ? <b>{price(amount)}</b> : 'المبلغ'} عبر <b>{m.name}</b> إلى الرقم:</span>
        <span className="pay-acc" dir="ltr">{m.details}</span>
        <button type="button" className="m-link" onClick={() => { navigator.clipboard?.writeText(m.details); notify('تم نسخ الرقم'); }}>نسخ</button>
      </div>
      <ol className="pay-steps">
        <li>افتحي تطبيق {m.name} واختاري التحويل.</li>
        <li>حوّلي المبلغ إلى الرقم أعلاه.</li>
        <li>اكتبي رقم العملية {user ? 'أو ارفعي صورة الإيصال' : ''} هنا.</li>
      </ol>
      <input className="m-select" dir="ltr" placeholder="رقم العملية / Transaction ID" value={value.ref || ''} onChange={(e) => set({ ref: e.target.value })} />
      {user && (
        <label className="receipt-up">
          <input type="file" accept="image/*" hidden onChange={(e) => upload(e.target.files[0])} />
          {value.receipt ? <><img src={value.receipt} alt="" /> تم رفع الإيصال ✓ (اضغطي للتغيير)</> : busy ? 'جارٍ الرفع...' : '📎 ارفعي صورة الإيصال (اختياري)'}
        </label>
      )}
      {error && <p className="alert">{error}</p>}
    </div>
  );
}

export const paymentReady = (v) => !!(v.ref?.trim() || v.receipt);

import { Link, useLocation, useParams } from 'react-router-dom';
import { price } from '../api.js';
import { useStore } from '../store.jsx';

export default function OrderSuccess() {
  const { id } = useParams();
  const { state } = useLocation();
  const { user } = useStore();

  return (
    <div className="container empty success">
      <div className="check-circle">✓</div>
      <h2>تم استلام طلبك بنجاح!</h2>
      <p>رقم الطلب: <b>#{id}</b></p>
      {state?.total && (
        <p>الإجمالي: <b>{price(state.total)}</b> — {state.payment_status === 'awaiting' ? `دفع إلكتروني (${state.payment_method})` : 'الدفع عند الاستلام'}</p>
      )}
      {state?.payment_status === 'awaiting' && <p className="m-note">⏳ استلمنا رقم التحويل، وسنؤكد الدفع ونجهّز طلبچ فور وصول المبلغ.</p>}
      <p className="muted">سنتواصل معچ على الهاتف لتأكيد الطلب قريباً 💕</p>
      <div className="row-btns">
        <Link to="/shop" className="btn btn-primary">متابعة التسوق</Link>
        {user && <Link to="/account" className="btn btn-outline">طلباتي</Link>}
      </div>
    </div>
  );
}

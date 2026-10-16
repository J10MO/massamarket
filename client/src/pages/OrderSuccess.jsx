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
      {state?.total && <p>الإجمالي: <b>{price(state.total)}</b> — الدفع عند الاستلام</p>}
      <p className="muted">سنتواصل معك على الجوال لتأكيد الطلب قريباً 💕</p>
      <div className="row-btns">
        <Link to="/shop" className="btn btn-primary">متابعة التسوق</Link>
        {user && <Link to="/account" className="btn btn-outline">طلباتي</Link>}
      </div>
    </div>
  );
}

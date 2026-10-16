import { Link } from 'react-router-dom';
import { price } from '../api.js';
import { useStore } from '../store.jsx';
import { Img } from '../components/ProductCard.jsx';
import { BagIcon } from '../components/Icons.jsx';

export function Summary({ subtotal }) {
  const { settings } = useStore();
  const fee = Number(settings.shipping_fee) || 0;
  const freeOver = Number(settings.free_shipping_over) || 0;
  const shipping = freeOver && subtotal >= freeOver ? 0 : fee;
  const left = freeOver ? freeOver - subtotal : 0;
  return (
    <div className="summary">
      {left > 0 && (
        <div className="free-ship">
          <p>أضيفي {price(left)} للحصول على شحن مجاني</p>
          <div className="bar"><i style={{ width: `${Math.min(100, (subtotal / freeOver) * 100)}%` }} /></div>
        </div>
      )}
      <div className="row"><span>المجموع الفرعي</span><span>{price(subtotal)}</span></div>
      <div className="row"><span>الشحن</span><span>{shipping ? price(shipping) : 'مجاني'}</span></div>
      <div className="row total"><span>الإجمالي</span><span>{price(subtotal + shipping)}</span></div>
    </div>
  );
}

export default function Cart() {
  const { cart, cartTotal, setQty } = useStore();

  if (!cart.length) {
    return (
      <div className="container empty">
        <BagIcon width="64" height="64" />
        <h2>سلتك فارغة</h2>
        <p className="muted">اكتشفي أحدث الفساتين وأضيفي ما يعجبك</p>
        <Link to="/shop" className="btn btn-primary">تسوقي الآن</Link>
      </div>
    );
  }

  return (
    <div className="container page-narrow">
      <h1 className="h1">سلة التسوق ({cart.length})</h1>
      <ul className="cart-list">
        {cart.map((i) => (
          <li key={i.key} className="cart-item">
            <Link to={`/product/${i.id}`}><Img src={i.image_url} alt={i.name} /></Link>
            <div className="ci-body">
              <Link to={`/product/${i.id}`}><b>{i.name}</b></Link>
              {i.size && <small className="muted">المقاس: {i.size}</small>}
              <strong>{price(i.price)}</strong>
              <div className="ci-actions">
                <div className="qty sm">
                  <button onClick={() => setQty(i.key, i.qty + 1)} aria-label="زيادة">+</button>
                  <span>{i.qty}</span>
                  <button onClick={() => setQty(i.key, i.qty - 1)} aria-label="إنقاص">−</button>
                </div>
                <button className="link-btn" onClick={() => setQty(i.key, 0)}>حذف</button>
              </div>
            </div>
          </li>
        ))}
      </ul>
      <Summary subtotal={cartTotal} />
      <div className="checkout-bar">
        <Link to="/checkout" className="btn btn-primary btn-lg btn-block">إتمام الطلب</Link>
      </div>
    </div>
  );
}

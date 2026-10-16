import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, price } from '../api.js';
import { useStore } from '../store.jsx';
import ProductCard, { Img } from '../components/ProductCard.jsx';
import { BackIcon, HeartIcon, ReturnIcon, StarIcon, TruckIcon } from '../components/Icons.jsx';

function Gallery({ images, alt }) {
  const list = [...new Set(images.filter(Boolean))];
  const track = useRef(null);
  const [index, setIndex] = useState(0);

  if (list.length < 2) return <Img src={list[0]} alt={alt} eager />;

  const go = (i) => {
    const el = track.current;
    el.scrollTo({ left: -i * el.clientWidth, behavior: 'smooth' }); // RTL: scrollLeft runs negative
  };
  return (
    <>
      <div
        className="gallery"
        ref={track}
        onScroll={(e) => setIndex(Math.round(Math.abs(e.currentTarget.scrollLeft) / e.currentTarget.clientWidth))}
      >
        {list.map((src, i) => <Img key={src} src={src} alt={`${alt} ${i + 1}`} eager={i === 0} />)}
      </div>
      <div className="gallery-dots">
        {list.map((src, i) => (
          <button key={src} className={i === index ? 'on' : ''} onClick={() => go(i)} aria-label={`صورة ${i + 1}`} />
        ))}
      </div>
    </>
  );
}

export default function Product() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToCart, isWished, toggleWish, notify } = useStore();
  const [p, setP] = useState(null);
  const [error, setError] = useState('');
  const [size, setSize] = useState('');
  const [qty, setQty] = useState(1);
  const [sizeError, setSizeError] = useState(false);

  useEffect(() => {
    setP(null);
    setSize('');
    setQty(1);
    api(`/products/${id}`).then(setP).catch((e) => setError(e.message));
  }, [id]);

  if (error) return <div className="container empty"><h2>{error}</h2><Link to="/shop" className="btn btn-primary">العودة للمتجر</Link></div>;
  if (!p) return <div className="container product"><div className="product-media skeleton" /></div>;

  const wished = isWished(p.id);
  const discount = p.old_price ? Math.round((1 - p.price / p.old_price) * 100) : 0;
  const soldOut = p.stock <= 0;

  const add = (buyNow) => {
    if (!size) {
      setSizeError(true);
      notify('اختاري المقاس أولاً');
      return;
    }
    addToCart(p, size, qty);
    if (buyNow) navigate('/cart');
  };

  return (
    <>
      <div className="container product">
        <div className="product-media">
          <button className="float-btn back" onClick={() => navigate(-1)} aria-label="رجوع"><BackIcon /></button>
          <button className={`float-btn wish ${wished ? 'on' : ''}`} onClick={() => toggleWish(p)} aria-label="المفضلة">
            <HeartIcon filled={wished} />
          </button>
          <Gallery images={[p.image_url, ...(p.images || [])]} alt={p.name} />
          {discount > 0 && <span className="badge badge-sale">-{discount}%</span>}
        </div>

        <div className="product-info">
          <Link to={`/shop?category=${p.category_slug}`} className="crumb">{p.category_name}</Link>
          <h1>{p.name}</h1>
          <div className="card-meta">
            <span className="rating"><StarIcon /> {p.rating}</span>
            <span className="muted">· تم بيع {p.sold_count}+</span>
          </div>
          <div className="product-price">
            <strong>{price(p.price)}</strong>
            {p.old_price && <del>{price(p.old_price)}</del>}
            {discount > 0 && <span className="save">وفّري {discount}%</span>}
          </div>

          <h4>الألوان المتوفرة</h4>
          <p className="muted">{p.colors.join(' · ')}</p>

          <h4 className={sizeError && !size ? 'error-text' : ''}>
            المقاس {sizeError && !size && '— يرجى الاختيار'}
          </h4>
          <div className="sizes">
            {p.sizes.map((s) => (
              <button key={s} className={size === s ? 'on' : ''} onClick={() => setSize(s)}>{s}</button>
            ))}
          </div>

          <h4>الكمية</h4>
          <div className="qty">
            <button onClick={() => setQty((q) => Math.min(q + 1, Math.min(10, p.stock)))} aria-label="زيادة">+</button>
            <span>{qty}</span>
            <button onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label="إنقاص">−</button>
          </div>
          {p.stock > 0 && p.stock < 10 && <p className="low-stock">متبقي {p.stock} قطع فقط!</p>}

          <div className="desktop-actions">
            <button className="btn btn-primary btn-lg" disabled={soldOut} onClick={() => add(false)}>
              {soldOut ? 'نفدت الكمية' : 'أضيفي إلى السلة'}
            </button>
            <button className="btn btn-outline btn-lg" disabled={soldOut} onClick={() => add(true)}>اشتري الآن</button>
          </div>

          <h4>الوصف</h4>
          <p className="desc">{p.description}</p>

          <ul className="perks small">
            <li><TruckIcon /> توصيل خلال 2-5 أيام عمل</li>
            <li><span className="perk-cash">💵</span> الدفع عند الاستلام</li>
            <li><ReturnIcon /> استبدال مجاني خلال 7 أيام</li>
          </ul>
          {p.source_url && (
            <a className="source" href={p.source_url} target="_blank" rel="noreferrer">مصدر الصورة: Pinterest</a>
          )}
        </div>
      </div>

      {p.related.length > 0 && (
        <section className="container section">
          <h2 className="h2">قد يعجبك أيضاً</h2>
          <div className="scroll-x deals-row">
            {p.related.map((r) => <ProductCard key={r.id} product={r} />)}
          </div>
        </section>
      )}

      {/* Sticky add-to-cart bar for mobile */}
      <div className="buy-bar">
        <div>
          <small className="muted">{size ? `المقاس: ${size}` : 'اختاري المقاس'}</small>
          <strong>{price(p.price * qty)}</strong>
        </div>
        <button className="btn btn-primary" disabled={soldOut} onClick={() => add(false)}>
          {soldOut ? 'نفدت الكمية' : 'أضيفي إلى السلة'}
        </button>
      </div>
    </>
  );
}

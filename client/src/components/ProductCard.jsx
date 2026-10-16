import { Link } from 'react-router-dom';
import { price } from '../api.js';
import { useStore } from '../store.jsx';
import { HeartIcon, StarIcon } from './Icons.jsx';

const BADGES = { new: 'جديد', sale: 'تخفيض', hot: 'الأكثر طلباً 🔥' };

export function Img({ src, alt, className, eager }) {
  return (
    <img
      src={src}
      alt={alt}
      className={className}
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      referrerPolicy="no-referrer"
      onError={(e) => e.currentTarget.classList.add('img-broken')}
    />
  );
}

export default function ProductCard({ product: p, eager }) {
  const { isWished, toggleWish } = useStore();
  const wished = isWished(p.id);
  const discount = p.old_price ? Math.round((1 - p.price / p.old_price) * 100) : 0;

  return (
    <article className="card">
      <Link to={`/product/${p.id}`} className="card-media">
        <Img src={p.image_url} alt={p.name} eager={eager} />
        {p.badge && (
          <span className={`badge badge-${p.badge}`}>{p.badge === 'sale' && discount ? `-${discount}%` : BADGES[p.badge]}</span>
        )}
      </Link>
      <button
        className={`wish-btn ${wished ? 'on' : ''}`}
        onClick={() => toggleWish(p)}
        aria-label={wished ? 'إزالة من المفضلة' : 'إضافة إلى المفضلة'}
      >
        <HeartIcon filled={wished} width="18" height="18" />
      </button>
      <Link to={`/product/${p.id}`} className="card-body">
        <h3>{p.name}</h3>
        <div className="card-meta">
          <span className="rating"><StarIcon /> {p.rating}</span>
          <span className="muted">{p.category_name}</span>
        </div>
        <div className="card-price">
          <strong>{price(p.price)}</strong>
          {p.old_price && <del>{price(p.old_price)}</del>}
        </div>
      </Link>
    </article>
  );
}

export function ProductGrid({ products, loading, count = 8 }) {
  if (loading && !products.length) {
    return (
      <div className="grid">
        {Array.from({ length: count }, (_, i) => (
          <div key={i} className="card skeleton" />
        ))}
      </div>
    );
  }
  return (
    <div className="grid">
      {products.map((p, i) => (
        <ProductCard key={p.id} product={p} eager={i < 4} />
      ))}
    </div>
  );
}

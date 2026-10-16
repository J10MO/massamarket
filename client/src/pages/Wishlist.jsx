import { Link } from 'react-router-dom';
import { useStore } from '../store.jsx';
import { ProductGrid } from '../components/ProductCard.jsx';
import { HeartIcon } from '../components/Icons.jsx';

export default function Wishlist() {
  const { wishlist } = useStore();
  if (!wishlist.length) {
    return (
      <div className="container empty">
        <HeartIcon width="64" height="64" />
        <h2>قائمة المفضلة فارغة</h2>
        <p className="muted">اضغطي على ♡ لحفظ الفساتين التي تعجبك</p>
        <Link to="/shop" className="btn btn-primary">تصفحي الفساتين</Link>
      </div>
    );
  }
  return (
    <div className="container section">
      <h1 className="h1">المفضلة ({wishlist.length})</h1>
      <ProductGrid products={wishlist} />
    </div>
  );
}

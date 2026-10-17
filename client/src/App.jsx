import { lazy, Suspense, useEffect } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import { useStore } from './store.jsx';
import { BottomNav, Footer, Header, WhatsappButton } from './components/Layout.jsx';
import Home from './pages/Home.jsx';
import Shop from './pages/Shop.jsx';
import Product from './pages/Product.jsx';
import Cart from './pages/Cart.jsx';
import Checkout from './pages/Checkout.jsx';
import Wishlist from './pages/Wishlist.jsx';
import Account from './pages/Account.jsx';
import OrderSuccess from './pages/OrderSuccess.jsx';
import Market from './market/Market.jsx';
import Listing from './market/Listing.jsx';
import Sell from './market/Sell.jsx';
import SellerCenter from './market/SellerCenter.jsx';
import { Purchases, Saved, SellerProfile } from './market/Purchases.jsx';
import './market/market.css';

// The admin dashboard is a separate app, loaded only when /admin is opened
const AdminApp = lazy(() => import('./admin/AdminApp.jsx'));

export default function App() {
  const { toast } = useStore();
  const { pathname, search } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname, search]);

  if (pathname.startsWith('/admin')) {
    return (
      <Suspense fallback={<div className="spinner" />}>
        <AdminApp />
      </Suspense>
    );
  }

  return (
    <>
      <Header />
      <main className="main">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/shop" element={<Shop />} />
          <Route path="/product/:id" element={<Product />} />
          <Route path="/cart" element={<Cart />} />
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/order/:id" element={<OrderSuccess />} />
          <Route path="/wishlist" element={<Wishlist />} />
          <Route path="/account" element={<Account />} />
          <Route path="/market" element={<Market />} />
          <Route path="/market/:id" element={<Listing />} />
          <Route path="/sell" element={<Sell />} />
          <Route path="/sell/:id" element={<Sell />} />
          <Route path="/my/listings" element={<SellerCenter />} />
          <Route path="/my/purchases" element={<Purchases />} />
          <Route path="/my/saved" element={<Saved />} />
          <Route path="/seller/:id" element={<SellerProfile />} />
          <Route path="*" element={<div className="container empty"><h2>الصفحة غير موجودة</h2></div>} />
        </Routes>
      </main>
      <Footer />
      {!['/product', '/market', '/sell', '/my/'].some((p) => pathname.startsWith(p)) && <WhatsappButton />}
      <BottomNav />
      {toast && <div key={toast.id} className="toast" role="status">{toast.msg}</div>}
    </>
  );
}

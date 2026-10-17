import { useEffect, useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useStore } from '../store.jsx';
import { BagIcon, HeartIcon, HomeIcon, InstagramIcon, MoonIcon, RecycleIcon, SunIcon, SearchIcon, ShopIcon, UserIcon, WhatsappIcon } from './Icons.jsx';

export const waLink = (n) => `https://wa.me/${String(n || '').replace(/\D/g, '')}`;
export const igHandle = (url) => '@' + (String(url || '').match(/instagram\.com\/([^/?#]+)/)?.[1] || 'katkot__fashion');

export function Logo({ light }) {
  return (
    <Link to="/" className={`logo ${light ? 'light' : ''}`} aria-label="Juman — الصفحة الرئيسية">
      <img src="/logo-badge.png" alt="" width="44" height="44" />
      <span className="logo-words">
        <b>جُمان</b>
        <small dir="ltr">JUMAN</small>
      </span>
    </Link>
  );
}

function AnnouncementBar() {
  const { settings } = useStore();
  const list = settings.announcements?.length ? settings.announcements : ['📦 توصيل لجميع المحافظات'];
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((n) => n + 1), 3500);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="announce" aria-live="polite">
      <span key={i}>{list[i % list.length]}</span>
    </div>
  );
}

export function Header() {
  const { cartCount, wishlist, theme, toggleTheme } = useStore();
  const [q, setQ] = useState('');
  const navigate = useNavigate();

  const submit = (e) => {
    e.preventDefault();
    navigate(q.trim() ? `/shop?q=${encodeURIComponent(q.trim())}` : '/shop');
  };

  return (
    <>
      <AnnouncementBar />
      <header className="header">
        <div className="header-row container">
          <Logo />
          <nav className="desktop-nav">
            <NavLink to="/" end>الرئيسية</NavLink>
            <NavLink to="/shop">المتجر</NavLink>
            <NavLink to="/shop?badge=sale">العروض</NavLink>
            <NavLink to="/shop?category=evening">السهرة</NavLink>
            <NavLink to="/market">السوق</NavLink>
            <NavLink to="/shops">المحلات</NavLink>
            <NavLink to="/sell" className="nav-sell">+ بيعي فستانچ</NavLink>
          </nav>
          <form className="search" onSubmit={submit} role="search">
            <SearchIcon width="18" height="18" />
            <input type="search" placeholder="ابحثي عن فستان..." value={q} onChange={(e) => setQ(e.target.value)} enterKeyHint="search" />
          </form>
          <button
            className="icon-btn theme-btn"
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? 'الوضع النهاري' : 'الوضع الليلي'}
            title={theme === 'dark' ? 'الوضع النهاري' : 'الوضع الليلي'}
          >
            {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
          </button>
          <div className="header-icons">
            <Link to="/account" className="icon-btn" aria-label="حسابي"><UserIcon /></Link>
            <Link to="/wishlist" className="icon-btn" aria-label="المفضلة">
              <HeartIcon />
              {wishlist.length > 0 && <span className="dot">{wishlist.length}</span>}
            </Link>
            <Link to="/cart" className="icon-btn" aria-label="السلة">
              <BagIcon />
              {cartCount > 0 && <span className="dot">{cartCount}</span>}
            </Link>
          </div>
        </div>
      </header>
    </>
  );
}

export function BottomNav() {
  const { cartCount, user } = useStore();
  const items = [
    { to: '/', label: 'الرئيسية', Icon: HomeIcon, end: true },
    { to: '/shop', label: 'المتجر', Icon: ShopIcon },
    { to: '/market', label: 'المستعمل', Icon: RecycleIcon },
    { to: '/cart', label: 'السلة', Icon: BagIcon, count: cartCount },
    { to: '/account', label: user ? 'حسابي' : 'دخول', Icon: UserIcon },
  ];
  return (
    <nav className="bottom-nav" aria-label="التنقل">
      {items.map(({ to, label, Icon, end, count }) => (
        <NavLink key={to} to={to} end={end}>
          <span className="bn-icon">
            <Icon />
            {count > 0 && <span className="dot">{count}</span>}
          </span>
          {label}
        </NavLink>
      ))}
    </nav>
  );
}

export function Footer() {
  const { settings } = useStore();
  return (
    <footer className="footer">
      <img className="footer-emblem" src="/logo-face-gold.png" alt="" aria-hidden="true" />
      <div className="container footer-grid">
        <div>
          <Logo light />
          <p>{settings.tagline || 'فخامة تُحاكي ذوقچ'} — أناقة • تميّز • اختيار راقٍ. توصيل لجميع محافظات العراق والدفع عند الاستلام.</p>
          <div className="socials">
            <a href={settings.instagram || 'https://www.instagram.com/katkot__fashion/'} target="_blank" rel="noreferrer" aria-label="Instagram"><InstagramIcon /></a>
            <a href={waLink(settings.whatsapp)} target="_blank" rel="noreferrer" aria-label="WhatsApp"><WhatsappIcon width="22" height="22" /></a>
          </div>
        </div>
        <div>
          <h4>تسوقي</h4>
          <Link to="/shop?category=evening">فساتين سهرة</Link>
          <Link to="/shop?category=engagement">فساتين خطوبة</Link>
          <Link to="/shop?category=casual">فساتين كاجوال</Link>
          <Link to="/shop?category=abaya">عبايات</Link>
          <Link to="/market">سوق المستعمل</Link>
          <Link to="/sell">بيعي فستانچ</Link>
          <Link to="/shops">المحلات والبوتيكات</Link>
          <Link to="/shops/join">سجّلي محلچ في جُمان</Link>
        </div>
        <div>
          <h4>المساعدة</h4>
          <Link to="/account">طلباتي</Link>
          <a href={waLink(settings.whatsapp)} target="_blank" rel="noreferrer">تواصلي معنا</a>
          <a href={settings.instagram} target="_blank" rel="noreferrer" dir="ltr">{igHandle(settings.instagram)}</a>
          <span>📦 توصيل لجميع المحافظات</span>
        </div>
      </div>
      <p className="copy">© {new Date().getFullYear()} Juman جُمان. جميع الحقوق محفوظة</p>
    </footer>
  );
}

export function WhatsappButton() {
  const { settings } = useStore();
  return (
    <a className="wa-fab" href={waLink(settings.whatsapp)} target="_blank" rel="noreferrer" aria-label="تواصلي عبر واتساب">
      <WhatsappIcon />
    </a>
  );
}

import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, price } from '../api.js';
import { useStore } from '../store.jsx';
import ProductCard, { Img, ProductGrid } from '../components/ProductCard.jsx';
import { InstagramIcon, ReturnIcon, StarIcon, TruckIcon } from '../components/Icons.jsx';
import { igHandle } from '../components/Layout.jsx';
import { ListingCard } from '../market/shared.jsx';
import { ShopCard } from '../market/Shops.jsx';

function SectionTitle({ children, sub, light }) {
  return (
    <div className={`section-title ${light ? 'light' : ''}`}>
      <h2>{children}</h2>
      <span className="ornament" aria-hidden="true"><i /><b /><i /></span>
      {sub && <p>{sub}</p>}
    </div>
  );
}

function Hero({ categories, featured }) {
  const { user, settings: s } = useStore();
  const [cat, setCat] = useState('');
  const navigate = useNavigate();
  const hero = featured[0];
  const avatars = featured.slice(1, 4);

  return (
    <section className="hero container">
      <div className="hero-card">
        <div className="hero-text">
          {s.hero_offer && <p className="eyebrow"><span>✦</span> {s.hero_offer}</p>}
          <h1>{s.hero_title || 'تألّقي كاللؤلؤ'}<br /><em>{s.hero_title_accent || 'في كل مناسبة'}</em></h1>
          <p className="hero-sub">{s.hero_subtitle || 'فساتين مختارة بعناية، خامات فاخرة ومقاسات تناسب الجميع.'}</p>
        </div>
        <div className="hero-media">
          <div className="hero-rays" aria-hidden="true" />
          {hero && <Img src={hero.image_url} alt={hero.name} eager />}
          {hero && (
            <Link to={`/product/${hero.id}`} className="hero-tag">
              <small>الأكثر طلباً</small>
              <b>{hero.name}</b>
            </Link>
          )}
        </div>
        <form
          className="hero-search"
          onSubmit={(e) => {
            e.preventDefault();
            navigate(cat ? `/shop?category=${cat}` : '/shop');
          }}
        >
          <select value={cat} onChange={(e) => setCat(e.target.value)} aria-label="اختاري القسم">
            <option value="">اختاري القسم</option>
            {categories.map((c) => (
              <option key={c.slug} value={c.slug}>{c.name}</option>
            ))}
          </select>
          <button className="btn btn-rose">تسوقي الآن</button>
        </form>
        <div className="hero-foot">
          <div className="happy">
            <div className="avatars">
              {avatars.map((a) => <Img key={a.id} src={a.image_url} alt="" />)}
            </div>
            <div>
              <small>عميلاتنا السعيدات</small>
              <span><StarIcon /><StarIcon /><StarIcon /><StarIcon /><StarIcon /> 4.9 (12 ألف تقييم)</span>
            </div>
          </div>
          {!user && (
            <Link to="/account?mode=register" className="join">
              لستِ عضوة بعد؟ <b>سجلي الآن</b>
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}

const REVIEWS = [
  { name: 'زينب', city: 'بغداد', text: 'الفستان وصل نفس الصورة بالضبط والقماش فخم كلش. لبسته بعرس أختي والكل سألني منين 😍' },
  { name: 'مريم', city: 'البصرة', text: 'التوصيل جان سريع والتغليف راقي، والقياس مضبوط. الدفع عند الاستلام ريّحني هواية.' },
  { name: 'نور', city: 'أربيل', text: 'العباية حلوة وعملية، وردّوا عليّ بالواتساب بسرعة. أكيد راح أطلب مرة ثانية.' },
  { name: 'فاطمة', city: 'النجف', text: 'بدّلت القياس بدون أي تعقيد. تعامل راقي من البداية للنهاية 💕' },
];

export default function Home() {
  const { settings } = useStore();
  const [categories, setCategories] = useState([]);
  const [featured, setFeatured] = useState([]);
  const [deals, setDeals] = useState([]);
  const [lookbook, setLookbook] = useState([]);
  const [used, setUsed] = useState([]);
  const [shops, setShops] = useState([]);
  const [active, setActive] = useState('all');
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api('/categories').then(setCategories).catch((e) => setError(e.message));
    api('/products?featured=1&category=evening&sort=rating&limit=8').then((d) => setFeatured(d.items)).catch(() => {});
    api('/products?badge=sale&sort=popular&limit=10').then((d) => setDeals(d.items)).catch(() => {});
    api('/products?sort=rating&limit=7&category=evening').then((d) => setLookbook(d.items)).catch(() => {});
    api('/market/listings?limit=10').then((d) => setUsed(d.items)).catch(() => {});
    api('/merchants?limit=12').then(setShops).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    api(`/products?category=${active}&sort=popular&limit=8`)
      .then((d) => setProducts(d.items))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [active]);

  return (
    <>
      <Hero categories={categories} featured={featured} />

      <ul className="perks container">
        <li><TruckIcon /> <span>توصيل لكل المحافظات<br /><small>{settings.free_shipping_over ? `مجاني فوق ${price(settings.free_shipping_over)}` : 'لباب البيت'}</small></span></li>
        <li><span className="perk-cash">💵</span> <span>الدفع عند الاستلام<br /><small>آمن وسهل</small></span></li>
        <li><ReturnIcon /> <span>إرجاع عند الاستلام<br /><small>إذا لم تطابق الصورة</small></span></li>
      </ul>

      {error && <p className="container alert">{error}</p>}

      <section className="container section">
        <SectionTitle sub="اكتشفي مجموعاتنا المختارة">مجموعات مميزة</SectionTitle>
        <div className="collections scroll-x">
          {categories.map((c) => (
            <Link key={c.slug} to={`/shop?category=${c.slug}`} className="collection" style={{ '--c': c.color }}>
              <span className="collection-text">
                <b>{c.name}</b>
                <small>{c.product_count} قطعة ←</small>
              </span>
              {c.image_url && <Img src={c.image_url} alt={c.name} />}
            </Link>
          ))}
        </div>
      </section>

      <section className="container section">
        <SectionTitle>تسوقي حسب القسم</SectionTitle>
        <div className="cat-tabs scroll-x" role="tablist">
          <button role="tab" aria-selected={active === 'all'} className={active === 'all' ? 'on' : ''} onClick={() => setActive('all')}>
            <span className="cat-thumb all"><img src="/logo-face-gold.png" alt="" /></span>الكل
          </button>
          {categories.map((c) => (
            <button key={c.slug} role="tab" aria-selected={active === c.slug} className={active === c.slug ? 'on' : ''} onClick={() => setActive(c.slug)}>
              <span className="cat-thumb">{c.image_url && <Img src={c.image_url} alt="" />}</span>
              {c.name}
            </button>
          ))}
        </div>
        <ProductGrid products={products} loading={loading} />
        <div className="center">
          <Link to={active === 'all' ? '/shop' : `/shop?category=${active}`} className="btn btn-outline">عرض الكل</Link>
        </div>
      </section>

      {deals.length > 0 && (
        <section className="section deals">
          <div className="container">
            <SectionTitle sub="خصومات لفترة محدودة" light>عروض الأسبوع</SectionTitle>
            <div className="scroll-x deals-row">
              {deals.map((p) => <ProductCard key={p.id} product={p} />)}
            </div>
            <div className="center">
              <Link to="/shop?badge=sale" className="btn btn-rose">كل العروض</Link>
            </div>
          </div>
        </section>
      )}

      {settings.market_enabled !== false && (
        <section className="container section">
          <div className="used-band">
            <div>
              <span className="m-tag">♻ جديد في جُمان</span>
              <h2>سوق المستعمل</h2>
              <p>فساتين لُبست مرة بأسعار تنافسية — أو بيعي فستانچ واستفيدي من سعره.</p>
            </div>
            <div className="used-band-actions">
              <Link to="/market" className="btn btn-rose">تصفحي المستعمل</Link>
              <Link to="/sell" className="btn m-ghost">+ بيعي فستانچ</Link>
            </div>
          </div>
          {used.length > 0 && (
            <div className="scroll-x deals-row used-row">
              {used.map((l) => <ListingCard key={l.id} listing={l} />)}
            </div>
          )}
        </section>
      )}

      {shops.length > 0 && (
        <section className="container section">
          <SectionTitle sub="محلات موثّقة تعرض أحدث الفساتين">محلات وبوتيكات</SectionTitle>
          <div className="scroll-x shops-row">
            {shops.map((s) => <ShopCard key={s.id} shop={s} />)}
          </div>
          <div className="center">
            <Link to="/shops" className="btn btn-outline">كل المحلات</Link>{' '}
            <Link to="/shops/join" className="btn btn-soft">🏬 سجّلي محلچ</Link>
          </div>
        </section>
      )}

      {lookbook.length >= 6 && (
        <section className="container section">
          <SectionTitle sub="إطلالات السهرة الأعلى تقييماً">لوك بوك جُمان</SectionTitle>
          <div className="lookbook">
            {lookbook.slice(0, 6).map((p, i) => (
              <Link key={p.id} to={`/product/${p.id}`} className={`look look-${i}`}>
                <Img src={p.image_url} alt={p.name} />
                <span>{p.name}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="container section promise">
        <img src="/logo-badge.png" alt="" className="promise-mark" />
        <h2>وعد جُمان</h2>
        <p>نختار كل قطعة بعناية لتصلك بجودة تليق بكِ. إن لم تكوني راضية تماماً، نستبدلها لكِ مجاناً.</p>
        <div className="promise-stats">
          <div><b>+12 ألف</b><small>عميلة سعيدة</small></div>
          <div><b>+450</b><small>تصميم</small></div>
          <div><b>4.9★</b><small>متوسط التقييم</small></div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <SectionTitle>آراء عميلاتنا</SectionTitle>
        </div>
        <div className="container">
          <div className="scroll-x reviews">
            {REVIEWS.map((r) => (
              <figure key={r.name} className="review">
                <span className="stars"><StarIcon /><StarIcon /><StarIcon /><StarIcon /><StarIcon /></span>
                <blockquote>{r.text}</blockquote>
                <figcaption>
                  <span className="review-avatar">{r.name[0]}</span>
                  <b>{r.name}</b> <small>· {r.city}</small>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      <section className="container section">
        <a className="insta-band" href={settings.instagram || 'https://www.instagram.com/katkot__fashion/'} target="_blank" rel="noreferrer">
          <span className="insta-icon"><InstagramIcon width="28" height="28" /></span>
          <span className="insta-text">
            <b>تابعينا على إنستغرام</b>
            <small>أحدث التصاميم والعروض أول بأول</small>
          </span>
          <span className="insta-handle" dir="ltr">{igHandle(settings.instagram)}</span>
        </a>
      </section>
    </>
  );
}

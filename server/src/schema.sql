CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  name          TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  phone         TEXT,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'customer' CHECK (role IN ('customer', 'admin')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS categories (
  id               SERIAL PRIMARY KEY,
  slug             TEXT NOT NULL UNIQUE,
  name             TEXT NOT NULL,
  description      TEXT,
  color            TEXT NOT NULL DEFAULT '#0B1A3E',
  sort_order       INT NOT NULL DEFAULT 0,
  pinterest_boards TEXT[] NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS products (
  id          SERIAL PRIMARY KEY,
  category_id INT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  description TEXT,
  price       NUMERIC(10,2) NOT NULL CHECK (price >= 0),
  old_price   NUMERIC(10,2),
  image_url   TEXT NOT NULL,
  image_key   TEXT UNIQUE,            -- Pinterest image hash, used to avoid duplicate imports
  source_url  TEXT,                   -- original Pinterest pin
  sizes       TEXT[] NOT NULL DEFAULT '{S,M,L,XL}',
  colors      TEXT[] NOT NULL DEFAULT '{}',
  stock       INT NOT NULL DEFAULT 20,
  badge       TEXT CHECK (badge IN ('new', 'sale', 'hot')),
  is_featured BOOLEAN NOT NULL DEFAULT false,
  rating      NUMERIC(2,1) NOT NULL DEFAULT 4.5,
  sold_count  INT NOT NULL DEFAULT 0,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS products_category_idx ON products(category_id);
CREATE INDEX IF NOT EXISTS products_created_idx ON products(created_at DESC);

CREATE TABLE IF NOT EXISTS orders (
  id             SERIAL PRIMARY KEY,
  user_id        INT REFERENCES users(id) ON DELETE SET NULL,
  customer_name  TEXT NOT NULL,
  phone          TEXT NOT NULL,
  city           TEXT NOT NULL,
  address        TEXT NOT NULL,
  notes          TEXT,
  payment_method TEXT NOT NULL DEFAULT 'cod',
  status         TEXT NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending', 'confirmed', 'shipped', 'delivered', 'cancelled')),
  subtotal       NUMERIC(10,2) NOT NULL,
  shipping       NUMERIC(10,2) NOT NULL,
  total          NUMERIC(10,2) NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS order_items (
  id         SERIAL PRIMARY KEY,
  order_id   INT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id INT REFERENCES products(id) ON DELETE SET NULL,
  name       TEXT NOT NULL,
  image_url  TEXT,
  price      NUMERIC(10,2) NOT NULL,
  size       TEXT,
  quantity   INT NOT NULL CHECK (quantity > 0)
);

-- v2: product gallery + store settings
ALTER TABLE products ADD COLUMN IF NOT EXISTS images TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE products ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE categories ADD COLUMN IF NOT EXISTS image_url TEXT;

CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value JSONB NOT NULL
);

CREATE INDEX IF NOT EXISTS orders_created_idx ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS orders_phone_idx ON orders(phone);

-- v3: used-dress marketplace (customers sell to customers) + paid boosts
CREATE TABLE IF NOT EXISTS listings (
  id             SERIAL PRIMARY KEY,
  seller_id      INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category_id    INT REFERENCES categories(id) ON DELETE SET NULL,
  title          TEXT NOT NULL,
  description    TEXT,
  size           TEXT NOT NULL,
  condition      TEXT NOT NULL CHECK (condition IN ('new_tag', 'like_new', 'very_good', 'good')),
  brand          TEXT,
  color          TEXT,
  price          NUMERIC(12,2) NOT NULL CHECK (price > 0),
  original_price NUMERIC(12,2),
  images         TEXT[] NOT NULL DEFAULT '{}',
  city           TEXT NOT NULL,
  status         TEXT NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending', 'active', 'reserved', 'sold', 'rejected', 'hidden')),
  reject_reason  TEXT,
  views          INT NOT NULL DEFAULT 0,
  boosted_until  TIMESTAMPTZ,
  sold_at        TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS listings_status_idx ON listings(status, boosted_until DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS listings_seller_idx ON listings(seller_id);

CREATE TABLE IF NOT EXISTS market_orders (
  id          SERIAL PRIMARY KEY,
  listing_id  INT REFERENCES listings(id) ON DELETE SET NULL,
  seller_id   INT REFERENCES users(id) ON DELETE SET NULL,
  buyer_id    INT REFERENCES users(id) ON DELETE SET NULL,
  title       TEXT NOT NULL,
  image_url   TEXT,
  price       NUMERIC(12,2) NOT NULL,
  commission  NUMERIC(12,2) NOT NULL DEFAULT 0,
  buyer_name  TEXT NOT NULL,
  buyer_phone TEXT NOT NULL,
  city        TEXT NOT NULL,
  address     TEXT NOT NULL,
  notes       TEXT,
  status      TEXT NOT NULL DEFAULT 'pending'
              CHECK (status IN ('pending', 'accepted', 'rejected', 'completed', 'cancelled')),
  seller_note TEXT,
  rating      INT CHECK (rating BETWEEN 1 AND 5),
  review      TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS market_orders_seller_idx ON market_orders(seller_id, created_at DESC);
CREATE INDEX IF NOT EXISTS market_orders_buyer_idx ON market_orders(buyer_id, created_at DESC);

CREATE TABLE IF NOT EXISTS promotions (
  id             SERIAL PRIMARY KEY,
  listing_id     INT NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  user_id        INT REFERENCES users(id) ON DELETE SET NULL,
  days           INT NOT NULL CHECK (days > 0),
  amount         NUMERIC(12,2) NOT NULL,
  payment_method TEXT NOT NULL,
  payment_ref    TEXT,
  receipt_url    TEXT,
  status         TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'rejected')),
  admin_note     TEXT,
  starts_at      TIMESTAMPTZ,
  ends_at        TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS promotions_status_idx ON promotions(status, created_at DESC);

CREATE TABLE IF NOT EXISTS listing_reports (
  id         SERIAL PRIMARY KEY,
  listing_id INT NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  user_id    INT REFERENCES users(id) ON DELETE SET NULL,
  reason     TEXT NOT NULL,
  details    TEXT,
  status     TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- v4: online payment (manual transfer, e.g. Super Qi) for store orders + marketplace commission collection
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'cod'; -- cod | awaiting | paid | rejected
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_ref TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_receipt TEXT;

ALTER TABLE market_orders ADD COLUMN IF NOT EXISTS commission_status TEXT NOT NULL DEFAULT 'unpaid'; -- unpaid | pending | paid

CREATE TABLE IF NOT EXISTS commission_payments (
  id             SERIAL PRIMARY KEY,
  seller_id      INT REFERENCES users(id) ON DELETE SET NULL,
  amount         NUMERIC(12,2) NOT NULL,
  order_ids      INT[] NOT NULL,
  payment_method TEXT NOT NULL,
  payment_ref    TEXT,
  receipt_url    TEXT,
  status         TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  admin_note     TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- v5: merchants (dress shops / boutiques) that publish under their own name after admin approval
CREATE TABLE IF NOT EXISTS merchants (
  id            SERIAL PRIMARY KEY,
  user_id       INT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  shop_name     TEXT NOT NULL,
  slug          TEXT NOT NULL UNIQUE,
  description   TEXT,
  logo_url      TEXT,
  cover_url     TEXT,
  phone         TEXT NOT NULL,
  whatsapp      TEXT,
  instagram     TEXT,
  website       TEXT,
  city          TEXT NOT NULL,
  address       TEXT,
  map_url       TEXT,
  hours         TEXT,
  status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'suspended')),
  reject_reason TEXT,
  approved_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS merchants_status_idx ON merchants(status);

-- Shop listings: new items with several sizes and a stock count (used listings keep stock NULL = one piece)
ALTER TABLE listings ADD COLUMN IF NOT EXISTS merchant_id INT REFERENCES merchants(id) ON DELETE SET NULL;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS sizes TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE listings ADD COLUMN IF NOT EXISTS stock INT;
CREATE INDEX IF NOT EXISTS listings_merchant_idx ON listings(merchant_id);
ALTER TABLE listings DROP CONSTRAINT IF EXISTS listings_condition_check;
ALTER TABLE listings ADD CONSTRAINT listings_condition_check CHECK (condition IN ('new', 'new_tag', 'like_new', 'very_good', 'good'));
ALTER TABLE market_orders ADD COLUMN IF NOT EXISTS size TEXT;

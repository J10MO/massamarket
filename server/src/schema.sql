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

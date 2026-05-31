-- ============================================================
-- BAIBESIK.KZ — Полная схема базы данных
-- Supabase (PostgreSQL) — Апрель 2026
-- Выполнить в SQL Editor на supabase.com
-- ============================================================

-- ── РАСШИРЕНИЯ ───────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- 1. ПОЛЬЗОВАТЕЛИ
-- ============================================================
CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email         TEXT UNIQUE,
  phone         TEXT UNIQUE NOT NULL,
  full_name     TEXT NOT NULL,
  avatar_url    TEXT,
  role          TEXT NOT NULL DEFAULT 'customer'
                CHECK (role IN ('super_admin','store_owner','manager','warehouse','customer','wholesale')),
  is_active     BOOLEAN DEFAULT TRUE,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Комментарии к ролям:
-- super_admin  → Алфараби (вы)
-- store_owner  → Владелец магазина (полный доступ к своему магазину)
-- manager      → Менеджер (1-3 чел, управление заказами + курьер)
-- warehouse    → Складской работник (только сборка заказов)
-- customer     → Розничный покупатель
-- wholesale    → Оптовый покупатель

-- ============================================================
-- 2. АДРЕСА ПОЛЬЗОВАТЕЛЕЙ
-- ============================================================
CREATE TABLE user_addresses (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
  title_ru    TEXT DEFAULT 'Домашний',
  title_kk    TEXT DEFAULT 'Үй',
  street      TEXT NOT NULL,
  house       TEXT,
  apartment   TEXT,
  lat         DECIMAL(10,7),
  lng         DECIMAL(10,7),
  is_main     BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 3. МАГАЗИНЫ
-- ============================================================
CREATE TABLE stores (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name            TEXT NOT NULL,
  description_ru  TEXT,
  description_kk  TEXT,
  address         TEXT,
  lat             DECIMAL(10,7) DEFAULT 43.2558,  -- Байбесик по умолчанию
  lng             DECIMAL(10,7) DEFAULT 76.9356,
  phone           TEXT,
  logo_url        TEXT,
  -- Платёжные реквизиты
  kaspi_merchant_id   TEXT,   -- для Kaspi QR
  halyk_merchant_id   TEXT,   -- для Halyk QR
  preferred_bank      TEXT DEFAULT 'kaspi' CHECK (preferred_bank IN ('kaspi','halyk','both')),
  -- Подписка
  status              TEXT DEFAULT 'trial' CHECK (status IN ('trial','active','expired','blocked')),
  trial_ends_at       TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '90 days'),
  subscription_fee    INTEGER DEFAULT 15000,  -- тенге в месяц
  last_paid_at        TIMESTAMPTZ,
  -- Метаданные
  is_active           BOOLEAN DEFAULT TRUE,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 4. СОТРУДНИКИ МАГАЗИНОВ
-- ============================================================
CREATE TABLE store_members (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  store_id    UUID REFERENCES stores(id) ON DELETE CASCADE,
  user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
  role        TEXT NOT NULL CHECK (role IN ('owner','manager','warehouse')),
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(store_id, user_id)
);

-- ============================================================
-- 5. КАТЕГОРИИ ТОВАРОВ (23 категории BMT)
-- ============================================================
CREATE TABLE categories (
  id          SERIAL PRIMARY KEY,
  icon        TEXT DEFAULT '📦',
  name_ru     TEXT NOT NULL,
  name_kk     TEXT NOT NULL,
  parent_id   INTEGER REFERENCES categories(id),
  sort_order  INTEGER DEFAULT 0,
  is_active   BOOLEAN DEFAULT TRUE
);

-- Вставка 23 категорий из прайс-листа BMT
INSERT INTO categories (icon, name_ru, name_kk, sort_order) VALUES
  ('📐', 'Направляющие',                          'Бағыттаушылар',                    1),
  ('🔩', 'Навесы (петли)',                         'Ілгектер',                         2),
  ('🖐️', 'Мебельные ручки и крючки',              'Жиһаз тұтқалары',                  3),
  ('🪝', 'Крючки',                                 'Ілгектер',                         4),
  ('🦿', 'Опоры для мебели',                       'Жиһаз тіреуіштері',                5),
  ('⬆️', 'Механизмы подъема и опускания',          'Газлифттер мен механизмдер',       6),
  ('🛁', 'Кухонные комплектующие',                 'Асүй жиынтықтары',                 7),
  ('📦', 'Системы выдвижных ящиков',               'Тартпалар жүйесі',                 8),
  ('💡', 'Светильники, розетки и трансформаторы', 'Шамдар мен розеткалар',             9),
  ('🔧', 'Метизы (шурупы) и конфирматы',           'Бекіту элементтері',               10),
  ('🧱', 'Декоративные полосы (латунь)',            'Декоративті жолақтар',             11),
  ('🪟', 'Консоли, полкодержатели, стеклодержат.', 'Сөреұстағыштар мен шыныұстағыш',  12),
  ('🛞', 'Ролики и колёса',                         'Роликтер мен доңғалақтар',         13),
  ('🪑', 'Гардеробное наполнение для шкафов',       'Шкафтарды толтыру',                14),
  ('🛏️', 'Кроватная фурнитура',                   'Төсек фурнитурасы',                15),
  ('🧴', 'Клеи, герметики, растворители',           'Желімдер мен герметиктер',         16),
  ('🔗', 'Штанги и крепления',                      'Штангалар мен бекітпелер',         17),
  ('🪣', 'Мебельные системы (Гола ручки)',          'Жиһаз жүйелері (Gola)',            18),
  ('🔄', 'Механизмы трансформации',                 'Трансформация механизмдері',        19),
  ('🚪', 'Системы раздвижных дверей',               'Сырғымалы есік жүйелері',          20),
  ('🪑', 'Аксессуары для офисной мебели',           'Кеңсе жиһазы керек-жарақтары',    21),
  ('🪑', 'Фурнитура для раздвижных столов',         'Сырғымалы үстел фурнитурасы',      22),
  ('🔩', 'Мебельные уголки, крепёжные пластины',   'Жиһаз бұрыштары',                  23);

-- ============================================================
-- 6. ТОВАРЫ
-- ============================================================
CREATE TABLE products (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  store_id        UUID REFERENCES stores(id) ON DELETE CASCADE,
  category_id     INTEGER REFERENCES categories(id),
  code            TEXT,                          -- артикул (4208, Blum, 7049...)
  name_ru         TEXT NOT NULL,
  name_kk         TEXT,
  description_ru  TEXT,
  description_kk  TEXT,
  spec            TEXT,                          -- характеристики
  image_url       TEXT,
  -- Цены
  price_retail    DECIMAL(12,2) NOT NULL,        -- розничная цена за шт
  price_wholesale DECIMAL(12,2),                 -- оптовая цена за шт
  -- Упаковка
  pack_qty        INTEGER DEFAULT 1,             -- кол-во в упаковке
  pack_price      DECIMAL(12,2),                 -- цена за упаковку
  -- Склад
  shelf_code      TEXT,                          -- код полки (A-14, B-02...)
  stock_qty       INTEGER DEFAULT 0,
  -- Флаги
  is_heavy        BOOLEAN DEFAULT FALSE,         -- крупногабаритный = только самовывоз
  is_active       BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 7. ДОСТУП ОПТОВИКОВ К МАГАЗИНАМ
-- ============================================================
CREATE TABLE wholesale_access (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  store_id      UUID REFERENCES stores(id) ON DELETE CASCADE,
  user_id       UUID REFERENCES users(id) ON DELETE CASCADE,
  discount_pct  INTEGER DEFAULT 15,              -- скидка в %
  status        TEXT DEFAULT 'pending'
                CHECK (status IN ('pending','active','blocked')),
  monthly_fee   INTEGER DEFAULT 5000,            -- айдат оптовика (тенге)
  last_paid_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(store_id, user_id)
);

-- ============================================================
-- 8. ЗАКАЗЫ
-- ============================================================
CREATE TABLE orders (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_number    TEXT UNIQUE NOT NULL,          -- BBS-XXXX
  customer_id     UUID REFERENCES users(id),
  store_id        UUID REFERENCES stores(id),
  -- Тип покупателя
  customer_type   TEXT DEFAULT 'retail' CHECK (customer_type IN ('retail','wholesale')),
  -- Адрес доставки
  delivery_address TEXT,
  delivery_lat    DECIMAL(10,7),
  delivery_lng    DECIMAL(10,7),
  recipient_name  TEXT,
  recipient_phone TEXT,
  comment         TEXT,
  -- Оплата
  payment_method  TEXT CHECK (payment_method IN ('kaspi','halyk','cash')),
  payment_status  TEXT DEFAULT 'pending'
                  CHECK (payment_status IN ('pending','paid','failed')),
  paid_at         TIMESTAMPTZ,
  -- Доставка
  delivery_type   TEXT CHECK (delivery_type IN ('courier','pickup')),
  courier_service TEXT CHECK (courier_service IN ('indrive','yandex',NULL)),
  courier_track   TEXT,                          -- трек-номер курьера
  -- Статус заказа
  status          TEXT DEFAULT 'new'
                  CHECK (status IN ('new','preparing','ready','delivery','done','cancelled')),
  -- Суммы
  subtotal        DECIMAL(12,2) NOT NULL,
  delivery_cost   DECIMAL(12,2) DEFAULT 0,
  total           DECIMAL(12,2) NOT NULL,
  -- Временные метки
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  completed_at    TIMESTAMPTZ
);

-- Автоматический номер заказа
CREATE SEQUENCE order_seq START 9001;
CREATE OR REPLACE FUNCTION set_order_number()
RETURNS TRIGGER AS $$
BEGIN
  NEW.order_number := 'BBS-' || nextval('order_seq');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_order_number
BEFORE INSERT ON orders
FOR EACH ROW
WHEN (NEW.order_number IS NULL OR NEW.order_number = '')
EXECUTE FUNCTION set_order_number();

-- ============================================================
-- 9. ПОЗИЦИИ ЗАКАЗА
-- ============================================================
CREATE TABLE order_items (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id      UUID REFERENCES orders(id) ON DELETE CASCADE,
  product_id    UUID REFERENCES products(id),
  product_name  TEXT NOT NULL,                   -- snapshot имени
  product_spec  TEXT,
  shelf_code    TEXT,                            -- для деpo панели
  quantity      INTEGER NOT NULL,
  unit_price    DECIMAL(12,2) NOT NULL,
  total_price   DECIMAL(12,2) NOT NULL,
  is_checked    BOOLEAN DEFAULT FALSE,           -- деpo: собрано ли
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 10. УВЕДОМЛЕНИЯ
-- ============================================================
CREATE TABLE notifications (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
  type        TEXT CHECK (type IN ('order','delivery','payment','promo','system')),
  title_ru    TEXT NOT NULL,
  title_kk    TEXT,
  body_ru     TEXT,
  body_kk     TEXT,
  order_id    UUID REFERENCES orders(id),
  is_read     BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 11. ПОДПИСКИ МАГАЗИНОВ (история платежей)
-- ============================================================
CREATE TABLE store_subscriptions (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  store_id    UUID REFERENCES stores(id) ON DELETE CASCADE,
  amount      INTEGER NOT NULL,
  period_from DATE NOT NULL,
  period_to   DATE NOT NULL,
  paid_via    TEXT CHECK (paid_via IN ('kaspi','halyk','cash')),
  status      TEXT DEFAULT 'paid' CHECK (status IN ('paid','pending','failed')),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 12. КОРЗИНА (временное хранилище)
-- ============================================================
CREATE TABLE cart_items (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
  product_id  UUID REFERENCES products(id) ON DELETE CASCADE,
  quantity    INTEGER DEFAULT 1,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, product_id)
);

-- ============================================================
-- 13. ИЗБРАННОЕ
-- ============================================================
CREATE TABLE favourites (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
  product_id  UUID REFERENCES products(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, product_id)
);

-- ============================================================
-- ИНДЕКСЫ (для быстрой работы)
-- ============================================================
CREATE INDEX idx_orders_customer   ON orders(customer_id);
CREATE INDEX idx_orders_store      ON orders(store_id);
CREATE INDEX idx_orders_status     ON orders(status);
CREATE INDEX idx_orders_created    ON orders(created_at DESC);
CREATE INDEX idx_order_items_order ON order_items(order_id);
CREATE INDEX idx_products_store    ON products(store_id);
CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_products_active   ON products(is_active);
CREATE INDEX idx_notif_user        ON notifications(user_id, is_read);
CREATE INDEX idx_cart_user         ON cart_items(user_id);
CREATE INDEX idx_ws_access_user    ON wholesale_access(user_id);

-- ============================================================
-- ROW LEVEL SECURITY (RLS) — безопасность на уровне строк
-- ============================================================
ALTER TABLE users              ENABLE ROW LEVEL SECURITY;
ALTER TABLE stores             ENABLE ROW LEVEL SECURITY;
ALTER TABLE products           ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders             ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items        ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications      ENABLE ROW LEVEL SECURITY;
ALTER TABLE cart_items         ENABLE ROW LEVEL SECURITY;
ALTER TABLE favourites         ENABLE ROW LEVEL SECURITY;
ALTER TABLE wholesale_access   ENABLE ROW LEVEL SECURITY;

-- Пользователь видит только свои данные
CREATE POLICY "users_own" ON users
  FOR ALL USING (auth.uid() = id);

-- Клиент видит только свои заказы
CREATE POLICY "orders_customer" ON orders
  FOR ALL USING (auth.uid() = customer_id);

-- Менеджер магазина видит заказы своего магазина
CREATE POLICY "orders_store" ON orders
  FOR SELECT USING (
    store_id IN (
      SELECT store_id FROM store_members WHERE user_id = auth.uid()
    )
  );

-- Товары видят все (публичный каталог)
CREATE POLICY "products_public" ON products
  FOR SELECT USING (is_active = TRUE);

-- Магазин управляет своими товарами
CREATE POLICY "products_store_manage" ON products
  FOR ALL USING (
    store_id IN (
      SELECT store_id FROM store_members
      WHERE user_id = auth.uid() AND role IN ('owner','manager')
    )
  );

-- Корзина — только своя
CREATE POLICY "cart_own" ON cart_items
  FOR ALL USING (auth.uid() = user_id);

-- Избранное — только своё
CREATE POLICY "favs_own" ON favourites
  FOR ALL USING (auth.uid() = user_id);

-- Уведомления — только свои
CREATE POLICY "notif_own" ON notifications
  FOR ALL USING (auth.uid() = user_id);

-- ============================================================
-- АВТООБНОВЛЕНИЕ updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated    BEFORE UPDATE ON users    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_stores_updated   BEFORE UPDATE ON stores   FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_products_updated BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_orders_updated   BEFORE UPDATE ON orders   FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- ТЕСТОВЫЕ ДАННЫЕ (можно удалить после настройки)
-- ============================================================

-- Супер Админ (Алфараби)
INSERT INTO users (phone, full_name, role) VALUES
  ('+77000000001', 'Alfarabi (Супер Админ)', 'super_admin');

-- Тестовый магазин
INSERT INTO stores (name, address, lat, lng, kaspi_merchant_id, status) VALUES
  ('Alik Hırdavat', 'мкр. Байбесик, ул. 2-я, уч.14', 43.2558, 76.9356, '554091223', 'active'),
  ('Serikcan Market', 'мкр. Байбесик, ул. Акжол, 7', 43.2620, 76.9420, 'HLK-889021', 'trial');

-- ============================================================
-- ГОТОВО! База данных baibesik.kz создана.
-- Следующий шаг: скопировать URL и ANON KEY из
-- Settings → API → и вставить в supabase_client.js
-- ============================================================

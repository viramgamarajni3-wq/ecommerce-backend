-- =============================================================
-- MULTI-VENDOR ECOMMERCE PLATFORM — PostgreSQL Schema
-- Version: 1.0.0  |  Engine: PostgreSQL 15+
-- =============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- for full-text search

-- =============================================================
-- ENUMS
-- =============================================================
CREATE TYPE user_role AS ENUM ('customer', 'vendor', 'admin');
CREATE TYPE vendor_status AS ENUM ('pending', 'approved', 'suspended', 'rejected');
CREATE TYPE product_status AS ENUM ('draft', 'active', 'archived');
CREATE TYPE order_status AS ENUM ('pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded');
CREATE TYPE payment_status AS ENUM ('pending', 'paid', 'failed', 'refunded');
CREATE TYPE payout_status AS ENUM ('pending', 'processing', 'completed', 'failed');

-- =============================================================
-- TABLE: users
-- =============================================================
CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email           VARCHAR(255) NOT NULL UNIQUE,
    password_hash   VARCHAR(512) NOT NULL,
    first_name      VARCHAR(100) NOT NULL,
    last_name       VARCHAR(100) NOT NULL,
    phone           VARCHAR(20),
    avatar_url      TEXT,
    role            user_role NOT NULL DEFAULT 'customer',
    is_verified     BOOLEAN NOT NULL DEFAULT FALSE,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    refresh_token   TEXT,
    last_login      TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_is_active ON users(is_active);

-- =============================================================
-- TABLE: addresses
-- =============================================================
CREATE TABLE addresses (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    label           VARCHAR(50) DEFAULT 'Home',
    first_name      VARCHAR(100) NOT NULL,
    last_name       VARCHAR(100) NOT NULL,
    address_line1   VARCHAR(255) NOT NULL,
    address_line2   VARCHAR(255),
    city            VARCHAR(100) NOT NULL,
    state           VARCHAR(100) NOT NULL,
    postal_code     VARCHAR(20) NOT NULL,
    country         VARCHAR(100) NOT NULL DEFAULT 'India',
    phone           VARCHAR(20),
    is_default      BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_addresses_user_id ON addresses(user_id);

-- =============================================================
-- TABLE: vendors
-- =============================================================
CREATE TABLE vendors (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id             UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    store_name          VARCHAR(255) NOT NULL UNIQUE,
    store_slug          VARCHAR(255) NOT NULL UNIQUE,
    description         TEXT,
    logo_url            TEXT,
    banner_url          TEXT,
    status              vendor_status NOT NULL DEFAULT 'pending',
    commission_rate     DECIMAL(5,2) NOT NULL DEFAULT 10.00, -- Platform takes 10%
    gst_number          VARCHAR(20),
    pan_number          VARCHAR(20),
    bank_account_number VARCHAR(50),
    bank_ifsc           VARCHAR(20),
    bank_account_name   VARCHAR(255),
    razorpay_account_id VARCHAR(255),  -- Razorpay linked account for payouts
    total_sales         DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    total_orders        INTEGER NOT NULL DEFAULT 0,
    rating              DECIMAL(3,2) NOT NULL DEFAULT 0.00,
    rating_count        INTEGER NOT NULL DEFAULT 0,
    approved_at         TIMESTAMPTZ,
    approved_by         UUID REFERENCES users(id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_vendors_user_id ON vendors(user_id);
CREATE INDEX idx_vendors_status ON vendors(status);
CREATE INDEX idx_vendors_store_slug ON vendors(store_slug);
CREATE INDEX idx_vendors_rating ON vendors(rating DESC);

-- =============================================================
-- TABLE: categories
-- =============================================================
CREATE TABLE categories (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name        VARCHAR(100) NOT NULL UNIQUE,
    slug        VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    image_url   TEXT,
    parent_id   UUID REFERENCES categories(id) ON DELETE SET NULL,
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order  INTEGER NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_categories_slug ON categories(slug);
CREATE INDEX idx_categories_parent_id ON categories(parent_id);
CREATE INDEX idx_categories_is_active ON categories(is_active);

-- =============================================================
-- TABLE: products
-- =============================================================
CREATE TABLE products (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    vendor_id           UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    category_id         UUID REFERENCES categories(id) ON DELETE SET NULL,
    name                VARCHAR(500) NOT NULL,
    slug                VARCHAR(500) NOT NULL UNIQUE,
    description         TEXT,
    short_description   TEXT,
    sku                 VARCHAR(100) UNIQUE,
    price               DECIMAL(12,2) NOT NULL,
    compare_at_price    DECIMAL(12,2),  -- original price for showing discount
    cost_price          DECIMAL(12,2),  -- vendor's purchase cost
    stock_quantity      INTEGER NOT NULL DEFAULT 0,
    low_stock_threshold INTEGER NOT NULL DEFAULT 5,
    weight_grams        INTEGER,
    status              product_status NOT NULL DEFAULT 'draft',
    is_featured         BOOLEAN NOT NULL DEFAULT FALSE,
    is_digital          BOOLEAN NOT NULL DEFAULT FALSE,
    tags                TEXT[],         -- array of tags for search
    attributes          JSONB,          -- flexible key-value product attributes
    total_sold          INTEGER NOT NULL DEFAULT 0,
    view_count          INTEGER NOT NULL DEFAULT 0,
    rating              DECIMAL(3,2) NOT NULL DEFAULT 0.00,
    rating_count        INTEGER NOT NULL DEFAULT 0,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_products_vendor_id ON products(vendor_id);
CREATE INDEX idx_products_category_id ON products(category_id);
CREATE INDEX idx_products_slug ON products(slug);
CREATE INDEX idx_products_status ON products(status);
CREATE INDEX idx_products_price ON products(price);
CREATE INDEX idx_products_rating ON products(rating DESC);
CREATE INDEX idx_products_is_featured ON products(is_featured);
CREATE INDEX idx_products_total_sold ON products(total_sold DESC);
-- Full-text search index
CREATE INDEX idx_products_name_fts ON products USING gin(to_tsvector('english', name));
CREATE INDEX idx_products_tags ON products USING gin(tags);

-- =============================================================
-- TABLE: product_images
-- =============================================================
DROP TABLE IF EXISTS product_images CASCADE;
CREATE TABLE product_images (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id  UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    url         TEXT NOT NULL,
    alt_text    VARCHAR(255),
    cloudinary_public_id VARCHAR(255),
    is_primary  BOOLEAN NOT NULL DEFAULT FALSE,
    sort_order  INTEGER NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_product_images_product_id ON product_images(product_id);
CREATE INDEX idx_product_images_is_primary ON product_images(is_primary);

-- =============================================================
-- TABLE: product_variants
-- =============================================================
CREATE TABLE product_variants (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id      UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    title           VARCHAR(255) NOT NULL,
    sku             VARCHAR(100) UNIQUE,
    price           DECIMAL(12,2),
    stock_quantity  INTEGER NOT NULL DEFAULT 0,
    attributes      JSONB,  -- e.g. {"size": "L", "color": "Red"}
    image_url       TEXT,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_product_variants_product_id ON product_variants(product_id);

-- =============================================================
-- TABLE: carts
-- =============================================================
CREATE TABLE carts (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
    session_id  VARCHAR(255),  -- for guest carts
    currency    VARCHAR(10) NOT NULL DEFAULT 'INR',
    coupon_code VARCHAR(50),
    discount_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT cart_owner CHECK (user_id IS NOT NULL OR session_id IS NOT NULL)
);

CREATE INDEX idx_carts_user_id ON carts(user_id);
CREATE INDEX idx_carts_session_id ON carts(session_id);

-- =============================================================
-- TABLE: cart_items
-- =============================================================
CREATE TABLE cart_items (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cart_id     UUID NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
    product_id  UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    variant_id  UUID REFERENCES product_variants(id) ON DELETE SET NULL,
    quantity    INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
    unit_price  DECIMAL(12,2) NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(cart_id, product_id, variant_id)
);

CREATE INDEX idx_cart_items_cart_id ON cart_items(cart_id);
CREATE INDEX idx_cart_items_product_id ON cart_items(product_id);

-- =============================================================
-- TABLE: orders
-- =============================================================
CREATE TABLE orders (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_number        VARCHAR(20) NOT NULL UNIQUE,
    user_id             UUID NOT NULL REFERENCES users(id),
    status              order_status NOT NULL DEFAULT 'pending',
    payment_status      payment_status NOT NULL DEFAULT 'pending',
    subtotal            DECIMAL(12,2) NOT NULL,
    discount_amount     DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    shipping_amount     DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    tax_amount          DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    total               DECIMAL(12,2) NOT NULL,
    currency            VARCHAR(10) NOT NULL DEFAULT 'INR',
    -- Razorpay
    razorpay_order_id   VARCHAR(255),
    razorpay_payment_id VARCHAR(255),
    razorpay_signature  VARCHAR(512),
    -- Shipping address snapshot
    shipping_address    JSONB NOT NULL,
    tracking_number     VARCHAR(100),
    shipped_at          TIMESTAMPTZ,
    delivered_at        TIMESTAMPTZ,
    notes               TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_orders_user_id ON orders(user_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_payment_status ON orders(payment_status);
CREATE INDEX idx_orders_order_number ON orders(order_number);
CREATE INDEX idx_orders_created_at ON orders(created_at DESC);

-- =============================================================
-- TABLE: order_items
-- =============================================================
CREATE TABLE order_items (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id        UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id      UUID NOT NULL REFERENCES products(id),
    vendor_id       UUID NOT NULL REFERENCES vendors(id),
    variant_id      UUID REFERENCES product_variants(id),
    product_name    VARCHAR(500) NOT NULL,
    variant_title   VARCHAR(255),
    quantity        INTEGER NOT NULL CHECK (quantity > 0),
    unit_price      DECIMAL(12,2) NOT NULL,
    total_price     DECIMAL(12,2) NOT NULL,
    vendor_amount   DECIMAL(12,2) NOT NULL,  -- after commission deduction
    commission      DECIMAL(12,2) NOT NULL,  -- platform commission
    image_url       TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_order_items_order_id ON order_items(order_id);
CREATE INDEX idx_order_items_vendor_id ON order_items(vendor_id);
CREATE INDEX idx_order_items_product_id ON order_items(product_id);

-- =============================================================
-- TABLE: vendor_payouts
-- =============================================================
CREATE TABLE vendor_payouts (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    vendor_id           UUID NOT NULL REFERENCES vendors(id),
    order_id            UUID REFERENCES orders(id),
    amount              DECIMAL(12,2) NOT NULL,
    commission          DECIMAL(12,2) NOT NULL,
    net_amount          DECIMAL(12,2) NOT NULL,  -- amount after commission
    status              payout_status NOT NULL DEFAULT 'pending',
    razorpay_payout_id  VARCHAR(255),
    failure_reason      TEXT,
    processed_at        TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_vendor_payouts_vendor_id ON vendor_payouts(vendor_id);
CREATE INDEX idx_vendor_payouts_status ON vendor_payouts(status);
CREATE INDEX idx_vendor_payouts_order_id ON vendor_payouts(order_id);

-- =============================================================
-- TABLE: reviews
-- =============================================================
CREATE TABLE reviews (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id  UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    user_id     UUID NOT NULL REFERENCES users(id),
    order_id    UUID REFERENCES orders(id),
    rating      SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
    title       VARCHAR(255),
    body        TEXT,
    is_verified BOOLEAN NOT NULL DEFAULT FALSE,  -- purchased & verified
    is_approved BOOLEAN NOT NULL DEFAULT FALSE,  -- admin approved
    helpful_count INTEGER NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(product_id, user_id, order_id)
);

CREATE INDEX idx_reviews_product_id ON reviews(product_id);
CREATE INDEX idx_reviews_user_id ON reviews(user_id);
CREATE INDEX idx_reviews_rating ON reviews(rating);
CREATE INDEX idx_reviews_is_approved ON reviews(is_approved);

-- =============================================================
-- TABLE: coupons
-- =============================================================
CREATE TABLE coupons (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code            VARCHAR(50) NOT NULL UNIQUE,
    description     TEXT,
    discount_type   VARCHAR(20) NOT NULL DEFAULT 'percentage',  -- percentage | fixed
    discount_value  DECIMAL(12,2) NOT NULL,
    min_order_value DECIMAL(12,2) DEFAULT 0,
    max_discount    DECIMAL(12,2),
    usage_limit     INTEGER,
    used_count      INTEGER NOT NULL DEFAULT 0,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    starts_at       TIMESTAMPTZ,
    expires_at      TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_coupons_code ON coupons(code);

-- =============================================================
-- TABLE: wishlists
-- =============================================================
CREATE TABLE wishlists (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    product_id  UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, product_id)
);

CREATE INDEX idx_wishlists_user_id ON wishlists(user_id);

-- =============================================================
-- TRIGGERS: auto-update updated_at timestamps
-- =============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to all tables with updated_at
DO $$
DECLARE
    t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY['users','addresses','vendors','categories','products','product_variants','carts','cart_items','orders','vendor_payouts','reviews']
    LOOP
        EXECUTE format('
            CREATE TRIGGER trg_%s_updated_at
            BEFORE UPDATE ON %s
            FOR EACH ROW EXECUTE FUNCTION update_updated_at();
        ', t, t);
    END LOOP;
END;
$$;

-- =============================================================
-- FUNCTION: Generate order number
-- =============================================================
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TEXT AS $$
DECLARE
    seq_val BIGINT;
BEGIN
    seq_val := nextval('order_number_seq');
    RETURN 'ORD-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(seq_val::TEXT, 6, '0');
END;
$$ LANGUAGE plpgsql;

CREATE SEQUENCE IF NOT EXISTS order_number_seq START WITH 1;

-- =============================================================
-- FUNCTION: Update product rating on review insert/update
-- =============================================================
CREATE OR REPLACE FUNCTION update_product_rating()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE products
    SET
        rating = (
            SELECT COALESCE(AVG(rating::DECIMAL), 0)
            FROM reviews
            WHERE product_id = COALESCE(NEW.product_id, OLD.product_id)
              AND is_approved = TRUE
        ),
        rating_count = (
            SELECT COUNT(*)
            FROM reviews
            WHERE product_id = COALESCE(NEW.product_id, OLD.product_id)
              AND is_approved = TRUE
        )
    WHERE id = COALESCE(NEW.product_id, OLD.product_id);
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_reviews_update_product_rating
AFTER INSERT OR UPDATE OR DELETE ON reviews
FOR EACH ROW EXECUTE FUNCTION update_product_rating();

-- =============================================================
-- HARDWARE MARKETPLACE MIGRATION
-- =============================================================

-- 1. Extend products table with hardware specifications and commercial fields
ALTER TABLE products
ADD COLUMN brand                 VARCHAR(255),
ADD COLUMN model                 VARCHAR(255),
ADD COLUMN warranty              VARCHAR(255),
ADD COLUMN condition             VARCHAR(50) DEFAULT 'new', -- 'new' | 'refurbished'
-- Hardware Specs
ADD COLUMN processor             VARCHAR(255),
ADD COLUMN cpu_generation        VARCHAR(255),
ADD COLUMN gpu                   VARCHAR(255),
ADD COLUMN ram                   VARCHAR(255),
ADD COLUMN storage               VARCHAR(255),
ADD COLUMN storage_type          VARCHAR(50), -- 'SSD' | 'HDD'
ADD COLUMN motherboard           VARCHAR(255),
ADD COLUMN power_supply          VARCHAR(255),
ADD COLUMN display_size          VARCHAR(255),
ADD COLUMN ports                 VARCHAR(255),
ADD COLUMN operating_system      VARCHAR(255),
-- Commercial Fields
ADD COLUMN bulk_price            DECIMAL(12,2),
ADD COLUMN minimum_bulk_quantity INTEGER DEFAULT 10,
ADD COLUMN wholesale_price       DECIMAL(12,2),
ADD COLUMN vendor_sku            VARCHAR(100),
ADD COLUMN supplier              VARCHAR(255);

-- 2. Add indexes for spec columns to improve filtering performance
CREATE INDEX idx_products_brand ON products(brand);
CREATE INDEX idx_products_condition ON products(condition);
CREATE INDEX idx_products_processor ON products(processor);
CREATE INDEX idx_products_gpu ON products(gpu);

-- 3. Create Bulk Inquiry System
CREATE TYPE inquiry_status AS ENUM ('pending', 'replied', 'closed');

CREATE TABLE bulk_inquiries (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id         UUID REFERENCES users(id) ON DELETE SET NULL,
    customer_name       VARCHAR(255) NOT NULL,
    company_name        VARCHAR(255),
    email               VARCHAR(255) NOT NULL,
    phone               VARCHAR(20),
    product_id          UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    variant_id          UUID REFERENCES product_variants(id) ON DELETE SET NULL,
    requested_quantity  INTEGER NOT NULL CHECK (requested_quantity > 0),
    message             TEXT,
    budget_range        VARCHAR(100),
    status              inquiry_status NOT NULL DEFAULT 'pending',
    vendor_id           UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_bulk_inquiries_product_id ON bulk_inquiries(product_id);
CREATE INDEX idx_bulk_inquiries_vendor_id ON bulk_inquiries(vendor_id);
CREATE INDEX idx_bulk_inquiries_status ON bulk_inquiries(status);

-- 4. Apply updated_at trigger to bulk_inquiries
CREATE TRIGGER trg_bulk_inquiries_updated_at
BEFORE UPDATE ON bulk_inquiries
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

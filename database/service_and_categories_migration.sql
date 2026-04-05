-- 1. Create Services Table
CREATE TABLE IF NOT EXISTS services (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name        VARCHAR(255) NOT NULL,
    slug        VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    image_url   TEXT,
    price       DECIMAL(12,2),
    status      VARCHAR(50) DEFAULT 'active',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Create Service Requests Table
CREATE TABLE IF NOT EXISTS service_requests (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    service_id      UUID REFERENCES services(id) ON DELETE SET NULL,
    customer_name   VARCHAR(255) NOT NULL,
    phone           VARCHAR(20) NOT NULL,
    email           VARCHAR(255) NOT NULL,
    service_type    VARCHAR(100) NOT NULL, -- "Laptop Repair", etc.
    description     TEXT,
    address         TEXT,
    status          VARCHAR(50) DEFAULT 'pending', -- 'pending', 'confirmed', 'completed', 'cancelled'
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Trigger for service_requests updated_at
CREATE TRIGGER trg_service_requests_updated_at
BEFORE UPDATE ON service_requests
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 4. Seed Hardware Categories
DO $$
DECLARE
    computers_id UUID;
    hardware_id UUID;
    peripherals_id UUID;
    security_id UUID;
BEGIN
    -- Top-level: Computers
    INSERT INTO categories (name, slug, description, sort_order)
    VALUES ('Computers', 'computers', 'Laptops and Desktop Computers', 1)
    ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
    RETURNING id INTO computers_id;

    -- Children of Computers
    INSERT INTO categories (name, slug, parent_id, sort_order)
    VALUES 
        ('Laptop', 'laptop', computers_id, 1),
        ('Desktop', 'desktop', computers_id, 2),
        ('Used Laptop', 'used-laptop', computers_id, 3),
        ('Used Computer', 'used-computer', computers_id, 4)
    ON CONFLICT (slug) DO NOTHING;

    -- Top-level: Hardware Components
    INSERT INTO categories (name, slug, description, sort_order)
    VALUES ('Hardware Components', 'hardware-components', 'Internal components for PCs', 2)
    ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
    RETURNING id INTO hardware_id;

    -- Children of Hardware Components
    INSERT INTO categories (name, slug, parent_id, sort_order)
    VALUES 
        ('CPU', 'cpu', hardware_id, 1),
        ('RAM', 'ram', hardware_id, 2),
        ('SSD', 'ssd', hardware_id, 3),
        ('HDD', 'hdd', hardware_id, 4),
        ('Motherboard', 'motherboard', hardware_id, 5)
    ON CONFLICT (slug) DO NOTHING;

    -- Top-level: Peripherals
    INSERT INTO categories (name, slug, description, sort_order)
    VALUES ('Peripherals', 'peripherals', 'External devices for computers', 3)
    ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
    RETURNING id INTO peripherals_id;

    -- Children of Peripherals
    INSERT INTO categories (name, slug, parent_id, sort_order)
    VALUES 
        ('Printer', 'printer', peripherals_id, 1),
        ('Monitor', 'monitor', peripherals_id, 2),
        ('Keyboard', 'keyboard', peripherals_id, 3),
        ('Mouse', 'mouse', peripherals_id, 4)
    ON CONFLICT (slug) DO NOTHING;

    -- Top-level: Security
    INSERT INTO categories (name, slug, description, sort_order)
    VALUES ('Security', 'security', 'Surveillance and security systems', 4)
    ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
    RETURNING id INTO security_id;

    -- Children of Security
    INSERT INTO categories (name, slug, parent_id, sort_order)
    VALUES 
        ('CCTV Camera', 'cctv-camera', security_id, 1),
        ('DVR', 'dvr', security_id, 2),
        ('Security Accessories', 'security-accessories', security_id, 3)
    ON CONFLICT (slug) DO NOTHING;
END $$;

-- 5. Seed Services
INSERT INTO services (name, slug, description, price)
VALUES 
    ('Laptop Repair', 'laptop-repair', 'Expert repair for all laptop brands', 499),
    ('Desktop Repair', 'desktop-repair', 'Desktop PC troubleshooting and repair', 399),
    ('Printer Repair', 'printer-repair', 'Printer service and maintenance', 350),
    ('CCTV Installation', 'cctv-installation', 'Professional security camera setup', 999),
    ('Computer AMC', 'computer-amc', 'Annual Maintenance Contract for businesses', 4999),
    ('Wilcom Embroidery Design Training', 'wilcom-training', 'Professional training for embroidery designing', 15000)
ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description;

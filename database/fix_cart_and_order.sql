-- Add email and shipping_address to carts
ALTER TABLE carts ADD COLUMN IF NOT EXISTS email VARCHAR(255);
ALTER TABLE carts ADD COLUMN IF NOT EXISTS shipping_address JSONB DEFAULT '{}';

-- Make user_id nullable in orders for guest checkout support
ALTER TABLE orders ALTER COLUMN user_id DROP NOT NULL;

-- Ensure billing_address is also at least an empty object if needed, but for now focus on shipping
-- Usually Medusa also has billing_address
ALTER TABLE orders ADD COLUMN IF NOT EXISTS billing_address JSONB DEFAULT '{}';
ALTER TABLE carts ADD COLUMN IF NOT EXISTS billing_address JSONB DEFAULT '{}';

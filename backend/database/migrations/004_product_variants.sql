CREATE TABLE product_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products (id),
  sku TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO product_variants (product_id, sku, name, price_cents)
SELECT id, sku, name, price_cents FROM products;

ALTER TABLE products DROP COLUMN sku;
ALTER TABLE products DROP COLUMN price_cents;
ALTER TABLE products ADD COLUMN description TEXT NOT NULL DEFAULT '';

CREATE TABLE warehouses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE inventory (
  warehouse_id UUID NOT NULL REFERENCES warehouses (id),
  variant_id UUID NOT NULL REFERENCES product_variants (id),
  on_hand INTEGER NOT NULL CHECK (on_hand >= 0),
  reserved INTEGER NOT NULL DEFAULT 0 CHECK (reserved >= 0),
  PRIMARY KEY (warehouse_id, variant_id),
  CHECK (reserved <= on_hand)
);

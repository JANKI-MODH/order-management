CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers (id),
  status TEXT NOT NULL CHECK (status IN ('placed', 'paid', 'shipped', 'delivered', 'cancelled', 'returned')),
  idempotency_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT orders_idempotency_key_key UNIQUE (idempotency_key)
);

CREATE TABLE order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders (id),
  variant_id UUID NOT NULL REFERENCES product_variants (id),
  warehouse_id UUID NOT NULL REFERENCES warehouses (id),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price_cents INTEGER NOT NULL CHECK (unit_price_cents >= 0)
);

CREATE INDEX order_items_order_id_idx ON order_items (order_id);

CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders (id),
  amount_cents INTEGER NOT NULL CHECK (amount_cents >= 0),
  status TEXT NOT NULL CHECK (status IN ('succeeded', 'failed')),
  provider TEXT NOT NULL,
  provider_event_id TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE shipments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL UNIQUE REFERENCES orders (id),
  carrier TEXT NOT NULL,
  tracking_number TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('shipped', 'delivered')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE refunds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID NOT NULL REFERENCES payments (id),
  order_id UUID NOT NULL UNIQUE REFERENCES orders (id),
  amount_cents INTEGER NOT NULL CHECK (amount_cents >= 0),
  status TEXT NOT NULL CHECK (status IN ('succeeded')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

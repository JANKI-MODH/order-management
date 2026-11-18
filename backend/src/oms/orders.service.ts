import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import type { PoolClient } from "pg";
import { DatabaseService } from "../database/database.service";
import { postgresConstraint } from "../database/pg-error";
import type { OrderItemDto } from "./oms.dto";
import { RecordsService } from "./records.service";

type OrderItem = {
  variantId: string;
  warehouseId: string;
  quantity: number;
  unitPriceCents: number;
};

export type OrderView = {
  id: string;
  customerId: string;
  customerName: string;
  status: string;
  idempotencyKey: string | null;
  items: OrderItem[];
  totalCents: number;
};

@Injectable()
export class OrdersService {
  constructor(
    private readonly database: DatabaseService,
    private readonly records: RecordsService,
  ) {}

  async list(): Promise<OrderView[]> {
    const result = await this.database.pool.query<{ id: string }>("SELECT id FROM orders ORDER BY created_at DESC");
    const orders: OrderView[] = [];
    for (const row of result.rows) {
      orders.push(await this.getById(row.id));
    }
    return orders;
  }

  async getById(id: string): Promise<OrderView> {
    const client = await this.database.pool.connect();
    try {
      return await this.load(client, id);
    } finally {
      client.release();
    }
  }

  async place(actorUserId: string, customerId: string, items: OrderItemDto[], idempotencyKey?: string): Promise<OrderView> {
    const key = normalizeKey(idempotencyKey);
    try {
      return await this.database.withTransaction((client) => this.placeInTransaction(client, actorUserId, customerId, items, key));
    } catch (error) {
      if (key && postgresConstraint(error) === "orders_idempotency_key_key") {
        return this.findByIdempotencyKey(key);
      }
      throw error;
    }
  }

  async cancel(actorUserId: string, orderId: string): Promise<OrderView> {
    return this.database.withTransaction(async (client) => {
      const order = await this.lockOrder(client, orderId);
      if (order.status !== "placed") {
        throw new ConflictException("Only a placed order can be cancelled");
      }
      const items = await this.lockItems(client, orderId);
      for (const item of items) {
        await client.query(
          `UPDATE inventory
           SET reserved = reserved - $3
           WHERE warehouse_id = $1 AND variant_id = $2`,
          [item.warehouseId, item.variantId, item.quantity],
        );
      }
      await client.query("UPDATE orders SET status = 'cancelled' WHERE id = $1", [orderId]);
      await this.records.audit(client, actorUserId, "order.cancelled", "order", orderId);
      const customer = await client.query<{ email: string }>("SELECT email FROM customers WHERE id = $1", [order.customer_id]);
      await this.records.notify(client, customer.rows[0].email, "Order cancelled", `Order ${orderId} was cancelled and the reserved stock was released.`);
      return this.load(client, orderId);
    });
  }

  private async placeInTransaction(
    client: PoolClient,
    actorUserId: string,
    customerId: string,
    items: OrderItemDto[],
    idempotencyKey: string | null,
  ): Promise<OrderView> {
    if (idempotencyKey) {
      const existing = await client.query<{ id: string }>("SELECT id FROM orders WHERE idempotency_key = $1", [idempotencyKey]);
      if (existing.rows[0]) {
        return this.load(client, existing.rows[0].id);
      }
    }

    const customer = await client.query<{ id: string; email: string }>("SELECT id, email FROM customers WHERE id = $1", [customerId]);
    if (!customer.rows[0]) {
      throw new NotFoundException("Customer not found");
    }

    const sorted = [...items].sort((left, right) => {
      const warehouse = left.warehouseId.localeCompare(right.warehouseId);
      return warehouse === 0 ? left.variantId.localeCompare(right.variantId) : warehouse;
    });

    const priced: OrderItem[] = [];
    for (const item of sorted) {
      const stock = await client.query<{ on_hand: number; reserved: number }>(
        `SELECT on_hand, reserved
         FROM inventory
         WHERE warehouse_id = $1 AND variant_id = $2
         FOR UPDATE`,
        [item.warehouseId, item.variantId],
      );
      if (!stock.rows[0]) {
        throw new ConflictException("Stock has not been received for this variant at that warehouse");
      }
      const available = stock.rows[0].on_hand - stock.rows[0].reserved;
      if (available < item.quantity) {
        throw new ConflictException("Not enough stock");
      }
      await client.query(
        `UPDATE inventory
         SET reserved = reserved + $3
         WHERE warehouse_id = $1 AND variant_id = $2`,
        [item.warehouseId, item.variantId, item.quantity],
      );
      const variant = await client.query<{ price_cents: number }>("SELECT price_cents FROM product_variants WHERE id = $1", [item.variantId]);
      if (!variant.rows[0]) {
        throw new NotFoundException("Variant not found");
      }
      priced.push({
        variantId: item.variantId,
        warehouseId: item.warehouseId,
        quantity: item.quantity,
        unitPriceCents: variant.rows[0].price_cents,
      });
    }

    const inserted = await client.query<{ id: string }>(
      "INSERT INTO orders (customer_id, status, idempotency_key) VALUES ($1, 'placed', $2) RETURNING id",
      [customerId, idempotencyKey],
    );
    const orderId = inserted.rows[0].id;
    for (const item of priced) {
      await client.query(
        `INSERT INTO order_items (order_id, variant_id, warehouse_id, quantity, unit_price_cents)
         VALUES ($1, $2, $3, $4, $5)`,
        [orderId, item.variantId, item.warehouseId, item.quantity, item.unitPriceCents],
      );
    }
    await this.records.audit(client, actorUserId, "order.placed", "order", orderId);
    await this.records.notify(client, customer.rows[0].email, "Order placed", `Order ${orderId} was placed.`);
    return this.load(client, orderId);
  }

  private async findByIdempotencyKey(key: string): Promise<OrderView> {
    const result = await this.database.pool.query<{ id: string }>("SELECT id FROM orders WHERE idempotency_key = $1", [key]);
    if (!result.rows[0]) {
      throw new ConflictException("The order request conflicted and could not be recovered");
    }
    return this.getById(result.rows[0].id);
  }

  private async lockOrder(client: PoolClient, orderId: string) {
    const result = await client.query<{ id: string; status: string; customer_id: string }>(
      "SELECT id, status, customer_id FROM orders WHERE id = $1 FOR UPDATE",
      [orderId],
    );
    if (!result.rows[0]) {
      throw new NotFoundException("Order not found");
    }
    return result.rows[0];
  }

  private async lockItems(client: PoolClient, orderId: string): Promise<OrderItem[]> {
    const result = await client.query<{ variant_id: string; warehouse_id: string; quantity: number; unit_price_cents: number }>(
      `SELECT variant_id, warehouse_id, quantity, unit_price_cents
       FROM order_items
       WHERE order_id = $1
       ORDER BY warehouse_id, variant_id
       FOR UPDATE`,
      [orderId],
    );
    for (const item of result.rows) {
      await client.query(
        "SELECT 1 FROM inventory WHERE warehouse_id = $1 AND variant_id = $2 FOR UPDATE",
        [item.warehouse_id, item.variant_id],
      );
    }
    return result.rows.map((item) => ({
      variantId: item.variant_id,
      warehouseId: item.warehouse_id,
      quantity: item.quantity,
      unitPriceCents: item.unit_price_cents,
    }));
  }

  private async load(client: PoolClient, orderId: string): Promise<OrderView> {
    const order = await client.query<{
      id: string;
      customer_id: string;
      customer_name: string;
      status: string;
      idempotency_key: string | null;
    }>(
      `SELECT o.id, o.customer_id, c.name AS customer_name, o.status, o.idempotency_key
       FROM orders o
       JOIN customers c ON c.id = o.customer_id
       WHERE o.id = $1`,
      [orderId],
    );
    if (!order.rows[0]) {
      throw new NotFoundException("Order not found");
    }
    const items = await client.query<{ variant_id: string; warehouse_id: string; quantity: number; unit_price_cents: number }>(
      `SELECT variant_id, warehouse_id, quantity, unit_price_cents
       FROM order_items
       WHERE order_id = $1
       ORDER BY warehouse_id, variant_id`,
      [orderId],
    );
    const mapped = items.rows.map((item) => ({
      variantId: item.variant_id,
      warehouseId: item.warehouse_id,
      quantity: item.quantity,
      unitPriceCents: item.unit_price_cents,
    }));
    return {
      id: order.rows[0].id,
      customerId: order.rows[0].customer_id,
      customerName: order.rows[0].customer_name,
      status: order.rows[0].status,
      idempotencyKey: order.rows[0].idempotency_key,
      items: mapped,
      totalCents: mapped.reduce((sum, item) => sum + item.quantity * item.unitPriceCents, 0),
    };
  }
}

function normalizeKey(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { DatabaseService } from "../database/database.service";
import { postgresConstraint } from "../database/pg-error";
import { RecordsService } from "./records.service";

export type PaymentView = {
  id: string;
  orderId: string;
  amountCents: number;
  status: string;
  provider: string;
  providerEventId: string;
};

@Injectable()
export class PaymentsService {
  constructor(
    private readonly database: DatabaseService,
    private readonly records: RecordsService,
  ) {}

  async chargeTest(actorUserId: string, orderId: string, idempotencyKey?: string): Promise<PaymentView> {
    const eventId = idempotencyKey?.trim() ? `test:${idempotencyKey.trim()}` : randomUUID();
    return this.apply(actorUserId, orderId, eventId, "succeeded", "test");
  }

  async webhook(actorUserId: string | null, orderId: string, eventId: string, status: "succeeded" | "failed"): Promise<PaymentView> {
    return this.apply(actorUserId, orderId, eventId, status, "webhook");
  }

  private async apply(
    actorUserId: string | null,
    orderId: string,
    eventId: string,
    status: "succeeded" | "failed",
    provider: string,
  ): Promise<PaymentView> {
    try {
      return await this.database.withTransaction((client) => this.applyInTransaction(client, actorUserId, orderId, eventId, status, provider));
    } catch (error) {
      if (postgresConstraint(error) === "payments_provider_event_id_key") {
        return this.findByEventId(eventId);
      }
      throw error;
    }
  }

  private async applyInTransaction(
    client: PoolClient,
    actorUserId: string | null,
    orderId: string,
    eventId: string,
    status: "succeeded" | "failed",
    provider: string,
  ): Promise<PaymentView> {
    const existing = await client.query<PaymentRow>("SELECT * FROM payments WHERE provider_event_id = $1", [eventId]);
    if (existing.rows[0]) {
      return toPayment(existing.rows[0]);
    }

    const order = await client.query<{ id: string; status: string }>("SELECT id, status FROM orders WHERE id = $1 FOR UPDATE", [orderId]);
    if (!order.rows[0]) {
      throw new NotFoundException("Order not found");
    }

    const total = await client.query<{ total: string }>(
      "SELECT COALESCE(SUM(quantity * unit_price_cents), 0)::text AS total FROM order_items WHERE order_id = $1",
      [orderId],
    );
    const amountCents = Number(total.rows[0].total);

    if (status === "failed") {
      const inserted = await client.query<PaymentRow>(
        `INSERT INTO payments (order_id, amount_cents, status, provider, provider_event_id)
         VALUES ($1, $2, 'failed', $3, $4)
         RETURNING *`,
        [orderId, amountCents, provider, eventId],
      );
      await this.records.audit(client, actorUserId, "payment.failed", "payment", inserted.rows[0].id);
      return toPayment(inserted.rows[0]);
    }

    if (order.rows[0].status !== "placed") {
      throw new ConflictException("Only a placed order can be paid");
    }

    const items = await client.query<{ variant_id: string; warehouse_id: string; quantity: number }>(
      `SELECT variant_id, warehouse_id, quantity
       FROM order_items
       WHERE order_id = $1
       ORDER BY warehouse_id, variant_id`,
      [orderId],
    );
    for (const item of items.rows) {
      await client.query("SELECT 1 FROM inventory WHERE warehouse_id = $1 AND variant_id = $2 FOR UPDATE", [
        item.warehouse_id,
        item.variant_id,
      ]);
      await client.query(
        `UPDATE inventory
         SET on_hand = on_hand - $3, reserved = reserved - $3
         WHERE warehouse_id = $1 AND variant_id = $2`,
        [item.warehouse_id, item.variant_id, item.quantity],
      );
    }
    await client.query("UPDATE orders SET status = 'paid' WHERE id = $1", [orderId]);
    const inserted = await client.query<PaymentRow>(
      `INSERT INTO payments (order_id, amount_cents, status, provider, provider_event_id)
       VALUES ($1, $2, 'succeeded', $3, $4)
       RETURNING *`,
      [orderId, amountCents, provider, eventId],
    );
    await this.records.audit(client, actorUserId, "payment.succeeded", "payment", inserted.rows[0].id);
    return toPayment(inserted.rows[0]);
  }

  private async findByEventId(eventId: string): Promise<PaymentView> {
    const result = await this.database.pool.query<PaymentRow>("SELECT * FROM payments WHERE provider_event_id = $1", [eventId]);
    if (!result.rows[0]) {
      throw new ConflictException("The payment event conflicted and could not be recovered");
    }
    return toPayment(result.rows[0]);
  }
}

type PaymentRow = {
  id: string;
  order_id: string;
  amount_cents: number;
  status: string;
  provider: string;
  provider_event_id: string;
};

function toPayment(row: PaymentRow): PaymentView {
  return {
    id: row.id,
    orderId: row.order_id,
    amountCents: row.amount_cents,
    status: row.status,
    provider: row.provider,
    providerEventId: row.provider_event_id,
  };
}

import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { DatabaseService } from "../database/database.service";
import { postgresConstraint } from "../database/pg-error";
import { RecordsService } from "./records.service";

@Injectable()
export class FulfillmentService {
  constructor(
    private readonly database: DatabaseService,
    private readonly records: RecordsService,
  ) {}

  async ship(actorUserId: string, orderId: string, carrier: string, trackingNumber: string) {
    return this.database.withTransaction(async (client) => {
      const order = await client.query<{ status: string; customer_id: string }>("SELECT status, customer_id FROM orders WHERE id = $1 FOR UPDATE", [
        orderId,
      ]);
      if (!order.rows[0]) {
        throw new NotFoundException("Order not found");
      }
      if (order.rows[0].status !== "paid") {
        throw new ConflictException("Only a paid order can be shipped");
      }
      const shipment = await client.query<{ id: string; carrier: string; tracking_number: string; status: string }>(
        `INSERT INTO shipments (order_id, carrier, tracking_number, status)
         VALUES ($1, $2, $3, 'shipped')
         RETURNING id, carrier, tracking_number, status`,
        [orderId, carrier.trim(), trackingNumber.trim()],
      );
      await client.query("UPDATE orders SET status = 'shipped' WHERE id = $1", [orderId]);
      await this.records.audit(client, actorUserId, "order.shipped", "shipment", shipment.rows[0].id);
      const customer = await client.query<{ email: string }>("SELECT email FROM customers WHERE id = $1", [order.rows[0].customer_id]);
      await this.records.notify(
        client,
        customer.rows[0].email,
        "Order shipped",
        `Order ${orderId} shipped with ${shipment.rows[0].tracking_number}.`,
      );
      return {
        id: shipment.rows[0].id,
        orderId,
        carrier: shipment.rows[0].carrier,
        trackingNumber: shipment.rows[0].tracking_number,
        status: shipment.rows[0].status,
      };
    });
  }

  async deliver(actorUserId: string, shipmentId: string) {
    return this.database.withTransaction(async (client) => {
      const shipment = await client.query<{ id: string; order_id: string; status: string; carrier: string; tracking_number: string }>(
        "SELECT id, order_id, status, carrier, tracking_number FROM shipments WHERE id = $1 FOR UPDATE",
        [shipmentId],
      );
      if (!shipment.rows[0]) {
        throw new NotFoundException("Shipment not found");
      }
      const order = await client.query<{ status: string }>("SELECT status FROM orders WHERE id = $1 FOR UPDATE", [shipment.rows[0].order_id]);
      if (order.rows[0].status !== "shipped" || shipment.rows[0].status !== "shipped") {
        throw new ConflictException("Only a shipped order can be delivered");
      }
      await client.query("UPDATE shipments SET status = 'delivered' WHERE id = $1", [shipmentId]);
      await client.query("UPDATE orders SET status = 'delivered' WHERE id = $1", [shipment.rows[0].order_id]);
      await this.records.audit(client, actorUserId, "order.delivered", "shipment", shipmentId);
      return {
        id: shipment.rows[0].id,
        orderId: shipment.rows[0].order_id,
        carrier: shipment.rows[0].carrier,
        trackingNumber: shipment.rows[0].tracking_number,
        status: "delivered",
      };
    });
  }

  async refund(actorUserId: string, orderId: string) {
    try {
      return await this.refundInTransaction(actorUserId, orderId);
    } catch (error) {
      if (postgresConstraint(error) === "refunds_order_id_key") {
        throw new ConflictException("This order has already been refunded");
      }
      throw error;
    }
  }

  private refundInTransaction(actorUserId: string, orderId: string) {
    return this.database.withTransaction(async (client) => {
      const order = await client.query<{ status: string; customer_id: string }>("SELECT status, customer_id FROM orders WHERE id = $1 FOR UPDATE", [
        orderId,
      ]);
      if (!order.rows[0]) {
        throw new NotFoundException("Order not found");
      }
      if (order.rows[0].status !== "shipped" && order.rows[0].status !== "delivered") {
        throw new ConflictException("Only a shipped or delivered order can be refunded");
      }
      const payment = await client.query<{ id: string; amount_cents: number }>(
        "SELECT id, amount_cents FROM payments WHERE order_id = $1 AND status = 'succeeded' ORDER BY created_at DESC LIMIT 1",
        [orderId],
      );
      if (!payment.rows[0]) {
        throw new ConflictException("This order has no successful payment to refund");
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
          `UPDATE inventory SET on_hand = on_hand + $3 WHERE warehouse_id = $1 AND variant_id = $2`,
          [item.warehouse_id, item.variant_id, item.quantity],
        );
      }
      const refund = await client.query<{ id: string; amount_cents: number; status: string }>(
        `INSERT INTO refunds (payment_id, order_id, amount_cents, status)
         VALUES ($1, $2, $3, 'succeeded')
         RETURNING id, amount_cents, status`,
        [payment.rows[0].id, orderId, payment.rows[0].amount_cents],
      );
      await client.query("UPDATE orders SET status = 'returned' WHERE id = $1", [orderId]);
      await this.records.audit(client, actorUserId, "order.refunded", "refund", refund.rows[0].id);
      const customer = await client.query<{ email: string }>("SELECT email FROM customers WHERE id = $1", [order.rows[0].customer_id]);
      await this.records.notify(client, customer.rows[0].email, "Refund completed", `Order ${orderId} was refunded.`);
      return {
        id: refund.rows[0].id,
        orderId,
        paymentId: payment.rows[0].id,
        amountCents: refund.rows[0].amount_cents,
        status: refund.rows[0].status,
      };
    });
  }
}

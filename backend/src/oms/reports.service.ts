import { Injectable } from "@nestjs/common";
import { DatabaseService } from "../database/database.service";

@Injectable()
export class ReportsService {
  constructor(private readonly database: DatabaseService) {}

  async summary() {
    const orders = await this.database.pool.query<{ status: string; count: string }>(
      "SELECT status, COUNT(*)::text AS count FROM orders GROUP BY status ORDER BY status",
    );
    const payments = await this.database.pool.query<{ total: string }>(
      "SELECT COALESCE(SUM(amount_cents), 0)::text AS total FROM payments WHERE status = 'succeeded'",
    );
    const refunds = await this.database.pool.query<{ total: string }>(
      "SELECT COALESCE(SUM(amount_cents), 0)::text AS total FROM refunds",
    );
    const lowStock = await this.database.pool.query<{ count: string }>(
      "SELECT COUNT(*)::text AS count FROM inventory WHERE on_hand - reserved <= 5",
    );
    return {
      ordersByStatus: orders.rows.map((row) => ({ status: row.status, count: Number(row.count) })),
      capturedCents: Number(payments.rows[0].total),
      refundedCents: Number(refunds.rows[0].total),
      netCents: Number(payments.rows[0].total) - Number(refunds.rows[0].total),
      lowStockCount: Number(lowStock.rows[0].count),
    };
  }
}

import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { DatabaseService } from "../database/database.service";
import { isForeignKeyViolation, isUniqueViolation } from "../database/pg-error";
import { RecordsService } from "./records.service";

@Injectable()
export class InventoryService {
  constructor(
    private readonly database: DatabaseService,
    private readonly records: RecordsService,
  ) {}

  async listWarehouses() {
    const result = await this.database.pool.query<{ id: string; code: string; name: string }>(
      "SELECT id, code, name FROM warehouses ORDER BY code",
    );
    return result.rows;
  }

  async createWarehouse(actorUserId: string, code: string, name: string) {
    return this.database.withTransaction(async (client) => {
      try {
        const result = await client.query<{ id: string; code: string; name: string }>(
          "INSERT INTO warehouses (code, name) VALUES ($1, $2) RETURNING id, code, name",
          [code.trim().toUpperCase(), name.trim()],
        );
        await this.records.audit(client, actorUserId, "warehouse.created", "warehouse", result.rows[0].id);
        return result.rows[0];
      } catch (error) {
        if (isUniqueViolation(error)) {
          throw new ConflictException("A warehouse with this code already exists");
        }
        throw error;
      }
    });
  }

  async renameWarehouse(actorUserId: string, id: string, name: string) {
    return this.database.withTransaction(async (client) => {
      const result = await client.query<{ id: string; code: string; name: string }>(
        "UPDATE warehouses SET name = $2 WHERE id = $1 RETURNING id, code, name",
        [id, name.trim()],
      );
      if (!result.rows[0]) {
        throw new NotFoundException("Warehouse not found");
      }
      await this.records.audit(client, actorUserId, "warehouse.updated", "warehouse", id);
      return result.rows[0];
    });
  }

  async removeWarehouse(actorUserId: string, id: string): Promise<void> {
    await this.database.withTransaction(async (client) => {
      try {
        const result = await client.query("DELETE FROM warehouses WHERE id = $1 RETURNING id", [id]);
        if (!result.rows[0]) {
          throw new NotFoundException("Warehouse not found");
        }
        await this.records.audit(client, actorUserId, "warehouse.deleted", "warehouse", id);
      } catch (error) {
        if (isForeignKeyViolation(error)) {
          throw new ConflictException("This warehouse still has stock or orders and cannot be deleted");
        }
        throw error;
      }
    });
  }

  async receive(actorUserId: string, warehouseId: string, variantId: string, quantity: number) {
    return this.database.withTransaction(async (client) => {
      try {
        const result = await client.query<{ warehouse_id: string; variant_id: string; on_hand: number; reserved: number }>(
          `INSERT INTO inventory (warehouse_id, variant_id, on_hand)
           VALUES ($1, $2, $3)
           ON CONFLICT (warehouse_id, variant_id)
           DO UPDATE SET on_hand = inventory.on_hand + EXCLUDED.on_hand
           RETURNING warehouse_id, variant_id, on_hand, reserved`,
          [warehouseId, variantId, quantity],
        );
        const row = result.rows[0];
        await this.records.audit(client, actorUserId, "inventory.received", "variant", variantId);
        return {
          warehouseId: row.warehouse_id,
          variantId: row.variant_id,
          onHand: row.on_hand,
          reserved: row.reserved,
          available: row.on_hand - row.reserved,
        };
      } catch (error) {
        if (isForeignKeyViolation(error)) {
          throw new ConflictException("Warehouse or variant does not exist");
        }
        throw error;
      }
    });
  }

  async list() {
    const result = await this.database.pool.query<{
      warehouse_id: string;
      warehouse_code: string;
      variant_id: string;
      sku: string;
      on_hand: number;
      reserved: number;
    }>(
      `SELECT i.warehouse_id, w.code AS warehouse_code, i.variant_id, v.sku, i.on_hand, i.reserved
       FROM inventory i
       JOIN warehouses w ON w.id = i.warehouse_id
       JOIN product_variants v ON v.id = i.variant_id
       ORDER BY w.code, v.sku`,
    );
    return result.rows.map((row) => ({
      warehouseId: row.warehouse_id,
      warehouseCode: row.warehouse_code,
      variantId: row.variant_id,
      sku: row.sku,
      onHand: row.on_hand,
      reserved: row.reserved,
      available: row.on_hand - row.reserved,
    }));
  }
}

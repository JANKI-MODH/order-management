import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { DatabaseService } from "../database/database.service";
import { isForeignKeyViolation, isUniqueViolation } from "../database/pg-error";
import { RecordsService } from "./records.service";

@Injectable()
export class CustomersService {
  constructor(
    private readonly database: DatabaseService,
    private readonly records: RecordsService,
  ) {}

  async list() {
    const result = await this.database.pool.query<{ id: string; name: string; email: string; phone: string | null }>(
      "SELECT id, name, email, phone FROM customers ORDER BY name",
    );
    return result.rows;
  }

  // FIX #1: look up the customer record that matches a user's email
  async findByEmail(email: string) {
    const result = await this.database.pool.query<{ id: string; name: string; email: string; phone: string | null }>(
      "SELECT id, name, email, phone FROM customers WHERE email = $1",
      [email],
    );
    return result.rows[0] ?? null;
  }

  async create(actorUserId: string, input: { name: string; email: string; phone?: string }) {
    return this.database.withTransaction(async (client) => {
      try {
        const result = await client.query<{ id: string; name: string; email: string; phone: string | null }>(
          "INSERT INTO customers (name, email, phone) VALUES ($1, $2, $3) RETURNING id, name, email, phone",
          [input.name.trim(), input.email.trim().toLowerCase(), input.phone?.trim() ?? null],
        );
        await this.records.audit(client, actorUserId, "customer.created", "customer", result.rows[0].id);
        return result.rows[0];
      } catch (error) {
        if (isUniqueViolation(error)) {
          throw new ConflictException("A customer with this email already exists");
        }
        throw error;
      }
    });
  }

  async update(actorUserId: string, id: string, input: { name?: string; email?: string; phone?: string }) {
    const existing = await this.findById(id);
    const name = input.name?.trim() || existing.name;
    const email = input.email?.trim().toLowerCase() || existing.email;
    const phone = input.phone !== undefined ? input.phone.trim() || null : existing.phone;
    return this.database.withTransaction(async (client) => {
      try {
        const result = await client.query<{ id: string; name: string; email: string; phone: string | null }>(
          "UPDATE customers SET name = $2, email = $3, phone = $4 WHERE id = $1 RETURNING id, name, email, phone",
          [id, name, email, phone],
        );
        await this.records.audit(client, actorUserId, "customer.updated", "customer", id);
        return result.rows[0];
      } catch (error) {
        if (isUniqueViolation(error)) {
          throw new ConflictException("A customer with this email already exists");
        }
        throw error;
      }
    });
  }

  async remove(actorUserId: string, id: string): Promise<void> {
    await this.findById(id);
    await this.database.withTransaction(async (client) => {
      try {
        await client.query("DELETE FROM customers WHERE id = $1", [id]);
        await this.records.audit(client, actorUserId, "customer.deleted", "customer", id);
      } catch (error) {
        if (isForeignKeyViolation(error)) {
          throw new ConflictException("This customer has orders and cannot be deleted");
        }
        throw error;
      }
    });
  }

  private async findById(id: string) {
    const result = await this.database.pool.query<{ id: string; name: string; email: string; phone: string | null }>(
      "SELECT id, name, email, phone FROM customers WHERE id = $1",
      [id],
    );
    if (!result.rows[0]) {
      throw new NotFoundException("Customer not found");
    }
    return result.rows[0];
  }
}

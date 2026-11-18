import { ConflictException, Injectable } from "@nestjs/common";
import { DatabaseService } from "../database/database.service";
import { isUniqueViolation } from "../database/pg-error";
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
}

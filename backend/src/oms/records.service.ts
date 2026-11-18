import { Injectable } from "@nestjs/common";
import type { PoolClient } from "pg";
import { DatabaseService } from "../database/database.service";

@Injectable()
export class RecordsService {
  constructor(private readonly database: DatabaseService) {}

  async audit(client: PoolClient, actorUserId: string, action: string, entityType: string, entityId: string): Promise<void> {
    await client.query(
      `INSERT INTO audit_logs (actor_user_id, action, entity_type, entity_id)
       VALUES ($1, $2, $3, $4)`,
      [actorUserId, action, entityType, entityId],
    );
  }

  async notify(client: PoolClient, recipient: string, subject: string, body: string): Promise<void> {
    await client.query(
      `INSERT INTO notifications (recipient, subject, body, status)
       VALUES ($1, $2, $3, 'sent')`,
      [recipient, subject, body],
    );
  }

  async listAudit() {
    const result = await this.database.pool.query<{
      id: string;
      actor_user_id: string | null;
      action: string;
      entity_type: string;
      entity_id: string;
      created_at: Date;
    }>(
      `SELECT id, actor_user_id, action, entity_type, entity_id, created_at
       FROM audit_logs
       ORDER BY created_at DESC
       LIMIT 100`,
    );
    return result.rows.map((row) => ({
      id: row.id,
      actorUserId: row.actor_user_id,
      action: row.action,
      entityType: row.entity_type,
      entityId: row.entity_id,
      createdAt: row.created_at,
    }));
  }

  async listNotifications() {
    const result = await this.database.pool.query<{
      id: string;
      recipient: string;
      subject: string;
      body: string;
      status: string;
      created_at: Date;
    }>(
      `SELECT id, recipient, subject, body, status, created_at
       FROM notifications
       ORDER BY created_at DESC
       LIMIT 100`,
    );
    return result.rows.map((row) => ({
      id: row.id,
      recipient: row.recipient,
      subject: row.subject,
      body: row.body,
      status: row.status,
      createdAt: row.created_at,
    }));
  }
}

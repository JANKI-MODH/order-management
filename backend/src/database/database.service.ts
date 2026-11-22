import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { Pool, type PoolClient } from "pg";

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  readonly pool: Pool;

  constructor() {
    const user = process.env.POSTGRES_USER;
    const password = process.env.POSTGRES_PASSWORD;
    const database = process.env.POSTGRES_DB;
    if (!user || !password || !database) {
      throw new Error("POSTGRES_USER, POSTGRES_PASSWORD, and POSTGRES_DB must be set");
    }

    this.pool = new Pool({
      host: process.env.POSTGRES_HOST ?? "localhost",
      port: Number(process.env.POSTGRES_PORT ?? 5432),
      user,
      password,
      database,
      // FIX #10: force UTF-8 client encoding regardless of the server's WIN1252 default
      // so non-English characters are stored and retrieved correctly.
      options: "-c client_encoding=UTF8",
    });
  }

  async onModuleInit(): Promise<void> {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    const directory = resolve(process.cwd(), "database/migrations");
    const files = (await readdir(directory)).filter((file) => file.endsWith(".sql")).sort();

    for (const file of files) {
      const applied = await this.pool.query("SELECT 1 FROM schema_migrations WHERE id = $1", [file]);
      if ((applied.rowCount ?? 0) > 0) {
        continue;
      }

      const sql = await readFile(resolve(directory, file), "utf8");
      const client = await this.pool.connect();
      try {
        await client.query("BEGIN");
        await client.query(sql);
        await client.query("INSERT INTO schema_migrations (id) VALUES ($1)", [file]);
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    }
  }

  async withTransaction<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const result = await work(client);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }
}

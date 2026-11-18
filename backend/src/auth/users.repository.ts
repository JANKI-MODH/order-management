import { Injectable, NotFoundException } from "@nestjs/common";
import { DatabaseService } from "../database/database.service";
import type { UserRole } from "./user-role";

export type PublicUser = {
  id: string;
  email: string;
  role: UserRole;
};

type LoginUser = PublicUser & {
  passwordHash: string;
};

type UserRow = {
  id: string;
  email: string;
  role: UserRole;
  password_hash?: string;
};

@Injectable()
export class UsersRepository {
  constructor(private readonly database: DatabaseService) {}

  async insert(email: string, passwordHash: string): Promise<PublicUser> {
    const result = await this.database.pool.query<UserRow>(
      "INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email, role",
      [email, passwordHash],
    );
    return toPublicUser(result.rows[0]);
  }

  async findForLogin(email: string): Promise<LoginUser | null> {
    const result = await this.database.pool.query<UserRow>(
      "SELECT id, email, role, password_hash FROM users WHERE email = $1",
      [email],
    );
    const row = result.rows[0];
    if (!row?.password_hash) {
      return null;
    }
    return { ...toPublicUser(row), passwordHash: row.password_hash };
  }

  async findById(id: string): Promise<PublicUser | null> {
    const result = await this.database.pool.query<UserRow>(
      "SELECT id, email, role FROM users WHERE id = $1",
      [id],
    );
    const row = result.rows[0];
    return row ? toPublicUser(row) : null;
  }

  async list(): Promise<PublicUser[]> {
    const result = await this.database.pool.query<UserRow>(
      "SELECT id, email, role FROM users ORDER BY email",
    );
    return result.rows.map(toPublicUser);
  }

  async updateRole(id: string, role: UserRole): Promise<PublicUser> {
    const result = await this.database.pool.query<UserRow>(
      "UPDATE users SET role = $2 WHERE id = $1 RETURNING id, email, role",
      [id, role],
    );
    const row = result.rows[0];
    if (!row) {
      throw new NotFoundException("User not found");
    }
    return toPublicUser(row);
  }

  async promoteToAdmin(email: string): Promise<void> {
    await this.database.pool.query("UPDATE users SET role = 'admin' WHERE email = $1", [email]);
  }
}

function toPublicUser(row: UserRow): PublicUser {
  return { id: row.id, email: row.email, role: row.role };
}

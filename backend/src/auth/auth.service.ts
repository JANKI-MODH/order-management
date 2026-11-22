import { ConflictException, Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import bcrypt from "bcryptjs";
import { DatabaseService } from "../database/database.service";
import { PublicUser, UsersRepository } from "./users.repository";

type AuthResponse = {
  accessToken: string;
  user: PublicUser;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersRepository,
    private readonly jwt: JwtService,
    private readonly database: DatabaseService,
  ) {}

  async register(email: string, password: string): Promise<AuthResponse> {
    const normalizedEmail = email.trim().toLowerCase();
    const passwordHash = await bcrypt.hash(password, 12);

    try {
      const user = await this.users.insert(normalizedEmail, passwordHash);
      await this.ensureCustomer(normalizedEmail);
      return { accessToken: await this.sign(user), user };
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException("An account with this email already exists");
      }
      throw error;
    }
  }

  async login(email: string, password: string): Promise<AuthResponse> {
    const user = await this.users.findForLogin(email.trim().toLowerCase());
    if (!user) {
      await bcrypt.hash(password, 12);
      throw new UnauthorizedException("Invalid email or password");
    }

    const matches = await bcrypt.compare(password, user.passwordHash);
    if (!matches) {
      throw new UnauthorizedException("Invalid email or password");
    }

    const publicUser = { id: user.id, email: user.email, role: user.role };
    if (publicUser.role === "customer") {
      await this.ensureCustomer(publicUser.email);
    }
    return {
      accessToken: await this.sign(publicUser),
      user: publicUser,
    };
  }

  private async ensureCustomer(email: string): Promise<void> {
    await this.database.pool.query(
      "INSERT INTO customers (name, email) VALUES ($1, $2) ON CONFLICT (email) DO NOTHING",
      [email, email],
    );
  }

  private sign(user: PublicUser): Promise<string> {
    return this.jwt.signAsync({ sub: user.id, email: user.email });
  }
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "23505";
}

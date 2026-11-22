import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { JwtService } from "@nestjs/jwt";
import type { Request } from "express";
import { IS_PUBLIC_KEY } from "./public.decorator";
import type { UserRole } from "./user-role";
import { UsersRepository } from "./users.repository";

export type AuthenticatedRequest = Request & {
  user: { id: string; email: string; role: UserRole };
};

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly users: UsersRepository,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // FIX #8: routes decorated with @Public() skip auth entirely
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const header = request.header("authorization") ?? "";
    const [scheme, token] = header.split(" ");
    if (scheme !== "Bearer" || !token) {
      throw new UnauthorizedException("Missing bearer token");
    }

    try {
      const payload = await this.jwt.verifyAsync<{ sub: string }>(token);
      const user = await this.users.findById(payload.sub);
      if (!user) {
        throw new UnauthorizedException("Invalid bearer token");
      }
      request.user = user;
      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException("Invalid bearer token");
    }
  }
}

import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { DatabaseModule } from "../database/database.module";
import { AdminBootstrap } from "./admin.bootstrap";
import { AuthController } from "./auth.controller";
import { AuthGuard } from "./auth.guard";
import { AuthService } from "./auth.service";
import { RolesGuard } from "./roles.guard";
import { UsersRepository } from "./users.repository";

@Module({
  imports: [
    DatabaseModule,
    JwtModule.registerAsync({
      useFactory: () => ({
        secret: process.env.JWT_SECRET,
        // FIX #11: extend session to 8 hours for usability
        signOptions: { expiresIn: "8h" },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, AuthGuard, RolesGuard, UsersRepository, AdminBootstrap],
  exports: [AuthGuard, RolesGuard, UsersRepository, JwtModule],
})
export class AuthModule {}

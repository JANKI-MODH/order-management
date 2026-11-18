import { Module } from "@nestjs/common";
import { AuthModule } from "./auth/auth.module";
import { CatalogModule } from "./catalog/catalog.module";
import { HealthModule } from "./health/health.module";
import { OmsModule } from "./oms/oms.module";
import { UsersModule } from "./users/users.module";

@Module({
  imports: [HealthModule, AuthModule, UsersModule, CatalogModule, OmsModule],
})
export class AppModule {}

import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { DatabaseModule } from "../database/database.module";
import { CommerceController } from "./commerce.controller";
import { CustomersService } from "./customers.service";
import { FulfillmentService } from "./fulfillment.service";
import { InventoryService } from "./inventory.service";
import { OrdersService } from "./orders.service";
import { OrganizationService } from "./organization.service";
import { PaymentsService } from "./payments.service";
import { RecordsService } from "./records.service";
import { ReportsService } from "./reports.service";

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [CommerceController],
  providers: [
    RecordsService,
    InventoryService,
    CustomersService,
    OrdersService,
    PaymentsService,
    FulfillmentService,
    OrganizationService,
    ReportsService,
  ],
})
export class OmsModule {}

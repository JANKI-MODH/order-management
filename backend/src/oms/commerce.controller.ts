import { Body, Controller, Get, Headers, Param, ParseUUIDPipe, Post, Req, UseGuards } from "@nestjs/common";
import type { AuthenticatedRequest } from "../auth/auth.guard";
import { AuthGuard } from "../auth/auth.guard";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import { CustomersService } from "./customers.service";
import { FulfillmentService } from "./fulfillment.service";
import { InventoryService } from "./inventory.service";
import {
  AddTeamMemberDto,
  CreateCustomerDto,
  CreateOrganizationDto,
  CreateShipmentDto,
  CreateTeamDto,
  CreateWarehouseDto,
  PaymentWebhookDto,
  PlaceOrderDto,
  ReceiveStockDto,
  RefundDto,
  TestPaymentDto,
} from "./oms.dto";
import { OrdersService } from "./orders.service";
import { OrganizationService } from "./organization.service";
import { PaymentsService } from "./payments.service";
import { RecordsService } from "./records.service";
import { ReportsService } from "./reports.service";

@Controller()
@UseGuards(AuthGuard, RolesGuard)
export class CommerceController {
  constructor(
    private readonly inventory: InventoryService,
    private readonly customers: CustomersService,
    private readonly orders: OrdersService,
    private readonly payments: PaymentsService,
    private readonly fulfillment: FulfillmentService,
    private readonly organizations: OrganizationService,
    private readonly reports: ReportsService,
    private readonly records: RecordsService,
  ) {}

  @Get("warehouses")
  @Roles("admin", "staff")
  listWarehouses() {
    return this.inventory.listWarehouses();
  }

  @Post("warehouses")
  @Roles("admin", "staff")
  createWarehouse(@Req() request: AuthenticatedRequest, @Body() body: CreateWarehouseDto) {
    return this.inventory.createWarehouse(request.user.id, body.code, body.name);
  }

  @Get("inventory")
  @Roles("admin", "staff")
  listInventory() {
    return this.inventory.list();
  }

  @Post("inventory/receive")
  @Roles("admin", "staff")
  receive(@Req() request: AuthenticatedRequest, @Body() body: ReceiveStockDto) {
    return this.inventory.receive(request.user.id, body.warehouseId, body.variantId, body.quantity);
  }

  @Get("customers")
  @Roles("admin", "staff")
  listCustomers() {
    return this.customers.list();
  }

  @Post("customers")
  @Roles("admin", "staff")
  createCustomer(@Req() request: AuthenticatedRequest, @Body() body: CreateCustomerDto) {
    return this.customers.create(request.user.id, body);
  }

  @Get("orders")
  @Roles("admin", "staff")
  listOrders() {
    return this.orders.list();
  }

  @Get("orders/:id")
  @Roles("admin", "staff")
  getOrder(@Param("id", ParseUUIDPipe) id: string) {
    return this.orders.getById(id);
  }

  @Post("orders")
  @Roles("admin", "staff")
  placeOrder(@Req() request: AuthenticatedRequest, @Body() body: PlaceOrderDto, @Headers("idempotency-key") idempotencyKey?: string) {
    return this.orders.place(request.user.id, body.customerId, body.items, idempotencyKey);
  }

  @Post("orders/:id/cancel")
  @Roles("admin", "staff")
  cancelOrder(@Req() request: AuthenticatedRequest, @Param("id", ParseUUIDPipe) id: string) {
    return this.orders.cancel(request.user.id, id);
  }

  @Post("payments/test")
  @Roles("admin", "staff")
  testPayment(@Req() request: AuthenticatedRequest, @Body() body: TestPaymentDto, @Headers("idempotency-key") idempotencyKey?: string) {
    return this.payments.chargeTest(request.user.id, body.orderId, idempotencyKey);
  }

  @Post("payments/webhook")
  @Roles("admin", "staff")
  webhook(@Req() request: AuthenticatedRequest, @Body() body: PaymentWebhookDto) {
    return this.payments.webhook(request.user.id, body.orderId, body.eventId, body.status);
  }

  @Post("shipments")
  @Roles("admin", "staff")
  ship(@Req() request: AuthenticatedRequest, @Body() body: CreateShipmentDto) {
    return this.fulfillment.ship(request.user.id, body.orderId, body.carrier, body.trackingNumber);
  }

  @Post("shipments/:id/deliver")
  @Roles("admin", "staff")
  deliver(@Req() request: AuthenticatedRequest, @Param("id", ParseUUIDPipe) id: string) {
    return this.fulfillment.deliver(request.user.id, id);
  }

  @Post("refunds")
  @Roles("admin", "staff")
  refund(@Req() request: AuthenticatedRequest, @Body() body: RefundDto) {
    return this.fulfillment.refund(request.user.id, body.orderId);
  }

  @Get("organizations")
  @Roles("admin")
  listOrganizations() {
    return this.organizations.list();
  }

  @Post("organizations")
  @Roles("admin")
  createOrganization(@Req() request: AuthenticatedRequest, @Body() body: CreateOrganizationDto) {
    return this.organizations.createOrganization(request.user.id, body.name);
  }

  @Post("organizations/:id/teams")
  @Roles("admin")
  createTeam(@Req() request: AuthenticatedRequest, @Param("id", ParseUUIDPipe) id: string, @Body() body: CreateTeamDto) {
    return this.organizations.createTeam(request.user.id, id, body.name);
  }

  @Post("teams/:id/members")
  @Roles("admin")
  addMember(@Req() request: AuthenticatedRequest, @Param("id", ParseUUIDPipe) id: string, @Body() body: AddTeamMemberDto) {
    return this.organizations.addMember(request.user.id, id, body.userId);
  }

  @Get("reports/summary")
  @Roles("admin")
  summary() {
    return this.reports.summary();
  }

  @Get("audit")
  @Roles("admin")
  audit() {
    return this.records.listAudit();
  }

  @Get("notifications")
  @Roles("admin")
  notifications() {
    return this.records.listNotifications();
  }
}

import { Body, Controller, Delete, Get, Headers, HttpCode, NotFoundException, Param, ParseUUIDPipe, Patch, Post, Query, Req, UnauthorizedException, UseGuards } from "@nestjs/common";
import type { AuthenticatedRequest } from "../auth/auth.guard";
import { AuthGuard } from "../auth/auth.guard";
import { Public } from "../auth/public.decorator";
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
  PlaceMyOrderDto,
  PlaceOrderDto,
  ReceiveStockDto,
  RefundDto,
  TestPaymentDto,
  UpdateCustomerDto,
  UpdateWarehouseDto,
} from "./oms.dto";
import { OrdersService } from "./orders.service";
import { OrganizationService } from "./organization.service";
import { PaymentsService } from "./payments.service";
import { RecordsService } from "./records.service";
import { ReportsService } from "./reports.service";
import { webhookSecretMatches } from "./webhook-secret";

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
  @Roles("admin", "staff", "customer")
  listWarehouses() {
    return this.inventory.listWarehouses();
  }

  @Post("warehouses")
  @Roles("admin", "staff")
  createWarehouse(@Req() request: AuthenticatedRequest, @Body() body: CreateWarehouseDto) {
    return this.inventory.createWarehouse(request.user.id, body.code, body.name);
  }

  @Patch("warehouses/:id")
  @Roles("admin", "staff")
  renameWarehouse(@Req() request: AuthenticatedRequest, @Param("id", ParseUUIDPipe) id: string, @Body() body: UpdateWarehouseDto) {
    return this.inventory.renameWarehouse(request.user.id, id, body.name);
  }

  @Delete("warehouses/:id")
  @HttpCode(204)
  @Roles("admin", "staff")
  removeWarehouse(@Req() request: AuthenticatedRequest, @Param("id", ParseUUIDPipe) id: string) {
    return this.inventory.removeWarehouse(request.user.id, id);
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

  // FIX #1: customer can look up their own customer profile by email
  @Get("customers/me")
  @Roles("customer", "admin", "staff")
  async getMyCustomer(@Req() request: AuthenticatedRequest) {
    const customer = await this.customers.findByEmail(request.user.email);
    if (!customer) {
      throw new NotFoundException("No customer record is linked to your account. Contact an admin or staff member.");
    }
    return customer;
  }

  @Post("customers")
  @Roles("admin", "staff")
  createCustomer(@Req() request: AuthenticatedRequest, @Body() body: CreateCustomerDto) {
    return this.customers.create(request.user.id, body);
  }

  @Patch("customers/:id")
  @Roles("admin", "staff")
  updateCustomer(@Req() request: AuthenticatedRequest, @Param("id", ParseUUIDPipe) id: string, @Body() body: UpdateCustomerDto) {
    return this.customers.update(request.user.id, id, body);
  }

  @Delete("customers/:id")
  @HttpCode(204)
  @Roles("admin", "staff")
  removeCustomer(@Req() request: AuthenticatedRequest, @Param("id", ParseUUIDPipe) id: string) {
    return this.customers.remove(request.user.id, id);
  }

  @Get("orders")
  @Roles("admin", "staff")
  listOrders(@Query("q") q?: string) {
    return this.orders.list({ q });
  }

  @Get("orders/mine")
  @Roles("customer")
  myOrders(@Req() request: AuthenticatedRequest) {
    return this.orders.list({ email: request.user.email });
  }

  @Get("orders/:id")
  @Roles("admin", "staff", "customer")
  getOrder(@Req() request: AuthenticatedRequest, @Param("id", ParseUUIDPipe) id: string) {
    return this.orders.getVisible(id, request.user);
  }

  @Post("orders")
  @Roles("admin", "staff")
  placeOrder(@Req() request: AuthenticatedRequest, @Body() body: PlaceOrderDto, @Headers("idempotency-key") idempotencyKey?: string) {
    return this.orders.place(request.user.id, body.customerId, body.items, idempotencyKey);
  }

  // FIX #1: customer-facing order placement — customerId resolved from their email
  @Post("orders/my")
  @Roles("customer")
  async placeMyOrder(@Req() request: AuthenticatedRequest, @Body() body: PlaceMyOrderDto, @Headers("idempotency-key") idempotencyKey?: string) {
    const customer = await this.customers.findByEmail(request.user.email);
    if (!customer) {
      throw new NotFoundException("No customer record is linked to your account. Contact an admin or staff member.");
    }
    return this.orders.place(request.user.id, customer.id, body.items, idempotencyKey);
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

  // FIX #8: webhook no longer requires a signed-in staff/admin user.
  // Authentication is done via a shared secret in X-Webhook-Secret header.
  // The @Roles() guard is removed and AuthGuard is bypassed for this route.
  @Post("payments/webhook")
  @Public()
  webhook(@Headers("x-webhook-secret") secret: string, @Body() body: PaymentWebhookDto) {
    if (!webhookSecretMatches(secret ?? "", process.env.WEBHOOK_SECRET ?? "")) {
      throw new UnauthorizedException("Invalid webhook secret");
    }
    return this.payments.webhook(null, body.orderId, body.eventId, body.status);
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


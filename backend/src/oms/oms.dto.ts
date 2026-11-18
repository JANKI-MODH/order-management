import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from "class-validator";

export class CreateWarehouseDto {
  @IsString()
  @MinLength(1)
  @MaxLength(20)
  code!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name!: string;
}

export class ReceiveStockDto {
  @IsUUID()
  warehouseId!: string;

  @IsUUID()
  variantId!: string;

  @IsInt()
  @Min(1)
  quantity!: number;
}

export class CreateCustomerDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @IsEmail()
  email!: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;
}

export class OrderItemDto {
  @IsUUID()
  variantId!: string;

  @IsUUID()
  warehouseId!: string;

  @IsInt()
  @Min(1)
  quantity!: number;
}

export class PlaceOrderDto {
  @IsUUID()
  customerId!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items!: OrderItemDto[];
}

export class TestPaymentDto {
  @IsUUID()
  orderId!: string;
}

export class PaymentWebhookDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  eventId!: string;

  @IsUUID()
  orderId!: string;

  @IsIn(["succeeded", "failed"])
  status!: "succeeded" | "failed";
}

export class CreateShipmentDto {
  @IsUUID()
  orderId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(40)
  carrier!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(60)
  trackingNumber!: string;
}

export class RefundDto {
  @IsUUID()
  orderId!: string;
}

export class CreateOrganizationDto {
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name!: string;
}

export class CreateTeamDto {
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name!: string;
}

export class AddTeamMemberDto {
  @IsUUID()
  userId!: string;
}

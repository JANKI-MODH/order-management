import { IsInt, IsString, MaxLength, Min, MinLength } from "class-validator";

export class CreateVariantDto {
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(40)
  sku!: string;

  @IsInt()
  @Min(0)
  priceCents!: number;
}

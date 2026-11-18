import { IsOptional, IsString, IsUUID, MaxLength, MinLength } from "class-validator";

export class CreateProductDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsUUID()
  categoryId!: string;
}

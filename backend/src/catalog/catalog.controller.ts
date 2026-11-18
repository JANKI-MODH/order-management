import { Body, Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from "@nestjs/common";
import { AuthGuard } from "../auth/auth.guard";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import { CatalogService } from "./catalog.service";
import { CreateCategoryDto } from "./create-category.dto";
import { CreateProductDto } from "./create-product.dto";
import { CreateVariantDto } from "./create-variant.dto";

@Controller()
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get("categories")
  listCategories() {
    return this.catalog.listCategories();
  }

  @Post("categories")
  @UseGuards(AuthGuard, RolesGuard)
  @Roles("admin")
  createCategory(@Body() body: CreateCategoryDto) {
    return this.catalog.createCategory(body.name);
  }

  @Get("products")
  listProducts() {
    return this.catalog.listProducts();
  }

  @Post("products")
  @UseGuards(AuthGuard, RolesGuard)
  @Roles("admin")
  createProduct(@Body() body: CreateProductDto) {
    return this.catalog.createProduct(body);
  }

  @Post("products/:productId/variants")
  @UseGuards(AuthGuard, RolesGuard)
  @Roles("admin")
  createVariant(@Param("productId", ParseUUIDPipe) productId: string, @Body() body: CreateVariantDto) {
    return this.catalog.createVariant(productId, body);
  }
}

import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { AuthGuard } from "../auth/auth.guard";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import { CatalogService } from "./catalog.service";
import { CreateCategoryDto } from "./create-category.dto";
import { CreateProductDto } from "./create-product.dto";
import { CreateVariantDto } from "./create-variant.dto";
import { UpdateProductDto } from "./update-product.dto";
import { UpdateVariantDto } from "./update-variant.dto";

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
  listProducts(@Query("q") q?: string) {
    return this.catalog.listProducts(q);
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

  @Patch("products/:productId")
  @UseGuards(AuthGuard, RolesGuard)
  @Roles("admin")
  updateProduct(@Param("productId", ParseUUIDPipe) productId: string, @Body() body: UpdateProductDto) {
    return this.catalog.updateProduct(productId, body);
  }

  @Delete("products/:productId")
  @HttpCode(204)
  @UseGuards(AuthGuard, RolesGuard)
  @Roles("admin")
  removeProduct(@Param("productId", ParseUUIDPipe) productId: string) {
    return this.catalog.removeProduct(productId);
  }

  @Patch("variants/:variantId")
  @UseGuards(AuthGuard, RolesGuard)
  @Roles("admin")
  updateVariant(@Param("variantId", ParseUUIDPipe) variantId: string, @Body() body: UpdateVariantDto) {
    return this.catalog.updateVariant(variantId, body);
  }

  @Delete("variants/:variantId")
  @HttpCode(204)
  @UseGuards(AuthGuard, RolesGuard)
  @Roles("admin")
  removeVariant(@Param("variantId", ParseUUIDPipe) variantId: string) {
    return this.catalog.removeVariant(variantId);
  }
}

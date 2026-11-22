import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { DatabaseService } from "../database/database.service";
import { isForeignKeyViolation, isUniqueViolation } from "../database/pg-error";

export type Category = { id: string; name: string };

export type Variant = {
  id: string;
  sku: string;
  name: string;
  priceCents: number;
};

export type Product = {
  id: string;
  name: string;
  description: string;
  categoryId: string;
  categoryName: string;
  variants: Variant[];
};

@Injectable()
export class CatalogService {
  constructor(private readonly database: DatabaseService) {}

  async listCategories(): Promise<Category[]> {
    const result = await this.database.pool.query<Category>("SELECT id, name FROM categories ORDER BY name");
    return result.rows;
  }

  async createCategory(name: string): Promise<Category> {
    try {
      const result = await this.database.pool.query<Category>(
        "INSERT INTO categories (name) VALUES ($1) RETURNING id, name",
        [name.trim()],
      );
      return result.rows[0];
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException("A category with this name already exists");
      }
      throw error;
    }
  }

  async listProducts(q?: string): Promise<Product[]> {
    const term = q?.trim();
    const params = term ? [likeTerm(term)] : [];
    const products = await this.database.pool.query<{
      id: string;
      name: string;
      description: string;
      category_id: string;
      category_name: string;
    }>(
      `SELECT p.id, p.name, p.description, p.category_id, c.name AS category_name
       FROM products p
       JOIN categories c ON c.id = p.category_id
       ${
         term
           ? `WHERE p.name ILIKE $1 ESCAPE '\\'
              OR p.description ILIKE $1 ESCAPE '\\'
              OR c.name ILIKE $1 ESCAPE '\\'
              OR EXISTS (
                SELECT 1 FROM product_variants v
                WHERE v.product_id = p.id AND (v.sku ILIKE $1 ESCAPE '\\' OR v.name ILIKE $1 ESCAPE '\\')
              )`
           : ""
       }
       ORDER BY p.name`,
      params,
    );
    const variants = await this.database.pool.query<{
      id: string;
      product_id: string;
      sku: string;
      name: string;
      price_cents: number;
    }>("SELECT id, product_id, sku, name, price_cents FROM product_variants ORDER BY sku");

    return products.rows.map((product) => ({
      id: product.id,
      name: product.name,
      description: product.description,
      categoryId: product.category_id,
      categoryName: product.category_name,
      variants: variants.rows
        .filter((variant) => variant.product_id === product.id)
        .map((variant) => ({
          id: variant.id,
          sku: variant.sku,
          name: variant.name,
          priceCents: variant.price_cents,
        })),
    }));
  }

  async createProduct(input: { name: string; description?: string; categoryId: string }): Promise<Product> {
    try {
      const result = await this.database.pool.query<{ id: string }>(
        "INSERT INTO products (name, description, category_id) VALUES ($1, $2, $3) RETURNING id",
        [input.name.trim(), input.description?.trim() ?? "", input.categoryId],
      );
      const products = await this.listProducts();
      const created = products.find((product) => product.id === result.rows[0].id);
      if (!created) {
        throw new NotFoundException("Product was not created");
      }
      return created;
    } catch (error) {
      if (isForeignKeyViolation(error)) {
        throw new NotFoundException("Category not found");
      }
      throw error;
    }
  }

  async createVariant(productId: string, input: { name: string; sku: string; priceCents: number }): Promise<Variant> {
    const product = await this.database.pool.query("SELECT id FROM products WHERE id = $1", [productId]);
    if (!product.rows[0]) {
      throw new NotFoundException("Product not found");
    }
    try {
      const result = await this.database.pool.query<{ id: string; sku: string; name: string; price_cents: number }>(
        `INSERT INTO product_variants (product_id, name, sku, price_cents)
         VALUES ($1, $2, $3, $4)
         RETURNING id, sku, name, price_cents`,
        [productId, input.name.trim(), input.sku.trim().toUpperCase(), input.priceCents],
      );
      const row = result.rows[0];
      return { id: row.id, sku: row.sku, name: row.name, priceCents: row.price_cents };
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException("A variant with this SKU already exists");
      }
      throw error;
    }
  }

  async updateProduct(id: string, input: { name?: string; description?: string }): Promise<Product> {
    const current = await this.database.pool.query<{ name: string; description: string }>(
      "SELECT name, description FROM products WHERE id = $1",
      [id],
    );
    if (!current.rows[0]) {
      throw new NotFoundException("Product not found");
    }
    await this.database.pool.query("UPDATE products SET name = $2, description = $3 WHERE id = $1", [
      id,
      input.name?.trim() || current.rows[0].name,
      input.description !== undefined ? input.description.trim() : current.rows[0].description,
    ]);
    const products = await this.listProducts();
    const updated = products.find((product) => product.id === id);
    if (!updated) {
      throw new NotFoundException("Product not found");
    }
    return updated;
  }

  async removeProduct(id: string): Promise<void> {
    try {
      const result = await this.database.pool.query("DELETE FROM products WHERE id = $1 RETURNING id", [id]);
      if (!result.rows[0]) {
        throw new NotFoundException("Product not found");
      }
    } catch (error) {
      if (isForeignKeyViolation(error)) {
        throw new ConflictException("This product still has variants and cannot be deleted");
      }
      throw error;
    }
  }

  async updateVariant(variantId: string, input: { name?: string; priceCents?: number }): Promise<Variant> {
    const current = await this.database.pool.query<{ name: string; price_cents: number }>(
      "SELECT name, price_cents FROM product_variants WHERE id = $1",
      [variantId],
    );
    if (!current.rows[0]) {
      throw new NotFoundException("Variant not found");
    }
    const result = await this.database.pool.query<{ id: string; sku: string; name: string; price_cents: number }>(
      "UPDATE product_variants SET name = $2, price_cents = $3 WHERE id = $1 RETURNING id, sku, name, price_cents",
      [variantId, input.name?.trim() || current.rows[0].name, input.priceCents ?? current.rows[0].price_cents],
    );
    const row = result.rows[0];
    return { id: row.id, sku: row.sku, name: row.name, priceCents: row.price_cents };
  }

  async removeVariant(variantId: string): Promise<void> {
    try {
      const result = await this.database.pool.query("DELETE FROM product_variants WHERE id = $1 RETURNING id", [variantId]);
      if (!result.rows[0]) {
        throw new NotFoundException("Variant not found");
      }
    } catch (error) {
      if (isForeignKeyViolation(error)) {
        throw new ConflictException("This variant is on an order or in stock and cannot be deleted");
      }
      throw error;
    }
  }
}

function likeTerm(value: string): string {
  return `%${value.trim().replace(/[\\%_]/g, "\\$&")}%`;
}

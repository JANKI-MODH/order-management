import { Alert, Box, Button, MenuItem, Paper, Stack, TextField, Typography } from "@mui/material";
import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { api, money } from "../api";
import { useSession } from "../session";
import { PageHeading } from "../ui";

type Product = {
  id: string;
  name: string;
  description: string;
  categoryName: string;
  variants: { id: string; sku: string; name: string; priceCents: number }[];
};

type Warehouse = { id: string; code: string; name: string };
type CustomerProfile = { id: string; name: string; email: string };

// FIX #1: inline order form state for a single variant
type QuickOrder = {
  variantId: string;
  warehouseId: string;
  quantity: string;
};

export function CatalogPage() {
  const session = useSession();
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [customerProfile, setCustomerProfile] = useState<CustomerProfile | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  // FIX #1: track which variant's order form is open
  const [openVariantId, setOpenVariantId] = useState<string | null>(null);
  const [quickOrder, setQuickOrder] = useState<QuickOrder>({ variantId: "", warehouseId: "", quantity: "1" });
  const [submitting, setSubmitting] = useState(false);
  const [query, setQuery] = useState("");
  // FIX #3: stable idempotency key per form open — regenerated after each successful order
  const idempotencyKeyRef = useRef(crypto.randomUUID());

  useEffect(() => {
    const controller = new AbortController();
    const path = query.trim() ? `/products?q=${encodeURIComponent(query.trim())}` : "/products";
    api<Product[]>(path, { signal: controller.signal })
      .then(setProducts)
      .catch((caught: unknown) => {
        if (caught instanceof DOMException && caught.name === "AbortError") {
          return;
        }
        setError(caught instanceof Error ? caught.message : "The catalogue could not be loaded");
      });
    return () => controller.abort();
  }, [query]);

  // FIX #1: load warehouses and the customer's own profile when signed in as customer
  useEffect(() => {
    if (session.user?.role !== "customer") {
      return;
    }
    void api<Warehouse[]>("/warehouses").then(setWarehouses).catch(() => setWarehouses([]));
    void api<CustomerProfile>("/customers/me")
      .then(setCustomerProfile)
      .catch(() => setCustomerProfile(null));
  }, [session.user]);

  function openOrderForm(variantId: string) {
    setOpenVariantId(variantId);
    setQuickOrder({ variantId, warehouseId: "", quantity: "1" });
    setNotice("");
    setError("");
  }

  async function submitOrder(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (!customerProfile) return;
    setSubmitting(true);
    setError("");
    const idempotencyKey = idempotencyKeyRef.current;
    try {
      await api("/orders/my", {
        method: "POST",
        headers: { "Idempotency-Key": idempotencyKey },
        body: JSON.stringify({
          items: [{ variantId: quickOrder.variantId, warehouseId: quickOrder.warehouseId, quantity: Number(quickOrder.quantity) }],
        }),
      });
      // FIX #3: regenerate key only after a successful order
      idempotencyKeyRef.current = crypto.randomUUID();
      setOpenVariantId(null);
      setNotice("Order placed successfully!");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not place order");
    } finally {
      setSubmitting(false);
    }
  }

  const isCustomer = session.user?.role === "customer";

  return (
    <Stack>
      <PageHeading title="Catalogue" detail="Products and the variants customers can order." />
      <TextField label="Search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name, SKU, or category" sx={{ mb: 2, maxWidth: 360 }} />
      {error ? <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert> : null}
      {notice ? <Alert severity="success" sx={{ mb: 2 }}>{notice}</Alert> : null}
      {/* FIX #1: show a helpful message if the customer has no linked customer record yet */}
      {isCustomer && !customerProfile && session.ready ? (
        <Alert severity="info" sx={{ mb: 2 }}>
          Your account is not yet linked to a customer record. Ask a staff member to create a customer entry with your email address so you can place orders.
        </Alert>
      ) : null}
      {products.length === 0 && !error ? <Typography color="text.secondary">No products yet.</Typography> : null}
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2 }}>
        {products.map((product) => (
          <Paper key={product.id} sx={{ p: 2.5, display: "flex", flexDirection: "column", gap: 1.5 }}>
            <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "flex-start", gap: 2 }}>
              <Typography variant="h6">{product.name}</Typography>
              <Typography
                sx={{
                  px: 1.25,
                  py: 0.4,
                  borderRadius: 999,
                  bgcolor: "#F3E6D8",
                  color: "#8A4B22",
                  fontSize: 12,
                  fontWeight: 700,
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                }}
              >
                {product.categoryName}
              </Typography>
            </Stack>
            {product.description ? <Typography color="text.secondary">{product.description}</Typography> : null}
            <Stack spacing={1} sx={{ mt: "auto" }}>
              {product.variants.length === 0 ? <Typography color="text.secondary">No variants yet.</Typography> : null}
              {product.variants.map((variant) => (
                <Box key={variant.id}>
                  <Box
                    sx={{ display: "flex", justifyContent: "space-between", gap: 2, py: 1, borderTop: "1px solid", borderColor: "divider", alignItems: "center" }}
                  >
                    <Box>
                      <Typography sx={{ fontWeight: 600 }}>{variant.name}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        {variant.sku}
                      </Typography>
                    </Box>
                    <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                      <Typography sx={{ fontWeight: 700, color: "secondary.main" }}>{money(variant.priceCents)}</Typography>
                      {/* FIX #1: Order button visible to signed-in customers with a linked profile */}
                      {isCustomer && customerProfile ? (
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => openOrderForm(variant.id)}
                          sx={{ whiteSpace: "nowrap" }}
                        >
                          Order
                        </Button>
                      ) : null}
                    </Stack>
                  </Box>

                  {/* FIX #1: inline quick-order form */}
                  {openVariantId === variant.id ? (
                    <Box
                      component="form"
                      onSubmit={(e: FormEvent) => void submitOrder(e)}
                      sx={{ mt: 1, p: 1.5, bgcolor: "action.hover", borderRadius: 1 }}
                    >
                      <Stack spacing={1.5}>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          Order · {variant.name}
                        </Typography>
                        {warehouses.length === 0 ? (
                          <Typography variant="body2" color="text.secondary">No warehouses available yet.</Typography>
                        ) : (
                          <TextField
                            select
                            label="Warehouse"
                            size="small"
                            value={quickOrder.warehouseId}
                            onChange={(e) => setQuickOrder((prev) => ({ ...prev, warehouseId: e.target.value }))}
                            required
                          >
                            {warehouses.map((wh) => (
                              <MenuItem key={wh.id} value={wh.id}>{wh.code} — {wh.name}</MenuItem>
                            ))}
                          </TextField>
                        )}
                        <TextField
                          label="Quantity"
                          type="number"
                          size="small"
                          value={quickOrder.quantity}
                          onChange={(e) => setQuickOrder((prev) => ({ ...prev, quantity: e.target.value }))}
                          slotProps={{ htmlInput: { min: 1 } }}
                          required
                        />
                        <Stack direction="row" spacing={1}>
                          <Button type="submit" size="small" variant="contained" disabled={submitting}>
                            {submitting ? "Placing…" : "Place order"}
                          </Button>
                          <Button size="small" onClick={() => setOpenVariantId(null)}>Cancel</Button>
                        </Stack>
                      </Stack>
                    </Box>
                  ) : null}
                </Box>
              ))}
            </Stack>
          </Paper>
        ))}
      </Box>
    </Stack>
  );
}

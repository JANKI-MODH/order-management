import { Alert, Box, Button, IconButton, MenuItem, Stack, TextField, Typography } from "@mui/material";
import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router";
import { api, money } from "../api";
import { useSession } from "../session";
import { PageHeading, Panel, StatusChip } from "../ui";

type Warehouse = { id: string; code: string; name: string };
type VariantChoice = { id: string; label: string };
type Customer = { id: string; name: string; email: string };
type Stock = { variantId: string; sku: string; warehouseCode: string; onHand: number; reserved: number; available: number };
type Order = {
  id: string;
  customerName: string;
  status: string;
  totalCents: number;
  shipment: { id: string; trackingNumber: string; status: string } | null;
};

// FIX #2: each order line has its own variant + warehouse + quantity
type OrderLine = { variantId: string; warehouseId: string; quantity: string };

function newLine(): OrderLine {
  return { variantId: "", warehouseId: "", quantity: "1" };
}

export function OperationsPage() {
  const session = useSession();
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [variants, setVariants] = useState<VariantChoice[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [stock, setStock] = useState<Stock[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [warehouseCode, setWarehouseCode] = useState("");
  const [warehouseName, setWarehouseName] = useState("");
  const [receiveWarehouse, setReceiveWarehouse] = useState("");
  const [receiveVariant, setReceiveVariant] = useState("");
  const [receiveQuantity, setReceiveQuantity] = useState("1");
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [orderCustomer, setOrderCustomer] = useState("");
  // FIX #2: multi-line order items
  const [orderLines, setOrderLines] = useState<OrderLine[]>([newLine()]);
  const [carrier, setCarrier] = useState("Local");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [orderQuery, setOrderQuery] = useState("");

  // FIX #3: stable idempotency key – only regenerated after a successful submit
  const orderKeyRef = useRef(crypto.randomUUID());

  async function load(): Promise<void> {
    const [warehouseRows, productRows, customerRows, stockRows, orderRows] = await Promise.all([
      api<Warehouse[]>("/warehouses"),
      api<{ name: string; variants: { id: string; sku: string; priceCents: number }[] }[]>("/products"),
      api<Customer[]>("/customers"),
      api<Stock[]>("/inventory"),
      api<Order[]>(orderQuery.trim() ? `/orders?q=${encodeURIComponent(orderQuery.trim())}` : "/orders"),
    ]);
    setWarehouses(warehouseRows);
    setVariants(productRows.flatMap((product) => product.variants.map((variant) => ({ id: variant.id, label: `${product.name} · ${variant.sku} · ${money(variant.priceCents)}` }))));
    setCustomers(customerRows);
    setStock(stockRows);
    setOrders(orderRows);
  }

  useEffect(() => {
    if (!session.user || (session.user.role !== "admin" && session.user.role !== "staff")) {
      return;
    }
    void load().catch((caught: unknown) => setError(caught instanceof Error ? caught.message : "Could not load operations"));
  }, [session.user, orderQuery]);

  async function run(work: () => Promise<void>): Promise<void> {
    setError("");
    setNotice("");
    try {
      await work();
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Request failed");
    }
  }

  if (!session.ready) {
    return <Typography>Loading…</Typography>;
  }
  if (!session.user) {
    return <Typography>Sign in as staff or admin to run warehouse and order work.</Typography>;
  }
  if (session.user.role === "customer") {
    return <Typography>Your account can browse the catalogue. Stock and orders are limited to staff and admin.</Typography>;
  }

  // FIX #2: helpers for the multi-line form
  function updateLine(index: number, patch: Partial<OrderLine>) {
    setOrderLines((prev) => prev.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  }
  function addLine() {
    setOrderLines((prev) => [...prev, newLine()]);
  }
  function removeLine(index: number) {
    setOrderLines((prev) => prev.filter((_, i) => i !== index));
  }

  return (
    <Stack spacing={3}>
      <PageHeading title="Operations" detail="Warehouses, stock, customers, and the order desk." />
      {error ? <Alert severity="error">{error}</Alert> : null}
      {notice ? <Alert severity="success">{notice}</Alert> : null}

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 2 }}>
        <form
          onSubmit={(event: FormEvent) => {
            event.preventDefault();
            void run(async () => {
              await api("/warehouses", { method: "POST", body: JSON.stringify({ code: warehouseCode, name: warehouseName }) });
              setWarehouseCode("");
              setWarehouseName("");
              setNotice("Warehouse created");
            });
          }}
        >
          <Panel title="Warehouse">
            <Stack spacing={1.5}>
              <TextField label="Code" value={warehouseCode} onChange={(event) => setWarehouseCode(event.target.value)} required />
              <TextField label="Name" value={warehouseName} onChange={(event) => setWarehouseName(event.target.value)} required />
              <Button type="submit" variant="contained" sx={{ alignSelf: "flex-start" }}>Add warehouse</Button>
              {warehouses.map((warehouse) => (
                <Stack key={warehouse.id} direction="row" spacing={1} sx={{ alignItems: "center" }}>
                  <Typography sx={{ flex: 1 }}>
                    <Box component="span" sx={{ fontWeight: 700 }}>{warehouse.code}</Box> · {warehouse.name}
                  </Typography>
                  <Button
                    size="small"
                    color="error"
                    onClick={() =>
                      void run(async () => {
                        await api(`/warehouses/${warehouse.id}`, { method: "DELETE" });
                        setNotice("Warehouse removed");
                      })
                    }
                  >
                    Remove
                  </Button>
                </Stack>
              ))}
            </Stack>
          </Panel>
        </form>

        <form
          onSubmit={(event: FormEvent) => {
            event.preventDefault();
            void run(async () => {
              await api("/inventory/receive", {
                method: "POST",
                body: JSON.stringify({ warehouseId: receiveWarehouse, variantId: receiveVariant, quantity: Number(receiveQuantity) }),
              });
              setNotice("Stock received");
            });
          }}
        >
          <Panel title="Receive stock">
            <Stack spacing={1.5}>
              <TextField select label="Warehouse" value={receiveWarehouse} onChange={(event) => setReceiveWarehouse(event.target.value)} required>
                {warehouses.map((warehouse) => (
                  <MenuItem key={warehouse.id} value={warehouse.id}>{warehouse.code}</MenuItem>
                ))}
              </TextField>
              <TextField select label="Variant" value={receiveVariant} onChange={(event) => setReceiveVariant(event.target.value)} required>
                {variants.map((variant) => (
                  <MenuItem key={variant.id} value={variant.id}>{variant.label}</MenuItem>
                ))}
              </TextField>
              <TextField label="Quantity" type="number" value={receiveQuantity} onChange={(event) => setReceiveQuantity(event.target.value)} required />
              <Button type="submit" variant="contained" sx={{ alignSelf: "flex-start" }}>Receive</Button>
              {stock.map((row) => (
                <Typography key={`${row.warehouseCode}-${row.sku}`}>
                  {row.warehouseCode} · {row.sku} · <Box component="span" sx={{ fontWeight: 700 }}>{row.available} available</Box>
                  <Box component="span" sx={{ color: "text.secondary" }}> ({row.onHand} on hand, {row.reserved} reserved)</Box>
                </Typography>
              ))}
            </Stack>
          </Panel>
        </form>

        <form
          onSubmit={(event: FormEvent) => {
            event.preventDefault();
            void run(async () => {
              await api("/customers", { method: "POST", body: JSON.stringify({ name: customerName, email: customerEmail }) });
              setCustomerName("");
              setCustomerEmail("");
              setNotice("Customer created");
            });
          }}
        >
          <Panel title="Customer">
            <Stack spacing={1.5}>
              <TextField label="Name" value={customerName} onChange={(event) => setCustomerName(event.target.value)} required />
              <TextField label="Email" type="email" value={customerEmail} onChange={(event) => setCustomerEmail(event.target.value)} required />
              <Button type="submit" variant="contained" sx={{ alignSelf: "flex-start" }}>Add customer</Button>
              {customers.map((customer) => (
                <Stack key={customer.id} direction="row" spacing={1} sx={{ alignItems: "center" }}>
                  <Typography sx={{ flex: 1 }}>{customer.name} · {customer.email}</Typography>
                  <Button
                    size="small"
                    color="error"
                    onClick={() =>
                      void run(async () => {
                        await api(`/customers/${customer.id}`, { method: "DELETE" });
                        setNotice("Customer removed");
                      })
                    }
                  >
                    Remove
                  </Button>
                </Stack>
              ))}
            </Stack>
          </Panel>
        </form>

        {/* FIX #2 + #3: multi-line order form with stable idempotency key */}
        <form
          onSubmit={(event: FormEvent) => {
            event.preventDefault();
            // Capture the current key before any async work
            const idempotencyKey = orderKeyRef.current;
            void run(async () => {
              await api("/orders", {
                method: "POST",
                headers: { "Idempotency-Key": idempotencyKey },
                body: JSON.stringify({
                  customerId: orderCustomer,
                  items: orderLines.map((line) => ({
                    variantId: line.variantId,
                    warehouseId: line.warehouseId,
                    quantity: Number(line.quantity),
                  })),
                }),
              });
              // FIX #3: only generate a new key after the order was successfully placed
              orderKeyRef.current = crypto.randomUUID();
              setOrderLines([newLine()]);
              setOrderCustomer("");
              setNotice("Order placed");
            });
          }}
        >
          <Panel title="Place order">
            <Stack spacing={1.5}>
              <TextField select label="Customer" value={orderCustomer} onChange={(event) => setOrderCustomer(event.target.value)} required>
                {customers.map((customer) => (
                  <MenuItem key={customer.id} value={customer.id}>{customer.name}</MenuItem>
                ))}
              </TextField>

              {/* FIX #2: dynamic line items */}
              {orderLines.map((line, index) => (
                <Box key={index} sx={{ border: "1px solid", borderColor: "divider", borderRadius: 1, p: 1.5 }}>
                  <Stack spacing={1}>
                    <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center" }}>
                      <Typography variant="body2" color="text.secondary">Line {index + 1}</Typography>
                      {orderLines.length > 1 && (
                        <IconButton size="small" onClick={() => removeLine(index)} title="Remove line">✕</IconButton>
                      )}
                    </Stack>
                    <TextField select label="Variant" value={line.variantId} onChange={(event) => updateLine(index, { variantId: event.target.value })} required>
                      {variants.map((variant) => (
                        <MenuItem key={variant.id} value={variant.id}>{variant.label}</MenuItem>
                      ))}
                    </TextField>
                    <TextField select label="Warehouse" value={line.warehouseId} onChange={(event) => updateLine(index, { warehouseId: event.target.value })} required>
                      {warehouses.map((warehouse) => (
                        <MenuItem key={warehouse.id} value={warehouse.id}>{warehouse.code}</MenuItem>
                      ))}
                    </TextField>
                    <TextField label="Quantity" type="number" value={line.quantity} onChange={(event) => updateLine(index, { quantity: event.target.value })} required slotProps={{ htmlInput: { min: 1 } }} />
                  </Stack>
                </Box>
              ))}

              <Button variant="outlined" size="small" onClick={addLine} sx={{ alignSelf: "flex-start" }}>+ Add line</Button>
              <Button type="submit" variant="contained" sx={{ alignSelf: "flex-start" }}>Place order</Button>
            </Stack>
          </Panel>
        </form>
      </Box>

      <Panel title="Orders">
        <Stack spacing={2}>
          <TextField label="Search orders" value={orderQuery} onChange={(event) => setOrderQuery(event.target.value)} placeholder="Customer, status, or id" sx={{ maxWidth: 360 }} />
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 1.5, maxWidth: 560 }}>
            <TextField label="Carrier" value={carrier} onChange={(event) => setCarrier(event.target.value)} />
            <TextField label="Tracking number" value={trackingNumber} onChange={(event) => setTrackingNumber(event.target.value)} />
          </Box>
          {orders.length === 0 ? <Typography color="text.secondary">No orders yet.</Typography> : null}
          {orders.map((order) => (
            <Box key={order.id} sx={{ py: 1.5, borderTop: "1px solid", borderColor: "divider" }}>
              <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center", gap: 2, flexWrap: "wrap" }}>
                <Box>
                  {/* FIX #4: link to order detail screen */}
                  <Typography
                    component={Link}
                    to={`/orders/${order.id}`}
                    sx={{ fontWeight: 700, textDecoration: "none", color: "inherit", "&:hover": { textDecoration: "underline" } }}
                  >
                    {order.customerName}
                  </Typography>
                  <Typography color="text.secondary">
                    {money(order.totalCents)}
                    {order.shipment ? ` · ${order.shipment.trackingNumber}` : ""}
                  </Typography>
                </Box>
                <StatusChip status={order.status} />
              </Stack>
              <Stack direction="row" spacing={1} sx={{ mt: 1.25, flexWrap: "wrap" }}>
                {order.status === "placed" ? (
                  <Button
                    size="small"
                    variant="contained"
                    onClick={() =>
                      void run(async () => {
                        await api("/payments/test", {
                          method: "POST",
                          headers: { "Idempotency-Key": `pay-${order.id}` },
                          body: JSON.stringify({ orderId: order.id }),
                        });
                        setNotice("Payment captured");
                      })
                    }
                  >
                    Take payment
                  </Button>
                ) : null}
                {order.status === "placed" ? (
                  <Button
                    size="small"
                    color="error"
                    onClick={() =>
                      void run(async () => {
                        await api(`/orders/${order.id}/cancel`, { method: "POST" });
                        setNotice("Order cancelled");
                      })
                    }
                  >
                    Cancel
                  </Button>
                ) : null}
                {order.status === "paid" ? (
                  <Button
                    size="small"
                    variant="contained"
                    color="secondary"
                    onClick={() =>
                      void run(async () => {
                        await api("/shipments", { method: "POST", body: JSON.stringify({ orderId: order.id, carrier, trackingNumber }) });
                        setNotice("Shipment created");
                      })
                    }
                  >
                    Ship
                  </Button>
                ) : null}
                {order.status === "shipped" && order.shipment ? (
                  <Button
                    size="small"
                    variant="contained"
                    onClick={() =>
                      void run(async () => {
                        await api(`/shipments/${order.shipment?.id}/deliver`, { method: "POST" });
                        setNotice("Marked delivered");
                      })
                    }
                  >
                    Deliver
                  </Button>
                ) : null}
                {order.status === "shipped" || order.status === "delivered" ? (
                  <Button
                    size="small"
                    onClick={() =>
                      void run(async () => {
                        await api("/refunds", { method: "POST", body: JSON.stringify({ orderId: order.id }) });
                        setNotice("Refund completed");
                      })
                    }
                  >
                    Refund
                  </Button>
                ) : null}
              </Stack>
            </Box>
          ))}
        </Stack>
      </Panel>
    </Stack>
  );
}

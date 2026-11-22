import { Box, Chip, Paper, Stack, Typography } from "@mui/material";
import { useEffect, useState } from "react";
import { useParams } from "react-router";
import { api, money } from "../api";
import { PageHeading, StatusChip } from "../ui";

type OrderDetail = {
  id: string;
  customerId: string;
  customerName: string;
  status: string;
  totalCents: number;
  items: { variantId: string; warehouseId: string; quantity: number; unitPriceCents: number }[];
  shipment: { id: string; carrier: string; trackingNumber: string; status: string } | null;
};

export function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) return;
    api<OrderDetail>(`/orders/${id}`)
      .then(setOrder)
      .catch((caught: unknown) => {
        setError(caught instanceof Error ? caught.message : "Could not load order");
      });
  }, [id]);

  if (error) {
    return (
      <Stack spacing={2}>
        <PageHeading title="Order" detail="" />
        <Typography color="error">{error}</Typography>
      </Stack>
    );
  }

  if (!order) {
    return <Typography>Loading…</Typography>;
  }

  return (
    <Stack spacing={3}>
      <PageHeading title={`Order`} detail={`ID: ${order.id}`} />
      <Paper sx={{ p: 2.5 }}>
        <Stack spacing={2}>
          <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 2 }}>
            <Box>
              <Typography variant="h6">{order.customerName}</Typography>
              <Typography color="text.secondary" variant="body2">{order.customerId}</Typography>
            </Box>
            <StatusChip status={order.status} />
          </Stack>

          <Box>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>Items</Typography>
            <Stack spacing={1}>
              {order.items.map((item, index) => (
                <Box
                  key={index}
                  sx={{ display: "flex", justifyContent: "space-between", py: 1, borderTop: "1px solid", borderColor: "divider", gap: 2, flexWrap: "wrap" }}
                >
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>Variant ID: {item.variantId}</Typography>
                    <Typography variant="body2" color="text.secondary">Warehouse: {item.warehouseId}</Typography>
                    <Typography variant="body2" color="text.secondary">Qty: {item.quantity} × {money(item.unitPriceCents)}</Typography>
                  </Box>
                  <Typography sx={{ fontWeight: 700 }}>{money(item.quantity * item.unitPriceCents)}</Typography>
                </Box>
              ))}
            </Stack>
          </Box>

          <Stack direction="row" sx={{ justifyContent: "flex-end" }}>
            <Typography variant="h6">Total: {money(order.totalCents)}</Typography>
          </Stack>

          {order.shipment ? (
            <Box sx={{ pt: 1, borderTop: "1px solid", borderColor: "divider" }}>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>Shipment</Typography>
              <Stack direction="row" spacing={2} sx={{ flexWrap: "wrap", alignItems: "center" }}>
                <Typography variant="body2">Carrier: <strong>{order.shipment.carrier}</strong></Typography>
                <Typography variant="body2">Tracking: <strong>{order.shipment.trackingNumber}</strong></Typography>
                <Chip size="small" label={order.shipment.status} sx={{ textTransform: "capitalize" }} />
              </Stack>
            </Box>
          ) : null}
        </Stack>
      </Paper>
    </Stack>
  );
}

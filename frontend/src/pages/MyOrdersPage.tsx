import { Box, Paper, Stack, Typography } from "@mui/material";
import { useEffect, useState } from "react";
import { Link } from "react-router";
import { api, money } from "../api";
import { PageHeading, StatusChip } from "../ui";

type MyOrder = {
  id: string;
  status: string;
  totalCents: number;
  shipment: { trackingNumber: string } | null;
};

export function MyOrdersPage() {
  const [orders, setOrders] = useState<MyOrder[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    api<MyOrder[]>("/orders/mine")
      .then(setOrders)
      .catch((caught: unknown) => setError(caught instanceof Error ? caught.message : "Could not load your orders"));
  }, []);

  return (
    <Stack spacing={2}>
      <PageHeading title="My orders" detail="Orders placed with your account." />
      {error ? <Typography color="error">{error}</Typography> : null}
      {orders.length === 0 && !error ? <Typography color="text.secondary">You have not placed an order yet.</Typography> : null}
      {orders.map((order) => (
        <Paper key={order.id} sx={{ p: 2 }}>
          <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center", gap: 2, flexWrap: "wrap" }}>
            <Box>
              <Typography component={Link} to={`/orders/${order.id}`} sx={{ fontWeight: 700, color: "inherit", textDecoration: "none" }}>
                {money(order.totalCents)}
              </Typography>
              <Typography color="text.secondary" variant="body2">
                {order.shipment ? order.shipment.trackingNumber : order.id}
              </Typography>
            </Box>
            <StatusChip status={order.status} />
          </Stack>
        </Paper>
      ))}
    </Stack>
  );
}

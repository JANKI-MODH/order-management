import { Box, Paper, Stack, Typography } from "@mui/material";
import { useEffect, useState } from "react";
import { Link } from "react-router";
import { useSession } from "../session";

type HealthState = "loading" | "ok" | "down";

const shortcuts = [
  { to: "/catalog", title: "Catalogue", detail: "Browse products, variants, and prices." },
  { to: "/operations", title: "Operations", detail: "Receive stock, place orders, ship, and refund." },
  { to: "/admin", title: "Admin", detail: "People, catalogue setup, and the sales report." },
];

export function HomePage() {
  const session = useSession();
  const [health, setHealth] = useState<HealthState>("loading");

  useEffect(() => {
    const controller = new AbortController();
    fetch("/health", { signal: controller.signal })
      .then((response) => {
        if (!response.ok) {
          throw new Error("Health request failed");
        }
        return response.json() as Promise<{ status?: string }>;
      })
      .then((body) => {
        setHealth(body.status === "ok" ? "ok" : "down");
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
        setHealth("down");
      });
    return () => controller.abort();
  }, []);

  const healthLabel = health === "loading" ? "Checking API" : health === "ok" ? "API online" : "API offline";

  return (
    <Stack spacing={3}>
      <Paper
        sx={{
          p: { xs: 3, md: 5 },
          color: "#F6F3EC",
          background: "linear-gradient(135deg, #142833 0%, #1B3A4B 55%, #3E2A22 100%)",
          border: "none",
        }}
      >
        <Typography sx={{ letterSpacing: "0.18em", fontSize: 12, color: "#E0A36A", fontWeight: 700 }}>ORDER DESK</Typography>
        <Typography variant="h3" component="h1" sx={{ mt: 1, maxWidth: 640, color: "#F6F3EC" }}>
          Northline Supply
        </Typography>
        <Typography sx={{ mt: 1.5, maxWidth: 520, color: "#D5DEE3" }}>
          Stock, orders, payments, and shipments for one distributor. {session.user ? `Signed in as ${session.user.email}.` : "Sign in to work an order."}
        </Typography>
        <Box
          sx={{
            mt: 3,
            display: "inline-flex",
            alignItems: "center",
            gap: 1,
            px: 1.5,
            py: 0.75,
            borderRadius: 999,
            bgcolor: "rgba(255,255,255,0.08)",
          }}
        >
          <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: health === "ok" ? "#8FCB9B" : health === "down" ? "#E7A0A0" : "#E0A36A" }} />
          <Typography sx={{ fontSize: 13, fontWeight: 600 }}>{healthLabel}</Typography>
        </Box>
      </Paper>
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr 1fr" }, gap: 2 }}>
        {shortcuts.map((item) => (
          <Paper
            key={item.to}
            component={Link}
            to={item.to}
            sx={{
              p: 2.5,
              textDecoration: "none",
              color: "inherit",
              transition: "transform 0.15s ease, border-color 0.15s ease",
              "&:hover": { transform: "translateY(-2px)", borderColor: "#C9B59A" },
            }}
          >
            <Typography variant="h6">{item.title}</Typography>
            <Typography color="text.secondary" sx={{ mt: 0.75 }}>
              {item.detail}
            </Typography>
          </Paper>
        ))}
      </Box>
    </Stack>
  );
}

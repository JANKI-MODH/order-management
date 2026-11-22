import { Box, Chip, Stack, Typography } from "@mui/material";
import { NavLink, Route, Routes } from "react-router";
import { AccountPage } from "./pages/AccountPage";
import { AdminPage } from "./pages/AdminPage";
import { CatalogPage } from "./pages/CatalogPage";
import { HomePage } from "./pages/HomePage";
import { MyOrdersPage } from "./pages/MyOrdersPage";
import { OperationsPage } from "./pages/OperationsPage";
import { OrderDetailPage } from "./pages/OrderDetailPage";
import { useSession } from "./session";

function NavItem({ to, children, end }: { to: string; children: string; end?: boolean }) {
  return (
    <NavLink
      to={to}
      end={end}
      style={({ isActive }) => ({
        color: "#F6F3EC",
        textDecoration: "none",
        fontSize: 14,
        fontWeight: 600,
        padding: "7px 12px",
        borderRadius: 999,
        whiteSpace: "nowrap",
        flexShrink: 0,
        background: isActive ? "rgba(255,255,255,0.14)" : "transparent",
      })}
    >
      {children}
    </NavLink>
  );
}

export default function App() {
  const session = useSession();
  const canOperate = session.user?.role === "admin" || session.user?.role === "staff";

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default" }}>
      <Box component="header" sx={{ bgcolor: "#142833", color: "#F6F3EC" }}>
        <Stack
          direction="row"
          sx={{ alignItems: "center", gap: 2, maxWidth: 1120, mx: "auto", px: { xs: 2, md: 4 }, py: 1.75 }}
        >
          <Box sx={{ mr: 1, lineHeight: 1, flexShrink: 0 }}>
            <Typography sx={{ fontFamily: '"Source Serif 4", Georgia, serif', fontSize: 15, letterSpacing: "0.16em", fontWeight: 600 }}>
              NORTHLINE
            </Typography>
            <Typography sx={{ fontSize: 10, letterSpacing: "0.28em", color: "#E0A36A", mt: 0.25 }}>SUPPLY</Typography>
          </Box>
          <Stack direction="row" sx={{ gap: 0.5, flex: 1, minWidth: 0, overflowX: "auto", flexWrap: "nowrap" }}>
            <NavItem to="/" end>
              Home
            </NavItem>
            <NavItem to="/catalog">Catalogue</NavItem>
            {session.user?.role === "customer" ? <NavItem to="/orders">My orders</NavItem> : null}
            <NavItem to="/account">Account</NavItem>
            {canOperate ? <NavItem to="/operations">Operations</NavItem> : null}
            {session.user?.role === "admin" ? <NavItem to="/admin">Admin</NavItem> : null}
          </Stack>
          {session.user ? (
            <Chip
              size="small"
              label={session.user.role}
              sx={{ bgcolor: "rgba(224,163,106,0.2)", color: "#F6E7D4", textTransform: "capitalize", fontWeight: 700, flexShrink: 0 }}
            />
          ) : (
            <Typography sx={{ fontSize: 13, color: "#C9D3D8", flexShrink: 0 }}>Guest</Typography>
          )}
        </Stack>
        <Box sx={{ height: 3, background: "linear-gradient(90deg, #E0A36A, #B8612E 40%, transparent)" }} />
      </Box>
      <Box component="main" sx={{ maxWidth: 1120, mx: "auto", px: { xs: 2, md: 4 }, py: 4 }}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/catalog" element={<CatalogPage />} />
          <Route path="/account" element={<AccountPage />} />
          <Route path="/operations" element={<OperationsPage />} />
          <Route path="/orders" element={<MyOrdersPage />} />
          <Route path="/orders/:id" element={<OrderDetailPage />} />
          <Route path="/admin" element={<AdminPage />} />
        </Routes>
      </Box>
    </Box>
  );
}

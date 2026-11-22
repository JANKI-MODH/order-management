import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const apiPaths = [
  "/health",
  "/auth",
  "/users",
  "/categories",
  "/products",
  "/variants",
  "/warehouses",
  "/inventory",
  "/customers",
  "/orders",
  "/payments",
  "/shipments",
  "/refunds",
  "/organizations",
  "/teams",
  "/reports",
  "/audit",
  "/notifications",
];

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: Object.fromEntries(apiPaths.map((path) => [path, "http://localhost:3000"])),
  },
});

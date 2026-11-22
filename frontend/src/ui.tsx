import { Chip, Paper, Typography } from "@mui/material";
import type { ReactNode } from "react";

const statusColor: Record<string, "default" | "info" | "primary" | "warning" | "success" | "error" | "secondary"> = {
  placed: "info",
  paid: "primary",
  shipped: "warning",
  delivered: "success",
  cancelled: "error",
  returned: "secondary",
};

export function StatusChip({ status }: { status: string }) {
  return <Chip size="small" label={status} color={statusColor[status] ?? "default"} sx={{ textTransform: "capitalize" }} />;
}

export function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Paper sx={{ p: 2.5, height: "100%" }}>
      <Typography variant="h6" sx={{ mb: 2 }}>
        {title}
      </Typography>
      {children}
    </Paper>
  );
}

export function PageHeading({ title, detail }: { title: string; detail: string }) {
  return (
    <>
      <Typography variant="h4" component="h1">
        {title}
      </Typography>
      <Typography color="text.secondary" sx={{ mt: 0.5, mb: 3 }}>
        {detail}
      </Typography>
    </>
  );
}

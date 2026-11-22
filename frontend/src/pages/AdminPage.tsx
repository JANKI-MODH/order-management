import { Alert, Box, Button, MenuItem, Stack, TextField, Typography } from "@mui/material";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { api, money } from "../api";
import type { Role } from "../api";
import { useSession } from "../session";
import { PageHeading, Panel } from "../ui";

type User = { id: string; email: string; role: Role };
type Category = { id: string; name: string };
type Product = { id: string; name: string; variants: { id: string; sku: string; name: string }[] };
type Summary = { ordersByStatus: { status: string; count: number }[]; netCents: number; lowStockCount: number };
type AuditRow = { id: string; action: string; entityType: string };
type Notice = { id: string; subject: string; recipient: string };
type Organization = { id: string; name: string; teams: { id: string; name: string; members: { userId: string; email: string }[] }[] };

export function AdminPage() {
  const session = useSession();
  const [users, setUsers] = useState<User[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [error, setError] = useState("");
  const [categoryName, setCategoryName] = useState("");
  const [productName, setProductName] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [productId, setProductId] = useState("");
  const [variantName, setVariantName] = useState("");
  const [sku, setSku] = useState("");
  const [price, setPrice] = useState("");
  const [organizationName, setOrganizationName] = useState("");
  const [teamOrganizationId, setTeamOrganizationId] = useState("");
  const [teamName, setTeamName] = useState("");
  const [memberTeamId, setMemberTeamId] = useState("");
  const [memberUserId, setMemberUserId] = useState("");

  async function load(): Promise<void> {
    const [userRows, categoryRows, productRows, report, auditRows, noticeRows, organizationRows] = await Promise.all([
      api<User[]>("/users"),
      api<Category[]>("/categories"),
      api<Product[]>("/products"),
      api<Summary>("/reports/summary"),
      api<AuditRow[]>("/audit"),
      api<Notice[]>("/notifications"),
      api<Organization[]>("/organizations"),
    ]);
    setUsers(userRows);
    setCategories(categoryRows);
    setProducts(productRows);
    setSummary(report);
    setAudit(auditRows);
    setNotices(noticeRows);
    setOrganizations(organizationRows);
  }

  useEffect(() => {
    if (session.user?.role !== "admin") {
      return;
    }
    void load().catch((caught: unknown) => setError(caught instanceof Error ? caught.message : "Could not load admin data"));
  }, [session.user]);

  async function run(event: FormEvent, work: () => Promise<void>): Promise<void> {
    event.preventDefault();
    setError("");
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
  if (session.user?.role !== "admin") {
    return <Typography>Admin access is required for people, catalogue setup, and reports.</Typography>;
  }

  const teams = organizations.flatMap((organization) => organization.teams.map((team) => ({ ...team, organizationName: organization.name })));

  return (
    <Stack spacing={3}>
      <PageHeading title="Admin" detail="People, catalogue setup, company structure, and the sales report." />
      {error ? <Alert severity="error">{error}</Alert> : null}

      {summary ? (
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(3, 1fr)" }, gap: 2 }}>
          <Panel title="Net sales">
            <Typography variant="h4">{money(summary.netCents)}</Typography>
          </Panel>
          <Panel title="Low stock">
            <Typography variant="h4">{summary.lowStockCount}</Typography>
            <Typography color="text.secondary">rows with 5 or fewer available</Typography>
          </Panel>
          <Panel title="Orders">
            <Stack spacing={0.5}>
              {summary.ordersByStatus.length === 0 ? <Typography color="text.secondary">No orders yet.</Typography> : null}
              {summary.ordersByStatus.map((row) => (
                <Typography key={row.status} sx={{ textTransform: "capitalize" }}>
                  {row.status} · {row.count}
                </Typography>
              ))}
            </Stack>
          </Panel>
        </Box>
      ) : null}

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 2 }}>
        <Panel title="People">
          <Stack spacing={1.5}>
            {users.map((user) => (
              <Stack key={user.id} direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ alignItems: { sm: "center" } }}>
                <Typography sx={{ flex: 1 }}>{user.email}</Typography>
                <TextField
                  select
                  label="Role"
                  value={user.role}
                  sx={{ minWidth: 140 }}
                  onChange={(event) => {
                    void api(`/users/${user.id}/role`, { method: "PATCH", body: JSON.stringify({ role: event.target.value }) })
                      .then(load)
                      .catch((caught: unknown) => setError(caught instanceof Error ? caught.message : "Could not change role"));
                  }}
                >
                  <MenuItem value="customer">customer</MenuItem>
                  <MenuItem value="staff">staff</MenuItem>
                  <MenuItem value="admin">admin</MenuItem>
                </TextField>
              </Stack>
            ))}
          </Stack>
        </Panel>

        <form onSubmit={(event) => void run(event, async () => {
          await api("/categories", { method: "POST", body: JSON.stringify({ name: categoryName }) });
          setCategoryName("");
        })}>
          <Panel title="Category">
            <Stack spacing={1.5}>
              {categories.map((category) => (
                <Typography key={category.id}>{category.name}</Typography>
              ))}
              <TextField label="Name" value={categoryName} onChange={(event) => setCategoryName(event.target.value)} required />
              <Button type="submit" variant="contained" sx={{ alignSelf: "flex-start" }}>Add category</Button>
            </Stack>
          </Panel>
        </form>

        <form onSubmit={(event) => void run(event, async () => {
          await api("/products", { method: "POST", body: JSON.stringify({ name: productName, description, categoryId }) });
          setProductName("");
          setDescription("");
        })}>
          <Panel title="Product">
            <Stack spacing={1.5}>
              <TextField label="Name" value={productName} onChange={(event) => setProductName(event.target.value)} required />
              <TextField label="Description" value={description} onChange={(event) => setDescription(event.target.value)} />
              <TextField select label="Category" value={categoryId} onChange={(event) => setCategoryId(event.target.value)} required>
                {categories.map((category) => (
                  <MenuItem key={category.id} value={category.id}>{category.name}</MenuItem>
                ))}
              </TextField>
              <Button type="submit" variant="contained" sx={{ alignSelf: "flex-start" }}>Add product</Button>
            </Stack>
          </Panel>
        </form>

        <form onSubmit={(event) => void run(event, async () => {
          await api(`/products/${productId}/variants`, {
            method: "POST",
            body: JSON.stringify({ name: variantName, sku, priceCents: Math.round(Number(price) * 100) }),
          });
          setVariantName("");
          setSku("");
          setPrice("");
        })}>
          <Panel title="Variant">
            <Stack spacing={1.5}>
              <TextField select label="Product" value={productId} onChange={(event) => setProductId(event.target.value)} required>
                {products.map((product) => (
                  <MenuItem key={product.id} value={product.id}>{product.name}</MenuItem>
                ))}
              </TextField>
              <TextField label="Name" value={variantName} onChange={(event) => setVariantName(event.target.value)} required />
              <TextField label="SKU" value={sku} onChange={(event) => setSku(event.target.value)} required />
              <TextField label="Price" type="number" value={price} onChange={(event) => setPrice(event.target.value)} required helperText="Dollars, stored as cents" />
              <Button type="submit" variant="contained" sx={{ alignSelf: "flex-start" }}>Add variant</Button>
            </Stack>
          </Panel>
        </form>

        <form onSubmit={(event) => void run(event, async () => {
          await api("/organizations", { method: "POST", body: JSON.stringify({ name: organizationName }) });
          setOrganizationName("");
        })}>
          <Panel title="Organization">
            <Stack spacing={1.5}>
              <TextField label="Name" value={organizationName} onChange={(event) => setOrganizationName(event.target.value)} required />
              <Button type="submit" variant="contained" sx={{ alignSelf: "flex-start" }}>Add organization</Button>
              {organizations.map((organization) => (
                <Box key={organization.id}>
                  <Typography sx={{ fontWeight: 700 }}>{organization.name}</Typography>
                  {organization.teams.map((team) => (
                    <Typography key={team.id} color="text.secondary">
                      {team.name} · {team.members.map((member) => member.email).join(", ") || "no members"}
                    </Typography>
                  ))}
                </Box>
              ))}
            </Stack>
          </Panel>
        </form>

        <Stack spacing={2}>
          <form onSubmit={(event) => void run(event, async () => {
            await api(`/organizations/${teamOrganizationId}/teams`, { method: "POST", body: JSON.stringify({ name: teamName }) });
            setTeamName("");
          })}>
            <Panel title="Team">
              <Stack spacing={1.5}>
                <TextField select label="Organization" value={teamOrganizationId} onChange={(event) => setTeamOrganizationId(event.target.value)} required>
                  {organizations.map((organization) => (
                    <MenuItem key={organization.id} value={organization.id}>{organization.name}</MenuItem>
                  ))}
                </TextField>
                <TextField label="Team name" value={teamName} onChange={(event) => setTeamName(event.target.value)} required />
                <Button type="submit" variant="contained" sx={{ alignSelf: "flex-start" }}>Add team</Button>
              </Stack>
            </Panel>
          </form>
          <form onSubmit={(event) => void run(event, async () => {
            await api(`/teams/${memberTeamId}/members`, { method: "POST", body: JSON.stringify({ userId: memberUserId }) });
          })}>
            <Panel title="Team member">
              <Stack spacing={1.5}>
                <TextField select label="Team" value={memberTeamId} onChange={(event) => setMemberTeamId(event.target.value)} required>
                  {teams.map((team) => (
                    <MenuItem key={team.id} value={team.id}>{team.organizationName} · {team.name}</MenuItem>
                  ))}
                </TextField>
                <TextField select label="Person" value={memberUserId} onChange={(event) => setMemberUserId(event.target.value)} required>
                  {users.map((user) => (
                    <MenuItem key={user.id} value={user.id}>{user.email}</MenuItem>
                  ))}
                </TextField>
                <Button type="submit" variant="contained" sx={{ alignSelf: "flex-start" }}>Add member</Button>
              </Stack>
            </Panel>
          </form>
        </Stack>
      </Box>

      <Panel title="Catalogue records">
        <Stack spacing={1.5}>
          {products.map((product) => (
            <Box key={product.id}>
              <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                <Typography sx={{ flex: 1, fontWeight: 700 }}>{product.name}</Typography>
                <Button
                  size="small"
                  color="error"
                  onClick={() => {
                    void api(`/products/${product.id}`, { method: "DELETE" })
                      .then(load)
                      .catch((caught: unknown) => setError(caught instanceof Error ? caught.message : "Could not delete product"));
                  }}
                >
                  Remove product
                </Button>
              </Stack>
              {product.variants.map((variant) => (
                <Stack key={variant.id} direction="row" spacing={1} sx={{ alignItems: "center", pl: 2, mt: 0.5 }}>
                  <Typography sx={{ flex: 1 }}>{variant.name} · {variant.sku}</Typography>
                  <Button
                    size="small"
                    color="error"
                    onClick={() => {
                      void api(`/variants/${variant.id}`, { method: "DELETE" })
                        .then(load)
                        .catch((caught: unknown) => setError(caught instanceof Error ? caught.message : "Could not delete variant"));
                    }}
                  >
                    Remove
                  </Button>
                </Stack>
              ))}
            </Box>
          ))}
        </Stack>
      </Panel>

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 2 }}>
        <Panel title="Recent activity">
          <Stack spacing={1}>
            {audit.slice(0, 8).map((row) => (
              <Typography key={row.id}>{row.action} · {row.entityType}</Typography>
            ))}
          </Stack>
        </Panel>
        <Panel title="Notifications">
          <Stack spacing={1}>
            {notices.slice(0, 5).map((row) => (
              <Typography key={row.id}>{row.subject} · {row.recipient}</Typography>
            ))}
          </Stack>
        </Panel>
      </Box>
    </Stack>
  );
}

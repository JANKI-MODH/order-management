import { Alert, Box, Button, Paper, Stack, TextField, Typography } from "@mui/material";
import { useState } from "react";
import type { FormEvent } from "react";
import { api, tokenKey } from "../api";
import type { SessionUser } from "../api";
import { useSession } from "../session";

export function AccountPage() {
  const session = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(path: "/auth/register" | "/auth/login"): Promise<void> {
    setPending(true);
    setError("");
    try {
      const result = await api<{ accessToken: string; user: SessionUser }>(path, {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      // FIX #11: persist in localStorage so session survives tab close
      localStorage.setItem(tokenKey, result.accessToken);
      setPassword("");
      await session.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The API could not be reached");
    } finally {
      setPending(false);
    }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const action = (event.nativeEvent as SubmitEvent).submitter?.getAttribute("value");
    void submit(action === "login" ? "/auth/login" : "/auth/register");
  }

  return (
    <Box sx={{ display: "grid", placeItems: "start center" }}>
      <Paper sx={{ p: { xs: 3, sm: 4 }, width: "100%", maxWidth: 440 }}>
        {session.user ? (
          <Stack spacing={2} sx={{ alignItems: "flex-start" }}>
            <Box
              sx={{
                width: 56,
                height: 56,
                borderRadius: "50%",
                bgcolor: "#1B3A4B",
                color: "#F6F3EC",
                display: "grid",
                placeItems: "center",
                fontWeight: 700,
                fontSize: 22,
              }}
            >
              {session.user.email.slice(0, 1).toUpperCase()}
            </Box>
            <Typography variant="h5" component="h1">
              Signed in
            </Typography>
            <Typography>{session.user.email}</Typography>
            <Typography color="text.secondary" sx={{ textTransform: "capitalize" }}>
              {session.user.role}
            </Typography>
            <Button variant="outlined" onClick={session.signOut}>
              Sign out
            </Button>
          </Stack>
        ) : (
          <form onSubmit={onSubmit}>
            <Stack spacing={2}>
              <Typography variant="h5" component="h1">
                Account
              </Typography>
              <Typography color="text.secondary">Register a customer account, or sign in to continue.</Typography>
              <TextField label="Email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
              <TextField
                label="Password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                helperText="At least 8 characters to register"
              />
              <Stack direction="row" spacing={1.5}>
                <Button type="submit" value="login" variant="contained" disabled={pending}>
                  Login
                </Button>
                <Button type="submit" value="register" variant="outlined" disabled={pending}>
                  Register
                </Button>
              </Stack>
              {error ? <Alert severity="error">{error}</Alert> : null}
            </Stack>
          </form>
        )}
      </Paper>
    </Box>
  );
}

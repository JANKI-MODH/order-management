export const tokenKey = "northline_token";

export type Role = "customer" | "staff" | "admin";

export type SessionUser = {
  id: string;
  email: string;
  role: Role;
};

export function money(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  // FIX #11: use localStorage so the session survives tab close / refresh
  const token = localStorage.getItem(tokenKey);
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(path, { ...options, headers });
  const body = (await response.json().catch(() => ({}))) as { message?: string | string[] };
  if (!response.ok) {
    const message = Array.isArray(body.message) ? body.message[0] : body.message;
    throw new Error(message || `Request failed (${response.status})`);
  }
  return body as T;
}

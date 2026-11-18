# Northline Supply — Order Management System

Enterprise order management for products, inventory, warehouses, payments, and shipments.

## Run the backend and frontend

Use two PowerShell windows. The backend stays running in the first. The frontend stays running in the second. Closing either window stops that app.

Project folder:

```powershell
cd "C:\Users\janki\OneDrive\Desktop\projects\order-managment"
```

If `node` or `npm` is not recognized, reload PATH in that window, then try again:

```powershell
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
node --version
npm --version
```

### First time only

`.env` is already in this project. On a new machine, copy the example first:

```powershell
copy .env.example .env
```

Install dependencies once per app:

```powershell
cd backend
npm install
cd ..\frontend
npm install
```

The backend now requires PostgreSQL. Docker is not installed here, and the Windows installer download was blocked, so start a local PostgreSQL 16 process from the backend folder:

```powershell
cd "C:\Users\janki\OneDrive\Desktop\projects\order-managment\backend"
npm run db
```

Leave that window open. It listens on port 5432 with the user, password, and database from `.env` (`northline` / `northline` / `northline`). Database files stay in `backend/data/postgres` and are not committed.

`.env` must also contain a private `JWT_SECRET` of at least 32 characters. Copy `.env.example` and replace the secret. The API refuses to start when the secret is still the example value.

Start `npm run db` before `npm run dev`. The API runs the users-table migration when it starts.

### Start the backend

In terminal 1:

```powershell
cd "C:\Users\janki\OneDrive\Desktop\projects\order-managment\backend"
npm run dev
```

Wait until the log includes `listening on http://localhost:3000`. Leave this window open.

Check the API from a third window, or from the frontend window before you start it:

```powershell
curl.exe http://localhost:3000/health
```

Expected body: `{"status":"ok"}`.

### Start the frontend

In terminal 2:

```powershell
cd "C:\Users\janki\OneDrive\Desktop\projects\order-managment\frontend"
npm run dev
```

Wait until the log prints a local URL, normally `http://localhost:5173`. Open that URL in the browser.

The page should show **API health: ok**. The page requests `/health` from Vite, and Vite forwards that request to the backend on port 3000. Start the backend before the frontend, or the page shows **API health: down** until the backend is up. Refresh after the backend starts.

Open http://localhost:5173/account to register or log in. The password must be at least 8 characters. After a successful register or login, the page shows the signed-in email and role. New accounts are customers. The browser keeps the token in `sessionStorage` until the tab is closed or you choose **Sign out**.

When `BOOTSTRAP_ADMIN=true`, the API promotes `ADMIN_EMAIL` to admin at startup. That switch is for this local project. A customer who calls an admin route receives 403.

http://localhost:5173/catalog shows products to anyone. http://localhost:5173/admin lists people and can add categories and products. Prices are stored as integer cents.

### Stop

In each window, press **Ctrl+C**. `npm run dev` watches files and restarts the app when you save code. It does not exit on its own.

### If a port is already taken

`EADDRINUSE` on port 3000 means a backend is already running. `Port 5173 is in use` means a frontend is already running. Use the window that is already serving that app, or stop it with **Ctrl+C**, then run `npm run dev` again.

## Database

Start PostgreSQL before the API. On this machine that is `npm run db` inside `backend`. `docker-compose.yml` is the same database for a machine that has Docker. Do not run both on port 5432.

The API applies SQL migrations from `backend/database/migrations` when it starts.

## Backend routes

Public reads: `GET /health`, `GET /categories`, `GET /products`.

Signed-in customer: `GET /auth/me`. Admin: `GET /users`, `PATCH /users/:id/role`.

Staff or admin:

- Warehouses and stock: `GET/POST /warehouses`, `GET /inventory`, `POST /inventory/receive`
- Customers: `GET/POST /customers`
- Orders: `POST /orders`, `GET /orders`, `GET /orders/:id`, `POST /orders/:id/cancel`
- Money, test mode: `POST /payments/test`, `POST /payments/webhook`
- Delivery and refunds: `POST /shipments`, `POST /shipments/:id/deliver`, `POST /refunds`

Admin only: organizations, teams, `GET /reports/summary`, `GET /audit`, `GET /notifications`.

`POST /orders` and `POST /payments/test` accept an `Idempotency-Key` header. Sending the same key again returns the original result instead of reserving stock or capturing money twice. A webhook with the same `eventId` is also ignored after the first delivery.

Prices are integer cents. Placing an order reserves stock inside a database transaction. Payment reduces the physical count and the reservation together. Cancelling a placed order releases the reservation. A refund puts the units back on hand.

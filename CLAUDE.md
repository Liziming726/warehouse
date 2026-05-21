# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build/Run Commands

```bash
npm run dev      # Start dev server (webpack, not Turbopack)
npm run build    # Production build
npm run start    # Start production server
npm run lint     # ESLint
```

No test suite exists yet.

## Tech Stack

- **Framework**: Next.js 16.2.1 App Router (NOT Pages Router)
- **UI**: React 19.2.4 + Ant Design 6.3.5 + Tailwind CSS 4
- **Database**: Supabase PostgreSQL (`@supabase/ssr` + `@supabase/supabase-js`)
- **Auth**: Custom HMAC-signed session cookie (not Supabase Auth)
- **Language**: TypeScript 5, strict mode

## Architecture — Five Layers

### 1. Page Route Layer (Server Components)
Top-level `app/**/page.tsx` files. Each page:
- Reads the session via `loadInventoryAccess()`
- Redirects to `/login?next=...` on unauthorized
- Loads data via query functions
- Passes data as props to client components wrapped in `<WmsShell>`

### 2. Client Interaction Layer (`'use client'`)
`*-client.tsx` files receive all data as props — they never fetch directly.
Use `useTransition` for Server Action mutations, `useDeferredValue` for search filtering, `useBreakpoint()` for mobile detection.

### 3. Server Actions Layer (`'use server'`)
`app/inbound/actions.ts`, `app/outbound/actions.ts`, `app/inventory/actions.ts`, `app/login/actions.ts`.
- Parse/validate FormData
- Resolve warehouse write scope via `resolveWriteWarehouseId()`
- Call Supabase RPC (`create_stock_in`, `create_stock_out`) or direct inserts
- Call `revalidatePath()` on all four pages: `/`, `/inventory`, `/inbound`, `/outbound`

### 4. Domain Service Layer (`src/lib/inventory/`)
- `queries.ts` — All Supabase read queries. Returns typed rows. **Read this file before touching any data loading.**
- `validators.ts` — FormData parsing helpers (UUID, quantity, date, remark)
- `types.ts` — Shared TypeScript types

### 5. Infrastructure Layer
- `src/lib/auth/session.ts` — HMAC-SHA256 signed cookie (`wms_session_user`), 8-hour expiry. Cookie value is `base64url(JSON).base64url(signature)`.
- `src/lib/auth/access.ts` — `requireLoginSession()` reads and validates the cookie. Throws `UnauthorizedError`.
- `src/lib/supabase/server.ts` — Supabase server client (reads cookies from `next/headers`)
- `src/lib/supabase/proxy.ts` — Middleware that updates session
- `proxy.ts` — Route protection middleware (redirects to `/login` for protected paths)

## Core Business Rule

**Current inventory = sum(IN movements) − sum(OUT movements)**

Never edit `products.quantity` directly. All stock changes go through `stock_movements` ledger records via `create_stock_in` / `create_stock_out` RPC functions.

## Database (Supabase PostgreSQL)

### Tables
- `warehouses` — id (uuid PK), code, name, status
- `app_users` — id (bigint PK), username (bigint unique), password (bigint), is_admin, nickname, warehouse (legacy text), warehouse_id (uuid FK)
- `products` — id (uuid PK), sku, name, category, unit, safe_stock, warehouse (legacy text), warehouse_id (uuid FK), status, remark
- `stock_movements` — id (uuid PK), movement_no (unique), movement_type (IN/OUT enum), biz_date, warehouse_id, product_id, quantity, operator_user_id, source, remark, is_void

### Views
- `v_current_inventory` — Per-product-per-warehouse stock balance with stock_status (NORMAL/LOW_STOCK/OUT_OF_STOCK)
- `v_stock_movements` — Joined movement records with product/warehouse/user names

### RPC Functions
- `create_stock_in(...)` — Inserts IN movement, returns uuid
- `create_stock_out(...)` — Takes advisory lock, validates stock sufficiency, inserts OUT movement

Legacy columns (`app_users.warehouse`, `products.warehouse`) exist for backward compatibility. New code uses `warehouse_id` (uuid FK to `warehouses`).

## Permission Model

- **Admin** (`is_admin=true`): read/write all warehouses, can create/edit/delete products
- **Non-admin**: scoped to `app_users.warehouse_id`. All Server Actions call `resolveWriteWarehouseId()` to enforce this server-side.
- Login requires pure-digit username and password (bigint columns).
- Accounts without a warehouse assignment cannot perform write operations.

## Key Patterns

### Adding a column visible in the UI
1. Add column via SQL in Supabase dashboard
2. If it affects a view, recreate the view
3. Add field to the TypeScript type in `types.ts`
4. Add field to the DB row type and mapping in `queries.ts`
5. Add column to the Ant Design `ColumnsType` in the client component
6. If writable, add parsing in the relevant `actions.ts`

### Server Action error handling
Server Actions return thrown errors. Client components catch them in `try/catch` around `startTransition(async () => { ... })` and display via `messageApi.error()`.

### Page protection
Two layers: `proxy.ts` middleware checks the cookie for protected routes, then each page's Server Component calls `loadInventoryAccess()` as a second check.

## Deprecated Files

- `app/dashboard-client.tsx` — Replaced by `app/home-client.tsx`
- `app/products/` — Redirects to `/`. Product CRUD now lives under `app/inventory/actions.ts`
- `app/test-db/` — Debug-only, used for diagnosing DB connectivity issues

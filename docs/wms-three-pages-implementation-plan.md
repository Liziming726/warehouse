# WMS Three-Page Implementation Plan (Inbound / Outbound / Inventory)

## 1. Target

Refactor current inventory logic from "directly editing products.quantity" to a ledger model:

- Inbound page: create `IN` movement records.
- Outbound page: create `OUT` movement records with stock validation.
- Inventory page: auto-calculate current stock from movement records.

Formula:

`current_stock = sum(IN) - sum(OUT)`

This matches your business example:

- 4/1 inbound 1 machine
- 4/2 inbound 3 pots
- 4/2 outbound 1 machine
- inventory is always computed from those records.

## 2. What is already in this repo

Current app already has:

- Session and role logic: `app/login/actions.ts`, `src/lib/auth/session.ts`
- Product CRUD and quantity write: `app/products/actions.ts`
- Dashboard list/stat cards: `app/page.tsx`, `app/dashboard-client.tsx`

Current issue:

- `products.quantity` is being edited directly, so no auditable movement history.

## 3. Database foundation

Use migration script:

- `sql/2026-04-01_inventory_ledger_migration.sql`

What this migration adds:

- `warehouses` table
- `warehouse_id` in `app_users` and `products`
- convert `products.quantity` from text to numeric
- `stock_movements` ledger table
- `create_stock_in(...)` RPC
- `create_stock_out(...)` RPC with atomic stock check
- `v_current_inventory` and `v_stock_movements` views
- opening balance backfill from legacy `products.quantity`

## 4. Route and file design

Recommended App Router structure:

```text
app/
  inbound/
    actions.ts
    inbound-client.tsx
    page.tsx
  outbound/
    actions.ts
    outbound-client.tsx
    page.tsx
  inventory/
    inventory-client.tsx
    page.tsx
```

Shared query/auth utilities:

```text
src/lib/inventory/
  queries.ts
  validators.ts
  types.ts
src/lib/auth/
  access.ts
```

Notes:

- `access.ts` should centralize role + warehouse scope checks (avoid duplicate logic currently spread in home/actions files).
- `queries.ts` should encapsulate Supabase read queries to views/tables.

## 5. Interface design (aligned with current Server Action style)

Use Server Actions first (same pattern as current codebase).

### 5.1 Inbound action

File: `app/inbound/actions.ts`

`createInbound(formData: FormData): Promise<void>`

Required form keys:

- `productId` (uuid)
- `warehouseId` (uuid, admin can choose; non-admin force assigned warehouse)
- `quantity` (number > 0)
- `bizDate` (date, default today)
- `remark` (optional)

Server logic:

1. Parse session from cookie.
2. Load app user profile and permission scope.
3. Resolve effective warehouse id (force user warehouse for non-admin).
4. Validate product exists and warehouse allowed.
5. Call `supabase.rpc('create_stock_in', payload)`.
6. Revalidate `'/inbound'`, `'/outbound'`, `'/inventory'`, `'/'`.

### 5.2 Outbound action

File: `app/outbound/actions.ts`

`createOutbound(formData: FormData): Promise<void>`

Input keys same as inbound.

Server logic:

1. Same auth + warehouse scope checks.
2. Call `supabase.rpc('create_stock_out', payload)`.
3. If rpc raises `Insufficient stock`, return user-friendly message.
4. Revalidate relevant paths.

### 5.3 Optional cancellation action

`voidMovement(formData: FormData): Promise<void>`

- mark record as `is_void=true` rather than hard delete.

## 6. Page behavior details

## 6.1 Inbound page `/inbound`

Data load:

- product options from `products` (active only)
- warehouse options from `warehouses` (admin only selection)
- recent records from `v_stock_movements` where `movement_type='IN'`

UI:

- Top form (date/product/qty/warehouse/remark)
- Submit button
- Recent inbound table (date, product, qty, warehouse, operator, created_at)

## 6.2 Outbound page `/outbound`

Data load:

- same as inbound
- recent records from `v_stock_movements` where `movement_type='OUT'`

UI:

- same form
- before submit can show current stock hint using `v_current_inventory`
- if stock not enough, show error and prevent commit

## 6.3 Inventory page `/inventory`

Data load:

- from `v_current_inventory`
- admin: all warehouses
- non-admin: only assigned warehouse

UI:

- Stat cards: total sku, total quantity, low stock count, out-of-stock count
- Filter: keyword + warehouse (admin)
- table columns:
  - sku
  - product_name
  - category
  - unit
  - warehouse_name
  - current_qty
  - safe_stock
  - stock_status

## 7. Permission rules

- Admin:
  - read/write all warehouses
- Non-admin:
  - can only read and write their own warehouse
  - cannot submit cross-warehouse inbound/outbound

Validation must be server-side in every Server Action (never trust client form fields).

## 8. Suggested refactor path (safe rollout)

1. Run DB migration in Supabase SQL editor.
2. Build `/inventory` read page using `v_current_inventory`.
3. Build `/inbound` with `create_stock_in`.
4. Build `/outbound` with `create_stock_out`.
5. Add top navigation links among `/`, `/inventory`, `/inbound`, `/outbound`.
6. Switch dashboard stock data source from `products.quantity` to `v_current_inventory`.
7. Keep old product CRUD temporarily, then remove direct quantity editing in product forms.

## 9. Test checklist

- Inbound creates one `IN` movement and inventory increases.
- Outbound cannot exceed current stock.
- Outbound success decreases inventory.
- Non-admin cannot operate outside assigned warehouse.
- Inventory page numbers equal `sum(IN)-sum(OUT)` for sampled products.
- Low stock and out-of-stock flags are correct.

## 10. Compatibility note

The migration keeps legacy columns (`products.warehouse`, `app_users.warehouse`) to avoid breaking existing pages while you migrate.

After all three new pages are online and stable, remove legacy direct-stock writes in old actions.


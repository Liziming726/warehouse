## Table `app_users`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `int8` | Primary |
| `username` | `int8` |  Unique |
| `password` | `int8` |  Nullable |
| `is_admin` | `bool` |  Nullable |
| `created_at` | `timestamptz` |  |
| `nickname` | `text` |  Nullable |
| `warehouse` | `text` |  Nullable |
| `warehouse_id` | `uuid` |  Nullable |
| `updated_at` | `timestamptz` |  |
| `password_hash` | `text` |  Nullable |

## Table `products`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `sku` | `text` |  Nullable |
| `created_at` | `timestamptz` |  |
| `name` | `text` |  Nullable |
| `category` | `text` |  Nullable |
| `unit` | `text` |  Nullable |
| `quantity` | `numeric` |  |
| `warehouse` | `text` |  Nullable |
| `warehouse_id` | `uuid` |  Nullable |
| `safe_stock` | `numeric` |  |
| `status` | `bool` |  |
| `updated_at` | `timestamptz` |  |

## Table `stock_movements`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `movement_no` | `varchar` |  Unique |
| `movement_type` | `stock_movement_type` |  |
| `biz_date` | `date` |  |
| `warehouse_id` | `uuid` |  |
| `product_id` | `uuid` |  |
| `quantity` | `numeric` |  |
| `operator_user_id` | `int8` |  Nullable |
| `source` | `varchar` |  |
| `remark` | `text` |  Nullable |
| `is_void` | `bool` |  |
| `void_reason` | `text` |  Nullable |
| `created_at` | `timestamptz` |  |

## Table `warehouses`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `code` | `varchar` |  |
| `name` | `varchar` |  |
| `status` | `bool` |  |
| `created_at` | `timestamptz` |  |


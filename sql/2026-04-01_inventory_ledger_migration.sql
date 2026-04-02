-- Inventory ledger migration (compatible with existing schema in this project)
-- Goal:
-- 1) Keep current data.
-- 2) Introduce inbound/outbound ledger table.
-- 3) Provide computed current-inventory view.
-- 4) Keep legacy columns for backward compatibility during app refactor.

begin;

create extension if not exists pgcrypto;

do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'stock_movement_type'
  ) then
    create type public.stock_movement_type as enum ('IN', 'OUT');
  end if;
end $$;

create table if not exists public.warehouses (
  id uuid primary key default gen_random_uuid(),
  code varchar(50) not null,
  name varchar(100) not null,
  status boolean not null default true,
  created_at timestamptz not null default now()
);

create unique index if not exists ux_warehouses_code on public.warehouses(code);
create unique index if not exists ux_warehouses_name on public.warehouses(name);

insert into public.warehouses (code, name, status)
values ('UNASSIGNED', 'Unassigned Warehouse', true)
on conflict (code) do nothing;

insert into public.warehouses (code, name, status)
select
  'WH-' || substr(md5(trim(src.warehouse_name)), 1, 8) as code,
  trim(src.warehouse_name) as name,
  true as status
from (
  select warehouse as warehouse_name
  from public.app_users
  where warehouse is not null and btrim(warehouse) <> ''
  union
  select warehouse as warehouse_name
  from public.products
  where warehouse is not null and btrim(warehouse) <> ''
) src
where not exists (
  select 1
  from public.warehouses w
  where lower(w.name) = lower(trim(src.warehouse_name))
);

alter table public.app_users
  add column if not exists warehouse_id uuid,
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists password_hash text;

update public.app_users u
set warehouse_id = w.id
from public.warehouses w
where u.warehouse_id is null
  and u.warehouse is not null
  and btrim(u.warehouse) <> ''
  and lower(w.name) = lower(btrim(u.warehouse));

do $$
begin
  if exists (
    select 1
    from public.app_users
    group by id
    having count(*) > 1
  ) then
    raise exception 'Migration blocked: duplicate app_users.id values found.';
  end if;

  if exists (
    select 1
    from public.app_users
    group by username
    having count(*) > 1
  ) then
    raise exception 'Migration blocked: duplicate app_users.username values found.';
  end if;
end $$;

-- If this migration is re-run, stock_movements may already reference app_users_pkey.
-- Drop that FK first so app_users primary key can be reshaped safely.
do $$
begin
  if to_regclass('public.stock_movements') is not null then
    alter table public.stock_movements
      drop constraint if exists stock_movements_operator_user_id_fkey;
  end if;
end $$;

do $$
declare
  v_pk_name text;
  v_is_target_pk boolean;
begin
  select
    c.conname,
    (
      array_length(c.conkey, 1) = 1
      and (
        select a.attname
        from pg_attribute a
        where a.attrelid = c.conrelid
          and a.attnum = c.conkey[1]
      ) = 'id'
    ) as is_target_pk
  into v_pk_name, v_is_target_pk
  from pg_constraint c
  where c.conrelid = 'public.app_users'::regclass
    and c.contype = 'p'
  limit 1;

  if v_pk_name is not null and not coalesce(v_is_target_pk, false) then
    execute format('alter table public.app_users drop constraint %I', v_pk_name);
  end if;
end $$;

alter table public.app_users
  alter column id set not null,
  alter column username set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint c
    where c.conrelid = 'public.app_users'::regclass
      and c.contype = 'p'
      and array_length(c.conkey, 1) = 1
      and (
        select a.attname
        from pg_attribute a
        where a.attrelid = c.conrelid
          and a.attnum = c.conkey[1]
      ) = 'id'
  ) then
    if exists (
      select 1
      from pg_constraint
      where conname = 'app_users_pkey'
        and conrelid = 'public.app_users'::regclass
    ) then
      alter table public.app_users drop constraint app_users_pkey;
    end if;

    alter table public.app_users
      add constraint app_users_pkey primary key (id);
  elsif not exists (
    select 1
    from pg_constraint
    where conname = 'app_users_pkey'
      and conrelid = 'public.app_users'::regclass
  ) then
    -- If PK is already on id but has another name, keep it as-is.
    null;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'app_users_username_key'
      and conrelid = 'public.app_users'::regclass
  ) then
    alter table public.app_users
      add constraint app_users_username_key unique (username);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'app_users_warehouse_id_fkey'
      and conrelid = 'public.app_users'::regclass
  ) then
    alter table public.app_users
      add constraint app_users_warehouse_id_fkey
      foreign key (warehouse_id) references public.warehouses(id);
  end if;
end $$;

create index if not exists idx_app_users_warehouse_id on public.app_users(warehouse_id);

alter table public.products
  add column if not exists warehouse_id uuid,
  add column if not exists safe_stock numeric(18,2) not null default 0,
  add column if not exists status boolean not null default true,
  add column if not exists updated_at timestamptz not null default now();

do $$
declare
  v_data_type text;
begin
  select c.data_type
  into v_data_type
  from information_schema.columns c
  where c.table_schema = 'public'
    and c.table_name = 'products'
    and c.column_name = 'quantity';

  if v_data_type is null then
    alter table public.products add column quantity numeric(18,2);
  elsif v_data_type in ('text', 'character varying', 'character') then
    alter table public.products
      alter column quantity type numeric(18,2)
      using case
        when quantity is null or btrim(quantity) = '' then 0
        when btrim(quantity) ~ '^[0-9]+(\.[0-9]+)?$' then btrim(quantity)::numeric(18,2)
        else 0
      end;
  end if;
end $$;

update public.products
set quantity = 0
where quantity is null or quantity < 0;

alter table public.products
  alter column quantity set default 0,
  alter column quantity set not null;

update public.products p
set warehouse_id = w.id
from public.warehouses w
where p.warehouse_id is null
  and p.warehouse is not null
  and btrim(p.warehouse) <> ''
  and lower(w.name) = lower(btrim(p.warehouse));

update public.products p
set warehouse_id = w.id
from public.warehouses w
where p.warehouse_id is null
  and w.code = 'UNASSIGNED';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'products_warehouse_id_fkey'
      and conrelid = 'public.products'::regclass
  ) then
    alter table public.products
      add constraint products_warehouse_id_fkey
      foreign key (warehouse_id) references public.warehouses(id);
  end if;
end $$;

create index if not exists idx_products_warehouse_id on public.products(warehouse_id);
create index if not exists idx_products_sku on public.products(sku);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_app_users_set_updated_at on public.app_users;
create trigger trg_app_users_set_updated_at
before update on public.app_users
for each row
execute function public.set_updated_at();

drop trigger if exists trg_products_set_updated_at on public.products;
create trigger trg_products_set_updated_at
before update on public.products
for each row
execute function public.set_updated_at();

create table if not exists public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  movement_no varchar(64) not null unique,
  movement_type public.stock_movement_type not null,
  biz_date date not null default current_date,
  warehouse_id uuid not null references public.warehouses(id),
  product_id uuid not null references public.products(id),
  quantity numeric(18,2) not null check (quantity > 0),
  operator_user_id bigint references public.app_users(id),
  source varchar(32) not null default 'manual',
  remark text,
  is_void boolean not null default false,
  void_reason text,
  created_at timestamptz not null default now()
);

do $$
begin
  if to_regclass('public.stock_movements') is not null then
    if not exists (
      select 1
      from pg_constraint
      where conname = 'stock_movements_operator_user_id_fkey'
        and conrelid = 'public.stock_movements'::regclass
    ) then
      alter table public.stock_movements
        add constraint stock_movements_operator_user_id_fkey
        foreign key (operator_user_id) references public.app_users(id);
    end if;
  end if;
end $$;

create index if not exists idx_stock_movements_biz_date
  on public.stock_movements(biz_date desc);
create index if not exists idx_stock_movements_type
  on public.stock_movements(movement_type);
create index if not exists idx_stock_movements_wh_product
  on public.stock_movements(warehouse_id, product_id);
create index if not exists idx_stock_movements_created_at
  on public.stock_movements(created_at desc);

insert into public.stock_movements (
  movement_no,
  movement_type,
  biz_date,
  warehouse_id,
  product_id,
  quantity,
  source,
  remark,
  created_at
)
select
  'OPENING-' || replace(p.id::text, '-', '') || '-' || substr(md5(p.warehouse_id::text), 1, 8) as movement_no,
  'IN'::public.stock_movement_type as movement_type,
  coalesce(p.created_at::date, current_date) as biz_date,
  p.warehouse_id,
  p.id as product_id,
  p.quantity,
  'opening_balance' as source,
  'Migrated from legacy products.quantity' as remark,
  coalesce(p.created_at, now()) as created_at
from public.products p
where p.quantity > 0
on conflict (movement_no) do nothing;

create or replace function public.create_stock_in(
  p_product_id uuid,
  p_warehouse_id uuid,
  p_quantity numeric,
  p_biz_date date default current_date,
  p_operator_user_id bigint default null,
  p_remark text default null,
  p_movement_no text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_movement_no text;
begin
  if p_product_id is null or p_warehouse_id is null then
    raise exception 'product_id and warehouse_id are required';
  end if;

  if p_quantity is null or p_quantity <= 0 then
    raise exception 'quantity must be greater than 0';
  end if;

  v_movement_no := coalesce(
    nullif(trim(p_movement_no), ''),
    'IN-' || to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS') || '-' || upper(substr(gen_random_uuid()::text, 1, 6))
  );

  insert into public.stock_movements (
    movement_no,
    movement_type,
    biz_date,
    warehouse_id,
    product_id,
    quantity,
    operator_user_id,
    source,
    remark
  )
  values (
    v_movement_no,
    'IN',
    coalesce(p_biz_date, current_date),
    p_warehouse_id,
    p_product_id,
    p_quantity,
    p_operator_user_id,
    'manual',
    p_remark
  )
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.create_stock_out(
  p_product_id uuid,
  p_warehouse_id uuid,
  p_quantity numeric,
  p_biz_date date default current_date,
  p_operator_user_id bigint default null,
  p_remark text default null,
  p_movement_no text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_movement_no text;
  v_current_qty numeric(18,2);
begin
  if p_product_id is null or p_warehouse_id is null then
    raise exception 'product_id and warehouse_id are required';
  end if;

  if p_quantity is null or p_quantity <= 0 then
    raise exception 'quantity must be greater than 0';
  end if;

  perform pg_advisory_xact_lock(
    hashtext(p_warehouse_id::text || ':' || p_product_id::text)
  );

  select coalesce(
    sum(
      case
        when sm.movement_type = 'IN' then sm.quantity
        when sm.movement_type = 'OUT' then -sm.quantity
        else 0
      end
    ),
    0
  )
  into v_current_qty
  from public.stock_movements sm
  where sm.warehouse_id = p_warehouse_id
    and sm.product_id = p_product_id
    and sm.is_void = false;

  if v_current_qty < p_quantity then
    raise exception 'Insufficient stock. current=%, requested=%', v_current_qty, p_quantity;
  end if;

  v_movement_no := coalesce(
    nullif(trim(p_movement_no), ''),
    'OUT-' || to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS') || '-' || upper(substr(gen_random_uuid()::text, 1, 6))
  );

  insert into public.stock_movements (
    movement_no,
    movement_type,
    biz_date,
    warehouse_id,
    product_id,
    quantity,
    operator_user_id,
    source,
    remark
  )
  values (
    v_movement_no,
    'OUT',
    coalesce(p_biz_date, current_date),
    p_warehouse_id,
    p_product_id,
    p_quantity,
    p_operator_user_id,
    'manual',
    p_remark
  )
  returning id into v_id;

  return v_id;
end;
$$;

create or replace view public.v_current_inventory as
with movement_agg as (
  select
    sm.warehouse_id,
    sm.product_id,
    sum(
      case
        when sm.movement_type = 'IN' then sm.quantity
        when sm.movement_type = 'OUT' then -sm.quantity
        else 0
      end
    ) as current_qty
  from public.stock_movements sm
  where sm.is_void = false
  group by sm.warehouse_id, sm.product_id
),
default_warehouse as (
  select w.id
  from public.warehouses w
  where w.code = 'UNASSIGNED'
  limit 1
),
base as (
  select ma.warehouse_id, ma.product_id
  from movement_agg ma
  union
  select coalesce(p.warehouse_id, dw.id) as warehouse_id, p.id as product_id
  from public.products p
  cross join default_warehouse dw
)
select
  b.warehouse_id,
  w.code as warehouse_code,
  w.name as warehouse_name,
  b.product_id,
  p.sku,
  p.name as product_name,
  p.category,
  p.unit,
  p.safe_stock,
  coalesce(ma.current_qty, 0) as current_qty,
  case
    when coalesce(ma.current_qty, 0) = 0 then 'OUT_OF_STOCK'
    when coalesce(ma.current_qty, 0) <= p.safe_stock then 'LOW_STOCK'
    else 'NORMAL'
  end as stock_status
from base b
join public.products p
  on p.id = b.product_id
left join public.warehouses w
  on w.id = b.warehouse_id
left join movement_agg ma
  on ma.warehouse_id = b.warehouse_id
 and ma.product_id = b.product_id;

create or replace view public.v_stock_movements as
select
  sm.id,
  sm.movement_no,
  sm.movement_type,
  sm.biz_date,
  sm.warehouse_id,
  w.name as warehouse_name,
  sm.product_id,
  p.sku,
  p.name as product_name,
  p.unit,
  sm.quantity,
  sm.operator_user_id,
  u.nickname as operator_nickname,
  u.username as operator_username,
  sm.source,
  sm.remark,
  sm.is_void,
  sm.void_reason,
  sm.created_at
from public.stock_movements sm
left join public.products p on p.id = sm.product_id
left join public.warehouses w on w.id = sm.warehouse_id
left join public.app_users u on u.id = sm.operator_user_id;

commit;

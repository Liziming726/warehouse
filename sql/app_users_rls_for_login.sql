-- WARNING:
-- This policy allows anon/authenticated roles to read app_users rows.
-- It is convenient for quick login debugging but is NOT safe for production.

alter table public.app_users enable row level security;

drop policy if exists "app_users_select_for_login_anon" on public.app_users;
create policy "app_users_select_for_login_anon"
on public.app_users
for select
to anon, authenticated
using (true);

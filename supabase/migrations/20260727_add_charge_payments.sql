-- Persist calendar paid/unpaid marks per user, subscription and charge date.
create table if not exists public.charge_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subscription_id text not null,
  charge_date date not null,
  is_paid boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, subscription_id, charge_date)
);

alter table public.charge_payments enable row level security;

drop policy if exists "Users can read own charge payments" on public.charge_payments;
drop policy if exists "Users can insert own charge payments" on public.charge_payments;
drop policy if exists "Users can update own charge payments" on public.charge_payments;
drop policy if exists "Users can delete own charge payments" on public.charge_payments;

create policy "Users can read own charge payments"
on public.charge_payments
for select
using (auth.uid() = user_id);

create policy "Users can insert own charge payments"
on public.charge_payments
for insert
with check (auth.uid() = user_id);

create policy "Users can update own charge payments"
on public.charge_payments
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete own charge payments"
on public.charge_payments
for delete
using (auth.uid() = user_id);

create index if not exists idx_charge_payments_user_date
on public.charge_payments(user_id, charge_date);

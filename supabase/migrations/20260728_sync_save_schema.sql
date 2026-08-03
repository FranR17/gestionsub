-- Keep the remote database compatible with the current save flow.
-- Safe to run more than once: columns are added conditionally and constraints are recreated.

alter table public.subscriptions
  add column if not exists payment_end_date date,
  add column if not exists reminder_time text not null default '09:00',
  add column if not exists icon_key text default null,
  add column if not exists custom_logo_url text default null,
  add column if not exists is_financed boolean not null default false,
  add column if not exists financing_provider_name text,
  add column if not exists financing_provider_logo_url text,
  add column if not exists anulado smallint not null default 0;

alter table public.subscriptions
  alter column reminder_time set default '09:00',
  alter column is_financed set default false,
  alter column anulado set default 0;

alter table public.subscriptions
  drop constraint if exists subscriptions_reminder_days_check,
  add constraint subscriptions_reminder_days_check check (reminder_days between 0 and 30);

alter table public.subscriptions
  drop constraint if exists subscriptions_anulado_check,
  add constraint subscriptions_anulado_check check (anulado in (0, 1));

alter table public.group_expenses
  add column if not exists anulado smallint not null default 0;

alter table public.group_expenses
  alter column anulado set default 0;

alter table public.group_expenses
  drop constraint if exists group_expenses_anulado_check,
  add constraint group_expenses_anulado_check check (anulado in (0, 1));

create or replace function public.is_expense_visible(p_expense_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.group_expenses ge
    where ge.id = p_expense_id
      and ge.anulado = 0
      and public.is_group_member(ge.group_id)
  );
$$;

create or replace function public.is_expense_admin_writable(p_expense_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.group_expenses ge
    where ge.id = p_expense_id
      and ge.anulado = 0
      and public.is_group_admin_or_owner(ge.group_id)
  );
$$;

create or replace function public.is_charge_visible(p_charge_instance_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.expense_charge_instances eci
    join public.group_expenses ge on ge.id = eci.expense_id
    where eci.id = p_charge_instance_id
      and ge.anulado = 0
      and public.is_group_member(ge.group_id)
  );
$$;

create or replace function public.is_charge_admin_writable(p_charge_instance_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.expense_charge_instances eci
    join public.group_expenses ge on ge.id = eci.expense_id
    where eci.id = p_charge_instance_id
      and ge.anulado = 0
      and public.is_group_admin_or_owner(ge.group_id)
  );
$$;

drop policy if exists "Members can read group expenses" on public.group_expenses;

create policy "Members can read group expenses"
on public.group_expenses
for select
using (public.is_group_member(group_id) and anulado = 0);

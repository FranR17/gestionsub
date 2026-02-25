-- Add soft-delete column (anulado) to subscriptions
-- 0 = active record, 1 = soft-deleted (annulled)
alter table public.subscriptions
  add column if not exists anulado smallint not null default 0
  check (anulado in (0, 1));

-- Add same column to group_expenses
alter table public.group_expenses
  add column if not exists anulado smallint not null default 0
  check (anulado in (0, 1));

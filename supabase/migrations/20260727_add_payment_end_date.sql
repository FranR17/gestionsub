-- Optional last charge date for subscriptions and group expenses.
alter table public.subscriptions
  add column if not exists payment_end_date date;

alter table public.group_expenses
  add column if not exists payment_end_date date;

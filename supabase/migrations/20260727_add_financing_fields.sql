-- Optional financing metadata for subscriptions and group expenses.
alter table public.subscriptions
  add column if not exists is_financed boolean not null default false,
  add column if not exists financing_provider_name text,
  add column if not exists financing_provider_logo_url text;

alter table public.group_expenses
  add column if not exists is_financed boolean not null default false,
  add column if not exists financing_provider_name text,
  add column if not exists financing_provider_logo_url text;

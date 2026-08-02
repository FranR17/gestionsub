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

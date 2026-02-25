-- Add icon_key and custom_logo_url columns to subscriptions
-- These store the user-selected Lucide icon key and custom logo URL

alter table public.subscriptions
  add column if not exists icon_key text default null,
  add column if not exists custom_logo_url text default null;

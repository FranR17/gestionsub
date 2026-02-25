-- Allow group co-members to read each other's profiles
-- (needed for displaying display_name/avatar in group views)
drop policy if exists "Group members can read co-member profiles" on public.profiles;

create policy "Group members can read co-member profiles"
on public.profiles
for select
using (
  auth.uid() = id
  or exists (
    select 1
    from public.group_members my_membership
    join public.group_members their_membership
      on their_membership.group_id = my_membership.group_id
      and their_membership.user_id = profiles.id
      and their_membership.status = 'active'
    where my_membership.user_id = auth.uid()
      and my_membership.status = 'active'
  )
);

-- Drop the old single-user policy (now covered by the combined policy above)
drop policy if exists "Users can read own profile" on public.profiles;

-- Add missing index on subscriptions for the primary query pattern
create index if not exists idx_subscriptions_user_charge
  on public.subscriptions(user_id, next_charge_date);

-- Auto-update updated_at on groups
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_groups_updated_at on public.groups;
create trigger trg_groups_updated_at
  before update on public.groups
  for each row execute function public.set_updated_at();

drop trigger if exists trg_group_expenses_updated_at on public.group_expenses;
create trigger trg_group_expenses_updated_at
  before update on public.group_expenses
  for each row execute function public.set_updated_at();

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

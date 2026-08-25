create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  amount numeric(12,2) not null check (amount >= 0),
  frequency text not null check (frequency in ('semanal','mensual','trimestral','anual')),
  next_charge_date date not null,
  payment_end_date date,
  category text not null,
  reminder_days int not null check (reminder_days between 0 and 30),
  reminder_time text not null default '09:00',
  status text not null check (status in ('activa','cancelada')),
  icon_key text,
  custom_logo_url text,
  is_financed boolean not null default false,
  financing_provider_name text,
  financing_provider_logo_url text,
  anulado smallint not null default 0 check (anulado in (0, 1)),
  created_at timestamptz not null default now()
);

alter table public.subscriptions enable row level security;

drop policy if exists "Users can read own subscriptions" on public.subscriptions;
drop policy if exists "Users can insert own subscriptions" on public.subscriptions;
drop policy if exists "Users can update own subscriptions" on public.subscriptions;
drop policy if exists "Users can delete own subscriptions" on public.subscriptions;

create policy "Users can read own subscriptions"
on public.subscriptions
for select
using (auth.uid() = user_id);

create policy "Users can insert own subscriptions"
on public.subscriptions
for insert
with check (auth.uid() = user_id);

create policy "Users can update own subscriptions"
on public.subscriptions
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete own subscriptions"
on public.subscriptions
for delete
using (auth.uid() = user_id);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "Users can read own profile" on public.profiles;
drop policy if exists "Group members can read co-member profiles" on public.profiles;
drop policy if exists "Users can insert own profile" on public.profiles;
drop policy if exists "Users can update own profile" on public.profiles;

create policy "Users can read own profile"
on public.profiles
for select
using (auth.uid() = id);

create policy "Users can insert own profile"
on public.profiles
for insert
with check (auth.uid() = id);

create policy "Users can update own profile"
on public.profiles
for update
using (auth.uid() = id)
with check (auth.uid() = id);

create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.group_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner','admin','member')),
  status text not null check (status in ('invited','active','left')),
  invited_at timestamptz,
  joined_at timestamptz,
  created_at timestamptz not null default now(),
  unique (group_id, user_id)
);

create table if not exists public.group_invites (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  invited_by_user_id uuid not null references auth.users(id) on delete cascade,
  invitee_email text not null,
  token text not null unique,
  status text not null check (status in ('pending','accepted','expired','revoked')),
  expires_at timestamptz not null,
  accepted_at timestamptz,
  accepted_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.group_expenses (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  name text not null,
  amount numeric(12,2) not null check (amount >= 0),
  frequency text not null check (frequency in ('puntual','semanal','mensual','trimestral','anual')),
  next_charge_date date not null,
  payment_end_date date,
  payer_member_id uuid not null references public.group_members(id) on delete restrict,
  is_active boolean not null default true,
  anulado smallint not null default 0 check (anulado in (0, 1)),
  is_financed boolean not null default false,
  financing_provider_name text,
  financing_provider_logo_url text,
  created_by_user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.group_expense_participants (
  id uuid primary key default gen_random_uuid(),
  expense_id uuid not null references public.group_expenses(id) on delete cascade,
  member_id uuid not null references public.group_members(id) on delete cascade,
  share_type text not null default 'equal' check (share_type in ('equal','percent','fixed')),
  share_value numeric(12,4),
  created_at timestamptz not null default now(),
  unique (expense_id, member_id)
);

create table if not exists public.expense_charge_instances (
  id uuid primary key default gen_random_uuid(),
  expense_id uuid not null references public.group_expenses(id) on delete cascade,
  charge_date date not null,
  amount_total numeric(12,2) not null check (amount_total >= 0),
  payer_member_id uuid not null references public.group_members(id) on delete restrict,
  status text not null default 'pending' check (status in ('pending','paid','skipped')),
  created_at timestamptz not null default now(),
  unique (expense_id, charge_date)
);

create table if not exists public.expense_charge_shares (
  id uuid primary key default gen_random_uuid(),
  charge_instance_id uuid not null references public.expense_charge_instances(id) on delete cascade,
  member_id uuid not null references public.group_members(id) on delete cascade,
  owed_amount numeric(12,2) not null check (owed_amount >= 0),
  created_at timestamptz not null default now(),
  unique (charge_instance_id, member_id)
);

create index if not exists idx_group_members_group_status on public.group_members(group_id, status);
create index if not exists idx_group_members_user_status on public.group_members(user_id, status);
create index if not exists idx_group_expenses_group on public.group_expenses(group_id);
create index if not exists idx_group_invites_group_status on public.group_invites(group_id, status);
create index if not exists idx_group_invites_email_status on public.group_invites(lower(invitee_email), status);
create index if not exists idx_charge_instances_date on public.expense_charge_instances(charge_date);
create index if not exists idx_charge_shares_member on public.expense_charge_shares(member_id);

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

drop policy if exists "Users can read own profile" on public.profiles;
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

create index if not exists idx_subscriptions_user_charge
on public.subscriptions(user_id, next_charge_date);

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

create or replace function public.is_group_member(p_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.group_members gm
    where gm.group_id = p_group_id
      and gm.user_id = auth.uid()
      and gm.status = 'active'
  );
$$;

create or replace function public.is_group_admin_or_owner(p_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.groups g
    where g.id = p_group_id
      and g.owner_user_id = auth.uid()
  )
  or exists (
    select 1
    from public.group_members gm
    where gm.group_id = p_group_id
      and gm.user_id = auth.uid()
      and gm.status = 'active'
      and gm.role in ('owner','admin')
  );
$$;

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

create or replace function public.is_expense_member_writable(p_expense_id uuid)
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
      and public.is_group_member(ge.group_id)
  );
$$;

create or replace function public.is_member_in_group(p_member_id uuid, p_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.group_members gm
    where gm.id = p_member_id
      and gm.group_id = p_group_id
      and gm.status = 'active'
  );
$$;

create or replace function public.is_member_in_expense_group(p_member_id uuid, p_expense_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.group_expenses ge
    join public.group_members gm
      on gm.group_id = ge.group_id
     and gm.id = p_member_id
     and gm.status = 'active'
    where ge.id = p_expense_id
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

create or replace function public.is_charge_member_writable(p_charge_instance_id uuid)
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
      and public.is_group_member(ge.group_id)
  );
$$;

create or replace function public.is_member_in_charge_group(p_member_id uuid, p_charge_instance_id uuid)
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
    join public.group_members gm
      on gm.group_id = ge.group_id
     and gm.id = p_member_id
     and gm.status = 'active'
    where eci.id = p_charge_instance_id
  );
$$;

grant execute on function public.is_group_member(uuid) to authenticated;
grant execute on function public.is_group_admin_or_owner(uuid) to authenticated;
grant execute on function public.is_expense_visible(uuid) to authenticated;
grant execute on function public.is_expense_admin_writable(uuid) to authenticated;
grant execute on function public.is_expense_member_writable(uuid) to authenticated;
grant execute on function public.is_member_in_group(uuid, uuid) to authenticated;
grant execute on function public.is_member_in_expense_group(uuid, uuid) to authenticated;
grant execute on function public.is_charge_visible(uuid) to authenticated;
grant execute on function public.is_charge_admin_writable(uuid) to authenticated;
grant execute on function public.is_charge_member_writable(uuid) to authenticated;
grant execute on function public.is_member_in_charge_group(uuid, uuid) to authenticated;

create or replace function public.accept_group_invite(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite record;
  v_uid uuid := auth.uid();
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'reason', 'unauthenticated');
  end if;

  if v_email = '' then
    return jsonb_build_object('ok', false, 'reason', 'missing_email');
  end if;

  select *
  into v_invite
  from public.group_invites
  where token = p_token
    and status = 'pending'
    and lower(invitee_email) = v_email
    and expires_at > now()
  for update;

  if not found then
    select *
    into v_invite
    from public.group_invites
    where token = p_token
      and status = 'accepted'
      and lower(invitee_email) = v_email
      and accepted_by_user_id = v_uid;

    if found then
      return jsonb_build_object('ok', true, 'group_id', v_invite.group_id, 'already_member', true);
    end if;

    return jsonb_build_object('ok', false, 'reason', 'invite_not_found_or_expired');
  end if;

  insert into public.group_members (group_id, user_id, role, status, joined_at)
  values (v_invite.group_id, v_uid, 'member', 'active', now())
  on conflict (group_id, user_id)
  do update set status = 'active', joined_at = now();

  update public.group_invites
  set status = 'accepted', accepted_at = now(), accepted_by_user_id = v_uid
  where id = v_invite.id;

  return jsonb_build_object('ok', true, 'group_id', v_invite.group_id);
end;
$$;

create or replace function public.accept_group_invite_by_id(p_invite_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite record;
  v_uid uuid := auth.uid();
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'reason', 'unauthenticated');
  end if;

  if v_email = '' then
    return jsonb_build_object('ok', false, 'reason', 'missing_email');
  end if;

  select *
  into v_invite
  from public.group_invites
  where id = p_invite_id
    and status = 'pending'
    and lower(invitee_email) = v_email
    and expires_at > now()
  for update;

  if not found then
    select *
    into v_invite
    from public.group_invites
    where id = p_invite_id
      and status = 'accepted'
      and lower(invitee_email) = v_email
      and accepted_by_user_id = v_uid;

    if found then
      return jsonb_build_object('ok', true, 'group_id', v_invite.group_id, 'already_member', true);
    end if;

    return jsonb_build_object('ok', false, 'reason', 'invite_not_found_or_expired');
  end if;

  insert into public.group_members (group_id, user_id, role, status, joined_at)
  values (v_invite.group_id, v_uid, 'member', 'active', now())
  on conflict (group_id, user_id)
  do update set status = 'active', joined_at = now();

  update public.group_invites
  set status = 'accepted', accepted_at = now(), accepted_by_user_id = v_uid
  where id = v_invite.id;

  return jsonb_build_object('ok', true, 'group_id', v_invite.group_id);
end;
$$;

grant execute on function public.accept_group_invite(text) to authenticated;
grant execute on function public.accept_group_invite_by_id(uuid) to authenticated;

create or replace function public.rename_group(p_group_id uuid, p_name text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text := btrim(coalesce(p_name, ''));
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'reason', 'unauthenticated');
  end if;

  if v_name = '' then
    return jsonb_build_object('ok', false, 'reason', 'empty_name');
  end if;

  if length(v_name) > 80 then
    return jsonb_build_object('ok', false, 'reason', 'name_too_long');
  end if;

  if not public.is_group_member(p_group_id) then
    return jsonb_build_object('ok', false, 'reason', 'not_group_member');
  end if;

  update public.groups
     set name = v_name
   where id = p_group_id;

  return jsonb_build_object('ok', true, 'group_id', p_group_id, 'name', v_name);
end;
$$;

grant execute on function public.rename_group(uuid, text) to authenticated;

create or replace function public.delete_own_account()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from auth.users where id = auth.uid();
$$;

revoke execute on function public.delete_own_account() from anon;
grant execute on function public.delete_own_account() to authenticated;

alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.group_invites enable row level security;
alter table public.group_expenses enable row level security;
alter table public.group_expense_participants enable row level security;
alter table public.expense_charge_instances enable row level security;
alter table public.expense_charge_shares enable row level security;

drop policy if exists "Members can read own groups" on public.groups;
drop policy if exists "Users can create groups" on public.groups;
drop policy if exists "Admins can update groups" on public.groups;
drop policy if exists "Admins can delete groups" on public.groups;

drop policy if exists "Members can read members in their groups" on public.group_members;
drop policy if exists "Admins can insert members" on public.group_members;
drop policy if exists "Admins can update members" on public.group_members;
drop policy if exists "Members can leave their own membership" on public.group_members;
drop policy if exists "Admins can delete members" on public.group_members;

drop policy if exists "Admins and invitees can read invites" on public.group_invites;
drop policy if exists "Admins can create invites" on public.group_invites;
drop policy if exists "Admins and invitees can update invites" on public.group_invites;
drop policy if exists "Admins can delete invites" on public.group_invites;

drop policy if exists "Members can read group expenses" on public.group_expenses;
drop policy if exists "Admins can insert group expenses" on public.group_expenses;
drop policy if exists "Admins can update group expenses" on public.group_expenses;
drop policy if exists "Admins can delete group expenses" on public.group_expenses;
drop policy if exists "Members can insert group expenses" on public.group_expenses;
drop policy if exists "Members can update group expenses" on public.group_expenses;
drop policy if exists "Members can delete group expenses" on public.group_expenses;

drop policy if exists "Members can read expense participants" on public.group_expense_participants;
drop policy if exists "Admins can insert expense participants" on public.group_expense_participants;
drop policy if exists "Admins can update expense participants" on public.group_expense_participants;
drop policy if exists "Admins can delete expense participants" on public.group_expense_participants;
drop policy if exists "Members can insert expense participants" on public.group_expense_participants;
drop policy if exists "Members can update expense participants" on public.group_expense_participants;
drop policy if exists "Members can delete expense participants" on public.group_expense_participants;

drop policy if exists "Members can read charge instances" on public.expense_charge_instances;
drop policy if exists "Admins can insert charge instances" on public.expense_charge_instances;
drop policy if exists "Admins can update charge instances" on public.expense_charge_instances;
drop policy if exists "Admins can delete charge instances" on public.expense_charge_instances;
drop policy if exists "Members can insert charge instances" on public.expense_charge_instances;
drop policy if exists "Members can update charge instances" on public.expense_charge_instances;
drop policy if exists "Members can delete charge instances" on public.expense_charge_instances;

drop policy if exists "Members can read charge shares" on public.expense_charge_shares;
drop policy if exists "Admins can insert charge shares" on public.expense_charge_shares;
drop policy if exists "Admins can update charge shares" on public.expense_charge_shares;
drop policy if exists "Admins can delete charge shares" on public.expense_charge_shares;
drop policy if exists "Members can insert charge shares" on public.expense_charge_shares;
drop policy if exists "Members can update charge shares" on public.expense_charge_shares;
drop policy if exists "Members can delete charge shares" on public.expense_charge_shares;

create policy "Members can read own groups"
on public.groups
for select
using (
  owner_user_id = auth.uid()
  or public.is_group_member(id)
);

create policy "Users can create groups"
on public.groups
for insert
with check (auth.uid() = owner_user_id);

create policy "Admins can update groups"
on public.groups
for update
using (public.is_group_admin_or_owner(id))
with check (public.is_group_admin_or_owner(id));

create policy "Admins can delete groups"
on public.groups
for delete
using (public.is_group_admin_or_owner(id));

create policy "Members can read members in their groups"
on public.group_members
for select
using (public.is_group_member(group_id));

create policy "Admins can insert members"
on public.group_members
for insert
with check (
  public.is_group_admin_or_owner(group_id)
  or (
    auth.uid() = user_id
    and exists (
      select 1
      from public.groups g
      where g.id = group_id
        and g.owner_user_id = auth.uid()
    )
  )
  or (
    auth.uid() = user_id
    and exists (
      select 1
      from public.group_invites gi
      where gi.group_id = group_id
        and gi.status = 'pending'
        and lower(gi.invitee_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
        and gi.expires_at > now()
    )
  )
);

create policy "Admins can update members"
on public.group_members
for update
using (public.is_group_admin_or_owner(group_id))
with check (public.is_group_admin_or_owner(group_id));

create policy "Members can leave their own membership"
on public.group_members
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Admins can delete members"
on public.group_members
for delete
using (public.is_group_admin_or_owner(group_id));

create policy "Admins and invitees can read invites"
on public.group_invites
for select
using (
  public.is_group_admin_or_owner(group_id)
  or lower(invitee_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
);

create policy "Admins can create invites"
on public.group_invites
for insert
with check (
  public.is_group_admin_or_owner(group_id)
  and auth.uid() = invited_by_user_id
);

create policy "Admins and invitees can update invites"
on public.group_invites
for update
using (
  public.is_group_admin_or_owner(group_id)
  or lower(invitee_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
)
with check (
  public.is_group_admin_or_owner(group_id)
  or lower(invitee_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
);

create policy "Admins can delete invites"
on public.group_invites
for delete
using (public.is_group_admin_or_owner(group_id));

create policy "Members can read group expenses"
on public.group_expenses
for select
using (public.is_group_member(group_id) and anulado = 0);

create policy "Members can insert group expenses"
on public.group_expenses
for insert
with check (
  public.is_group_member(group_id)
  and auth.uid() = created_by_user_id
  and public.is_member_in_group(payer_member_id, group_id)
);

create policy "Members can update group expenses"
on public.group_expenses
for update
using (public.is_group_member(group_id))
with check (
  public.is_group_member(group_id)
  and public.is_member_in_group(payer_member_id, group_id)
);

create policy "Members can delete group expenses"
on public.group_expenses
for delete
using (public.is_group_member(group_id));

create policy "Members can read expense participants"
on public.group_expense_participants
for select
using (public.is_expense_visible(expense_id));

create policy "Members can insert expense participants"
on public.group_expense_participants
for insert
with check (
  public.is_expense_member_writable(expense_id)
  and public.is_member_in_expense_group(member_id, expense_id)
);

create policy "Members can update expense participants"
on public.group_expense_participants
for update
using (public.is_expense_member_writable(expense_id))
with check (
  public.is_expense_member_writable(expense_id)
  and public.is_member_in_expense_group(member_id, expense_id)
);

create policy "Members can delete expense participants"
on public.group_expense_participants
for delete
using (public.is_expense_member_writable(expense_id));

create policy "Members can read charge instances"
on public.expense_charge_instances
for select
using (public.is_expense_visible(expense_id));

create policy "Members can insert charge instances"
on public.expense_charge_instances
for insert
with check (
  public.is_expense_member_writable(expense_id)
  and public.is_member_in_expense_group(payer_member_id, expense_id)
);

create policy "Members can update charge instances"
on public.expense_charge_instances
for update
using (public.is_expense_member_writable(expense_id))
with check (
  public.is_expense_member_writable(expense_id)
  and public.is_member_in_expense_group(payer_member_id, expense_id)
);

create policy "Members can delete charge instances"
on public.expense_charge_instances
for delete
using (public.is_expense_member_writable(expense_id));

create policy "Members can read charge shares"
on public.expense_charge_shares
for select
using (public.is_charge_visible(charge_instance_id));

create policy "Members can insert charge shares"
on public.expense_charge_shares
for insert
with check (
  public.is_charge_member_writable(charge_instance_id)
  and public.is_member_in_charge_group(member_id, charge_instance_id)
);

create policy "Members can update charge shares"
on public.expense_charge_shares
for update
using (public.is_charge_member_writable(charge_instance_id))
with check (
  public.is_charge_member_writable(charge_instance_id)
  and public.is_member_in_charge_group(member_id, charge_instance_id)
);

create policy "Members can delete charge shares"
on public.expense_charge_shares
for delete
using (public.is_charge_member_writable(charge_instance_id));

create or replace function public.ensure_group_charge_instances(
  p_group_id uuid,
  p_year int,
  p_month int
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_period_start date;
  v_period_end date;
  v_exp record;
  v_charge_date date;
  v_charge_instance_id uuid;
  v_generated int := 0;
  v_amount_cents int;
  v_base_cents int;
  v_remainder_cents int;
  v_owed numeric(12,2);
  v_participant record;
begin
  if p_year not between 1 and 9999 or p_month not between 1 and 12 then
    return jsonb_build_object('ok', false, 'reason', 'invalid_period');
  end if;

  if not public.is_group_member(p_group_id) then
    return jsonb_build_object('ok', false, 'reason', 'not_member');
  end if;

  if exists (
    select 1 from public.group_settlements
    where group_id = p_group_id and year = p_year and month = p_month
  ) then
    return jsonb_build_object('ok', true, 'generated', 0, 'settled', true);
  end if;

  v_period_start := make_date(p_year, p_month, 1);
  v_period_end := (v_period_start + interval '1 month')::date;

  for v_exp in
    select id, amount, frequency, next_charge_date, payment_end_date, payer_member_id
    from public.group_expenses
    where group_id = p_group_id
      and anulado = 0
      and is_active = true
      and next_charge_date < v_period_end
      and (payment_end_date is null or payment_end_date >= v_period_start)
  loop
    v_charge_date := v_exp.next_charge_date;

    while v_charge_date < v_period_start loop
      v_charge_date := case v_exp.frequency
        when 'semanal' then (v_charge_date + interval '7 days')::date
        when 'mensual' then (v_charge_date + interval '1 month')::date
        when 'trimestral' then (v_charge_date + interval '3 months')::date
        when 'anual' then (v_charge_date + interval '1 year')::date
        else v_period_end
      end;
    end loop;

    while v_charge_date < v_period_end loop
      if v_charge_date >= v_exp.next_charge_date
         and (v_exp.payment_end_date is null or v_charge_date <= v_exp.payment_end_date) then
        insert into public.expense_charge_instances (expense_id, charge_date, amount_total, payer_member_id, status)
        values (v_exp.id, v_charge_date, v_exp.amount, v_exp.payer_member_id, 'pending')
        on conflict (expense_id, charge_date)
        do update set amount_total = excluded.amount_total, payer_member_id = excluded.payer_member_id
        returning id into v_charge_instance_id;

        delete from public.expense_charge_shares where charge_instance_id = v_charge_instance_id;

        v_amount_cents := round(v_exp.amount * 100)::int;

        for v_participant in
          select gep.member_id, gep.share_type, coalesce(gep.share_value, 0) as share_value,
                 row_number() over (order by gep.created_at, gep.id) as rn,
                 count(*) over () as participant_count
          from public.group_expense_participants gep
          join public.group_members gm on gm.id = gep.member_id and gm.status = 'active'
          where gep.expense_id = v_exp.id
        loop
          if v_participant.share_type = 'fixed' then
            v_owed := round(v_participant.share_value, 2);
          elsif v_participant.share_type = 'percent' then
            v_owed := round((v_exp.amount * v_participant.share_value / 100), 2);
          else
            v_base_cents := floor(v_amount_cents::numeric / v_participant.participant_count)::int;
            v_remainder_cents := v_amount_cents - (v_base_cents * v_participant.participant_count);
            v_owed := (v_base_cents + case when v_participant.rn <= v_remainder_cents then 1 else 0 end) / 100.0;
          end if;

          insert into public.expense_charge_shares (charge_instance_id, member_id, owed_amount)
          values (v_charge_instance_id, v_participant.member_id, greatest(v_owed, 0));
        end loop;

        v_generated := v_generated + 1;
      end if;

      exit when v_exp.frequency = 'puntual';

      v_charge_date := case v_exp.frequency
        when 'semanal' then (v_charge_date + interval '7 days')::date
        when 'mensual' then (v_charge_date + interval '1 month')::date
        when 'trimestral' then (v_charge_date + interval '3 months')::date
        when 'anual' then (v_charge_date + interval '1 year')::date
        else v_period_end
      end;
    end loop;
  end loop;

  return jsonb_build_object('ok', true, 'generated', v_generated);
end;
$$;

revoke all on function public.ensure_group_charge_instances(uuid, int, int) from public, anon;
grant execute on function public.ensure_group_charge_instances(uuid, int, int) to authenticated;

create or replace function public.get_group_monthly_balances(
  p_group_id uuid,
  p_year int,
  p_month int
)
returns table (
  member_id uuid,
  member_name text,
  paid_total numeric,
  owed_total numeric,
  net_total numeric
)
language sql
stable
security definer
set search_path = public
as $$
  with period as (
    select make_date(p_year, p_month, 1) as start_date,
           (make_date(p_year, p_month, 1) + interval '1 month')::date as end_date
  ),
  scoped_members as (
    select gm.id as member_id,
           coalesce(nullif(p.display_name, ''), split_part(u.email, '@', 1), 'Miembro') as member_name
    from public.group_members gm
    left join public.profiles p on p.id = gm.user_id
    left join auth.users u on u.id = gm.user_id
    where gm.group_id = p_group_id
      and gm.status = 'active'
  ),
  charges_in_month as (
    select eci.id,
           eci.amount_total,
           eci.payer_member_id
    from public.expense_charge_instances eci
    join public.group_expenses ge on ge.id = eci.expense_id
    join period p on true
    where ge.group_id = p_group_id
      and ge.anulado = 0
      and eci.charge_date >= p.start_date
      and eci.charge_date < p.end_date
      and eci.status <> 'skipped'
  ),
  paid_by_member as (
    select payer_member_id as member_id,
           sum(amount_total)::numeric as paid_total
    from charges_in_month
    group by payer_member_id
  ),
  owed_by_member as (
    select ecs.member_id,
           sum(ecs.owed_amount)::numeric as owed_total
    from public.expense_charge_shares ecs
    join charges_in_month cim on cim.id = ecs.charge_instance_id
    group by ecs.member_id
  )
  select sm.member_id,
         sm.member_name,
         coalesce(pbm.paid_total, 0)::numeric(12,2) as paid_total,
         coalesce(obm.owed_total, 0)::numeric(12,2) as owed_total,
         (coalesce(pbm.paid_total, 0) - coalesce(obm.owed_total, 0))::numeric(12,2) as net_total
  from scoped_members sm
  left join paid_by_member pbm on pbm.member_id = sm.member_id
  left join owed_by_member obm on obm.member_id = sm.member_id
  where public.is_group_member(p_group_id)
  order by net_total desc, member_name asc;
$$;

grant execute on function public.get_group_monthly_balances(uuid, int, int) to authenticated;

create table if not exists public.group_settlements (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  year int not null,
  month int not null check (month between 1 and 12),
  settled_by uuid not null references auth.users(id),
  settled_at timestamptz not null default now(),
  notes text default '',
  balance_snapshot jsonb not null default '[]'::jsonb,
  transfers jsonb not null default '[]'::jsonb,
  unique (group_id, year, month)
);

alter table public.group_settlements enable row level security;

drop policy if exists "Members can read own group settlements" on public.group_settlements;
drop policy if exists "Admins/owners can insert settlements" on public.group_settlements;
drop policy if exists "Members can insert settlements" on public.group_settlements;

create policy "Members can read own group settlements"
on public.group_settlements
for select
using (public.is_group_member(group_id));

create policy "Members can insert settlements"
on public.group_settlements
for insert
with check (public.is_group_member(group_id));

create or replace function public.settle_group_month(
  p_group_id uuid,
  p_year int,
  p_month int,
  p_notes text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_balances jsonb;
  v_transfers jsonb;
  v_debtors jsonb[];
  v_creditors jsonb[];
  v_d jsonb;
  v_c jsonb;
  v_d_amt numeric;
  v_c_amt numeric;
  v_pay numeric;
  v_result jsonb := '[]'::jsonb;
begin
  if not public.is_group_member(p_group_id) then
    return jsonb_build_object('ok', false, 'reason', 'not_member');
  end if;

  if exists (
    select 1
    from public.group_settlements
    where group_id = p_group_id
      and year = p_year
      and month = p_month
  ) then
    return jsonb_build_object('ok', false, 'reason', 'already_settled');
  end if;

  select jsonb_agg(
    jsonb_build_object(
      'member_id', b.member_id,
      'member_name', b.member_name,
      'paid_total', b.paid_total,
      'owed_total', b.owed_total,
      'net_total', b.net_total
    )
  )
  into v_balances
  from public.get_group_monthly_balances(p_group_id, p_year, p_month) b;

  if v_balances is null then
    v_balances := '[]'::jsonb;
  end if;

  select array_agg(jsonb_build_object('id', b.member_id, 'name', b.member_name, 'amt', abs(b.net_total)))
  into v_debtors
  from public.get_group_monthly_balances(p_group_id, p_year, p_month) b
  where b.net_total < -0.009;

  select array_agg(jsonb_build_object('id', b.member_id, 'name', b.member_name, 'amt', b.net_total))
  into v_creditors
  from public.get_group_monthly_balances(p_group_id, p_year, p_month) b
  where b.net_total > 0.009;

  if v_debtors is not null and v_creditors is not null then
    declare
      di int := 1;
      ci int := 1;
    begin
      while di <= array_length(v_debtors, 1) and ci <= array_length(v_creditors, 1) loop
        v_d := v_debtors[di];
        v_c := v_creditors[ci];
        v_d_amt := (v_d->>'amt')::numeric;
        v_c_amt := (v_c->>'amt')::numeric;
        v_pay := least(v_d_amt, v_c_amt);

        if v_pay > 0.009 then
          v_result := v_result || jsonb_build_object(
            'from_member_id', v_d->>'id',
            'from_name', v_d->>'name',
            'to_member_id', v_c->>'id',
            'to_name', v_c->>'name',
            'amount', round(v_pay, 2)
          );
        end if;

        v_d_amt := v_d_amt - v_pay;
        v_c_amt := v_c_amt - v_pay;
        v_debtors[di] := jsonb_set(v_d, '{amt}', to_jsonb(v_d_amt));
        v_creditors[ci] := jsonb_set(v_c, '{amt}', to_jsonb(v_c_amt));

        if v_d_amt < 0.01 then di := di + 1; end if;
        if v_c_amt < 0.01 then ci := ci + 1; end if;
      end loop;
    end;
  end if;

  v_transfers := v_result;

  insert into public.group_settlements (group_id, year, month, settled_by, balance_snapshot, transfers, notes)
  values (p_group_id, p_year, p_month, v_uid, v_balances, v_transfers, coalesce(p_notes, ''));

  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.get_group_settlement(
  p_group_id uuid,
  p_year int,
  p_month int
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select jsonb_build_object(
        'settled', true,
        'settled_at', s.settled_at,
        'settled_by', s.settled_by,
        'balance_snapshot', s.balance_snapshot,
        'transfers', s.transfers,
        'notes', s.notes
      )
      from public.group_settlements s
      where s.group_id = p_group_id
        and s.year = p_year
        and s.month = p_month
        and public.is_group_member(p_group_id)
    ),
    jsonb_build_object('settled', false)
  );
$$;

grant execute on function public.settle_group_month(uuid, int, int, text) to authenticated;
grant execute on function public.get_group_settlement(uuid, int, int) to authenticated;

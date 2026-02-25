create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  amount numeric(12,2) not null check (amount >= 0),
  frequency text not null check (frequency in ('semanal','mensual','trimestral','anual')),
  next_charge_date date not null,
  category text not null,
  reminder_days int not null check (reminder_days in (1,3,7)),
  status text not null check (status in ('activa','cancelada')),
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
  frequency text not null check (frequency in ('puntual','semanal','mensual','anual')),
  next_charge_date date not null,
  payer_member_id uuid not null references public.group_members(id) on delete restrict,
  is_active boolean not null default true,
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
      and public.is_group_admin_or_owner(ge.group_id)
  );
$$;

grant execute on function public.is_group_member(uuid) to authenticated;
grant execute on function public.is_group_admin_or_owner(uuid) to authenticated;
grant execute on function public.is_expense_visible(uuid) to authenticated;
grant execute on function public.is_expense_admin_writable(uuid) to authenticated;
grant execute on function public.is_charge_visible(uuid) to authenticated;
grant execute on function public.is_charge_admin_writable(uuid) to authenticated;

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

drop policy if exists "Members can read expense participants" on public.group_expense_participants;
drop policy if exists "Admins can insert expense participants" on public.group_expense_participants;
drop policy if exists "Admins can update expense participants" on public.group_expense_participants;
drop policy if exists "Admins can delete expense participants" on public.group_expense_participants;

drop policy if exists "Members can read charge instances" on public.expense_charge_instances;
drop policy if exists "Admins can insert charge instances" on public.expense_charge_instances;
drop policy if exists "Admins can update charge instances" on public.expense_charge_instances;
drop policy if exists "Admins can delete charge instances" on public.expense_charge_instances;

drop policy if exists "Members can read charge shares" on public.expense_charge_shares;
drop policy if exists "Admins can insert charge shares" on public.expense_charge_shares;
drop policy if exists "Admins can update charge shares" on public.expense_charge_shares;
drop policy if exists "Admins can delete charge shares" on public.expense_charge_shares;

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
using (public.is_group_member(group_id));

create policy "Admins can insert group expenses"
on public.group_expenses
for insert
with check (
  public.is_group_admin_or_owner(group_id)
  and auth.uid() = created_by_user_id
);

create policy "Admins can update group expenses"
on public.group_expenses
for update
using (public.is_group_admin_or_owner(group_id))
with check (public.is_group_admin_or_owner(group_id));

create policy "Admins can delete group expenses"
on public.group_expenses
for delete
using (public.is_group_admin_or_owner(group_id));

create policy "Members can read expense participants"
on public.group_expense_participants
for select
using (public.is_expense_visible(expense_id));

create policy "Admins can insert expense participants"
on public.group_expense_participants
for insert
with check (public.is_expense_admin_writable(expense_id));

create policy "Admins can update expense participants"
on public.group_expense_participants
for update
using (public.is_expense_admin_writable(expense_id))
with check (public.is_expense_admin_writable(expense_id));

create policy "Admins can delete expense participants"
on public.group_expense_participants
for delete
using (public.is_expense_admin_writable(expense_id));

create policy "Members can read charge instances"
on public.expense_charge_instances
for select
using (public.is_expense_visible(expense_id));

create policy "Admins can insert charge instances"
on public.expense_charge_instances
for insert
with check (public.is_expense_admin_writable(expense_id));

create policy "Admins can update charge instances"
on public.expense_charge_instances
for update
using (public.is_expense_admin_writable(expense_id))
with check (public.is_expense_admin_writable(expense_id));

create policy "Admins can delete charge instances"
on public.expense_charge_instances
for delete
using (public.is_expense_admin_writable(expense_id));

create policy "Members can read charge shares"
on public.expense_charge_shares
for select
using (public.is_charge_visible(charge_instance_id));

create policy "Admins can insert charge shares"
on public.expense_charge_shares
for insert
with check (public.is_charge_admin_writable(charge_instance_id));

create policy "Admins can update charge shares"
on public.expense_charge_shares
for update
using (public.is_charge_admin_writable(charge_instance_id))
with check (public.is_charge_admin_writable(charge_instance_id));

create policy "Admins can delete charge shares"
on public.expense_charge_shares
for delete
using (public.is_charge_admin_writable(charge_instance_id));

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

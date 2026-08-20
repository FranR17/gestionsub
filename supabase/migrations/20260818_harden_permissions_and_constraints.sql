-- Bring a baseline schema.sql installation up to the current application schema.
alter table public.subscriptions
  add column if not exists icon_key text default null,
  add column if not exists custom_logo_url text default null,
  add column if not exists reminder_time text not null default '09:00',
  add column if not exists anulado smallint not null default 0;

alter table public.group_expenses
  add column if not exists anulado smallint not null default 0;

alter table public.subscriptions
  drop constraint if exists subscriptions_anulado_check;

alter table public.subscriptions
  add constraint subscriptions_anulado_check check (anulado in (0, 1));

alter table public.group_expenses
  drop constraint if exists group_expenses_anulado_check;

alter table public.group_expenses
  add constraint group_expenses_anulado_check check (anulado in (0, 1));

create index if not exists idx_subscriptions_user_charge
  on public.subscriptions(user_id, next_charge_date);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
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

create table if not exists public.group_settlements (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  year int not null,
  month int not null check (month between 1 and 12),
  settled_by uuid references auth.users(id) on delete set null,
  settled_at timestamptz not null default now(),
  notes text default '',
  balance_snapshot jsonb not null default '[]'::jsonb,
  transfers jsonb not null default '[]'::jsonb,
  unique (group_id, year, month)
);

alter table public.group_settlements enable row level security;
alter table public.group_settlements alter column settled_by drop not null;
alter table public.group_settlements
  drop constraint if exists group_settlements_settled_by_fkey;
alter table public.group_settlements
  add constraint group_settlements_settled_by_fkey
  foreign key (settled_by) references auth.users(id) on delete set null;

drop policy if exists "Members can read own group settlements" on public.group_settlements;
create policy "Members can read own group settlements"
on public.group_settlements
for select
using (public.is_group_member(group_id));

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
    (select jsonb_build_object(
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
      and public.is_group_member(p_group_id)),
    jsonb_build_object('settled', false)
  );
$$;

create or replace function public.delete_own_account()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from auth.users where id = auth.uid();
$$;

-- Align database constraints with the values supported by the application.
alter table public.subscriptions
  drop constraint if exists subscriptions_reminder_days_check;

alter table public.subscriptions
  add constraint subscriptions_reminder_days_check
  check (reminder_days between 0 and 30);

alter table public.group_expenses
  drop constraint if exists group_expenses_frequency_check;

alter table public.group_expenses
  add constraint group_expenses_frequency_check
  check (frequency in ('puntual', 'semanal', 'mensual', 'trimestral', 'anual'));

-- Validate that referenced members belong to the expense/charge group.
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

revoke all on function public.is_member_in_group(uuid, uuid) from public, anon;
revoke all on function public.is_member_in_expense_group(uuid, uuid) from public, anon;
revoke all on function public.is_member_in_charge_group(uuid, uuid) from public, anon;
grant execute on function public.is_member_in_group(uuid, uuid) to authenticated;
grant execute on function public.is_member_in_expense_group(uuid, uuid) to authenticated;
grant execute on function public.is_member_in_charge_group(uuid, uuid) to authenticated;

drop policy if exists "Admins can insert group expenses" on public.group_expenses;
drop policy if exists "Admins can update group expenses" on public.group_expenses;
drop policy if exists "Admins can insert expense participants" on public.group_expense_participants;
drop policy if exists "Admins can update expense participants" on public.group_expense_participants;
drop policy if exists "Admins can insert charge instances" on public.expense_charge_instances;
drop policy if exists "Admins can update charge instances" on public.expense_charge_instances;
drop policy if exists "Admins can insert charge shares" on public.expense_charge_shares;
drop policy if exists "Admins can update charge shares" on public.expense_charge_shares;

create policy "Admins can insert group expenses"
on public.group_expenses
for insert
with check (
  public.is_group_admin_or_owner(group_id)
  and auth.uid() = created_by_user_id
  and public.is_member_in_group(payer_member_id, group_id)
);

create policy "Admins can update group expenses"
on public.group_expenses
for update
using (public.is_group_admin_or_owner(group_id))
with check (
  public.is_group_admin_or_owner(group_id)
  and public.is_member_in_group(payer_member_id, group_id)
);

create policy "Admins can insert expense participants"
on public.group_expense_participants
for insert
with check (
  public.is_expense_admin_writable(expense_id)
  and public.is_member_in_expense_group(member_id, expense_id)
);

create policy "Admins can update expense participants"
on public.group_expense_participants
for update
using (public.is_expense_admin_writable(expense_id))
with check (
  public.is_expense_admin_writable(expense_id)
  and public.is_member_in_expense_group(member_id, expense_id)
);

create policy "Admins can insert charge instances"
on public.expense_charge_instances
for insert
with check (
  public.is_expense_admin_writable(expense_id)
  and public.is_member_in_expense_group(payer_member_id, expense_id)
);

create policy "Admins can update charge instances"
on public.expense_charge_instances
for update
using (public.is_expense_admin_writable(expense_id))
with check (
  public.is_expense_admin_writable(expense_id)
  and public.is_member_in_expense_group(payer_member_id, expense_id)
);

create policy "Admins can insert charge shares"
on public.expense_charge_shares
for insert
with check (
  public.is_charge_admin_writable(charge_instance_id)
  and public.is_member_in_charge_group(member_id, charge_instance_id)
);

create policy "Admins can update charge shares"
on public.expense_charge_shares
for update
using (public.is_charge_admin_writable(charge_instance_id))
with check (
  public.is_charge_admin_writable(charge_instance_id)
  and public.is_member_in_charge_group(member_id, charge_instance_id)
);

-- Prevent users from changing role/group data through the former "leave" policy.
drop policy if exists "Members can leave their own membership" on public.group_members;

-- Invitees can no longer update arbitrary invite columns directly.
drop policy if exists "Admins and invitees can update invites" on public.group_invites;
drop policy if exists "Admins can update invites" on public.group_invites;

create policy "Admins can update invites"
on public.group_invites
for update
using (public.is_group_admin_or_owner(group_id))
with check (public.is_group_admin_or_owner(group_id));

create or replace function public.get_group_invite_preview(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_invite record;
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'reason', 'unauthenticated');
  end if;

  select gi.invitee_email, g.name as group_name
    into v_invite
    from public.group_invites gi
    join public.groups g on g.id = gi.group_id
   where gi.token = p_token
     and gi.status = 'pending'
     and gi.expires_at > now();

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'invite_not_found_or_expired');
  end if;

  if lower(v_invite.invitee_email) <> 'invite-link@gestionsub.local'
     and lower(v_invite.invitee_email) <> v_email then
    return jsonb_build_object('ok', false, 'reason', 'invite_not_for_user');
  end if;

  return jsonb_build_object('ok', true, 'group_name', v_invite.group_name);
end;
$$;

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

  select *
    into v_invite
    from public.group_invites
   where token = p_token
     and status = 'pending'
     and expires_at > now()
   for update;

  if not found then
    select *
      into v_invite
      from public.group_invites
     where token = p_token
       and status = 'accepted'
       and accepted_by_user_id = v_uid;

    if found then
      return jsonb_build_object('ok', true, 'group_id', v_invite.group_id, 'already_member', true);
    end if;

    return jsonb_build_object('ok', false, 'reason', 'invite_not_found_or_expired');
  end if;

  if lower(v_invite.invitee_email) <> 'invite-link@gestionsub.local'
     and lower(v_invite.invitee_email) <> v_email then
    return jsonb_build_object('ok', false, 'reason', 'invite_not_for_user');
  end if;

  insert into public.group_members (group_id, user_id, role, status, joined_at)
  values (v_invite.group_id, v_uid, 'member', 'active', now())
  on conflict (group_id, user_id)
  do update set
    status = 'active',
    joined_at = now(),
    role = case
      when exists (
        select 1 from public.groups g
        where g.id = v_invite.group_id and g.owner_user_id = v_uid
      ) then 'owner'
      else 'member'
    end;

  update public.group_invites
     set status = 'accepted',
         accepted_at = now(),
         accepted_by_user_id = v_uid
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

  select *
    into v_invite
    from public.group_invites
   where id = p_invite_id
     and status = 'pending'
     and expires_at > now()
     and lower(invitee_email) = v_email
   for update;

  if not found then
    select *
      into v_invite
      from public.group_invites
     where id = p_invite_id
       and status = 'accepted'
       and accepted_by_user_id = v_uid;

    if found then
      return jsonb_build_object('ok', true, 'group_id', v_invite.group_id, 'already_member', true);
    end if;

    return jsonb_build_object('ok', false, 'reason', 'invite_not_found_or_expired');
  end if;

  insert into public.group_members (group_id, user_id, role, status, joined_at)
  values (v_invite.group_id, v_uid, 'member', 'active', now())
  on conflict (group_id, user_id)
  do update set
    status = 'active',
    joined_at = now(),
    role = case
      when exists (
        select 1 from public.groups g
        where g.id = v_invite.group_id and g.owner_user_id = v_uid
      ) then 'owner'
      else 'member'
    end;

  update public.group_invites
     set status = 'accepted', accepted_at = now(), accepted_by_user_id = v_uid
   where id = v_invite.id;

  return jsonb_build_object('ok', true, 'group_id', v_invite.group_id);
end;
$$;

create or replace function public.decline_group_invite_by_id(p_invite_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'reason', 'unauthenticated');
  end if;

  update public.group_invites
     set status = 'revoked'
   where id = p_invite_id
     and status = 'pending'
     and lower(invitee_email) = v_email;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'invite_not_found');
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.get_group_invite_preview(text) from public, anon;
revoke all on function public.accept_group_invite(text) from public, anon;
revoke all on function public.accept_group_invite_by_id(uuid) from public, anon;
revoke all on function public.decline_group_invite_by_id(uuid) from public, anon;
grant execute on function public.get_group_invite_preview(text) to authenticated;
grant execute on function public.accept_group_invite(text) to authenticated;
grant execute on function public.accept_group_invite_by_id(uuid) to authenticated;
grant execute on function public.decline_group_invite_by_id(uuid) to authenticated;

-- Settlement snapshots can only be written through the authorized RPC.
drop policy if exists "Admins/owners can insert settlements" on public.group_settlements;

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
  if p_year not between 1 and 9999 or p_month not between 1 and 12 then
    return jsonb_build_object('ok', false, 'reason', 'invalid_period');
  end if;

  if not public.is_group_admin_or_owner(p_group_id) then
    return jsonb_build_object('ok', false, 'reason', 'not_authorized');
  end if;

  if exists (
    select 1 from public.group_settlements
    where group_id = p_group_id and year = p_year and month = p_month
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

  v_balances := coalesce(v_balances, '[]'::jsonb);

  select array_agg(
    jsonb_build_object('id', b.member_id, 'name', b.member_name, 'amt', abs(b.net_total))
  )
  into v_debtors
  from public.get_group_monthly_balances(p_group_id, p_year, p_month) b
  where b.net_total < -0.009;

  select array_agg(
    jsonb_build_object('id', b.member_id, 'name', b.member_name, 'amt', b.net_total)
  )
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
        v_d_amt := (v_d ->> 'amt')::numeric;
        v_c_amt := (v_c ->> 'amt')::numeric;
        v_pay := least(v_d_amt, v_c_amt);

        if v_pay > 0.009 then
          v_result := v_result || jsonb_build_object(
            'from_member_id', v_d ->> 'id',
            'from_name', v_d ->> 'name',
            'to_member_id', v_c ->> 'id',
            'to_name', v_c ->> 'name',
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

  begin
    insert into public.group_settlements (
      group_id, year, month, settled_by, balance_snapshot, transfers, notes
    )
    values (
      p_group_id, p_year, p_month, v_uid, v_balances, v_transfers, coalesce(p_notes, '')
    );
  exception when unique_violation then
    return jsonb_build_object('ok', false, 'reason', 'already_settled');
  end;

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.settle_group_month(uuid, int, int, text) from public, anon;
grant execute on function public.settle_group_month(uuid, int, int, text) to authenticated;

-- SECURITY DEFINER functions should never retain PostgreSQL's default PUBLIC execute grant.
revoke all on function public.is_group_member(uuid) from public, anon;
revoke all on function public.is_group_admin_or_owner(uuid) from public, anon;
revoke all on function public.is_expense_visible(uuid) from public, anon;
revoke all on function public.is_expense_admin_writable(uuid) from public, anon;
revoke all on function public.is_charge_visible(uuid) from public, anon;
revoke all on function public.is_charge_admin_writable(uuid) from public, anon;
revoke all on function public.get_group_monthly_balances(uuid, int, int) from public, anon;
revoke all on function public.get_group_settlement(uuid, int, int) from public, anon;
revoke all on function public.delete_own_account() from public, anon;

grant execute on function public.is_group_member(uuid) to authenticated;
grant execute on function public.is_group_admin_or_owner(uuid) to authenticated;
grant execute on function public.is_expense_visible(uuid) to authenticated;
grant execute on function public.is_expense_admin_writable(uuid) to authenticated;
grant execute on function public.is_charge_visible(uuid) to authenticated;
grant execute on function public.is_charge_admin_writable(uuid) to authenticated;
grant execute on function public.get_group_monthly_balances(uuid, int, int) to authenticated;
grant execute on function public.get_group_settlement(uuid, int, int) to authenticated;
grant execute on function public.delete_own_account() to authenticated;

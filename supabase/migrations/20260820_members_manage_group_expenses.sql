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

grant execute on function public.is_expense_member_writable(uuid) to authenticated;
grant execute on function public.is_charge_member_writable(uuid) to authenticated;

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

drop policy if exists "Admins can insert group expenses" on public.group_expenses;
drop policy if exists "Admins can update group expenses" on public.group_expenses;
drop policy if exists "Admins can delete group expenses" on public.group_expenses;
drop policy if exists "Members can insert group expenses" on public.group_expenses;
drop policy if exists "Members can update group expenses" on public.group_expenses;
drop policy if exists "Members can delete group expenses" on public.group_expenses;

drop policy if exists "Admins can insert expense participants" on public.group_expense_participants;
drop policy if exists "Admins can update expense participants" on public.group_expense_participants;
drop policy if exists "Admins can delete expense participants" on public.group_expense_participants;
drop policy if exists "Members can insert expense participants" on public.group_expense_participants;
drop policy if exists "Members can update expense participants" on public.group_expense_participants;
drop policy if exists "Members can delete expense participants" on public.group_expense_participants;

drop policy if exists "Admins can insert charge instances" on public.expense_charge_instances;
drop policy if exists "Admins can update charge instances" on public.expense_charge_instances;
drop policy if exists "Admins can delete charge instances" on public.expense_charge_instances;
drop policy if exists "Members can insert charge instances" on public.expense_charge_instances;
drop policy if exists "Members can update charge instances" on public.expense_charge_instances;
drop policy if exists "Members can delete charge instances" on public.expense_charge_instances;

drop policy if exists "Admins can insert charge shares" on public.expense_charge_shares;
drop policy if exists "Admins can update charge shares" on public.expense_charge_shares;
drop policy if exists "Admins can delete charge shares" on public.expense_charge_shares;
drop policy if exists "Members can insert charge shares" on public.expense_charge_shares;
drop policy if exists "Members can update charge shares" on public.expense_charge_shares;
drop policy if exists "Members can delete charge shares" on public.expense_charge_shares;

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

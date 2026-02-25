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

drop policy if exists "Members can read own groups" on public.groups;

create policy "Members can read own groups"
on public.groups
for select
using (
  owner_user_id = auth.uid()
  or public.is_group_member(id)
);

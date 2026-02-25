-- Allow authenticated users to delete their own account.
-- All related data cascades via ON DELETE CASCADE.
create or replace function public.delete_own_account()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from auth.users where id = auth.uid();
$$;

-- Only authenticated users can call this
revoke execute on function public.delete_own_account() from anon;
grant execute on function public.delete_own_account() to authenticated;

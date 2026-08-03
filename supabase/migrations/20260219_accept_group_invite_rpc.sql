-- accept_group_invite(p_token)
-- Atomic, security-definer function that validates an invite token,
-- upserts the caller as an active group member, and marks the invite accepted.
-- Returns a JSON object: { "ok": true, "group_id": "..." }
--                     or { "ok": false, "reason": "..." }

create or replace function public.accept_group_invite(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite       record;
  v_uid          uuid := auth.uid();
  v_email        text := lower(coalesce(auth.jwt() ->> 'email', ''));
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'reason', 'unauthenticated');
  end if;

  if v_email = '' then
    return jsonb_build_object('ok', false, 'reason', 'missing_email');
  end if;

  -- Lock the row so concurrent calls don't double-accept
  select *
    into v_invite
    from public.group_invites
   where token = p_token
     and status = 'pending'
     and lower(invitee_email) = v_email
     and expires_at > now()
   for update;

  if not found then
    -- Check if already accepted by this user (idempotent)
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

  -- Upsert member
  insert into public.group_members (group_id, user_id, role, status, joined_at)
  values (v_invite.group_id, v_uid, 'member', 'active', now())
  on conflict (group_id, user_id)
  do update set status = 'active', joined_at = now();

  -- Mark invite accepted
  update public.group_invites
     set status = 'accepted',
         accepted_at = now(),
         accepted_by_user_id = v_uid
   where id = v_invite.id;

  return jsonb_build_object('ok', true, 'group_id', v_invite.group_id);
end;
$$;

grant execute on function public.accept_group_invite(text) to authenticated;

-- Same logic but accepts by invite UUID (used for email-based invites shown in the UI)
create or replace function public.accept_group_invite_by_id(p_invite_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite record;
  v_uid    uuid := auth.uid();
  v_email  text := lower(coalesce(auth.jwt() ->> 'email', ''));
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
    select * into v_invite from public.group_invites
     where id = p_invite_id and status = 'accepted' and lower(invitee_email) = v_email and accepted_by_user_id = v_uid;
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

grant execute on function public.accept_group_invite_by_id(uuid) to authenticated;

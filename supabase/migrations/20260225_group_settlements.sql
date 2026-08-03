-- ─── Group Settlements (Liquidaciones mensuales) ─────────────────────
-- Stores monthly settlement snapshots per group.
-- Once a month is settled, it becomes read-only historical data.

create table if not exists public.group_settlements (
  id          uuid primary key default gen_random_uuid(),
  group_id    uuid not null references public.groups(id) on delete cascade,
  year        int  not null,
  month       int  not null check (month between 1 and 12),
  settled_by  uuid not null references auth.users(id),
  settled_at  timestamptz not null default now(),
  notes       text default '',
  -- Snapshot: JSON array of {member_id, member_name, paid_total, owed_total, net_total}
  balance_snapshot jsonb not null default '[]'::jsonb,
  -- Optimised transfers: JSON array of {from_member_id, from_name, to_member_id, to_name, amount}
  transfers   jsonb not null default '[]'::jsonb,
  unique (group_id, year, month)
);

-- RLS
alter table public.group_settlements enable row level security;

drop policy if exists "Members can read own group settlements" on public.group_settlements;

create policy "Members can read own group settlements"
  on public.group_settlements for select
  using (public.is_group_member(group_id));

drop policy if exists "Admins/owners can insert settlements" on public.group_settlements;
drop policy if exists "Members can insert settlements" on public.group_settlements;

create policy "Members can insert settlements"
  on public.group_settlements for insert
  with check (public.is_group_member(group_id));

-- ─── RPC: settle a month ──────────────────────────────────────────────
-- Takes the current balances snapshot + optimised transfers and stores them.
-- Returns {ok: true} or {ok: false, reason: '...'}.
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
  -- Check membership
  if not public.is_group_member(p_group_id) then
    return jsonb_build_object('ok', false, 'reason', 'not_member');
  end if;

  -- Check not already settled
  if exists (
    select 1 from public.group_settlements
    where group_id = p_group_id and year = p_year and month = p_month
  ) then
    return jsonb_build_object('ok', false, 'reason', 'already_settled');
  end if;

  -- Get balances snapshot
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

  -- Compute optimised transfers (greedy algorithm)
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

  -- Insert settlement
  insert into public.group_settlements (group_id, year, month, settled_by, balance_snapshot, transfers, notes)
  values (p_group_id, p_year, p_month, v_uid, v_balances, v_transfers, coalesce(p_notes, ''));

  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.settle_group_month(uuid, int, int, text) to authenticated;

-- ─── RPC: check if a month is settled ──────────────────────────────────
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
      and public.is_group_member(p_group_id)
    ),
    jsonb_build_object('settled', false)
  );
$$;

grant execute on function public.get_group_settlement(uuid, int, int) to authenticated;

-- Generate monthly charge instances for recurring group expenses before balances/settlements are read.
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
    select 1
    from public.group_settlements
    where group_id = p_group_id
      and year = p_year
      and month = p_month
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
        insert into public.expense_charge_instances (
          expense_id, charge_date, amount_total, payer_member_id, status
        )
        values (
          v_exp.id, v_charge_date, v_exp.amount, v_exp.payer_member_id, 'pending'
        )
        on conflict (expense_id, charge_date)
        do update set
          amount_total = excluded.amount_total,
          payer_member_id = excluded.payer_member_id
        returning id into v_charge_instance_id;

        delete from public.expense_charge_shares
        where charge_instance_id = v_charge_instance_id;

        v_amount_cents := round(v_exp.amount * 100)::int;

        for v_participant in
          select
            gep.member_id,
            gep.share_type,
            coalesce(gep.share_value, 0) as share_value,
            row_number() over (order by gep.created_at, gep.id) as rn,
            count(*) over () as participant_count
          from public.group_expense_participants gep
          join public.group_members gm
            on gm.id = gep.member_id
           and gm.status = 'active'
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

          insert into public.expense_charge_shares (
            charge_instance_id, member_id, owed_amount
          ) values (
            v_charge_instance_id, v_participant.member_id, greatest(v_owed, 0)
          );
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

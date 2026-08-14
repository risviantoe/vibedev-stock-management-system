begin;

create or replace function public.preview_fefo_allocation(
  p_product_id uuid,
  p_qty bigint
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_result jsonb;
begin
  perform public.assert_admin();

  if p_qty is null or p_qty <= 0 then
    raise exception using
      errcode = '22023',
      message = 'OUTBOUND_QTY_MUST_BE_POSITIVE';
  end if;

  with candidates as (
    select
      batch.id as batch_id,
      batch.batch_code,
      batch.expiry_date,
      batch.created_at,
      balance.on_hand_qty as balance_before,
      sum(balance.on_hand_qty) over (
        order by batch.expiry_date, batch.created_at, batch.id
        rows between unbounded preceding and current row
      ) as running_qty
    from public.stock_balances as balance
    join public.batches as batch
      on batch.id = balance.batch_id
     and batch.product_id = balance.product_id
    where balance.product_id = p_product_id
      and balance.on_hand_qty > 0
  ),
  totals as (
    select
      coalesce(sum(candidate.balance_before), 0)::bigint as on_hand_qty,
      greatest(
        coalesce(sum(candidate.balance_before), 0)::bigint
        - coalesce(
          (
            select reservation.reserved_qty
            from public.product_reservations as reservation
            where reservation.product_id = p_product_id
          ),
          0
        ),
        0
      )::bigint as available_qty
    from candidates as candidate
  ),
  allocated as (
    select
      candidate.*,
      greatest(
        least(
          candidate.balance_before,
          least(p_qty, totals.available_qty)
            - (candidate.running_qty - candidate.balance_before)
        ),
        0
      )::bigint as allocated_qty
    from candidates as candidate
    cross join totals
  )
  select jsonb_build_object(
    'requested_qty', p_qty,
    'on_hand_qty', totals.on_hand_qty,
    'reserved_qty', totals.on_hand_qty - totals.available_qty,
    'available_qty', totals.available_qty,
    'sufficient', totals.available_qty >= p_qty,
    'allocations',
      coalesce(
        (
          select jsonb_agg(
            jsonb_build_object(
              'batch_id', allocated.batch_id,
              'batch_code', allocated.batch_code,
              'expiry_date', allocated.expiry_date,
              'allocated_qty', allocated.allocated_qty,
              'balance_before', allocated.balance_before,
              'balance_after',
                allocated.balance_before - allocated.allocated_qty
            )
            order by
              allocated.expiry_date,
              allocated.created_at,
              allocated.batch_id
          )
          from allocated
          where allocated.allocated_qty > 0
        ),
        '[]'::jsonb
      )
  )
  into v_result
  from totals;

  return v_result;
end;
$$;

revoke execute on function public.preview_fefo_allocation(uuid, bigint)
  from public;
grant execute on function public.preview_fefo_allocation(uuid, bigint)
  to authenticated;

commit;

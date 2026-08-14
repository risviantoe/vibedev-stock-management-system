begin;

create or replace function public.project_stock_ledger_insert()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_projected_qty bigint;
begin
  if new.qty_delta < 0 then
    update public.stock_balances
    set
      on_hand_qty = on_hand_qty + new.qty_delta,
      updated_at = now()
    where product_id = new.product_id
      and batch_id = new.batch_id
      and on_hand_qty + new.qty_delta >= 0
    returning on_hand_qty into v_projected_qty;
  else
    insert into public.stock_balances (
      product_id,
      batch_id,
      on_hand_qty,
      updated_at
    )
    values (
      new.product_id,
      new.batch_id,
      new.qty_delta,
      now()
    )
    on conflict (product_id, batch_id)
    do update
    set
      on_hand_qty = public.stock_balances.on_hand_qty + excluded.on_hand_qty,
      updated_at = now()
    returning on_hand_qty into v_projected_qty;
  end if;

  if v_projected_qty is null then
    raise exception using
      errcode = 'P0001',
      message = 'INSUFFICIENT_STOCK';
  end if;

  return new;
end;
$$;

commit;

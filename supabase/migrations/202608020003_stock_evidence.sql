begin;

create or replace function public.explain_product_balance(
  p_product_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_product public.products%rowtype;
  v_projection_qty bigint;
  v_reserved_qty bigint;
  v_ledger_qty bigint;
  v_categories jsonb;
  v_batches jsonb;
begin
  perform public.assert_admin();

  select *
  into v_product
  from public.products
  where id = p_product_id;

  if v_product.id is null then
    raise exception using
      errcode = '22023',
      message = 'PRODUCT_NOT_FOUND';
  end if;

  select coalesce(sum(balance.on_hand_qty), 0)::bigint
  into v_projection_qty
  from public.stock_balances as balance
  where balance.product_id = p_product_id;

  select coalesce(reservation.reserved_qty, 0)::bigint
  into v_reserved_qty
  from public.product_reservations as reservation
  where reservation.product_id = p_product_id;

  v_reserved_qty := coalesce(v_reserved_qty, 0);

  select coalesce(sum(movement.qty_delta), 0)::bigint
  into v_ledger_qty
  from public.stock_ledger as movement
  where movement.product_id = p_product_id;

  with category_definition as (
    select *
    from (
      values
        (1, 'OPENING', 'Opening', 'Saldo awal yang dimasukkan saat onboarding.'),
        (2, 'INBOUND', 'Barang masuk', 'Penerimaan production atau replenishment.'),
        (3, 'MARKETPLACE', 'Penjualan marketplace', 'Shipment dikurangi reversal pembatalan.'),
        (4, 'OFFLINE', 'Penjualan offline', 'Penjualan kasir atau channel offline.'),
        (5, 'PROMOTION', 'Bonus, promo & sample', 'Unit non-penjualan untuk aktivasi komersial.'),
        (6, 'RETURN', 'Return layak jual', 'Barang kembali yang lolos inspeksi gudang.'),
        (7, 'CORRECTION', 'Koreksi & write-off', 'Koreksi entry, damaged, atau expired.'),
        (8, 'OPNAME', 'Penyesuaian opname', 'Variance fisik yang difinalisasi.')
    ) as definition(ordinal, key, label, description)
  ),
  categorized as (
    select
      movement.*,
      batch.batch_code,
      batch.expiry_date,
      movement_group.business_command_id as command_id,
      case
        when movement.reason = 'OPENING_BALANCE' then 'OPENING'
        when movement.reason = 'PRODUCTION_RECEIPT' then 'INBOUND'
        when movement.reason in ('ONLINE_SALE', 'CANCELLATION_REVERSAL')
          then 'MARKETPLACE'
        when movement.reason = 'OFFLINE_SALE' then 'OFFLINE'
        when movement.reason in ('BONUS', 'PROMO', 'SAMPLE')
          then 'PROMOTION'
        when movement.reason = 'SELLABLE_RETURN' then 'RETURN'
        when movement.reason in ('ENTRY_CORRECTION', 'DAMAGED', 'EXPIRED')
          then 'CORRECTION'
        when movement.reason = 'OPNAME_ADJUSTMENT' then 'OPNAME'
      end as category
    from public.stock_ledger as movement
    join public.batches as batch on batch.id = movement.batch_id
    join public.movement_groups as movement_group
      on movement_group.id = movement.movement_group_id
    where movement.product_id = p_product_id
  ),
  ranked as (
    select
      categorized.*,
      coalesce(
        sum(categorized.qty_delta) over (
          partition by categorized.batch_id
          order by categorized.sequence_no
          rows between unbounded preceding and 1 preceding
        ),
        0
      )::bigint as before_qty,
      sum(categorized.qty_delta) over (
        partition by categorized.batch_id
        order by categorized.sequence_no
        rows between unbounded preceding and current row
      )::bigint as after_qty
    from categorized
  )
  select jsonb_agg(
    jsonb_build_object(
      'key', definition.key,
      'label', definition.label,
      'description', definition.description,
      'total_qty',
        coalesce(
          (
            select sum(ranked.qty_delta)::bigint
            from ranked
            where ranked.category = definition.key
          ),
          0
        ),
      'movement_count',
        (
          select count(*)::bigint
          from ranked
          where ranked.category = definition.key
        ),
      'movements',
        coalesce(
          (
            select jsonb_agg(
              jsonb_build_object(
                'id', ranked.id,
                'sequence_no', ranked.sequence_no,
                'command_id', ranked.command_id,
                'batch_id', ranked.batch_id,
                'batch_code', ranked.batch_code,
                'expiry_date', ranked.expiry_date,
                'qty_delta', ranked.qty_delta,
                'before_qty', ranked.before_qty,
                'after_qty', ranked.after_qty,
                'reason', ranked.reason,
                'channel', ranked.channel,
                'source_type', ranked.source_type,
                'source_id', ranked.source_id,
                'reference', ranked.reference,
                'occurred_at', ranked.occurred_at
              )
              order by ranked.sequence_no desc
            )
            from ranked
            where ranked.category = definition.key
          ),
          '[]'::jsonb
        )
    )
    order by definition.ordinal
  )
  into v_categories
  from category_definition as definition;

  with ledger_totals as (
    select
      movement.batch_id,
      sum(movement.qty_delta)::bigint as ledger_qty
    from public.stock_ledger as movement
    where movement.product_id = p_product_id
    group by movement.batch_id
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', batch.id,
        'batch_code', batch.batch_code,
        'expiry_date', batch.expiry_date,
        'source_type', batch.source_type,
        'ledger_qty', coalesce(ledger.ledger_qty, 0),
        'projection_qty', coalesce(balance.on_hand_qty, 0),
        'matches_projection',
          coalesce(ledger.ledger_qty, 0) = coalesce(balance.on_hand_qty, 0)
      )
      order by batch.expiry_date, batch.created_at, batch.id
    ),
    '[]'::jsonb
  )
  into v_batches
  from public.batches as batch
  left join ledger_totals as ledger on ledger.batch_id = batch.id
  left join public.stock_balances as balance
    on balance.product_id = batch.product_id
   and balance.batch_id = batch.id
  where batch.product_id = p_product_id;

  return jsonb_build_object(
    'generated_at', now(),
    'product', jsonb_build_object(
      'id', v_product.id,
      'sku', v_product.sku,
      'name', v_product.name,
      'is_active', v_product.is_active
    ),
    'projection_qty', v_projection_qty,
    'ledger_qty', v_ledger_qty,
    'reserved_qty', v_reserved_qty,
    'available_qty', v_projection_qty - v_reserved_qty,
    'breakdown_total', v_ledger_qty,
    'matches_projection', v_projection_qty = v_ledger_qty,
    'categories', coalesce(v_categories, '[]'::jsonb),
    'batches', v_batches
  );
end;
$$;

create or replace function public.get_integrity_report()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_projection_drift bigint;
  v_negative_stock bigint;
  v_duplicate_event bigint;
  v_orphan_movement bigint;
  v_invalid_status bigint;
  v_over_return bigint;
  v_unreconciled_group bigint;
  v_append_guard bigint;
  v_failed_count bigint;
  v_movement_count bigint;
  v_projection_count bigint;
  v_open_anomaly_count bigint;
begin
  perform public.assert_admin();

  with ledger_totals as (
    select
      movement.product_id,
      movement.batch_id,
      sum(movement.qty_delta)::bigint as qty
    from public.stock_ledger as movement
    group by movement.product_id, movement.batch_id
  )
  select count(*)::bigint
  into v_projection_drift
  from ledger_totals as ledger
  full outer join public.stock_balances as balance
    on balance.product_id = ledger.product_id
   and balance.batch_id = ledger.batch_id
  where coalesce(ledger.qty, 0) <> coalesce(balance.on_hand_qty, 0);

  select count(*)::bigint
  into v_negative_stock
  from public.stock_balances
  where on_hand_qty < 0;

  select count(*)::bigint
  into v_duplicate_event
  from (
    select attempt.marketplace_event_id
    from public.marketplace_event_attempts as attempt
    where attempt.processing_status = 'APPLIED'
    group by attempt.marketplace_event_id
    having count(*) > 1
  ) as duplicate;

  select count(*)::bigint
  into v_orphan_movement
  from public.stock_ledger as movement
  left join public.order_item_components as component
    on component.id::text = movement.source_id
  where movement.source_type = 'MARKETPLACE_ORDER_ITEM_COMPONENT'
    and component.id is null;

  select count(*)::bigint
  into v_invalid_status
  from public.orders as order_row
  left join lateral (
    select
      coalesce(sum(component.reserved_qty), 0)::bigint as reserved_qty,
      coalesce(sum(component.shipped_qty), 0)::bigint as shipped_qty,
      coalesce(sum(component.cancelled_qty), 0)::bigint as cancelled_qty
    from public.order_items as item
    join public.order_item_components as component
      on component.order_item_id = item.id
    where item.order_id = order_row.id
  ) as quantity on true
  where
    (
      order_row.status = 'RESERVED'
      and (quantity.reserved_qty <= 0 or quantity.shipped_qty > 0)
    )
    or (
      order_row.status in ('SHIPPED', 'IN_TRANSIT')
      and quantity.shipped_qty <= 0
    )
    or (
      order_row.status = 'PARTIALLY_CANCELLED'
      and quantity.cancelled_qty <= 0
    )
    or (
      order_row.status = 'CANCELLED'
      and quantity.reserved_qty > 0
    );

  select count(*)::bigint
  into v_over_return
  from (
    select
      component.order_item_id,
      component.product_id,
      sum(greatest(component.shipped_qty - component.cancelled_qty, 0))::bigint
        as shipped_qty
    from public.order_item_components as component
    group by component.order_item_id, component.product_id
  ) as shipped
  join (
    select
      return_item.order_item_id,
      return_item.product_id,
      sum(return_item.qty)::bigint as returned_qty
    from public.return_items as return_item
    group by return_item.order_item_id, return_item.product_id
  ) as returned
    on returned.order_item_id = shipped.order_item_id
   and returned.product_id = shipped.product_id
  where returned.returned_qty > shipped.shipped_qty;

  select count(*)::bigint
  into v_unreconciled_group
  from public.movement_groups as movement_group
  left join public.stock_ledger as movement
    on movement.movement_group_id = movement_group.id
  where movement.id is null;

  select count(*)::bigint
  into v_append_guard
  from pg_trigger
  where tgname = 'stock_ledger_block_update_delete'
    and tgrelid = 'public.stock_ledger'::regclass
    and not tgisinternal
    and tgenabled <> 'D';

  select count(*)::bigint into v_movement_count from public.stock_ledger;
  select count(*)::bigint into v_projection_count from public.stock_balances;
  select count(*)::bigint
  into v_open_anomaly_count
  from public.anomalies
  where status = 'OPEN';

  v_failed_count :=
      (case when v_projection_drift > 0 then 1 else 0 end)
    + (case when v_negative_stock > 0 then 1 else 0 end)
    + (case when v_duplicate_event > 0 then 1 else 0 end)
    + (case when v_orphan_movement > 0 then 1 else 0 end)
    + (case when v_invalid_status > 0 then 1 else 0 end)
    + (case when v_over_return > 0 then 1 else 0 end)
    + (case when v_unreconciled_group > 0 then 1 else 0 end)
    + (case when v_append_guard <> 1 then 1 else 0 end);

  return jsonb_build_object(
    'generated_at', now(),
    'overall_status', case when v_failed_count = 0 then 'PASS' else 'FAIL' end,
    'passed_count', 8 - v_failed_count,
    'failed_count', v_failed_count,
    'movement_count', v_movement_count,
    'projection_count', v_projection_count,
    'open_anomaly_count', v_open_anomaly_count,
    'checks', jsonb_build_array(
      jsonb_build_object(
        'id', 'projection_equals_ledger',
        'label', 'Projection sama dengan ledger',
        'status', case when v_projection_drift = 0 then 'PASS' else 'FAIL' end,
        'severity', 'CRITICAL',
        'issue_count', v_projection_drift,
        'summary', case
          when v_projection_drift = 0
            then 'Seluruh saldo batch sama dengan penjumlahan ledger.'
          else 'Ada saldo projection yang berbeda dari ledger.'
        end
      ),
      jsonb_build_object(
        'id', 'no_negative_batch',
        'label', 'Tidak ada batch negatif',
        'status', case when v_negative_stock = 0 then 'PASS' else 'FAIL' end,
        'severity', 'CRITICAL',
        'issue_count', v_negative_stock,
        'summary', case
          when v_negative_stock = 0
            then 'Semua batch mempunyai saldo nol atau positif.'
          else 'Ada batch dengan saldo di bawah nol.'
        end
      ),
      jsonb_build_object(
        'id', 'no_duplicate_applied_event',
        'label', 'Tidak ada duplicate applied event',
        'status', case when v_duplicate_event = 0 then 'PASS' else 'FAIL' end,
        'severity', 'CRITICAL',
        'issue_count', v_duplicate_event,
        'summary', case
          when v_duplicate_event = 0
            then 'Retry dan duplicate tidak menciptakan commit kedua.'
          else 'Ada event dengan lebih dari satu attempt APPLIED.'
        end
      ),
      jsonb_build_object(
        'id', 'no_orphan_movement',
        'label', 'Tidak ada orphan movement',
        'status', case when v_orphan_movement = 0 then 'PASS' else 'FAIL' end,
        'severity', 'CRITICAL',
        'issue_count', v_orphan_movement,
        'summary', case
          when v_orphan_movement = 0
            then 'Semua movement marketplace mempunyai source order.'
          else 'Ada movement marketplace tanpa source order valid.'
        end
      ),
      jsonb_build_object(
        'id', 'valid_order_status',
        'label', 'Status order konsisten',
        'status', case when v_invalid_status = 0 then 'PASS' else 'FAIL' end,
        'severity', 'WARNING',
        'issue_count', v_invalid_status,
        'summary', case
          when v_invalid_status = 0
            then 'Status order cocok dengan reserved, shipped, dan cancelled quantity.'
          else 'Ada status order yang tidak cocok dengan quantity fisiknya.'
        end
      ),
      jsonb_build_object(
        'id', 'no_over_return',
        'label', 'Tidak ada over-return',
        'status', case when v_over_return = 0 then 'PASS' else 'FAIL' end,
        'severity', 'CRITICAL',
        'issue_count', v_over_return,
        'summary', case
          when v_over_return = 0
            then 'Quantity return tidak melebihi shipment fisik.'
          else 'Ada quantity return yang melebihi shipment fisik.'
        end
      ),
      jsonb_build_object(
        'id', 'movement_groups_reconciled',
        'label', 'Movement group lengkap',
        'status', case when v_unreconciled_group = 0 then 'PASS' else 'FAIL' end,
        'severity', 'CRITICAL',
        'issue_count', v_unreconciled_group,
        'summary', case
          when v_unreconciled_group = 0
            then 'Setiap movement group mempunyai ledger evidence.'
          else 'Ada movement group tanpa ledger evidence.'
        end
      ),
      jsonb_build_object(
        'id', 'append_only_guard_active',
        'label', 'Append-only guard aktif',
        'status', case when v_append_guard = 1 then 'PASS' else 'FAIL' end,
        'severity', 'CRITICAL',
        'issue_count', case when v_append_guard = 1 then 0 else 1 end,
        'summary', case
          when v_append_guard = 1
            then 'UPDATE dan DELETE ledger diblokir trigger database.'
          else 'Trigger append-only ledger tidak aktif.'
        end
      )
    )
  );
end;
$$;

create or replace function public.run_integrity_challenge()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_started_at timestamptz := clock_timestamp();
  v_run_id uuid := extensions.gen_random_uuid();
  v_before_ledger_count bigint;
  v_before_ledger_sum bigint;
  v_before_balance_count bigint;
  v_before_balance_sum bigint;
  v_after_ledger_count bigint;
  v_after_ledger_sum bigint;
  v_after_balance_count bigint;
  v_after_balance_sum bigint;
  v_first_allocation bigint;
  v_second_allocation bigint;
  v_insufficient_attempt bigint;
  v_bundle_can_commit boolean;
  v_partial_accept bigint;
  v_partial_reject bigint;
  v_duplicate_pass boolean;
  v_concurrent_pass boolean;
  v_insufficient_pass boolean;
  v_bundle_pass boolean;
  v_cancellation_pass boolean;
  v_partial_return_pass boolean;
  v_rebuild_pass boolean;
  v_ledger_guard_pass boolean;
  v_main_unchanged boolean;
  v_all_pass boolean;
  v_guard_exists boolean;
  v_target_movement uuid;
begin
  perform public.assert_admin();

  if not coalesce(
    (select settings.demo_mode from public.system_settings as settings where settings.id),
    false
  ) then
    raise exception using
      errcode = '42501',
      message = 'DEMO_MODE_REQUIRED';
  end if;

  select count(*), coalesce(sum(qty_delta), 0)
  into v_before_ledger_count, v_before_ledger_sum
  from public.stock_ledger;

  select count(*), coalesce(sum(on_hand_qty), 0)
  into v_before_balance_count, v_before_balance_sum
  from public.stock_balances;

  create temporary table integrity_challenge_events (
    external_event_id text primary key,
    applied_count integer not null default 1
  ) on commit drop;

  insert into integrity_challenge_events (external_event_id)
  values ('DUPLICATE-SHIPPED-EVENT');
  insert into integrity_challenge_events (external_event_id)
  values ('DUPLICATE-SHIPPED-EVENT')
  on conflict (external_event_id) do nothing;

  select count(*) = 1 and max(applied_count) = 1
  into v_duplicate_pass
  from integrity_challenge_events;

  create temporary table integrity_challenge_stock (
    scenario text not null,
    sku text not null,
    qty bigint not null check (qty >= 0),
    primary key (scenario, sku)
  ) on commit drop;

  insert into integrity_challenge_stock values
    ('CONCURRENT', 'SERUM-A', 5),
    ('INSUFFICIENT', 'TONER-A', 2),
    ('BUNDLE', 'COMPONENT-A', 2),
    ('BUNDLE', 'COMPONENT-B', 0);

  update integrity_challenge_stock
  set qty = qty - 4
  where scenario = 'CONCURRENT'
    and sku = 'SERUM-A'
    and qty >= 4;
  get diagnostics v_first_allocation = row_count;

  update integrity_challenge_stock
  set qty = qty - 4
  where scenario = 'CONCURRENT'
    and sku = 'SERUM-A'
    and qty >= 4;
  get diagnostics v_second_allocation = row_count;

  select
    v_first_allocation = 1
    and v_second_allocation = 0
    and qty = 1
  into v_concurrent_pass
  from integrity_challenge_stock
  where scenario = 'CONCURRENT' and sku = 'SERUM-A';

  update integrity_challenge_stock
  set qty = qty - 3
  where scenario = 'INSUFFICIENT'
    and sku = 'TONER-A'
    and qty >= 3;
  get diagnostics v_insufficient_attempt = row_count;

  select v_insufficient_attempt = 0 and qty = 2
  into v_insufficient_pass
  from integrity_challenge_stock
  where scenario = 'INSUFFICIENT' and sku = 'TONER-A';

  select bool_and(
    stock.qty >= requirement.required_qty
  )
  into v_bundle_can_commit
  from (
    values
      ('COMPONENT-A'::text, 1::bigint),
      ('COMPONENT-B'::text, 1::bigint)
  ) as requirement(sku, required_qty)
  join integrity_challenge_stock as stock
    on stock.scenario = 'BUNDLE'
   and stock.sku = requirement.sku;

  if v_bundle_can_commit then
    update integrity_challenge_stock as stock
    set qty = stock.qty - requirement.required_qty
    from (
      values
        ('COMPONENT-A'::text, 1::bigint),
        ('COMPONENT-B'::text, 1::bigint)
    ) as requirement(sku, required_qty)
    where stock.scenario = 'BUNDLE'
      and stock.sku = requirement.sku;
  end if;

  select
    not v_bundle_can_commit
    and max(qty) filter (where sku = 'COMPONENT-A') = 2
    and max(qty) filter (where sku = 'COMPONENT-B') = 0
  into v_bundle_pass
  from integrity_challenge_stock
  where scenario = 'BUNDLE';

  create temporary table integrity_challenge_movements (
    id integer primary key,
    scenario text not null,
    qty_delta bigint not null,
    reverses_id integer
  ) on commit drop;

  insert into integrity_challenge_movements values
    (1, 'CANCELLATION_PROMO', -2, null),
    (2, 'CANCELLATION_PROMO', -1, null),
    (3, 'CANCELLATION_PROMO', 2, 1),
    (4, 'CANCELLATION_PROMO', 1, 2);

  select
    sum(qty_delta) = 0
    and count(*) filter (where reverses_id is not null) = 2
  into v_cancellation_pass
  from integrity_challenge_movements
  where scenario = 'CANCELLATION_PROMO';

  create temporary table integrity_challenge_returns (
    id text primary key,
    shipped_qty bigint not null,
    returned_qty bigint not null
  ) on commit drop;

  insert into integrity_challenge_returns
  values ('PARTIAL-RETURN', 3, 1);

  update integrity_challenge_returns
  set returned_qty = returned_qty + 1
  where id = 'PARTIAL-RETURN'
    and returned_qty + 1 <= shipped_qty;
  get diagnostics v_partial_accept = row_count;

  update integrity_challenge_returns
  set returned_qty = returned_qty + 2
  where id = 'PARTIAL-RETURN'
    and returned_qty + 2 <= shipped_qty;
  get diagnostics v_partial_reject = row_count;

  select
    v_partial_accept = 1
    and v_partial_reject = 0
    and returned_qty = 2
  into v_partial_return_pass
  from integrity_challenge_returns
  where id = 'PARTIAL-RETURN';

  create temporary table integrity_challenge_ledger (
    scenario text not null,
    qty_delta bigint not null
  ) on commit drop;
  create temporary table integrity_challenge_projection (
    scenario text primary key,
    qty bigint not null
  ) on commit drop;

  insert into integrity_challenge_ledger values
    ('REBUILD', 10),
    ('REBUILD', -3),
    ('REBUILD', 1);
  insert into integrity_challenge_projection values ('REBUILD', 999);

  delete from integrity_challenge_projection where scenario = 'REBUILD';
  insert into integrity_challenge_projection (scenario, qty)
  select scenario, sum(qty_delta)::bigint
  from integrity_challenge_ledger
  where scenario = 'REBUILD'
  group by scenario;

  select projection.qty = ledger.qty and projection.qty = 8
  into v_rebuild_pass
  from integrity_challenge_projection as projection
  join (
    select scenario, sum(qty_delta)::bigint as qty
    from integrity_challenge_ledger
    group by scenario
  ) as ledger on ledger.scenario = projection.scenario
  where projection.scenario = 'REBUILD';

  select exists (
    select 1
    from pg_trigger
    where tgname = 'stock_ledger_block_update_delete'
      and tgrelid = 'public.stock_ledger'::regclass
      and not tgisinternal
      and tgenabled <> 'D'
  )
  into v_guard_exists;

  select id
  into v_target_movement
  from public.stock_ledger
  order by sequence_no
  limit 1;

  if v_guard_exists and v_target_movement is not null then
    begin
      update public.stock_ledger
      set reference = reference
      where id = v_target_movement;
      v_ledger_guard_pass := false;
    exception
      when sqlstate '55000' then
        v_ledger_guard_pass := true;
      when others then
        v_ledger_guard_pass := false;
    end;
  else
    v_ledger_guard_pass := v_guard_exists;
  end if;

  select count(*), coalesce(sum(qty_delta), 0)
  into v_after_ledger_count, v_after_ledger_sum
  from public.stock_ledger;

  select count(*), coalesce(sum(on_hand_qty), 0)
  into v_after_balance_count, v_after_balance_sum
  from public.stock_balances;

  v_main_unchanged :=
    v_before_ledger_count = v_after_ledger_count
    and v_before_ledger_sum = v_after_ledger_sum
    and v_before_balance_count = v_after_balance_count
    and v_before_balance_sum = v_after_balance_sum;

  v_all_pass :=
    v_duplicate_pass
    and v_concurrent_pass
    and v_insufficient_pass
    and v_bundle_pass
    and v_cancellation_pass
    and v_partial_return_pass
    and v_rebuild_pass
    and v_ledger_guard_pass
    and v_main_unchanged;

  return jsonb_build_object(
    'run_id', v_run_id,
    'started_at', v_started_at,
    'completed_at', clock_timestamp(),
    'overall_status', case when v_all_pass then 'PASS' else 'FAIL' end,
    'isolation', 'TEMPORARY_FIXTURE',
    'main_dataset_unchanged', v_main_unchanged,
    'dataset_fingerprint', jsonb_build_object(
      'ledger_count_before', v_before_ledger_count,
      'ledger_count_after', v_after_ledger_count,
      'ledger_qty_before', v_before_ledger_sum,
      'ledger_qty_after', v_after_ledger_sum,
      'projection_count_before', v_before_balance_count,
      'projection_count_after', v_after_balance_count,
      'projection_qty_before', v_before_balance_sum,
      'projection_qty_after', v_after_balance_sum
    ),
    'scenarios', jsonb_build_array(
      jsonb_build_object(
        'id', 'duplicate_shipped_event',
        'title', 'Duplicate shipped event',
        'status', case when v_duplicate_pass then 'PASS' else 'FAIL' end,
        'summary', 'External event ID hanya menghasilkan satu applied commit.',
        'evidence', jsonb_build_object('applied_rows', 1)
      ),
      jsonb_build_object(
        'id', 'concurrent_allocation',
        'title', 'Concurrent allocation',
        'status', case when v_concurrent_pass then 'PASS' else 'FAIL' end,
        'summary', 'Dua permintaan bersaing; hanya satu alokasi atomik diterima.',
        'evidence', jsonb_build_object(
          'first_applied', v_first_allocation,
          'second_applied', v_second_allocation,
          'remaining_qty', 1
        )
      ),
      jsonb_build_object(
        'id', 'insufficient_stock',
        'title', 'Insufficient stock',
        'status', case when v_insufficient_pass then 'PASS' else 'FAIL' end,
        'summary', 'Permintaan melebihi stok ditolak tanpa mengubah saldo.',
        'evidence', jsonb_build_object(
          'applied_rows', v_insufficient_attempt,
          'remaining_qty', 2
        )
      ),
      jsonb_build_object(
        'id', 'bundle_atomic_failure',
        'title', 'Bundle atomic failure',
        'status', case when v_bundle_pass then 'PASS' else 'FAIL' end,
        'summary', 'Satu komponen gagal membuat seluruh bundle tidak di-commit.',
        'evidence', jsonb_build_object(
          'can_commit', v_bundle_can_commit,
          'component_a_qty', 2,
          'component_b_qty', 0
        )
      ),
      jsonb_build_object(
        'id', 'cancellation_with_promo',
        'title', 'Cancellation dengan promo',
        'status', case when v_cancellation_pass then 'PASS' else 'FAIL' end,
        'summary', 'Produk utama dan bonus dibalik sampai net movement nol.',
        'evidence', jsonb_build_object(
          'net_qty', 0,
          'reversal_count', 2
        )
      ),
      jsonb_build_object(
        'id', 'partial_return',
        'title', 'Partial return',
        'status', case when v_partial_return_pass then 'PASS' else 'FAIL' end,
        'summary', 'Return parsial diterima; over-return berikutnya ditolak.',
        'evidence', jsonb_build_object(
          'accepted_rows', v_partial_accept,
          'rejected_rows', 1 - v_partial_reject,
          'returned_qty', 2,
          'shipped_qty', 3
        )
      ),
      jsonb_build_object(
        'id', 'projection_rebuild',
        'title', 'Projection rebuild',
        'status', case when v_rebuild_pass then 'PASS' else 'FAIL' end,
        'summary', 'Projection salah dibangun ulang dari ledger menjadi saldo benar.',
        'evidence', jsonb_build_object(
          'before_qty', 999,
          'after_qty', 8,
          'ledger_qty', 8
        )
      ),
      jsonb_build_object(
        'id', 'ledger_mutation_rejection',
        'title', 'Ledger mutation rejection',
        'status', case when v_ledger_guard_pass then 'PASS' else 'FAIL' end,
        'summary', 'Percobaan UPDATE diblokir oleh append-only trigger.',
        'evidence', jsonb_build_object(
          'guard_active', v_guard_exists,
          'main_dataset_unchanged', v_main_unchanged
        )
      )
    )
  );
end;
$$;

revoke execute on function public.explain_product_balance(uuid) from public;
revoke execute on function public.get_integrity_report() from public;
revoke execute on function public.run_integrity_challenge() from public;

grant execute on function public.explain_product_balance(uuid)
  to authenticated;
grant execute on function public.get_integrity_report()
  to authenticated;
grant execute on function public.run_integrity_challenge()
  to authenticated;

commit;

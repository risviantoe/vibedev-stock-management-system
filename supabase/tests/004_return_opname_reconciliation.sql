-- Transactional Milestone 4 acceptance checks.
-- Run against the linked project with:
-- supabase db query --linked --file supabase/tests/004_return_opname_reconciliation.sql

begin;

do $$
declare
  v_user_id uuid := '92000000-0000-4000-8000-000000000001';
  v_product_id uuid := '92000000-0000-4000-8000-000000000010';
  v_product_b uuid := '92000000-0000-4000-8000-000000000011';
  v_batch_id uuid := '92000000-0000-4000-8000-000000000020';
  v_batch_b uuid := '92000000-0000-4000-8000-000000000021';
  v_bundle_id uuid := '92000000-0000-4000-8000-000000000030';
  v_recipe_id uuid := '92000000-0000-4000-8000-000000000031';
  v_order_id uuid;
  v_order_item_id uuid;
  v_return_id uuid;
  v_return_item_id uuid;
  v_tiktok_return_id uuid;
  v_session_id uuid;
  v_receipt jsonb;
  v_before bigint;
  v_after bigint;
  v_count bigint;
  v_opname_count record;
begin
  insert into auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at
  )
  values (
    '00000000-0000-0000-0000-000000000000',
    v_user_id,
    'authenticated',
    'authenticated',
    'milestone4-test@stokledger.local',
    '',
    now(),
    '{}'::jsonb,
    '{"display_name":"Milestone 4 Test"}'::jsonb,
    now(),
    now()
  );

  perform set_config(
    'request.jwt.claims',
    jsonb_build_object(
      'sub', v_user_id,
      'role', 'authenticated'
    )::text,
    true
  );

  insert into public.products (id, sku, name)
  values
    (v_product_id, 'M4-SERUM-A', 'Milestone 4 Serum A'),
    (v_product_b, 'M4-TONER-B', 'Milestone 4 Toner B');

  insert into public.batches (
    id,
    product_id,
    batch_code,
    expiry_date,
    source_type
  )
  values
    (
      v_batch_id,
      v_product_id,
      'M4-SA-01',
      '2027-12-31',
      'PRODUCTION'
    ),
    (
      v_batch_b,
      v_product_b,
      'M4-TB-01',
      '2027-11-30',
      'PRODUCTION'
    );

  perform public.record_opening_balance(
    'm4:opening:a',
    v_product_id,
    v_batch_id,
    20,
    'M4 OPENING',
    '2026-07-01T00:00:00Z'
  );
  perform public.record_opening_balance(
    'm4:opening:b',
    v_product_b,
    v_batch_b,
    10,
    'M4 OPENING B',
    '2026-07-01T00:00:01Z'
  );

  insert into public.marketplace_listings (
    channel,
    listing_sku,
    listing_type,
    product_id,
    bundle_id
  )
  values
    ('SHOPEE', 'M4-SERUM-A', 'PHYSICAL', v_product_id, null),
    ('TIKTOK', 'M4-SERUM-A', 'PHYSICAL', v_product_id, null);

  insert into public.bundles (id, sku, name)
  values (v_bundle_id, 'M4-GLOW-KIT', 'Milestone 4 Glow Kit');

  insert into public.bundle_recipe_versions (
    id,
    bundle_id,
    version,
    effective_from
  )
  values (
    v_recipe_id,
    v_bundle_id,
    1,
    '2026-01-01T00:00:00Z'
  );

  insert into public.bundle_recipe_components (
    recipe_version_id,
    product_id,
    qty
  )
  values
    (v_recipe_id, v_product_id, 2),
    (v_recipe_id, v_product_b, 1);

  insert into public.marketplace_listings (
    channel,
    listing_sku,
    listing_type,
    product_id,
    bundle_id
  )
  values (
    'SHOPEE',
    'M4-GLOW-KIT',
    'BUNDLE',
    null,
    v_bundle_id
  );

  perform public.ingest_marketplace_event(
    'SIMULATOR',
    'M4-EVT-CREATE-SHP-001',
    'SHOPEE',
    'ORDER_CREATED',
    'M4-ORDER-SHP-001',
    '[{"external_line_id":"LINE-1","listing_sku":"M4-SERUM-A","quantity":5}]',
    '2026-07-02T00:00:00Z',
    '{"fixture":"M4-return"}'
  );

  perform public.ingest_marketplace_event(
    'SIMULATOR',
    'M4-EVT-SHIP-SHP-001',
    'SHOPEE',
    'ORDER_SHIPPED',
    'M4-ORDER-SHP-001',
    '[]',
    '2026-07-02T00:01:00Z',
    '{"fixture":"M4-return"}'
  );

  select orders.id, item.id
  into v_order_id, v_order_item_id
  from public.orders
  join public.order_items as item on item.order_id = orders.id
  where orders.channel = 'SHOPEE'
    and orders.external_order_id = 'M4-ORDER-SHP-001';

  -- AT-016: partial return leaves the remaining quantity returnable.
  v_receipt := public.create_return(
    'm4:return:partial:001',
    'SHOPEE',
    'M4-ORDER-SHP-001',
    'M4-RETURN-SHP-001',
    jsonb_build_array(
      jsonb_build_object(
        'order_item_id', v_order_item_id,
        'product_id', v_product_id,
        'qty', 2
      )
    ),
    '2026-07-03T00:00:00Z'
  );

  if v_receipt ->> 'outcome' <> 'APPLIED' then
    raise exception 'AT-016 partial return failed: %', v_receipt;
  end if;

  v_return_id := (v_receipt #>> '{return,id}')::uuid;

  select id into v_return_item_id
  from public.return_items
  where return_id = v_return_id;

  if (
    select shipped.shipped_qty - returned.returned_qty
    from (
      select sum(
        greatest(component.shipped_qty - component.cancelled_qty, 0)
      )::bigint as shipped_qty
      from public.order_item_components as component
      where component.order_item_id = v_order_item_id
        and component.product_id = v_product_id
    ) as shipped
    cross join (
      select sum(item.qty)::bigint as returned_qty
      from public.return_items as item
      where item.order_item_id = v_order_item_id
        and item.product_id = v_product_id
    ) as returned
  ) <> 3 then
    raise exception 'AT-016 remaining returnable quantity is not 3';
  end if;

  -- AT-017: over-return rejects without a return header or item.
  v_receipt := public.create_return(
    'm4:return:over:001',
    'SHOPEE',
    'M4-ORDER-SHP-001',
    'M4-RETURN-SHP-OVER',
    jsonb_build_array(
      jsonb_build_object(
        'order_item_id', v_order_item_id,
        'product_id', v_product_id,
        'qty', 4
      )
    ),
    '2026-07-03T00:01:00Z'
  );

  if v_receipt ->> 'outcome' <> 'REJECTED'
     or v_receipt #>> '{error,message}' <> 'RETURN_QUANTITY_EXCEEDS_SHIPPED'
     or exists (
       select 1
       from public.returns
       where external_return_id = 'M4-RETURN-SHP-OVER'
     ) then
    raise exception 'AT-017 over-return was not rejected atomically: %',
      v_receipt;
  end if;

  -- AT-018: SELLABLE creates a new RETURN batch and positive movement.
  v_receipt := public.inspect_return_item(
    'm4:inspect:sellable:001',
    v_return_item_id,
    'SELLABLE',
    'RETURN-M4-SA-001',
    '2027-09-30',
    '2026-07-03T01:00:00Z'
  );

  if v_receipt ->> 'outcome' <> 'APPLIED'
     or v_receipt #>> '{return_item,condition}' <> 'SELLABLE'
     or not exists (
       select 1
       from public.batches
       where batch_code = 'RETURN-M4-SA-001'
         and source_type = 'RETURN'
     )
     or not exists (
       select 1
       from public.stock_ledger
       where source_type = 'RETURN_INSPECTION'
         and source_id = v_return_item_id::text
         and reason = 'SELLABLE_RETURN'
         and qty_delta = 2
     ) then
    raise exception 'AT-018 sellable inspection is incorrect: %', v_receipt;
  end if;

  -- AT-019: DAMAGED stores condition without a second stock movement.
  v_receipt := public.create_return(
    'm4:return:damaged:001',
    'SHOPEE',
    'M4-ORDER-SHP-001',
    'M4-RETURN-SHP-002',
    jsonb_build_array(
      jsonb_build_object(
        'order_item_id', v_order_item_id,
        'product_id', v_product_id,
        'qty', 1
      )
    ),
    '2026-07-04T00:00:00Z'
  );

  select item.id into v_return_item_id
  from public.return_items as item
  where item.return_id = (v_receipt #>> '{return,id}')::uuid;

  select count(*) into v_before from public.stock_ledger;

  v_receipt := public.inspect_return_item(
    'm4:inspect:damaged:001',
    v_return_item_id,
    'DAMAGED',
    null,
    null,
    '2026-07-04T01:00:00Z'
  );

  select count(*) into v_after from public.stock_ledger;

  if v_receipt ->> 'outcome' <> 'APPLIED'
     or v_receipt #>> '{return_item,condition}' <> 'DAMAGED'
     or v_after <> v_before then
    raise exception 'AT-019 damaged inspection changed stock: %', v_receipt;
  end if;

  -- AT-020: LOST also records no second stock movement.
  v_receipt := public.create_return(
    'm4:return:lost:001',
    'SHOPEE',
    'M4-ORDER-SHP-001',
    'M4-RETURN-SHP-003',
    jsonb_build_array(
      jsonb_build_object(
        'order_item_id', v_order_item_id,
        'product_id', v_product_id,
        'qty', 1
      )
    ),
    '2026-07-05T00:00:00Z'
  );

  select item.id into v_return_item_id
  from public.return_items as item
  where item.return_id = (v_receipt #>> '{return,id}')::uuid;

  select count(*) into v_before from public.stock_ledger;

  v_receipt := public.inspect_return_item(
    'm4:inspect:lost:001',
    v_return_item_id,
    'LOST',
    null,
    null,
    '2026-07-05T01:00:00Z'
  );

  select count(*) into v_after from public.stock_ledger;

  if v_receipt ->> 'outcome' <> 'APPLIED'
     or v_receipt #>> '{return_item,condition}' <> 'LOST'
     or v_after <> v_before then
    raise exception 'AT-020 lost inspection changed stock: %', v_receipt;
  end if;

  -- AT-021: a partial bundle return targets one physical component only.
  perform public.ingest_marketplace_event(
    'SIMULATOR',
    'M4-EVT-CREATE-BUNDLE-001',
    'SHOPEE',
    'ORDER_CREATED',
    'M4-ORDER-BUNDLE-001',
    '[{"external_line_id":"KIT-1","listing_sku":"M4-GLOW-KIT","quantity":1}]',
    '2026-07-06T00:00:00Z',
    '{"fixture":"M4-bundle-return"}'
  );

  perform public.ingest_marketplace_event(
    'SIMULATOR',
    'M4-EVT-SHIP-BUNDLE-001',
    'SHOPEE',
    'ORDER_SHIPPED',
    'M4-ORDER-BUNDLE-001',
    '[]',
    '2026-07-06T00:01:00Z',
    '{"fixture":"M4-bundle-return"}'
  );

  select item.id into v_order_item_id
  from public.orders
  join public.order_items as item on item.order_id = orders.id
  where orders.channel = 'SHOPEE'
    and orders.external_order_id = 'M4-ORDER-BUNDLE-001';

  v_receipt := public.create_return(
    'm4:return:bundle:001',
    'SHOPEE',
    'M4-ORDER-BUNDLE-001',
    'M4-RETURN-BUNDLE-001',
    jsonb_build_array(
      jsonb_build_object(
        'order_item_id', v_order_item_id,
        'product_id', v_product_id,
        'qty', 1
      )
    ),
    '2026-07-06T01:00:00Z'
  );

  if v_receipt ->> 'outcome' <> 'APPLIED'
     or not exists (
       select 1
       from public.return_items
       where return_id = (v_receipt #>> '{return,id}')::uuid
         and product_id = v_product_id
         and qty = 1
     )
     or exists (
       select 1
       from public.return_items
       where return_id = (v_receipt #>> '{return,id}')::uuid
         and product_id = v_product_b
     ) then
    raise exception 'AT-021 partial bundle return is incorrect: %', v_receipt;
  end if;

  -- AT-022: TikTok deadline is exactly 40 days from return creation.
  perform public.ingest_marketplace_event(
    'SIMULATOR',
    'M4-EVT-CREATE-TT-001',
    'TIKTOK',
    'ORDER_CREATED',
    'M4-ORDER-TT-001',
    '[{"external_line_id":"LINE-1","listing_sku":"M4-SERUM-A","quantity":1}]',
    '2026-07-01T00:00:00Z',
    '{"fixture":"M4-claim"}'
  );

  perform public.ingest_marketplace_event(
    'SIMULATOR',
    'M4-EVT-SHIP-TT-001',
    'TIKTOK',
    'ORDER_SHIPPED',
    'M4-ORDER-TT-001',
    '[]',
    '2026-07-01T00:01:00Z',
    '{"fixture":"M4-claim"}'
  );

  select item.id into v_order_item_id
  from public.orders
  join public.order_items as item on item.order_id = orders.id
  where orders.channel = 'TIKTOK'
    and orders.external_order_id = 'M4-ORDER-TT-001';

  v_receipt := public.create_return(
    'm4:return:tiktok:001',
    'TIKTOK',
    'M4-ORDER-TT-001',
    'M4-RETURN-TT-001',
    jsonb_build_array(
      jsonb_build_object(
        'order_item_id', v_order_item_id,
        'product_id', v_product_id,
        'qty', 1
      )
    ),
    '2026-07-01T00:00:00Z'
  );
  v_tiktok_return_id := (v_receipt #>> '{return,id}')::uuid;

  if (
    select claim_deadline
    from public.returns
    where id = v_tiktok_return_id
  ) <> '2026-08-10T00:00:00Z'::timestamptz then
    raise exception 'AT-022 TikTok claim deadline is not creation + 40 days';
  end if;

  if not exists (
    select 1
    from public.notification_feed
    where return_id = v_tiktok_return_id
      and type = 'TIKTOK_CLAIM'
  ) then
    raise exception 'AT-022 TikTok claim reminder is missing';
  end if;

  -- AT-027 to AT-031: draft is inert, finalize is atomic and verifies opening.
  v_receipt := public.start_opname_session(
    'm4:opname:start:001',
    '2026-08-02T00:00:00Z'
  );
  v_session_id := (v_receipt ->> 'session_id')::uuid;

  select count(*) into v_before from public.stock_ledger;

  for v_opname_count in
    select *
    from public.opname_counts
    where session_id = v_session_id
  loop
    perform public.save_opname_count(
      v_session_id,
      v_opname_count.batch_id,
      case
        when v_opname_count.batch_id = v_batch_id
          then v_opname_count.system_qty - 1
        else v_opname_count.system_qty
      end
    );
  end loop;

  select count(*) into v_after from public.stock_ledger;
  if v_after <> v_before then
    raise exception 'AT-027 draft opname changed ledger';
  end if;

  -- AT-029: a stale snapshot rejects atomically and keeps the session draft.
  update public.stock_balances
  set on_hand_qty = on_hand_qty + 1
  where batch_id = v_batch_id
    and product_id = v_product_id;

  v_receipt := public.finalize_opname_session(
    'm4:opname:finalize:stale',
    v_session_id,
    '2026-08-02T00:30:00Z'
  );

  select count(*) into v_after from public.stock_ledger;

  if v_receipt ->> 'outcome' <> 'REJECTED'
     or v_receipt #>> '{error,message}' <> 'OPNAME_SNAPSHOT_STALE'
     or v_after <> v_before
     or not exists (
       select 1
       from public.opname_sessions
       where id = v_session_id
         and status = 'DRAFT'
     ) then
    raise exception 'AT-029 stale finalize was not atomic: %', v_receipt;
  end if;

  update public.stock_balances
  set on_hand_qty = on_hand_qty - 1
  where batch_id = v_batch_id
    and product_id = v_product_id;

  v_receipt := public.finalize_opname_session(
    'm4:opname:finalize:001',
    v_session_id,
    '2026-08-02T01:00:00Z'
  );

  if v_receipt ->> 'outcome' <> 'APPLIED'
     or not exists (
       select 1
       from public.stock_ledger
       where source_type = 'OPNAME_SESSION'
         and source_id = v_session_id::text
         and reason = 'OPNAME_ADJUSTMENT'
         and batch_id = v_batch_id
         and qty_delta = -1
     )
     or not exists (
       select 1
       from public.opening_balances
       where batch_id = v_batch_id
         and verification_status = 'VERIFIED'
         and verified_by_opname_session_id = v_session_id
     ) then
    raise exception 'AT-028/031 opname finalization is incorrect: %', v_receipt;
  end if;

  v_receipt := public.finalize_opname_session(
    'm4:opname:finalize:twice',
    v_session_id,
    '2026-08-02T01:01:00Z'
  );

  if v_receipt ->> 'outcome' <> 'REJECTED'
     or v_receipt #>> '{error,message}' <> 'OPNAME_SESSION_ALREADY_FINALIZED' then
    raise exception 'AT-030 second finalize was not rejected: %', v_receipt;
  end if;

  -- AT-033: reconciliation persists projection drift as evidence.
  update public.stock_balances
  set on_hand_qty = on_hand_qty + 1
  where batch_id = v_batch_id
    and product_id = v_product_id;

  perform public.run_daily_reconciliation('2026-08-02T02:00:00Z');

  if not exists (
    select 1
    from public.anomalies
    where type = 'PROJECTION_DRIFT'
      and batch_id = v_batch_id
      and status = 'OPEN'
  ) then
    raise exception 'AT-033 reconciliation did not detect projection drift';
  end if;

  select count(*) into v_count
  from public.anomalies
  where status = 'OPEN';

  if v_count < 1 then
    raise exception 'Milestone 4 anomaly worklist is unexpectedly empty';
  end if;
end;
$$;

rollback;

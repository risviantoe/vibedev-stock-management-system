-- Transactional Milestone 3 acceptance checks.
-- Run against the linked project with:
-- supabase db query --linked --file supabase/tests/003_marketplace_core.sql

begin;

do $$
declare
  v_user_id uuid := '91000000-0000-4000-8000-000000000001';
  v_product_a uuid := '91000000-0000-4000-8000-000000000010';
  v_product_b uuid := '91000000-0000-4000-8000-000000000011';
  v_product_c uuid := '91000000-0000-4000-8000-000000000012';
  v_batch_a_early uuid := '91000000-0000-4000-8000-000000000020';
  v_batch_a_late uuid := '91000000-0000-4000-8000-000000000021';
  v_batch_b uuid := '91000000-0000-4000-8000-000000000022';
  v_batch_c uuid := '91000000-0000-4000-8000-000000000023';
  v_bundle_id uuid := '91000000-0000-4000-8000-000000000030';
  v_recipe_v1 uuid := '91000000-0000-4000-8000-000000000031';
  v_recipe_v2 uuid := '91000000-0000-4000-8000-000000000032';
  v_promo_id uuid := '91000000-0000-4000-8000-000000000040';
  v_listing_id uuid;
  v_receipt jsonb;
  v_preview jsonb;
  v_order_id uuid;
  v_group_id uuid;
  v_before bigint;
  v_after bigint;
  v_count bigint;
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
    'marketplace-test@stokledger.local',
    '',
    now(),
    '{}'::jsonb,
    '{"display_name":"Marketplace Test"}'::jsonb,
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
    (v_product_a, 'M3-SERUM-A', 'Milestone 3 Serum A'),
    (v_product_b, 'M3-TONER-B', 'Milestone 3 Toner B'),
    (v_product_c, 'M3-MASK-C', 'Milestone 3 Mask C');

  -- Product marketplace listings are managed through an authenticated RPC.
  v_receipt := public.save_product_marketplace_listing(
    null,
    v_product_a,
    'SHOPEE',
    'M3-CUSTOM-A',
    true
  );
  v_listing_id := (v_receipt ->> 'id')::uuid;

  if v_receipt ->> 'listing_type' <> 'PHYSICAL'
     or (v_receipt ->> 'product_id')::uuid <> v_product_a
     or not (v_receipt ->> 'is_active')::boolean then
    raise exception 'Product marketplace listing create is incorrect: %',
      v_receipt;
  end if;

  v_receipt := public.save_product_marketplace_listing(
    v_listing_id,
    v_product_a,
    'SHOPEE',
    'M3-CUSTOM-A',
    false
  );

  if (v_receipt ->> 'is_active')::boolean then
    raise exception 'Product marketplace listing update did not deactivate';
  end if;

  begin
    perform public.save_product_marketplace_listing(
      null,
      v_product_b,
      'SHOPEE',
      'M3-CUSTOM-A',
      true
    );
    raise exception 'Duplicate marketplace listing SKU was accepted';
  exception
    when unique_violation then
      if sqlerrm <> 'MARKETPLACE_LISTING_SKU_ALREADY_EXISTS' then
        raise;
      end if;
  end;

  insert into public.batches (
    id,
    product_id,
    batch_code,
    expiry_date,
    source_type
  )
  values
    (v_batch_a_early, v_product_a, 'M3-SA-01', '2027-01-31', 'PRODUCTION'),
    (v_batch_a_late, v_product_a, 'M3-SA-02', '2027-06-30', 'PRODUCTION'),
    (v_batch_b, v_product_b, 'M3-TB-01', '2027-03-31', 'PRODUCTION'),
    (v_batch_c, v_product_c, 'M3-MC-01', '2027-04-30', 'PRODUCTION');

  perform public.record_opening_balance(
    'm3:opening:a1',
    v_product_a,
    v_batch_a_early,
    10,
    'M3 OPENING A1',
    '2026-07-26T00:00:00Z'
  );
  perform public.record_opening_balance(
    'm3:opening:a2',
    v_product_a,
    v_batch_a_late,
    35,
    'M3 OPENING A2',
    '2026-07-26T00:01:00Z'
  );
  perform public.record_opening_balance(
    'm3:opening:b',
    v_product_b,
    v_batch_b,
    20,
    'M3 OPENING B',
    '2026-07-26T00:02:00Z'
  );
  perform public.record_opening_balance(
    'm3:opening:c',
    v_product_c,
    v_batch_c,
    20,
    'M3 OPENING C',
    '2026-07-26T00:03:00Z'
  );

  insert into public.bundles (id, sku, name)
  values (v_bundle_id, 'M3-GLOW-KIT', 'Milestone 3 Glow Kit');

  insert into public.bundle_recipe_versions (
    id,
    bundle_id,
    version,
    effective_from
  )
  values (
    v_recipe_v1,
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
    (v_recipe_v1, v_product_a, 1),
    (v_recipe_v1, v_product_b, 1);

  insert into public.promo_rules (
    id,
    name,
    start_at,
    end_at,
    channel
  )
  values (
    v_promo_id,
    'M3 Buy 2 Get Mask',
    '2026-07-26T05:00:00Z',
    '2027-01-01T00:00:00Z',
    'SHOPEE'
  );

  insert into public.promo_rule_items (
    promo_rule_id,
    trigger_product_id,
    trigger_qty,
    free_product_id,
    free_qty
  )
  values (v_promo_id, v_product_a, 2, v_product_c, 1);

  insert into public.marketplace_listings (
    channel,
    listing_sku,
    listing_type,
    product_id,
    bundle_id
  )
  values
    ('SHOPEE', 'M3-SERUM-A', 'PHYSICAL', v_product_a, null),
    ('TIKTOK', 'M3-SERUM-A', 'PHYSICAL', v_product_a, null),
    ('SHOPEE', 'M3-GLOW-KIT', 'BUNDLE', null, v_bundle_id),
    ('TIKTOK', 'M3-GLOW-KIT', 'BUNDLE', null, v_bundle_id);

  -- AT-003: reservation changes available, not physical stock.
  v_receipt := public.ingest_marketplace_event(
    'SIMULATOR',
    'M3-EVT-RESERVE-001',
    'TIKTOK',
    'ORDER_CREATED',
    'M3-ORDER-RESERVE-001',
    '[{"external_line_id":"LINE-1","listing_sku":"M3-SERUM-A","quantity":12}]',
    '2026-07-26T01:00:00Z',
    '{"fixture":"AT-003"}'
  );

  if v_receipt ->> 'outcome' <> 'APPLIED' then
    raise exception 'AT-003 order creation failed: %', v_receipt;
  end if;

  select coalesce(sum(on_hand_qty), 0)::bigint
  into v_after
  from public.stock_balances
  where product_id = v_product_a;

  if v_after <> 45 then
    raise exception 'AT-003 on-hand changed during reservation: %', v_after;
  end if;

  select reserved_qty into v_after
  from public.product_reservations
  where product_id = v_product_a;

  if v_after <> 12 then
    raise exception 'AT-003 reserved expected 12, got %', v_after;
  end if;

  v_preview := public.preview_fefo_allocation(v_product_a, 34);

  if (v_preview ->> 'on_hand_qty')::bigint <> 45
     or (v_preview ->> 'reserved_qty')::bigint <> 12
     or (v_preview ->> 'available_qty')::bigint <> 33
     or (v_preview ->> 'sufficient')::boolean then
    raise exception 'AT-003 reservation-aware FEFO preview is incorrect: %',
      v_preview;
  end if;

  select count(*) into v_count
  from public.stock_ledger
  where source_type = 'MARKETPLACE_ORDER_ITEM_COMPONENT'
    and product_id in (v_product_a, v_product_b, v_product_c);

  if v_count <> 0 then
    raise exception 'AT-003 reservation unexpectedly wrote outbound ledger';
  end if;

  -- AT-004: pre-shipment cancellation releases reservation without reversal.
  v_receipt := public.ingest_marketplace_event(
    'SIMULATOR',
    'M3-EVT-CANCEL-PRE-001',
    'TIKTOK',
    'ORDER_CANCELLED',
    'M3-ORDER-RESERVE-001',
    '[{"external_line_id":"LINE-1","quantity":12}]',
    '2026-07-26T01:01:00Z',
    '{"fixture":"AT-004"}'
  );

  if v_receipt ->> 'outcome' <> 'APPLIED'
     or v_receipt ->> 'movement_group_id' is not null then
    raise exception 'AT-004 pre-ship cancel is incorrect: %', v_receipt;
  end if;

  select reserved_qty into v_after
  from public.product_reservations
  where product_id = v_product_a;

  if v_after <> 0 then
    raise exception 'AT-004 reservation was not released: %', v_after;
  end if;

  -- AT-005 and AT-007: Shopee shipment uses FEFO and duplicate is inert.
  perform public.ingest_marketplace_event(
    'SIMULATOR',
    'M3-EVT-CREATE-SHIP-001',
    'SHOPEE',
    'ORDER_CREATED',
    'M3-ORDER-SHIP-001',
    '[{"external_line_id":"LINE-1","listing_sku":"M3-SERUM-A","quantity":12}]',
    '2026-07-26T02:00:00Z',
    '{"fixture":"AT-005"}'
  );

  v_receipt := public.ingest_marketplace_event(
    'SIMULATOR',
    'M3-EVT-SHIP-001',
    'SHOPEE',
    'ORDER_SHIPPED',
    'M3-ORDER-SHIP-001',
    '[]',
    '2026-07-26T02:01:00Z',
    '{"fixture":"AT-005"}'
  );

  if v_receipt ->> 'outcome' <> 'APPLIED'
     or jsonb_array_length(v_receipt -> 'movements') <> 2 then
    raise exception 'AT-005 FEFO shipment is incorrect: %', v_receipt;
  end if;

  if (v_receipt #>> '{order,status}') <> 'SHIPPED' then
    raise exception 'AT-005 Shopee threshold status is incorrect: %', v_receipt;
  end if;

  select on_hand_qty into v_after
  from public.stock_balances
  where batch_id = v_batch_a_early;

  if v_after <> 0 then
    raise exception 'AT-005 early batch expected 0, got %', v_after;
  end if;

  select on_hand_qty into v_after
  from public.stock_balances
  where batch_id = v_batch_a_late;

  if v_after <> 33 then
    raise exception 'AT-005 later batch expected 33, got %', v_after;
  end if;

  select count(*) into v_count
  from public.stock_ledger
  where source_type = 'MARKETPLACE_ORDER_ITEM_COMPONENT'
    and product_id in (v_product_a, v_product_b, v_product_c);

  v_receipt := public.ingest_marketplace_event(
    'SIMULATOR',
    'M3-EVT-SHIP-001',
    'SHOPEE',
    'ORDER_SHIPPED',
    'M3-ORDER-SHIP-001',
    '[]',
    '2026-07-26T02:01:00Z',
    '{"fixture":"AT-005"}'
  );

  if v_receipt ->> 'outcome' <> 'DUPLICATE' then
    raise exception 'AT-007 duplicate ship was not detected: %', v_receipt;
  end if;

  if (
    select count(*)
    from public.stock_ledger
    where source_type = 'MARKETPLACE_ORDER_ITEM_COMPONENT'
      and product_id in (v_product_a, v_product_b, v_product_c)
  ) <> v_count then
    raise exception 'AT-007 duplicate shipment wrote a second movement';
  end if;

  -- AT-013: full post-shipment cancellation reverses every FEFO movement.
  v_receipt := public.ingest_marketplace_event(
    'SIMULATOR',
    'M3-EVT-CANCEL-POST-001',
    'SHOPEE',
    'ORDER_CANCELLED',
    'M3-ORDER-SHIP-001',
    '[{"external_line_id":"LINE-1","quantity":12}]',
    '2026-07-26T02:02:00Z',
    '{"fixture":"AT-013"}'
  );

  if v_receipt ->> 'outcome' <> 'APPLIED'
     or jsonb_array_length(v_receipt -> 'movements') <> 2 then
    raise exception 'AT-013 cancellation reversal is incorrect: %', v_receipt;
  end if;

  select coalesce(sum(on_hand_qty), 0)::bigint
  into v_after
  from public.stock_balances
  where product_id = v_product_a;

  if v_after <> 45 then
    raise exception 'AT-013 stock was not restored exactly: %', v_after;
  end if;

  v_receipt := public.ingest_marketplace_event(
    'SIMULATOR',
    'M3-EVT-CANCEL-POST-001',
    'SHOPEE',
    'ORDER_CANCELLED',
    'M3-ORDER-SHIP-001',
    '[{"external_line_id":"LINE-1","quantity":12}]',
    '2026-07-26T02:02:00Z',
    '{"fixture":"AT-013"}'
  );

  if v_receipt ->> 'outcome' <> 'DUPLICATE' then
    raise exception 'AT-015 duplicate cancellation was not inert: %', v_receipt;
  end if;

  -- AT-006: the same canonical shipment event moves TikTok to IN_TRANSIT.
  perform public.ingest_marketplace_event(
    'SIMULATOR',
    'M3-EVT-CREATE-TT-001',
    'TIKTOK',
    'ORDER_CREATED',
    'M3-ORDER-TT-001',
    '[{"external_line_id":"LINE-1","listing_sku":"M3-SERUM-A","quantity":5}]',
    '2026-07-26T03:00:00Z',
    '{"fixture":"AT-006"}'
  );

  v_receipt := public.ingest_marketplace_event(
    'SIMULATOR',
    'M3-EVT-SHIP-TT-001',
    'TIKTOK',
    'ORDER_SHIPPED',
    'M3-ORDER-TT-001',
    '[]',
    '2026-07-26T03:01:00Z',
    '{"fixture":"AT-006"}'
  );

  if v_receipt #>> '{order,status}' <> 'IN_TRANSIT' then
    raise exception 'AT-006 TikTok threshold is incorrect: %', v_receipt;
  end if;

  -- AT-011: recipe V1 remains frozen after V2 becomes active.
  perform public.ingest_marketplace_event(
    'SIMULATOR',
    'M3-EVT-CREATE-BUNDLE-001',
    'TIKTOK',
    'ORDER_CREATED',
    'M3-ORDER-BUNDLE-001',
    '[{"external_line_id":"KIT-1","listing_sku":"M3-GLOW-KIT","quantity":1}]',
    '2026-07-26T04:00:00Z',
    '{"fixture":"AT-011"}'
  );

  insert into public.bundle_recipe_versions (
    id,
    bundle_id,
    version,
    effective_from
  )
  values (
    v_recipe_v2,
    v_bundle_id,
    2,
    '2026-07-26T04:01:00Z'
  );

  insert into public.bundle_recipe_components (
    recipe_version_id,
    product_id,
    qty
  )
  values
    (v_recipe_v2, v_product_a, 1),
    (v_recipe_v2, v_product_c, 1);

  v_receipt := public.ingest_marketplace_event(
    'SIMULATOR',
    'M3-EVT-SHIP-BUNDLE-001',
    'TIKTOK',
    'ORDER_SHIPPED',
    'M3-ORDER-BUNDLE-001',
    '[]',
    '2026-07-26T04:02:00Z',
    '{"fixture":"AT-011"}'
  );

  select orders.id into v_order_id
  from public.orders
  where channel = 'TIKTOK'
    and external_order_id = 'M3-ORDER-BUNDLE-001';

  if not exists (
    select 1
    from public.order_item_components as component
    join public.order_items as item on item.id = component.order_item_id
    where item.order_id = v_order_id
      and component.product_id = v_product_b
      and component.recipe_version_id = v_recipe_v1
  ) or exists (
    select 1
    from public.order_item_components as component
    join public.order_items as item on item.id = component.order_item_id
    where item.order_id = v_order_id
      and component.product_id = v_product_c
  ) then
    raise exception 'AT-011 order did not preserve recipe V1 snapshot';
  end if;

  -- AT-012 and partial AT-014: promo is posted atomically, then reversed
  -- proportionally across two cancellation events.
  perform public.ingest_marketplace_event(
    'SIMULATOR',
    'M3-EVT-CREATE-PROMO-001',
    'SHOPEE',
    'ORDER_CREATED',
    'M3-ORDER-PROMO-001',
    '[{"external_line_id":"PROMO-1","listing_sku":"M3-SERUM-A","quantity":2}]',
    '2026-07-26T05:00:00Z',
    '{"fixture":"AT-012"}'
  );

  v_receipt := public.ingest_marketplace_event(
    'SIMULATOR',
    'M3-EVT-SHIP-PROMO-001',
    'SHOPEE',
    'ORDER_SHIPPED',
    'M3-ORDER-PROMO-001',
    '[]',
    '2026-07-26T05:01:00Z',
    '{"fixture":"AT-012"}'
  );

  v_group_id := (v_receipt ->> 'movement_group_id')::uuid;

  if (
    select count(distinct product_id)
    from public.stock_ledger
    where movement_group_id = v_group_id
      and qty_delta < 0
  ) <> 2 then
    raise exception 'AT-012 primary and promo were not posted atomically: %', v_receipt;
  end if;

  v_receipt := public.ingest_marketplace_event(
    'SIMULATOR',
    'M3-EVT-CANCEL-PROMO-001',
    'SHOPEE',
    'ORDER_CANCELLED',
    'M3-ORDER-PROMO-001',
    '[{"external_line_id":"PROMO-1","quantity":1}]',
    '2026-07-26T05:02:00Z',
    '{"fixture":"AT-014-partial-1"}'
  );

  if v_receipt #>> '{order,status}' <> 'PARTIALLY_CANCELLED' then
    raise exception 'AT-014 partial cancellation state is incorrect: %', v_receipt;
  end if;

  v_receipt := public.ingest_marketplace_event(
    'SIMULATOR',
    'M3-EVT-CANCEL-PROMO-002',
    'SHOPEE',
    'ORDER_CANCELLED',
    'M3-ORDER-PROMO-001',
    '[{"external_line_id":"PROMO-1","quantity":1}]',
    '2026-07-26T05:03:00Z',
    '{"fixture":"AT-014-partial-2"}'
  );

  if v_receipt #>> '{order,status}' <> 'CANCELLED' then
    raise exception 'AT-014 final cancellation state is incorrect: %', v_receipt;
  end if;

  if not exists (
    select 1
    from public.marketplace_cancellation_allocations as allocation
    join public.order_item_components as component
      on component.id = allocation.order_item_component_id
    where component.component_type = 'PROMO'
  ) then
    raise exception 'AT-014 promo movement was not reversed';
  end if;

  -- AT-010: a bundle shipment failure leaves every component untouched.
  perform public.ingest_marketplace_event(
    'SIMULATOR',
    'M3-EVT-CREATE-BUNDLE-FAIL-001',
    'TIKTOK',
    'ORDER_CREATED',
    'M3-ORDER-BUNDLE-FAIL-001',
    '[{"external_line_id":"KIT-FAIL","listing_sku":"M3-GLOW-KIT","quantity":1}]',
    '2026-07-26T06:00:00Z',
    '{"fixture":"AT-010"}'
  );

  select coalesce(sum(on_hand_qty), 0)::bigint
  into v_before
  from public.stock_balances
  where product_id = v_product_a;

  update public.stock_balances
  set on_hand_qty = 0
  where product_id = v_product_c;

  v_receipt := public.ingest_marketplace_event(
    'SIMULATOR',
    'M3-EVT-SHIP-BUNDLE-FAIL-001',
    'TIKTOK',
    'ORDER_SHIPPED',
    'M3-ORDER-BUNDLE-FAIL-001',
    '[]',
    '2026-07-26T06:01:00Z',
    '{"fixture":"AT-010"}'
  );

  if v_receipt ->> 'outcome' <> 'REJECTED' then
    raise exception 'AT-010 bundle shipment should reject atomically: %', v_receipt;
  end if;

  select coalesce(sum(on_hand_qty), 0)::bigint
  into v_after
  from public.stock_balances
  where product_id = v_product_a;

  if v_after <> v_before then
    raise exception 'AT-010 successful component changed during failed bundle shipment';
  end if;

  if exists (
    select 1
    from public.movement_groups
    where business_command_id = (
      select id
      from public.business_commands
      where source_id = (
        select id::text
        from public.marketplace_events
        where external_event_id = 'M3-EVT-SHIP-BUNDLE-FAIL-001'
          and source = 'SIMULATOR'
      )
    )
  ) then
    raise exception 'AT-010 failed bundle left a movement group';
  end if;
end;
$$;

rollback;

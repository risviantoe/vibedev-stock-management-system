begin;

alter table public.system_settings
  add column if not exists demo_reset_at timestamptz,
  add column if not exists demo_reset_by uuid
    references public.profiles (id) on delete set null,
  add column if not exists demo_generation integer not null default 0
    check (demo_generation >= 0);

create or replace function public.get_demo_dataset_status()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_settings public.system_settings%rowtype;
begin
  perform public.assert_admin();

  select *
  into strict v_settings
  from public.system_settings
  where id;

  return jsonb_build_object(
    'demo_mode', v_settings.demo_mode,
    'dataset_key', 'stokledger-demo-v1',
    'generation', v_settings.demo_generation,
    'last_reset_at', v_settings.demo_reset_at,
    'ready',
      (select count(*) >= 6 from public.products)
      and (select count(*) > 0 from public.stock_ledger)
      and (select count(*) > 0 from public.orders),
    'counts', jsonb_build_object(
      'products', (select count(*) from public.products),
      'batches', (select count(*) from public.batches),
      'orders', (select count(*) from public.orders),
      'movements', (select count(*) from public.stock_ledger),
      'returns', (select count(*) from public.returns),
      'open_anomalies',
        (select count(*) from public.anomalies where status = 'OPEN')
    )
  );
end;
$$;

create or replace function public.reset_demo_dataset(
  p_confirmation text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_actor_id uuid := auth.uid();
  v_reset_at timestamptz := date_trunc('minute', clock_timestamp());
  v_generation integer;
begin
  perform public.assert_admin();

  if not coalesce(
    (
      select settings.demo_mode
      from public.system_settings as settings
      where settings.id
    ),
    false
  ) then
    raise exception using
      errcode = '42501',
      message = 'DEMO_MODE_REQUIRED';
  end if;

  if p_confirmation is distinct from 'RESET DEMO' then
    raise exception using
      errcode = '22023',
      message = 'DEMO_RESET_CONFIRMATION_REQUIRED';
  end if;

  perform pg_advisory_xact_lock(hashtext('stokledger:demo-reset'));

  truncate table
    public.products,
    public.bundles,
    public.promo_rules,
    public.marketplace_events,
    public.opname_sessions,
    public.anomalies,
    public.business_commands
  restart identity cascade;

  insert into public.products (id, sku, name, is_active)
  values
    (
      '61000000-0000-4000-8000-000000000001',
      'CLN-GENTLE-100',
      'Gentle Barrier Cleanser 100 ml',
      true
    ),
    (
      '61000000-0000-4000-8000-000000000002',
      'SER-NIAC-020',
      'Niacinamide Serum 20 ml',
      true
    ),
    (
      '61000000-0000-4000-8000-000000000003',
      'SUN-DAILY-030',
      'Daily Shield Sunscreen 30 ml',
      true
    ),
    (
      '61000000-0000-4000-8000-000000000004',
      'TON-HYDR-100',
      'Hydrating Essence Toner 100 ml',
      true
    ),
    (
      '61000000-0000-4000-8000-000000000005',
      'MSK-CALM-001',
      'Calming Sheet Mask',
      true
    ),
    (
      '61000000-0000-4000-8000-000000000006',
      'LIP-BALM-010',
      'Ceramide Lip Balm 10 g',
      true
    );

  insert into public.batches (
    id,
    product_id,
    batch_code,
    expiry_date,
    source_type
  )
  values
    (
      '62000000-0000-4000-8000-000000000001',
      '61000000-0000-4000-8000-000000000001',
      'CLN-DEMO-FEFO-A',
      current_date + 120,
      'PRODUCTION'
    ),
    (
      '62000000-0000-4000-8000-000000000002',
      '61000000-0000-4000-8000-000000000001',
      'CLN-DEMO-FEFO-B',
      current_date + 300,
      'PRODUCTION'
    ),
    (
      '62000000-0000-4000-8000-000000000003',
      '61000000-0000-4000-8000-000000000002',
      'SER-DEMO-A',
      current_date + 150,
      'PRODUCTION'
    ),
    (
      '62000000-0000-4000-8000-000000000004',
      '61000000-0000-4000-8000-000000000002',
      'SER-DEMO-B',
      current_date + 330,
      'PRODUCTION'
    ),
    (
      '62000000-0000-4000-8000-000000000005',
      '61000000-0000-4000-8000-000000000003',
      'SUN-DEMO-A',
      current_date + 210,
      'PRODUCTION'
    ),
    (
      '62000000-0000-4000-8000-000000000006',
      '61000000-0000-4000-8000-000000000004',
      'TON-DEMO-A',
      current_date + 240,
      'PRODUCTION'
    ),
    (
      '62000000-0000-4000-8000-000000000007',
      '61000000-0000-4000-8000-000000000005',
      'MSK-DEMO-EXPIRY',
      current_date + 30,
      'PRODUCTION'
    ),
    (
      '62000000-0000-4000-8000-000000000008',
      '61000000-0000-4000-8000-000000000006',
      'LIP-DEMO-OPENING',
      current_date + 365,
      'PRODUCTION'
    ),
    (
      '62000000-0000-4000-8000-000000000009',
      '61000000-0000-4000-8000-000000000001',
      'RETURN-DEMO-CLN-001',
      current_date + 365,
      'RETURN'
    );

  insert into public.bundles (id, sku, name, is_active)
  values (
    '63000000-0000-4000-8000-000000000001',
    'GLOW-KIT',
    'Glow Routine Kit',
    true
  );

  insert into public.bundle_recipe_versions (
    id,
    bundle_id,
    version,
    effective_from
  )
  values (
    '63100000-0000-4000-8000-000000000001',
    '63000000-0000-4000-8000-000000000001',
    1,
    v_reset_at - interval '365 days'
  );

  insert into public.bundle_recipe_components (
    id,
    recipe_version_id,
    product_id,
    qty
  )
  values
    (
      '63200000-0000-4000-8000-000000000001',
      '63100000-0000-4000-8000-000000000001',
      '61000000-0000-4000-8000-000000000002',
      1
    ),
    (
      '63200000-0000-4000-8000-000000000002',
      '63100000-0000-4000-8000-000000000001',
      '61000000-0000-4000-8000-000000000004',
      1
    );

  insert into public.promo_rules (
    id,
    name,
    start_at,
    end_at,
    channel,
    is_active
  )
  values (
    '63300000-0000-4000-8000-000000000001',
    'Serum Bonus Mask',
    v_reset_at - interval '30 days',
    v_reset_at + interval '365 days',
    'SHOPEE',
    true
  );

  insert into public.promo_rule_items (
    id,
    promo_rule_id,
    trigger_product_id,
    trigger_qty,
    free_product_id,
    free_qty
  )
  values (
    '63400000-0000-4000-8000-000000000001',
    '63300000-0000-4000-8000-000000000001',
    '61000000-0000-4000-8000-000000000002',
    2,
    '61000000-0000-4000-8000-000000000005',
    1
  );

  insert into public.marketplace_listings (
    id,
    channel,
    listing_sku,
    listing_type,
    product_id,
    bundle_id,
    is_active
  )
  values
    (
      '63500000-0000-4000-8000-000000000001',
      'SHOPEE',
      'CLN-GENTLE-100',
      'PHYSICAL',
      '61000000-0000-4000-8000-000000000001',
      null,
      true
    ),
    (
      '63500000-0000-4000-8000-000000000002',
      'SHOPEE',
      'SER-NIAC-020',
      'PHYSICAL',
      '61000000-0000-4000-8000-000000000002',
      null,
      true
    ),
    (
      '63500000-0000-4000-8000-000000000003',
      'SHOPEE',
      'SUN-DAILY-030',
      'PHYSICAL',
      '61000000-0000-4000-8000-000000000003',
      null,
      true
    ),
    (
      '63500000-0000-4000-8000-000000000004',
      'SHOPEE',
      'TON-HYDR-100',
      'PHYSICAL',
      '61000000-0000-4000-8000-000000000004',
      null,
      true
    ),
    (
      '63500000-0000-4000-8000-000000000005',
      'SHOPEE',
      'MSK-CALM-001',
      'PHYSICAL',
      '61000000-0000-4000-8000-000000000005',
      null,
      true
    ),
    (
      '63500000-0000-4000-8000-000000000006',
      'SHOPEE',
      'LIP-BALM-010',
      'PHYSICAL',
      '61000000-0000-4000-8000-000000000006',
      null,
      true
    ),
    (
      '63500000-0000-4000-8000-000000000007',
      'SHOPEE',
      'GLOW-KIT',
      'BUNDLE',
      null,
      '63000000-0000-4000-8000-000000000001',
      true
    ),
    (
      '63500000-0000-4000-8000-000000000101',
      'TIKTOK',
      'CLN-GENTLE-100',
      'PHYSICAL',
      '61000000-0000-4000-8000-000000000001',
      null,
      true
    ),
    (
      '63500000-0000-4000-8000-000000000102',
      'TIKTOK',
      'SER-NIAC-020',
      'PHYSICAL',
      '61000000-0000-4000-8000-000000000002',
      null,
      true
    ),
    (
      '63500000-0000-4000-8000-000000000103',
      'TIKTOK',
      'SUN-DAILY-030',
      'PHYSICAL',
      '61000000-0000-4000-8000-000000000003',
      null,
      true
    ),
    (
      '63500000-0000-4000-8000-000000000104',
      'TIKTOK',
      'TON-HYDR-100',
      'PHYSICAL',
      '61000000-0000-4000-8000-000000000004',
      null,
      true
    ),
    (
      '63500000-0000-4000-8000-000000000105',
      'TIKTOK',
      'MSK-CALM-001',
      'PHYSICAL',
      '61000000-0000-4000-8000-000000000005',
      null,
      true
    ),
    (
      '63500000-0000-4000-8000-000000000106',
      'TIKTOK',
      'LIP-BALM-010',
      'PHYSICAL',
      '61000000-0000-4000-8000-000000000006',
      null,
      true
    ),
    (
      '63500000-0000-4000-8000-000000000107',
      'TIKTOK',
      'GLOW-KIT',
      'BUNDLE',
      null,
      '63000000-0000-4000-8000-000000000001',
      true
    );

  insert into public.business_commands (
    id,
    command_type,
    idempotency_key,
    request_hash,
    status,
    actor_id,
    source_type,
    source_id,
    created_at,
    completed_at
  )
  select
    command.id::uuid,
    command.command_type,
    command.idempotency_key,
    encode(extensions.digest(command.idempotency_key, 'sha256'), 'hex'),
    'APPLIED',
    v_actor_id,
    command.source_type,
    command.source_id,
    v_reset_at + command.offset_interval,
    v_reset_at + command.offset_interval
  from (
    values
      (
        '64000000-0000-4000-8000-000000000001',
        'OPENING_BALANCE',
        'demo:v1:opening:cleanser',
        'DEMO_SEED',
        'CLN-DEMO-FEFO-A',
        interval '-10 days'
      ),
      (
        '64000000-0000-4000-8000-000000000002',
        'OPENING_BALANCE',
        'demo:v1:opening:lip-balm',
        'DEMO_SEED',
        'LIP-DEMO-OPENING',
        interval '-10 days'
      ),
      (
        '64000000-0000-4000-8000-000000000003',
        'RECEIVE_GOODS',
        'demo:v1:inbound:cleanser',
        'DEMO_SEED',
        'CLN-DEMO-FEFO-B',
        interval '-9 days'
      ),
      (
        '64000000-0000-4000-8000-000000000004',
        'RECEIVE_GOODS',
        'demo:v1:inbound:serum-a',
        'DEMO_SEED',
        'SER-DEMO-A',
        interval '-9 days'
      ),
      (
        '64000000-0000-4000-8000-000000000005',
        'CORRECT_MOVEMENT',
        'demo:v1:correction:serum-a',
        'DEMO_SEED',
        'SER-DEMO-A',
        interval '-8 days'
      ),
      (
        '64000000-0000-4000-8000-000000000006',
        'RECEIVE_GOODS',
        'demo:v1:inbound:serum-b',
        'DEMO_SEED',
        'SER-DEMO-B',
        interval '-9 days'
      ),
      (
        '64000000-0000-4000-8000-000000000007',
        'RECEIVE_GOODS',
        'demo:v1:inbound:sunscreen',
        'DEMO_SEED',
        'SUN-DEMO-A',
        interval '-9 days'
      ),
      (
        '64000000-0000-4000-8000-000000000008',
        'RECEIVE_GOODS',
        'demo:v1:inbound:toner',
        'DEMO_SEED',
        'TON-DEMO-A',
        interval '-9 days'
      ),
      (
        '64000000-0000-4000-8000-000000000009',
        'RECEIVE_GOODS',
        'demo:v1:inbound:mask',
        'DEMO_SEED',
        'MSK-DEMO-EXPIRY',
        interval '-9 days'
      ),
      (
        '64000000-0000-4000-8000-000000000010',
        'MARKETPLACE_ORDER_CREATED',
        'demo:v1:event:tiktok-created',
        'MARKETPLACE_EVENT',
        'DEMO-TT-CREATED-001',
        interval '-7 days'
      ),
      (
        '64000000-0000-4000-8000-000000000011',
        'MARKETPLACE_ORDER_SHIPPED',
        'demo:v1:event:tiktok-shipped',
        'MARKETPLACE_EVENT',
        'DEMO-TT-SHIPPED-001',
        interval '-6 days'
      ),
      (
        '64000000-0000-4000-8000-000000000012',
        'MARKETPLACE_ORDER_CREATED',
        'demo:v1:event:shopee-reserved',
        'MARKETPLACE_EVENT',
        'DEMO-SHP-CREATED-001',
        interval '-1 day'
      ),
      (
        '64000000-0000-4000-8000-000000000013',
        'CREATE_RETURN',
        'demo:v1:return:create',
        'RETURN',
        'DEMO-TT-RETURN-001',
        interval '-3 days'
      ),
      (
        '64000000-0000-4000-8000-000000000014',
        'INSPECT_RETURN',
        'demo:v1:return:inspect',
        'RETURN',
        'DEMO-TT-RETURN-001',
        interval '-2 days'
      ),
      (
        '64000000-0000-4000-8000-000000000015',
        'FINALIZE_OPNAME',
        'demo:v1:opname:finalize',
        'OPNAME',
        'DEMO-OPNAME-001',
        interval '-4 days'
      )
  ) as command(
    id,
    command_type,
    idempotency_key,
    source_type,
    source_id,
    offset_interval
  );

  insert into public.marketplace_events (
    id,
    source,
    external_event_id,
    channel,
    event_type,
    external_order_id,
    raw_payload,
    canonical_payload,
    payload_hash,
    occurred_at,
    received_at,
    processed_at,
    processing_status,
    business_command_id
  )
  values
    (
      '65000000-0000-4000-8000-000000000001',
      'SIMULATOR',
      'DEMO-TT-CREATED-001',
      'TIKTOK',
      'ORDER_CREATED',
      'DEMO-TT-ORDER-001',
      '{"scenario":"shipped-fefo-split"}'::jsonb,
      '{"scenario":"shipped-fefo-split","status":"created"}'::jsonb,
      encode(
        extensions.digest('demo:v1:event:tiktok-created', 'sha256'),
        'hex'
      ),
      v_reset_at - interval '7 days',
      v_reset_at - interval '7 days',
      v_reset_at - interval '7 days',
      'APPLIED',
      '64000000-0000-4000-8000-000000000010'
    ),
    (
      '65000000-0000-4000-8000-000000000002',
      'SIMULATOR',
      'DEMO-TT-SHIPPED-001',
      'TIKTOK',
      'ORDER_SHIPPED',
      'DEMO-TT-ORDER-001',
      '{"scenario":"shipped-fefo-split"}'::jsonb,
      '{"scenario":"shipped-fefo-split","status":"in_transit"}'::jsonb,
      encode(
        extensions.digest('demo:v1:event:tiktok-shipped', 'sha256'),
        'hex'
      ),
      v_reset_at - interval '6 days',
      v_reset_at - interval '6 days',
      v_reset_at - interval '6 days',
      'APPLIED',
      '64000000-0000-4000-8000-000000000011'
    ),
    (
      '65000000-0000-4000-8000-000000000003',
      'SIMULATOR',
      'DEMO-SHP-CREATED-001',
      'SHOPEE',
      'ORDER_CREATED',
      'DEMO-SHP-ORDER-001',
      '{"scenario":"reserved-multi-item"}'::jsonb,
      '{"scenario":"reserved-multi-item","items":2}'::jsonb,
      encode(
        extensions.digest('demo:v1:event:shopee-reserved', 'sha256'),
        'hex'
      ),
      v_reset_at - interval '1 day',
      v_reset_at - interval '1 day',
      v_reset_at - interval '1 day',
      'APPLIED',
      '64000000-0000-4000-8000-000000000012'
    );

  insert into public.marketplace_event_attempts (
    id,
    marketplace_event_id,
    attempt_no,
    processing_status,
    payload_hash,
    received_at,
    processed_at
  )
  values
    (
      '65010000-0000-4000-8000-000000000001',
      '65000000-0000-4000-8000-000000000001',
      1,
      'APPLIED',
      encode(
        extensions.digest('demo:v1:event:tiktok-created', 'sha256'),
        'hex'
      ),
      v_reset_at - interval '7 days',
      v_reset_at - interval '7 days'
    ),
    (
      '65010000-0000-4000-8000-000000000002',
      '65000000-0000-4000-8000-000000000002',
      1,
      'APPLIED',
      encode(
        extensions.digest('demo:v1:event:tiktok-shipped', 'sha256'),
        'hex'
      ),
      v_reset_at - interval '6 days',
      v_reset_at - interval '6 days'
    ),
    (
      '65010000-0000-4000-8000-000000000003',
      '65000000-0000-4000-8000-000000000003',
      1,
      'APPLIED',
      encode(
        extensions.digest('demo:v1:event:shopee-reserved', 'sha256'),
        'hex'
      ),
      v_reset_at - interval '1 day',
      v_reset_at - interval '1 day'
    ),
    (
      '65010000-0000-4000-8000-000000000004',
      '65000000-0000-4000-8000-000000000003',
      2,
      'DUPLICATE',
      encode(
        extensions.digest('demo:v1:event:shopee-reserved', 'sha256'),
        'hex'
      ),
      v_reset_at - interval '23 hours',
      v_reset_at - interval '23 hours'
    );

  insert into public.orders (
    id,
    external_order_id,
    channel,
    status,
    created_event_id,
    last_event_id,
    ordered_at,
    shipped_at,
    created_at,
    updated_at
  )
  values
    (
      '65100000-0000-4000-8000-000000000001',
      'DEMO-TT-ORDER-001',
      'TIKTOK',
      'IN_TRANSIT',
      '65000000-0000-4000-8000-000000000001',
      '65000000-0000-4000-8000-000000000002',
      v_reset_at - interval '7 days',
      v_reset_at - interval '6 days',
      v_reset_at - interval '7 days',
      v_reset_at - interval '6 days'
    ),
    (
      '65100000-0000-4000-8000-000000000002',
      'DEMO-SHP-ORDER-001',
      'SHOPEE',
      'RESERVED',
      '65000000-0000-4000-8000-000000000003',
      '65000000-0000-4000-8000-000000000003',
      v_reset_at - interval '1 day',
      null,
      v_reset_at - interval '1 day',
      v_reset_at - interval '1 day'
    );

  insert into public.order_items (
    id,
    order_id,
    external_line_id,
    listing_sku,
    listing_type,
    ordered_qty,
    reserved_qty,
    shipped_qty,
    cancelled_qty,
    returned_qty,
    created_at,
    updated_at
  )
  values
    (
      '65200000-0000-4000-8000-000000000001',
      '65100000-0000-4000-8000-000000000001',
      'LINE-CLN-001',
      'CLN-GENTLE-100',
      'PHYSICAL',
      50,
      0,
      50,
      0,
      5,
      v_reset_at - interval '7 days',
      v_reset_at - interval '2 days'
    ),
    (
      '65200000-0000-4000-8000-000000000002',
      '65100000-0000-4000-8000-000000000002',
      'LINE-SUN-001',
      'SUN-DAILY-030',
      'PHYSICAL',
      2,
      2,
      0,
      0,
      0,
      v_reset_at - interval '1 day',
      v_reset_at - interval '1 day'
    ),
    (
      '65200000-0000-4000-8000-000000000003',
      '65100000-0000-4000-8000-000000000002',
      'LINE-GLOW-001',
      'GLOW-KIT',
      'BUNDLE',
      1,
      1,
      0,
      0,
      0,
      v_reset_at - interval '1 day',
      v_reset_at - interval '1 day'
    );

  insert into public.order_item_components (
    id,
    order_item_id,
    product_id,
    component_type,
    qty_per_item,
    ordered_component_qty,
    reserved_qty,
    shipped_qty,
    cancelled_qty,
    recipe_version_id,
    promo_rule_id,
    snapshot,
    created_at,
    updated_at
  )
  values
    (
      '65300000-0000-4000-8000-000000000001',
      '65200000-0000-4000-8000-000000000001',
      '61000000-0000-4000-8000-000000000001',
      'PRIMARY',
      1,
      50,
      0,
      50,
      0,
      null,
      null,
      '{"listing_sku":"CLN-GENTLE-100","listing_type":"PHYSICAL"}'::jsonb,
      v_reset_at - interval '7 days',
      v_reset_at - interval '6 days'
    ),
    (
      '65300000-0000-4000-8000-000000000002',
      '65200000-0000-4000-8000-000000000002',
      '61000000-0000-4000-8000-000000000003',
      'PRIMARY',
      1,
      2,
      2,
      0,
      0,
      null,
      null,
      '{"listing_sku":"SUN-DAILY-030","listing_type":"PHYSICAL"}'::jsonb,
      v_reset_at - interval '1 day',
      v_reset_at - interval '1 day'
    ),
    (
      '65300000-0000-4000-8000-000000000003',
      '65200000-0000-4000-8000-000000000003',
      '61000000-0000-4000-8000-000000000002',
      'BUNDLE_COMPONENT',
      1,
      1,
      1,
      0,
      0,
      '63100000-0000-4000-8000-000000000001',
      null,
      '{"bundle_sku":"GLOW-KIT","recipe_version":1,"component":"SER-NIAC-020"}'::jsonb,
      v_reset_at - interval '1 day',
      v_reset_at - interval '1 day'
    ),
    (
      '65300000-0000-4000-8000-000000000004',
      '65200000-0000-4000-8000-000000000003',
      '61000000-0000-4000-8000-000000000004',
      'BUNDLE_COMPONENT',
      1,
      1,
      1,
      0,
      0,
      '63100000-0000-4000-8000-000000000001',
      null,
      '{"bundle_sku":"GLOW-KIT","recipe_version":1,"component":"TON-HYDR-100"}'::jsonb,
      v_reset_at - interval '1 day',
      v_reset_at - interval '1 day'
    );

  insert into public.product_reservations (product_id, reserved_qty)
  values
    ('61000000-0000-4000-8000-000000000001', 0),
    ('61000000-0000-4000-8000-000000000002', 1),
    ('61000000-0000-4000-8000-000000000003', 2),
    ('61000000-0000-4000-8000-000000000004', 1),
    ('61000000-0000-4000-8000-000000000005', 0),
    ('61000000-0000-4000-8000-000000000006', 0);

  insert into public.opname_sessions (
    id,
    idempotency_key,
    status,
    actor_id,
    started_at,
    finalized_at,
    finalized_command_id,
    created_at,
    updated_at
  )
  values (
    '65600000-0000-4000-8000-000000000001',
    'demo:v1:opname:session',
    'FINALIZED',
    v_actor_id,
    v_reset_at - interval '5 days',
    v_reset_at - interval '4 days',
    '64000000-0000-4000-8000-000000000015',
    v_reset_at - interval '5 days',
    v_reset_at - interval '4 days'
  );

  insert into public.opname_counts (
    session_id,
    product_id,
    batch_id,
    system_qty,
    physical_qty,
    variance_qty,
    saved_at
  )
  values
    (
      '65600000-0000-4000-8000-000000000001',
      '61000000-0000-4000-8000-000000000001',
      '62000000-0000-4000-8000-000000000001',
      0,
      0,
      0,
      v_reset_at - interval '4 days'
    ),
    (
      '65600000-0000-4000-8000-000000000001',
      '61000000-0000-4000-8000-000000000001',
      '62000000-0000-4000-8000-000000000002',
      50,
      52,
      2,
      v_reset_at - interval '4 days'
    );

  insert into public.opening_balances (
    id,
    product_id,
    batch_id,
    qty,
    verification_status,
    verified_by_opname_session_id,
    created_at,
    verified_at
  )
  values
    (
      '64300000-0000-4000-8000-000000000001',
      '61000000-0000-4000-8000-000000000001',
      '62000000-0000-4000-8000-000000000001',
      40,
      'VERIFIED',
      '65600000-0000-4000-8000-000000000001',
      v_reset_at - interval '10 days',
      v_reset_at - interval '4 days'
    ),
    (
      '64300000-0000-4000-8000-000000000002',
      '61000000-0000-4000-8000-000000000006',
      '62000000-0000-4000-8000-000000000008',
      25,
      'UNVERIFIED',
      null,
      v_reset_at - interval '10 days',
      null
    );

  insert into public.returns (
    id,
    external_return_id,
    order_id,
    channel,
    claim_deadline,
    claim_status,
    created_command_id,
    created_by,
    created_at,
    recorded_at,
    updated_at
  )
  values (
    '65400000-0000-4000-8000-000000000001',
    'DEMO-TT-RETURN-001',
    '65100000-0000-4000-8000-000000000001',
    'TIKTOK',
    v_reset_at + interval '5 days',
    'OPEN',
    '64000000-0000-4000-8000-000000000013',
    v_actor_id,
    v_reset_at - interval '3 days',
    v_reset_at - interval '3 days',
    v_reset_at - interval '2 days'
  );

  insert into public.return_items (
    id,
    return_id,
    order_item_id,
    product_id,
    qty,
    inspection_status,
    condition,
    return_batch_id,
    inspected_command_id,
    inspected_by,
    inspected_at,
    created_at,
    updated_at
  )
  values (
    '65500000-0000-4000-8000-000000000001',
    '65400000-0000-4000-8000-000000000001',
    '65200000-0000-4000-8000-000000000001',
    '61000000-0000-4000-8000-000000000001',
    5,
    'INSPECTED',
    'SELLABLE',
    '62000000-0000-4000-8000-000000000009',
    '64000000-0000-4000-8000-000000000014',
    v_actor_id,
    v_reset_at - interval '2 days',
    v_reset_at - interval '3 days',
    v_reset_at - interval '2 days'
  );

  insert into public.movement_groups (
    id,
    business_command_id,
    group_type,
    source_type,
    source_id,
    created_at
  )
  values
    (
      '64100000-0000-4000-8000-000000000001',
      '64000000-0000-4000-8000-000000000001',
      'OPENING_BALANCE',
      'DEMO_SEED',
      'CLN-DEMO-FEFO-A',
      v_reset_at - interval '10 days'
    ),
    (
      '64100000-0000-4000-8000-000000000002',
      '64000000-0000-4000-8000-000000000002',
      'OPENING_BALANCE',
      'DEMO_SEED',
      'LIP-DEMO-OPENING',
      v_reset_at - interval '10 days'
    ),
    (
      '64100000-0000-4000-8000-000000000003',
      '64000000-0000-4000-8000-000000000003',
      'RECEIVE_GOODS',
      'DEMO_SEED',
      'CLN-DEMO-FEFO-B',
      v_reset_at - interval '9 days'
    ),
    (
      '64100000-0000-4000-8000-000000000004',
      '64000000-0000-4000-8000-000000000004',
      'RECEIVE_GOODS',
      'DEMO_SEED',
      'SER-DEMO-A',
      v_reset_at - interval '9 days'
    ),
    (
      '64100000-0000-4000-8000-000000000005',
      '64000000-0000-4000-8000-000000000005',
      'CORRECTION',
      'DEMO_SEED',
      'SER-DEMO-A',
      v_reset_at - interval '8 days'
    ),
    (
      '64100000-0000-4000-8000-000000000006',
      '64000000-0000-4000-8000-000000000006',
      'RECEIVE_GOODS',
      'DEMO_SEED',
      'SER-DEMO-B',
      v_reset_at - interval '9 days'
    ),
    (
      '64100000-0000-4000-8000-000000000007',
      '64000000-0000-4000-8000-000000000007',
      'RECEIVE_GOODS',
      'DEMO_SEED',
      'SUN-DEMO-A',
      v_reset_at - interval '9 days'
    ),
    (
      '64100000-0000-4000-8000-000000000008',
      '64000000-0000-4000-8000-000000000008',
      'RECEIVE_GOODS',
      'DEMO_SEED',
      'TON-DEMO-A',
      v_reset_at - interval '9 days'
    ),
    (
      '64100000-0000-4000-8000-000000000009',
      '64000000-0000-4000-8000-000000000009',
      'RECEIVE_GOODS',
      'DEMO_SEED',
      'MSK-DEMO-EXPIRY',
      v_reset_at - interval '9 days'
    ),
    (
      '64100000-0000-4000-8000-000000000010',
      '64000000-0000-4000-8000-000000000011',
      'MARKETPLACE_SHIPMENT',
      'MARKETPLACE_EVENT',
      'DEMO-TT-SHIPPED-001',
      v_reset_at - interval '6 days'
    ),
    (
      '64100000-0000-4000-8000-000000000011',
      '64000000-0000-4000-8000-000000000014',
      'RETURN_INSPECTION',
      'RETURN',
      'DEMO-TT-RETURN-001',
      v_reset_at - interval '2 days'
    ),
    (
      '64100000-0000-4000-8000-000000000012',
      '64000000-0000-4000-8000-000000000015',
      'OPNAME',
      'OPNAME',
      'DEMO-OPNAME-001',
      v_reset_at - interval '4 days'
    );

  insert into public.stock_ledger (
    id,
    movement_group_id,
    product_id,
    batch_id,
    qty_delta,
    reason,
    channel,
    source_type,
    source_id,
    reference,
    actor_id,
    movement_key,
    occurred_at,
    created_at
  )
  values
    (
      '64200000-0000-4000-8000-000000000001',
      '64100000-0000-4000-8000-000000000001',
      '61000000-0000-4000-8000-000000000001',
      '62000000-0000-4000-8000-000000000001',
      40,
      'OPENING_BALANCE',
      'INTERNAL',
      'DEMO_OPENING',
      'CLN-DEMO-FEFO-A',
      'DEMO-OPENING-CLN',
      v_actor_id,
      'opening:cleanser',
      v_reset_at - interval '10 days',
      v_reset_at - interval '10 days'
    ),
    (
      '64200000-0000-4000-8000-000000000002',
      '64100000-0000-4000-8000-000000000002',
      '61000000-0000-4000-8000-000000000006',
      '62000000-0000-4000-8000-000000000008',
      25,
      'OPENING_BALANCE',
      'INTERNAL',
      'DEMO_OPENING',
      'LIP-DEMO-OPENING',
      'DEMO-OPENING-LIP',
      v_actor_id,
      'opening:lip-balm',
      v_reset_at - interval '10 days',
      v_reset_at - interval '10 days'
    ),
    (
      '64200000-0000-4000-8000-000000000003',
      '64100000-0000-4000-8000-000000000003',
      '61000000-0000-4000-8000-000000000001',
      '62000000-0000-4000-8000-000000000002',
      60,
      'PRODUCTION_RECEIPT',
      'INTERNAL',
      'DEMO_RECEIPT',
      'CLN-DEMO-FEFO-B',
      'DEMO-INBOUND-CLN',
      v_actor_id,
      'inbound:cleanser',
      v_reset_at - interval '9 days',
      v_reset_at - interval '9 days'
    ),
    (
      '64200000-0000-4000-8000-000000000004',
      '64100000-0000-4000-8000-000000000004',
      '61000000-0000-4000-8000-000000000002',
      '62000000-0000-4000-8000-000000000003',
      80,
      'PRODUCTION_RECEIPT',
      'INTERNAL',
      'DEMO_RECEIPT',
      'SER-DEMO-A',
      'DEMO-INBOUND-SER-A',
      v_actor_id,
      'inbound:serum-a',
      v_reset_at - interval '9 days',
      v_reset_at - interval '9 days'
    ),
    (
      '64200000-0000-4000-8000-000000000007',
      '64100000-0000-4000-8000-000000000006',
      '61000000-0000-4000-8000-000000000002',
      '62000000-0000-4000-8000-000000000004',
      40,
      'PRODUCTION_RECEIPT',
      'INTERNAL',
      'DEMO_RECEIPT',
      'SER-DEMO-B',
      'DEMO-INBOUND-SER-B',
      v_actor_id,
      'inbound:serum-b',
      v_reset_at - interval '9 days',
      v_reset_at - interval '9 days'
    ),
    (
      '64200000-0000-4000-8000-000000000008',
      '64100000-0000-4000-8000-000000000007',
      '61000000-0000-4000-8000-000000000003',
      '62000000-0000-4000-8000-000000000005',
      70,
      'PRODUCTION_RECEIPT',
      'INTERNAL',
      'DEMO_RECEIPT',
      'SUN-DEMO-A',
      'DEMO-INBOUND-SUN',
      v_actor_id,
      'inbound:sunscreen',
      v_reset_at - interval '9 days',
      v_reset_at - interval '9 days'
    ),
    (
      '64200000-0000-4000-8000-000000000009',
      '64100000-0000-4000-8000-000000000008',
      '61000000-0000-4000-8000-000000000004',
      '62000000-0000-4000-8000-000000000006',
      50,
      'PRODUCTION_RECEIPT',
      'INTERNAL',
      'DEMO_RECEIPT',
      'TON-DEMO-A',
      'DEMO-INBOUND-TON',
      v_actor_id,
      'inbound:toner',
      v_reset_at - interval '9 days',
      v_reset_at - interval '9 days'
    ),
    (
      '64200000-0000-4000-8000-000000000010',
      '64100000-0000-4000-8000-000000000009',
      '61000000-0000-4000-8000-000000000005',
      '62000000-0000-4000-8000-000000000007',
      100,
      'PRODUCTION_RECEIPT',
      'INTERNAL',
      'DEMO_RECEIPT',
      'MSK-DEMO-EXPIRY',
      'DEMO-INBOUND-MSK',
      v_actor_id,
      'inbound:mask',
      v_reset_at - interval '9 days',
      v_reset_at - interval '9 days'
    );

  insert into public.stock_ledger (
    id,
    movement_group_id,
    product_id,
    batch_id,
    qty_delta,
    reason,
    channel,
    source_type,
    source_id,
    reference,
    reverses_movement_id,
    actor_id,
    movement_key,
    occurred_at,
    created_at
  )
  values (
    '64200000-0000-4000-8000-000000000005',
    '64100000-0000-4000-8000-000000000005',
    '61000000-0000-4000-8000-000000000002',
    '62000000-0000-4000-8000-000000000003',
    -80,
    'ENTRY_CORRECTION',
    'INTERNAL',
    'CORRECTION_REVERSAL',
    '64200000-0000-4000-8000-000000000004',
    'DEMO-CORRECTION-SER',
    '64200000-0000-4000-8000-000000000004',
    v_actor_id,
    'correction:reversal',
    v_reset_at - interval '8 days',
    v_reset_at - interval '8 days'
  );

  insert into public.stock_ledger (
    id,
    movement_group_id,
    product_id,
    batch_id,
    qty_delta,
    reason,
    channel,
    source_type,
    source_id,
    reference,
    actor_id,
    movement_key,
    occurred_at,
    created_at
  )
  values
    (
      '64200000-0000-4000-8000-000000000006',
      '64100000-0000-4000-8000-000000000005',
      '61000000-0000-4000-8000-000000000002',
      '62000000-0000-4000-8000-000000000003',
      75,
      'ENTRY_CORRECTION',
      'INTERNAL',
      'CORRECTION_REPLACEMENT',
      '64200000-0000-4000-8000-000000000004',
      'DEMO-CORRECTION-SER',
      v_actor_id,
      'correction:replacement',
      v_reset_at - interval '8 days',
      v_reset_at - interval '8 days'
    ),
    (
      '64200000-0000-4000-8000-000000000011',
      '64100000-0000-4000-8000-000000000010',
      '61000000-0000-4000-8000-000000000001',
      '62000000-0000-4000-8000-000000000001',
      -40,
      'ONLINE_SALE',
      'TIKTOK',
      'MARKETPLACE_ORDER_ITEM_COMPONENT',
      '65300000-0000-4000-8000-000000000001',
      'DEMO-TT-ORDER-001',
      v_actor_id,
      'shipment:cleanser:batch-a',
      v_reset_at - interval '6 days',
      v_reset_at - interval '6 days'
    ),
    (
      '64200000-0000-4000-8000-000000000012',
      '64100000-0000-4000-8000-000000000010',
      '61000000-0000-4000-8000-000000000001',
      '62000000-0000-4000-8000-000000000002',
      -10,
      'ONLINE_SALE',
      'TIKTOK',
      'MARKETPLACE_ORDER_ITEM_COMPONENT',
      '65300000-0000-4000-8000-000000000001',
      'DEMO-TT-ORDER-001',
      v_actor_id,
      'shipment:cleanser:batch-b',
      v_reset_at - interval '6 days',
      v_reset_at - interval '6 days'
    ),
    (
      '64200000-0000-4000-8000-000000000013',
      '64100000-0000-4000-8000-000000000011',
      '61000000-0000-4000-8000-000000000001',
      '62000000-0000-4000-8000-000000000009',
      5,
      'SELLABLE_RETURN',
      'TIKTOK',
      'RETURN_ITEM',
      '65500000-0000-4000-8000-000000000001',
      'DEMO-TT-RETURN-001',
      v_actor_id,
      'return:sellable:cleanser',
      v_reset_at - interval '2 days',
      v_reset_at - interval '2 days'
    ),
    (
      '64200000-0000-4000-8000-000000000014',
      '64100000-0000-4000-8000-000000000012',
      '61000000-0000-4000-8000-000000000001',
      '62000000-0000-4000-8000-000000000002',
      2,
      'OPNAME_ADJUSTMENT',
      'INTERNAL',
      'OPNAME_COUNT',
      '65600000-0000-4000-8000-000000000001',
      'DEMO-OPNAME-001',
      v_actor_id,
      'opname:cleanser:batch-b',
      v_reset_at - interval '4 days',
      v_reset_at - interval '4 days'
    );

  insert into public.anomalies (
    id,
    fingerprint,
    type,
    severity,
    status,
    order_id,
    explanation,
    evidence,
    detected_at,
    last_detected_at,
    updated_at
  )
  values (
    '65700000-0000-4000-8000-000000000001',
    'DEMO:ORDER_LEDGER_MISMATCH:OPEN:001',
    'ORDER_LEDGER_MISMATCH',
    'WARNING',
    'OPEN',
    '65100000-0000-4000-8000-000000000002',
    'Demo anomaly untuk memperlihatkan reconciliation worklist.',
    '{"demo":true,"action":"review reserved order"}'::jsonb,
    v_reset_at - interval '12 hours',
    v_reset_at - interval '12 hours',
    v_reset_at - interval '12 hours'
  );

  update public.system_settings
  set
    schema_version = 7,
    demo_reset_at = v_reset_at,
    demo_reset_by = v_actor_id,
    demo_generation = demo_generation + 1
  where id
  returning demo_generation into v_generation;

  return jsonb_build_object(
    'status', 'RESET',
    'dataset_key', 'stokledger-demo-v1',
    'generation', v_generation,
    'reset_at', v_reset_at,
    'counts', jsonb_build_object(
      'products', (select count(*) from public.products),
      'batches', (select count(*) from public.batches),
      'orders', (select count(*) from public.orders),
      'movements', (select count(*) from public.stock_ledger),
      'returns', (select count(*) from public.returns),
      'open_anomalies',
        (select count(*) from public.anomalies where status = 'OPEN')
    ),
    'judge_start', jsonb_build_object(
      'product_id', '61000000-0000-4000-8000-000000000001',
      'reserved_order_id', '65100000-0000-4000-8000-000000000002',
      'receipt_command_id', '64000000-0000-4000-8000-000000000011'
    )
  );
end;
$$;

revoke execute on function public.get_demo_dataset_status() from public;
revoke execute on function public.reset_demo_dataset(text) from public;

grant execute on function public.get_demo_dataset_status() to authenticated;
grant execute on function public.reset_demo_dataset(text) to authenticated;

update public.system_settings
set schema_version = 7
where id;

commit;

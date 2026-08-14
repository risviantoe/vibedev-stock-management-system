-- Transactional Milestone 6A acceptance checks.
-- The reset runs twice, but the outer transaction rolls back so linked data
-- remains unchanged.
-- Run with:
-- supabase db query --linked --file supabase/tests/006_demo_readiness.sql

begin;

do $$
declare
  v_user_id uuid := '94000000-0000-4000-8000-000000000001';
  v_before_products bigint;
  v_first jsonb;
  v_second jsonb;
  v_status jsonb;
  v_integrity jsonb;
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
    'milestone6a-test@stokledger.local',
    '',
    now(),
    '{}'::jsonb,
    '{"display_name":"Milestone 6A Test"}'::jsonb,
    now(),
    now()
  );

  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('role', 'authenticated')::text,
    true
  );

  begin
    perform public.reset_demo_dataset('RESET DEMO');
    raise exception 'Expected unauthenticated reset to be rejected';
  exception
    when sqlstate '42501' then
      if sqlerrm <> 'ADMIN_AUTH_REQUIRED' then
        raise;
      end if;
  end;

  perform set_config(
    'request.jwt.claims',
    jsonb_build_object(
      'sub', v_user_id,
      'role', 'authenticated'
    )::text,
    true
  );

  select count(*) into v_before_products from public.products;

  begin
    perform public.reset_demo_dataset('RESET');
    raise exception 'Expected confirmation guard to reject reset';
  exception
    when sqlstate '22023' then
      if sqlerrm <> 'DEMO_RESET_CONFIRMATION_REQUIRED' then
        raise;
      end if;
  end;

  if (select count(*) from public.products) <> v_before_products then
    raise exception 'Confirmation rejection changed the main dataset';
  end if;

  update public.system_settings set demo_mode = false where id;

  begin
    perform public.reset_demo_dataset('RESET DEMO');
    raise exception 'Expected non-demo environment to reject reset';
  exception
    when sqlstate '42501' then
      if sqlerrm <> 'DEMO_MODE_REQUIRED' then
        raise;
      end if;
  end;

  if (select count(*) from public.products) <> v_before_products then
    raise exception 'Demo-mode rejection changed the main dataset';
  end if;

  update public.system_settings set demo_mode = true where id;

  select public.reset_demo_dataset('RESET DEMO') into v_first;

  if (v_first #>> '{counts,products}')::bigint <> 6
    or (v_first #>> '{counts,batches}')::bigint <> 9
    or (v_first #>> '{counts,orders}')::bigint <> 2
    or (v_first #>> '{counts,movements}')::bigint <> 14
    or (v_first #>> '{counts,returns}')::bigint <> 1
    or (v_first #>> '{counts,open_anomalies}')::bigint <> 1 then
    raise exception 'Unexpected reset summary: %', v_first;
  end if;

  if (
    select count(*)
    from public.opening_balances
    where verification_status = 'UNVERIFIED'
  ) <> 1 then
    raise exception 'Demo must contain exactly one unverified opening';
  end if;

  if not exists (
    select 1
    from public.stock_balances as balance
    join public.batches as batch on batch.id = balance.batch_id
    where balance.on_hand_qty > 0
      and batch.expiry_date <= current_date + 90
  ) then
    raise exception 'Demo must contain a positive near-expiry batch';
  end if;

  if not exists (
    select 1
    from public.orders as order_row
    where order_row.status = 'RESERVED'
      and (
        select count(*)
        from public.order_items as item
        where item.order_id = order_row.id
      ) >= 2
  ) then
    raise exception 'Reserved multi-item order fixture is missing';
  end if;

  if (
    select count(distinct movement.batch_id)
    from public.stock_ledger as movement
    where movement.source_type = 'MARKETPLACE_ORDER_ITEM_COMPONENT'
      and movement.source_id = '65300000-0000-4000-8000-000000000001'
  ) <> 2 then
    raise exception 'Shipped demo order does not prove FEFO split';
  end if;

  if (
    select count(*)
    from public.marketplace_event_attempts
    where processing_status = 'DUPLICATE'
  ) <> 1 then
    raise exception 'Duplicate event evidence is missing';
  end if;

  if (
    select count(*)
    from public.order_item_components
    where component_type = 'BUNDLE_COMPONENT'
      and recipe_version_id = '63100000-0000-4000-8000-000000000001'
      and snapshot ->> 'recipe_version' = '1'
  ) <> 2 then
    raise exception 'Bundle recipe snapshot fixture is incomplete';
  end if;

  if (
    select count(*)
    from public.promo_rules
    where is_active
      and now() between start_at and end_at
  ) <> 1 then
    raise exception 'Active promo fixture is missing';
  end if;

  if not exists (
    select 1
    from public.return_items as return_item
    join public.order_items as item on item.id = return_item.order_item_id
    where return_item.qty > 0
      and return_item.qty < item.shipped_qty
      and return_item.inspection_status = 'INSPECTED'
  ) then
    raise exception 'Partial return fixture is missing';
  end if;

  if not exists (
    select 1
    from public.returns
    where channel = 'TIKTOK'
      and claim_status = 'OPEN'
      and claim_deadline <= now() + interval '10 days'
  ) then
    raise exception 'TikTok claim reminder fixture is missing';
  end if;

  if (
    select count(*)
    from public.stock_ledger
    where movement_group_id = '64100000-0000-4000-8000-000000000005'
      and reason = 'ENTRY_CORRECTION'
  ) <> 2 then
    raise exception 'Correction reversal/replacement fixture is incomplete';
  end if;

  if (
    select count(*)
    from public.opname_sessions
    where status = 'FINALIZED'
  ) <> 1 then
    raise exception 'Completed opname fixture is missing';
  end if;

  select public.get_integrity_report() into v_integrity;

  if v_integrity ->> 'overall_status' <> 'PASS'
    or (v_integrity ->> 'passed_count')::integer <> 8 then
    raise exception 'Demo dataset does not pass integrity checks: %', v_integrity;
  end if;

  select public.get_demo_dataset_status() into v_status;

  if not (v_status ->> 'ready')::boolean
    or v_status ->> 'dataset_key' <> 'stokledger-demo-v1' then
    raise exception 'Demo status does not report ready: %', v_status;
  end if;

  select public.reset_demo_dataset('RESET DEMO') into v_second;

  if (v_second #>> '{counts,products}')::bigint <> 6
    or (v_second #>> '{counts,movements}')::bigint <> 14
    or (v_second ->> 'generation')::integer
      <> (v_first ->> 'generation')::integer + 1 then
    raise exception 'Second reset is not idempotent: first %, second %',
      v_first,
      v_second;
  end if;

  if not exists (
    select 1
    from public.products
    where id = '61000000-0000-4000-8000-000000000001'
      and sku = 'CLN-GENTLE-100'
  ) then
    raise exception 'Stable demo identifiers changed after second reset';
  end if;
end;
$$;

rollback;

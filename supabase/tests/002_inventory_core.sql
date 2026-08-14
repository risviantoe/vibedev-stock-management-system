-- Transactional Milestone 2 acceptance checks.
-- Run with: supabase test db

begin;

do $$
declare
  v_user_id uuid := '90000000-0000-4000-8000-000000000001';
  v_product_id uuid := '90000000-0000-4000-8000-000000000002';
  v_batch_early uuid := '90000000-0000-4000-8000-000000000003';
  v_batch_later uuid := '90000000-0000-4000-8000-000000000004';
  v_receipt jsonb;
  v_outbound_movement_id uuid;
  v_qty bigint;
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
    'inventory-test@stokledger.local',
    '',
    now(),
    '{}'::jsonb,
    '{"display_name":"Inventory Test"}'::jsonb,
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
  values (v_product_id, 'TEST-SERUM-A', 'Test Serum A');

  insert into public.batches (
    id,
    product_id,
    batch_code,
    expiry_date,
    source_type
  )
  values
    (
      v_batch_early,
      v_product_id,
      'TEST-SA-01',
      '2027-01-31',
      'PRODUCTION'
    ),
    (
      v_batch_later,
      v_product_id,
      'TEST-SA-02',
      '2027-06-30',
      'PRODUCTION'
    );

  -- AT-001: opening movement and UNVERIFIED status.
  v_receipt := public.record_opening_balance(
    'test:opening:sa01',
    v_product_id,
    v_batch_early,
    10,
    'TEST OPENING SA01',
    '2026-07-25T01:00:00Z'
  );

  if v_receipt ->> 'outcome' <> 'APPLIED' then
    raise exception 'AT-001 opening command was not applied: %', v_receipt;
  end if;

  v_receipt := public.record_opening_balance(
    'test:opening:sa02',
    v_product_id,
    v_batch_later,
    20,
    'TEST OPENING SA02',
    '2026-07-25T01:01:00Z'
  );

  if not exists (
    select 1
    from public.opening_balances
    where batch_id = v_batch_early
      and qty = 10
      and verification_status = 'UNVERIFIED'
  ) then
    raise exception 'AT-001 opening verification state is incorrect';
  end if;

  -- AT-002: production receipt 20 -> 35.
  v_receipt := public.receive_goods(
    'test:receive:sa02',
    v_product_id,
    'TEST-SA-02',
    '2027-06-30',
    15,
    'MAKLON-TEST-001',
    '2026-07-25T02:00:00Z'
  );

  if v_receipt ->> 'outcome' <> 'APPLIED'
     or (v_receipt #>> '{movements,0,balance_before}')::bigint <> 20
     or (v_receipt #>> '{movements,0,balance_after}')::bigint <> 35 then
    raise exception 'AT-002 receipt is incorrect: %', v_receipt;
  end if;

  -- AT-005: FEFO split 10 from SA-01 and 2 from SA-02.
  v_receipt := public.post_manual_outbound(
    'test:manual:fefo12',
    v_product_id,
    12,
    'OFFLINE_SALE',
    'OFFLINE',
    'OFFLINE-TEST-001',
    '2026-07-25T03:00:00Z'
  );

  if v_receipt ->> 'outcome' <> 'APPLIED'
     or jsonb_array_length(v_receipt -> 'movements') <> 2 then
    raise exception 'AT-005 FEFO did not split into two movements: %', v_receipt;
  end if;

  select on_hand_qty into v_qty
  from public.stock_balances
  where product_id = v_product_id
    and batch_id = v_batch_early;

  if v_qty <> 0 then
    raise exception 'AT-005 early batch expected 0, got %', v_qty;
  end if;

  select on_hand_qty into v_qty
  from public.stock_balances
  where product_id = v_product_id
    and batch_id = v_batch_later;

  if v_qty <> 33 then
    raise exception 'AT-005 later batch expected 33, got %', v_qty;
  end if;

  -- Idempotent retry must not create a second movement group.
  v_receipt := public.post_manual_outbound(
    'test:manual:fefo12',
    v_product_id,
    12,
    'OFFLINE_SALE',
    'OFFLINE',
    'OFFLINE-TEST-001',
    '2026-07-25T03:00:00Z'
  );

  if v_receipt ->> 'outcome' <> 'DUPLICATE' then
    raise exception 'Duplicate command was not identified: %', v_receipt;
  end if;

  -- AT-008: insufficient stock rejects atomically.
  v_receipt := public.post_manual_outbound(
    'test:manual:insufficient',
    v_product_id,
    100,
    'OFFLINE_SALE',
    'OFFLINE',
    'OFFLINE-TEST-002',
    '2026-07-25T03:05:00Z'
  );

  if v_receipt ->> 'outcome' <> 'REJECTED'
     or v_receipt #>> '{error,message}' <> 'INSUFFICIENT_STOCK' then
    raise exception 'AT-008 insufficient stock result is incorrect: %', v_receipt;
  end if;

  select ledger.id into v_outbound_movement_id
  from public.stock_ledger as ledger
  where ledger.movement_group_id = (
    select id
    from public.movement_groups
    where business_command_id = (
      select id
      from public.business_commands
      where idempotency_key = 'test:manual:fefo12'
    )
  )
  order by ledger.sequence_no
  limit 1;

  -- Correction is an append-only reversal.
  v_receipt := public.correct_movement(
    'test:correction:one',
    v_outbound_movement_id,
    'Salah input transaksi test',
    '2026-07-25T04:00:00Z'
  );

  if v_receipt ->> 'outcome' <> 'APPLIED'
     or (v_receipt #>> '{movements,0,qty_delta}')::bigint <> 10 then
    raise exception 'Correction was not applied as a reversal: %', v_receipt;
  end if;

  v_receipt := public.correct_movement(
    'test:correction:second',
    v_outbound_movement_id,
    'Percobaan reversal kedua',
    '2026-07-25T04:01:00Z'
  );

  if v_receipt ->> 'outcome' <> 'REJECTED'
     or v_receipt #>> '{error,message}' <> 'MOVEMENT_ALREADY_REVERSED' then
    raise exception 'Second correction should be rejected: %', v_receipt;
  end if;

  -- Direct ledger mutation remains blocked.
  begin
    update public.stock_ledger
    set reference = 'MUTATED'
    where id = v_outbound_movement_id;

    raise exception 'Ledger UPDATE unexpectedly succeeded';
  exception
    when sqlstate '55000' then
      null;
  end;
end;
$$;

rollback;

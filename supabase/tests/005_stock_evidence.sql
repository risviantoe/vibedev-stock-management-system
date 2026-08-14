-- Transactional Milestone 5 acceptance checks.
-- Run against the linked project with:
-- supabase db query --linked --file supabase/tests/005_stock_evidence.sql

begin;

do $$
declare
  v_user_id uuid := '93000000-0000-4000-8000-000000000001';
  v_product_id uuid := '93000000-0000-4000-8000-000000000010';
  v_batch_id uuid := '93000000-0000-4000-8000-000000000020';
  v_command_id uuid := '93000000-0000-4000-8000-000000000030';
  v_group_id uuid := '93000000-0000-4000-8000-000000000040';
  v_explanation jsonb;
  v_integrity jsonb;
  v_challenge jsonb;
  v_before_ledger_count bigint;
  v_before_ledger_qty bigint;
  v_before_projection_count bigint;
  v_before_projection_qty bigint;
  v_after_ledger_count bigint;
  v_after_ledger_qty bigint;
  v_after_projection_count bigint;
  v_after_projection_qty bigint;
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
    'milestone5-test@stokledger.local',
    '',
    now(),
    '{}'::jsonb,
    '{"display_name":"Milestone 5 Test"}'::jsonb,
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
  values (v_product_id, 'M5-PROOF-001', 'Milestone 5 Proof Product');

  insert into public.batches (
    id,
    product_id,
    batch_code,
    expiry_date,
    source_type
  )
  values (
    v_batch_id,
    v_product_id,
    'M5-PROOF-BATCH',
    '2028-12-31',
    'PRODUCTION'
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
  values (
    v_command_id,
    'M5_EVIDENCE_FIXTURE',
    'm5:evidence:fixture',
    repeat('a', 64),
    'APPLIED',
    v_user_id,
    'TEST',
    v_product_id::text,
    '2026-08-02T00:00:00Z',
    '2026-08-02T00:00:01Z'
  );

  insert into public.movement_groups (
    id,
    business_command_id,
    group_type,
    source_type,
    source_id
  )
  values (
    v_group_id,
    v_command_id,
    'M5_EVIDENCE_FIXTURE',
    'TEST',
    v_product_id::text
  );

  insert into public.stock_ledger (
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
    occurred_at
  )
  values
    (
      v_group_id, v_product_id, v_batch_id, 100,
      'OPENING_BALANCE', 'INTERNAL', 'TEST', 'opening',
      'M5 opening', v_user_id, 'm5:opening', '2026-08-02T00:01:00Z'
    ),
    (
      v_group_id, v_product_id, v_batch_id, 20,
      'PRODUCTION_RECEIPT', 'INTERNAL', 'TEST', 'inbound',
      'M5 inbound', v_user_id, 'm5:inbound', '2026-08-02T00:02:00Z'
    ),
    (
      v_group_id, v_product_id, v_batch_id, -10,
      'ONLINE_SALE', 'SHOPEE', 'TEST', 'marketplace',
      'M5 marketplace', v_user_id, 'm5:marketplace', '2026-08-02T00:03:00Z'
    ),
    (
      v_group_id, v_product_id, v_batch_id, -5,
      'OFFLINE_SALE', 'OFFLINE', 'TEST', 'offline',
      'M5 offline', v_user_id, 'm5:offline', '2026-08-02T00:04:00Z'
    ),
    (
      v_group_id, v_product_id, v_batch_id, -3,
      'BONUS', 'INTERNAL', 'TEST', 'promotion',
      'M5 promotion', v_user_id, 'm5:promotion', '2026-08-02T00:05:00Z'
    ),
    (
      v_group_id, v_product_id, v_batch_id, 2,
      'SELLABLE_RETURN', 'TIKTOK', 'TEST', 'return',
      'M5 return', v_user_id, 'm5:return', '2026-08-02T00:06:00Z'
    ),
    (
      v_group_id, v_product_id, v_batch_id, -1,
      'ENTRY_CORRECTION', 'INTERNAL', 'TEST', 'correction',
      'M5 correction', v_user_id, 'm5:correction', '2026-08-02T00:07:00Z'
    ),
    (
      v_group_id, v_product_id, v_batch_id, -2,
      'OPNAME_ADJUSTMENT', 'INTERNAL', 'TEST', 'opname',
      'M5 opname', v_user_id, 'm5:opname', '2026-08-02T00:08:00Z'
    );

  v_explanation := public.explain_product_balance(v_product_id);

  if (v_explanation->>'projection_qty')::bigint <> 101 then
    raise exception 'Explain projection quantity is incorrect: %', v_explanation;
  end if;

  if (v_explanation->>'ledger_qty')::bigint <> 101
     or (v_explanation->>'breakdown_total')::bigint <> 101
     or (v_explanation->>'matches_projection')::boolean is not true then
    raise exception 'Explain totals do not reconcile: %', v_explanation;
  end if;

  if jsonb_array_length(v_explanation->'categories') <> 8 then
    raise exception 'Explain must return eight deterministic categories';
  end if;

  if (v_explanation->'categories'->0->>'total_qty')::bigint <> 100
     or (v_explanation->'categories'->1->>'total_qty')::bigint <> 20
     or (v_explanation->'categories'->2->>'total_qty')::bigint <> -10
     or (v_explanation->'categories'->3->>'total_qty')::bigint <> -5
     or (v_explanation->'categories'->4->>'total_qty')::bigint <> -3
     or (v_explanation->'categories'->5->>'total_qty')::bigint <> 2
     or (v_explanation->'categories'->6->>'total_qty')::bigint <> -1
     or (v_explanation->'categories'->7->>'total_qty')::bigint <> -2 then
    raise exception 'Explain category totals are incorrect: %', v_explanation;
  end if;

  v_integrity := public.get_integrity_report();

  if jsonb_array_length(v_integrity->'checks') <> 8 then
    raise exception 'Integrity report must expose eight checks';
  end if;

  if not exists (
    select 1
    from jsonb_array_elements(v_integrity->'checks') as check_row
    where check_row->>'id' = 'projection_equals_ledger'
      and check_row->>'status' = 'PASS'
  ) then
    raise exception 'Projection integrity check did not pass: %', v_integrity;
  end if;

  if not exists (
    select 1
    from jsonb_array_elements(v_integrity->'checks') as check_row
    where check_row->>'id' = 'append_only_guard_active'
      and check_row->>'status' = 'PASS'
  ) then
    raise exception 'Append-only integrity check did not pass: %', v_integrity;
  end if;

  select count(*), coalesce(sum(qty_delta), 0)
  into v_before_ledger_count, v_before_ledger_qty
  from public.stock_ledger;

  select count(*), coalesce(sum(on_hand_qty), 0)
  into v_before_projection_count, v_before_projection_qty
  from public.stock_balances;

  v_challenge := public.run_integrity_challenge();

  select count(*), coalesce(sum(qty_delta), 0)
  into v_after_ledger_count, v_after_ledger_qty
  from public.stock_ledger;

  select count(*), coalesce(sum(on_hand_qty), 0)
  into v_after_projection_count, v_after_projection_qty
  from public.stock_balances;

  if v_challenge->>'overall_status' <> 'PASS'
     or (v_challenge->>'main_dataset_unchanged')::boolean is not true
     or jsonb_array_length(v_challenge->'scenarios') <> 8 then
    raise exception 'Integrity challenge did not pass: %', v_challenge;
  end if;

  if v_before_ledger_count <> v_after_ledger_count
     or v_before_ledger_qty <> v_after_ledger_qty
     or v_before_projection_count <> v_after_projection_count
     or v_before_projection_qty <> v_after_projection_qty then
    raise exception 'Integrity challenge changed the main dataset';
  end if;
end;
$$;

rollback;

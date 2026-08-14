begin;

create or replace function public.correct_movement(
  p_idempotency_key text,
  p_movement_id uuid,
  p_note text,
  p_occurred_at timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor_id uuid := auth.uid();
  v_command_id uuid;
  v_existing_status public.command_status;
  v_existing_hash text;
  v_group_id uuid;
  v_request_hash text;
  v_original public.stock_ledger;
  v_original_group_id uuid;
  v_error_code text;
  v_error_message text;
begin
  perform public.assert_admin();

  if p_idempotency_key is null
     or length(trim(p_idempotency_key)) not between 8 and 160 then
    raise exception using
      errcode = '22023',
      message = 'INVALID_IDEMPOTENCY_KEY';
  end if;

  v_request_hash := public.request_hash(
    jsonb_build_object(
      'movement_id', p_movement_id,
      'note', trim(p_note),
      'occurred_at', p_occurred_at
    )
  );

  insert into public.business_commands (
    command_type,
    idempotency_key,
    request_hash,
    status,
    actor_id,
    source_type,
    source_id
  )
  values (
    'CORRECT_MOVEMENT',
    trim(p_idempotency_key),
    v_request_hash,
    'PROCESSING',
    v_actor_id,
    'LEDGER_MOVEMENT',
    p_movement_id::text
  )
  on conflict (idempotency_key) do nothing
  returning id, status, request_hash
  into v_command_id, v_existing_status, v_existing_hash;

  if v_command_id is null then
    select id, status, request_hash
    into v_command_id, v_existing_status, v_existing_hash
    from public.business_commands
    where idempotency_key = trim(p_idempotency_key)
    for update;

    if v_existing_hash <> v_request_hash then
      return jsonb_build_object(
        'outcome', 'REJECTED',
        'command_id', v_command_id,
        'movement_group_id', null,
        'idempotency_key', trim(p_idempotency_key),
        'command_type', 'CORRECT_MOVEMENT',
        'movements', '[]'::jsonb,
        'error', jsonb_build_object(
          'code', 'IDEMPOTENCY_KEY_REUSED',
          'message', 'Idempotency key sudah dipakai oleh payload berbeda.'
        )
      );
    end if;

    return public.get_movement_receipt(
      v_command_id,
      case
        when v_existing_status = 'APPLIED' then 'DUPLICATE'
        else 'REJECTED'
      end
    );
  end if;

  begin
    if p_note is null or length(trim(p_note)) < 5 then
      raise exception using
        errcode = '22023',
        message = 'CORRECTION_NOTE_REQUIRED';
    end if;

    select ledger.*
    into v_original
    from public.stock_ledger as ledger
    where ledger.id = p_movement_id;

    if not found then
      raise exception using
        errcode = 'P0002',
        message = 'MOVEMENT_NOT_FOUND';
    end if;

    v_original_group_id := v_original.movement_group_id;

    perform 1
    from public.stock_balances
    where product_id = v_original.product_id
      and batch_id = v_original.batch_id
    for update;

    if v_original.reverses_movement_id is not null
       or v_original.reason in ('ENTRY_CORRECTION', 'CANCELLATION_REVERSAL') then
      raise exception using
        errcode = '22023',
        message = 'REVERSAL_MOVEMENT_CANNOT_BE_CORRECTED';
    end if;

    if exists (
      select 1
      from public.stock_ledger
      where reverses_movement_id = p_movement_id
    ) then
      raise exception using
        errcode = '23505',
        message = 'MOVEMENT_ALREADY_REVERSED';
    end if;

    insert into public.movement_groups (
      business_command_id,
      group_type,
      source_type,
      source_id,
      reversal_group_id
    )
    values (
      v_command_id,
      'ENTRY_CORRECTION',
      'LEDGER_MOVEMENT',
      p_movement_id::text,
      v_original_group_id
    )
    returning id into v_group_id;

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
      reverses_movement_id,
      actor_id,
      movement_key,
      occurred_at
    )
    values (
      v_group_id,
      v_original.product_id,
      v_original.batch_id,
      -v_original.qty_delta,
      'ENTRY_CORRECTION',
      'INTERNAL',
      'LEDGER_MOVEMENT',
      p_movement_id::text,
      trim(p_note),
      p_movement_id,
      v_actor_id,
      'correction:' || p_movement_id::text,
      p_occurred_at
    );

    update public.business_commands
    set
      status = 'APPLIED',
      completed_at = now()
    where id = v_command_id;
  exception
    when others then
      get stacked diagnostics
        v_error_code = returned_sqlstate,
        v_error_message = message_text;

      update public.business_commands
      set
        status = 'REJECTED',
        error_code = v_error_code,
        error_message = v_error_message,
        completed_at = now()
      where id = v_command_id;

      return public.get_movement_receipt(v_command_id, 'REJECTED');
  end;

  return public.get_movement_receipt(v_command_id, 'APPLIED');
end;
$$;

commit;

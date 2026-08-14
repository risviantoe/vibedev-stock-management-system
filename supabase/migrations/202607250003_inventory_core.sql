begin;

alter table public.stock_ledger
  add column sequence_no bigint generated always as identity;

create unique index stock_ledger_sequence_no_unique
  on public.stock_ledger (sequence_no);

create index stock_ledger_batch_sequence_idx
  on public.stock_ledger (product_id, batch_id, sequence_no);

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

create or replace function public.request_hash(p_payload jsonb)
returns text
language sql
immutable
security definer
set search_path = public, extensions, pg_temp
as $$
  select encode(
    extensions.digest(convert_to(p_payload::text, 'UTF8'), 'sha256'),
    'hex'
  );
$$;

create or replace function public.get_movement_receipt(
  p_command_id uuid,
  p_outcome text default null
)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'outcome',
      coalesce(
        p_outcome,
        case
          when command.status = 'APPLIED' then 'APPLIED'
          else 'REJECTED'
        end
      ),
    'command_id', command.id,
    'movement_group_id', movement_group.id,
    'idempotency_key', command.idempotency_key,
    'command_type', command.command_type,
    'source_type', command.source_type,
    'source_id', command.source_id,
    'created_at', command.created_at,
    'completed_at', command.completed_at,
    'movements',
      coalesce(
        (
          select jsonb_agg(
            jsonb_build_object(
              'movement_id', ledger.id,
              'sequence_no', ledger.sequence_no,
              'movement_key', ledger.movement_key,
              'product_id', ledger.product_id,
              'product_sku', product.sku,
              'product_name', product.name,
              'batch_id', ledger.batch_id,
              'batch_code', batch.batch_code,
              'expiry_date', batch.expiry_date,
              'qty_delta', ledger.qty_delta,
              'reason', ledger.reason,
              'channel', ledger.channel,
              'balance_before', history.balance_after - ledger.qty_delta,
              'balance_after', history.balance_after,
              'reference', ledger.reference,
              'reverses_movement_id', ledger.reverses_movement_id,
              'occurred_at', ledger.occurred_at
            )
            order by ledger.sequence_no
          )
          from public.stock_ledger as ledger
          join public.products as product
            on product.id = ledger.product_id
          join public.batches as batch
            on batch.id = ledger.batch_id
          cross join lateral (
            select coalesce(sum(previous.qty_delta), 0)::bigint as balance_after
            from public.stock_ledger as previous
            where previous.product_id = ledger.product_id
              and previous.batch_id = ledger.batch_id
              and previous.sequence_no <= ledger.sequence_no
          ) as history
          where ledger.movement_group_id = movement_group.id
        ),
        '[]'::jsonb
      ),
    'error',
      case
        when command.error_code is null then null
        else jsonb_build_object(
          'code', command.error_code,
          'message', command.error_message
        )
      end
  )
  from public.business_commands as command
  left join public.movement_groups as movement_group
    on movement_group.business_command_id = command.id
  where command.id = p_command_id
    and (
      command.actor_id = auth.uid()
      or auth.role() = 'service_role'
    );
$$;

create or replace function public.save_product(
  p_id uuid,
  p_sku text,
  p_name text,
  p_is_active boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_product public.products;
begin
  perform public.assert_admin();

  if p_sku is null or length(trim(p_sku)) not between 1 and 80 then
    raise exception using errcode = '22023', message = 'INVALID_PRODUCT_SKU';
  end if;

  if p_name is null or length(trim(p_name)) not between 1 and 180 then
    raise exception using errcode = '22023', message = 'INVALID_PRODUCT_NAME';
  end if;

  if p_id is null then
    insert into public.products (sku, name, is_active)
    values (upper(trim(p_sku)), trim(p_name), coalesce(p_is_active, true))
    returning * into v_product;
  else
    update public.products
    set
      sku = upper(trim(p_sku)),
      name = trim(p_name),
      is_active = coalesce(p_is_active, is_active)
    where id = p_id
    returning * into v_product;

    if not found then
      raise exception using errcode = 'P0002', message = 'PRODUCT_NOT_FOUND';
    end if;
  end if;

  return to_jsonb(v_product);
exception
  when unique_violation then
    raise exception using errcode = '23505', message = 'PRODUCT_SKU_ALREADY_EXISTS';
end;
$$;

create or replace function public.create_batch(
  p_product_id uuid,
  p_batch_code text,
  p_expiry_date date,
  p_source_type public.batch_source_type default 'PRODUCTION'
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_batch public.batches;
begin
  perform public.assert_admin();

  if p_batch_code is null
     or length(trim(p_batch_code)) not between 1 and 100 then
    raise exception using errcode = '22023', message = 'INVALID_BATCH_CODE';
  end if;

  if p_expiry_date is null then
    raise exception using errcode = '22023', message = 'EXPIRY_DATE_REQUIRED';
  end if;

  perform 1
  from public.products
  where id = p_product_id;

  if not found then
    raise exception using errcode = 'P0002', message = 'PRODUCT_NOT_FOUND';
  end if;

  insert into public.batches (
    product_id,
    batch_code,
    expiry_date,
    source_type
  )
  values (
    p_product_id,
    upper(trim(p_batch_code)),
    p_expiry_date,
    coalesce(p_source_type, 'PRODUCTION')
  )
  returning * into v_batch;

  return to_jsonb(v_batch);
exception
  when unique_violation then
    raise exception using errcode = '23505', message = 'BATCH_CODE_ALREADY_EXISTS';
end;
$$;

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
  allocated as (
    select
      candidate.*,
      greatest(
        least(
          candidate.balance_before,
          p_qty - (candidate.running_qty - candidate.balance_before)
        ),
        0
      )::bigint as allocated_qty
    from candidates as candidate
  ),
  totals as (
    select coalesce(sum(balance_before), 0)::bigint as available_qty
    from candidates
  )
  select jsonb_build_object(
    'requested_qty', p_qty,
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
              allocated.batch_code,
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

create or replace function public.receive_goods(
  p_idempotency_key text,
  p_product_id uuid,
  p_batch_code text,
  p_expiry_date date,
  p_qty bigint,
  p_reference text,
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
  v_batch_id uuid;
  v_batch_expiry date;
  v_batch_source public.batch_source_type;
  v_request_hash text;
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
      'batch_code', upper(trim(p_batch_code)),
      'expiry_date', p_expiry_date,
      'occurred_at', p_occurred_at,
      'product_id', p_product_id,
      'qty', p_qty,
      'reference', trim(p_reference)
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
    'RECEIVE_GOODS',
    trim(p_idempotency_key),
    v_request_hash,
    'PROCESSING',
    v_actor_id,
    'PRODUCTION_RECEIPT',
    upper(trim(p_batch_code))
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
        'command_type', 'RECEIVE_GOODS',
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
    if p_batch_code is null
       or length(trim(p_batch_code)) not between 1 and 100 then
      raise exception using errcode = '22023', message = 'INVALID_BATCH_CODE';
    end if;

    if p_expiry_date is null then
      raise exception using errcode = '22023', message = 'EXPIRY_DATE_REQUIRED';
    end if;

    if p_qty is null or p_qty <= 0 then
      raise exception using
        errcode = '22023',
        message = 'RECEIPT_QTY_MUST_BE_POSITIVE';
    end if;

    if p_reference is null or length(trim(p_reference)) < 3 then
      raise exception using
        errcode = '22023',
        message = 'PRODUCTION_REFERENCE_REQUIRED';
    end if;

    perform 1
    from public.products
    where id = p_product_id
      and is_active
    for update;

    if not found then
      raise exception using
        errcode = 'P0002',
        message = 'ACTIVE_PRODUCT_NOT_FOUND';
    end if;

    select id, expiry_date, source_type
    into v_batch_id, v_batch_expiry, v_batch_source
    from public.batches
    where product_id = p_product_id
      and upper(batch_code) = upper(trim(p_batch_code))
    for update;

    if v_batch_id is null then
      insert into public.batches (
        product_id,
        batch_code,
        expiry_date,
        source_type
      )
      values (
        p_product_id,
        upper(trim(p_batch_code)),
        p_expiry_date,
        'PRODUCTION'
      )
      returning id into v_batch_id;
    elsif v_batch_expiry <> p_expiry_date
       or v_batch_source <> 'PRODUCTION' then
      raise exception using
        errcode = '23505',
        message = 'BATCH_CODE_CONFLICT';
    end if;

    insert into public.movement_groups (
      business_command_id,
      group_type,
      source_type,
      source_id
    )
    values (
      v_command_id,
      'PRODUCTION_RECEIPT',
      'BATCH',
      v_batch_id::text
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
      actor_id,
      movement_key,
      occurred_at
    )
    values (
      v_group_id,
      p_product_id,
      v_batch_id,
      p_qty,
      'PRODUCTION_RECEIPT',
      'INTERNAL',
      'PRODUCTION_RECEIPT',
      v_command_id::text,
      trim(p_reference),
      v_actor_id,
      'receipt:' || v_batch_id::text,
      p_occurred_at
    );

    update public.business_commands
    set
      status = 'APPLIED',
      source_id = v_batch_id::text,
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

create or replace function public.post_manual_outbound(
  p_idempotency_key text,
  p_product_id uuid,
  p_qty bigint,
  p_reason public.stock_reason,
  p_channel public.stock_channel,
  p_reference text default null,
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
  v_available_qty bigint := 0;
  v_remaining_qty bigint;
  v_allocated_qty bigint;
  v_batch record;
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
      'channel', p_channel,
      'occurred_at', p_occurred_at,
      'product_id', p_product_id,
      'qty', p_qty,
      'reason', p_reason,
      'reference', nullif(trim(p_reference), '')
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
    'POST_MANUAL_OUTBOUND',
    trim(p_idempotency_key),
    v_request_hash,
    'PROCESSING',
    v_actor_id,
    'MANUAL_OUTBOUND',
    p_product_id::text
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
        'command_type', 'POST_MANUAL_OUTBOUND',
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
    if p_qty is null or p_qty <= 0 then
      raise exception using
        errcode = '22023',
        message = 'OUTBOUND_QTY_MUST_BE_POSITIVE';
    end if;

    if p_reason not in (
      'OFFLINE_SALE',
      'BONUS',
      'PROMO',
      'SAMPLE',
      'DAMAGED',
      'EXPIRED'
    ) then
      raise exception using
        errcode = '22023',
        message = 'UNSUPPORTED_MANUAL_OUTBOUND_REASON';
    end if;

    if p_reason = 'OFFLINE_SALE' and p_channel <> 'OFFLINE' then
      raise exception using
        errcode = '22023',
        message = 'OFFLINE_SALE_REQUIRES_OFFLINE_CHANNEL';
    end if;

    if p_reason in ('DAMAGED', 'EXPIRED') and p_channel <> 'INTERNAL' then
      raise exception using
        errcode = '22023',
        message = 'INTERNAL_REASON_REQUIRES_INTERNAL_CHANNEL';
    end if;

    if p_reason in ('BONUS', 'PROMO', 'SAMPLE')
       and (p_reference is null or length(trim(p_reference)) < 3) then
      raise exception using
        errcode = '22023',
        message = 'CAMPAIGN_OR_APPROVAL_REFERENCE_REQUIRED';
    end if;

    perform 1
    from public.products
    where id = p_product_id
      and is_active;

    if not found then
      raise exception using
        errcode = 'P0002',
        message = 'ACTIVE_PRODUCT_NOT_FOUND';
    end if;

    for v_batch in
      select
        batch.id as batch_id,
        batch.expiry_date,
        batch.created_at,
        balance.on_hand_qty
      from public.stock_balances as balance
      join public.batches as batch
        on batch.id = balance.batch_id
       and batch.product_id = balance.product_id
      where balance.product_id = p_product_id
        and balance.on_hand_qty > 0
      order by batch.expiry_date, batch.created_at, batch.id
      for update of balance
    loop
      v_available_qty := v_available_qty + v_batch.on_hand_qty;
    end loop;

    if v_available_qty < p_qty then
      raise exception using
        errcode = 'P0001',
        message = 'INSUFFICIENT_STOCK',
        detail = format(
          'requested=%s available=%s',
          p_qty,
          v_available_qty
        );
    end if;

    insert into public.movement_groups (
      business_command_id,
      group_type,
      source_type,
      source_id
    )
    values (
      v_command_id,
      'MANUAL_OUTBOUND',
      'PRODUCT',
      p_product_id::text
    )
    returning id into v_group_id;

    v_remaining_qty := p_qty;

    for v_batch in
      select
        batch.id as batch_id,
        batch.expiry_date,
        batch.created_at,
        balance.on_hand_qty
      from public.stock_balances as balance
      join public.batches as batch
        on batch.id = balance.batch_id
       and batch.product_id = balance.product_id
      where balance.product_id = p_product_id
        and balance.on_hand_qty > 0
      order by batch.expiry_date, batch.created_at, batch.id
    loop
      exit when v_remaining_qty = 0;

      v_allocated_qty := least(v_batch.on_hand_qty, v_remaining_qty);

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
      values (
        v_group_id,
        p_product_id,
        v_batch.batch_id,
        -v_allocated_qty,
        p_reason,
        p_channel,
        'MANUAL_OUTBOUND',
        v_command_id::text,
        nullif(trim(p_reference), ''),
        v_actor_id,
        'fefo:' || v_batch.batch_id::text,
        p_occurred_at
      );

      v_remaining_qty := v_remaining_qty - v_allocated_qty;
    end loop;

    if v_remaining_qty <> 0 then
      raise exception using
        errcode = '55000',
        message = 'FEFO_ALLOCATION_INCOMPLETE';
    end if;

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

update public.system_settings
set schema_version = 2
where id = true;

revoke execute on function public.request_hash(jsonb) from public;
revoke execute on function public.save_product(uuid, text, text, boolean)
  from public;
revoke execute on function public.create_batch(
  uuid,
  text,
  date,
  public.batch_source_type
) from public;
revoke execute on function public.preview_fefo_allocation(uuid, bigint)
  from public;
revoke execute on function public.receive_goods(
  text,
  uuid,
  text,
  date,
  bigint,
  text,
  timestamptz
) from public;
revoke execute on function public.post_manual_outbound(
  text,
  uuid,
  bigint,
  public.stock_reason,
  public.stock_channel,
  text,
  timestamptz
) from public;
revoke execute on function public.correct_movement(
  text,
  uuid,
  text,
  timestamptz
) from public;

grant execute on function public.save_product(uuid, text, text, boolean)
  to authenticated;
grant execute on function public.create_batch(
  uuid,
  text,
  date,
  public.batch_source_type
) to authenticated;
grant execute on function public.preview_fefo_allocation(uuid, bigint)
  to authenticated;
grant execute on function public.receive_goods(
  text,
  uuid,
  text,
  date,
  bigint,
  text,
  timestamptz
) to authenticated;
grant execute on function public.post_manual_outbound(
  text,
  uuid,
  bigint,
  public.stock_reason,
  public.stock_channel,
  text,
  timestamptz
) to authenticated;
grant execute on function public.correct_movement(
  text,
  uuid,
  text,
  timestamptz
) to authenticated;

grant select on table public.profiles to service_role;
grant select on table public.system_settings to service_role;
grant select on table public.products to service_role;
grant select on table public.batches to service_role;
grant select on table public.business_commands to service_role;
grant select on table public.movement_groups to service_role;
grant select on table public.stock_balances to service_role;
grant select on table public.stock_ledger to service_role;
grant select on table public.opening_balances to service_role;

grant execute on function public.get_movement_receipt(uuid, text)
  to service_role;
grant execute on function public.verify_stock_projection()
  to service_role;

commit;

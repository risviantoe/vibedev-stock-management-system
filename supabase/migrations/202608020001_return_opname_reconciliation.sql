begin;

create type public.return_claim_status as enum (
  'OPEN',
  'RESOLVED'
);

create type public.return_inspection_status as enum (
  'PENDING',
  'INSPECTED'
);

create type public.return_condition as enum (
  'SELLABLE',
  'DAMAGED',
  'LOST'
);

create type public.opname_session_status as enum (
  'DRAFT',
  'FINALIZED'
);

create type public.anomaly_type as enum (
  'PROJECTION_DRIFT',
  'NEGATIVE_STOCK',
  'ORDER_LEDGER_MISMATCH',
  'DUPLICATE_PROCESSING',
  'ORPHAN_MOVEMENT',
  'OVER_RETURN',
  'OVERDUE_RETURN'
);

create type public.anomaly_severity as enum (
  'INFO',
  'WARNING',
  'CRITICAL'
);

create type public.anomaly_status as enum (
  'OPEN',
  'RESOLVED'
);

create table public.returns (
  id uuid primary key default extensions.gen_random_uuid(),
  external_return_id text not null
    check (length(trim(external_return_id)) between 1 and 160),
  order_id uuid not null references public.orders (id) on delete restrict,
  channel public.stock_channel not null,
  claim_deadline timestamptz,
  claim_status public.return_claim_status not null default 'OPEN',
  created_command_id uuid not null unique
    references public.business_commands (id) on delete restrict,
  created_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null,
  recorded_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (channel, external_return_id),
  check (channel in ('SHOPEE', 'TIKTOK')),
  check (
    (channel = 'TIKTOK' and claim_deadline is not null)
    or (channel = 'SHOPEE' and claim_deadline is null)
  )
);

create index returns_claim_worklist_idx
  on public.returns (claim_status, claim_deadline, created_at, id);

create index returns_order_idx
  on public.returns (order_id, created_at desc, id);

create table public.return_items (
  id uuid primary key default extensions.gen_random_uuid(),
  return_id uuid not null references public.returns (id) on delete restrict,
  order_item_id uuid not null
    references public.order_items (id) on delete restrict,
  product_id uuid not null references public.products (id) on delete restrict,
  qty bigint not null check (qty > 0),
  inspection_status public.return_inspection_status
    not null default 'PENDING',
  condition public.return_condition,
  return_batch_id uuid references public.batches (id) on delete restrict,
  inspected_command_id uuid unique
    references public.business_commands (id) on delete restrict,
  inspected_by uuid references public.profiles (id) on delete restrict,
  inspected_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (return_id, order_item_id, product_id),
  check (
    (
      inspection_status = 'PENDING'
      and condition is null
      and return_batch_id is null
      and inspected_command_id is null
      and inspected_by is null
      and inspected_at is null
    )
    or (
      inspection_status = 'INSPECTED'
      and condition is not null
      and inspected_command_id is not null
      and inspected_by is not null
      and inspected_at is not null
      and (
        (condition = 'SELLABLE' and return_batch_id is not null)
        or (condition in ('DAMAGED', 'LOST') and return_batch_id is null)
      )
    )
  )
);

create index return_items_pending_idx
  on public.return_items (inspection_status, created_at, id)
  where inspection_status = 'PENDING';

create index return_items_order_product_idx
  on public.return_items (order_item_id, product_id, created_at, id);

create table public.opname_sessions (
  id uuid primary key default extensions.gen_random_uuid(),
  idempotency_key text not null unique
    check (length(trim(idempotency_key)) between 8 and 160),
  status public.opname_session_status not null default 'DRAFT',
  actor_id uuid not null references public.profiles (id) on delete restrict,
  started_at timestamptz not null,
  finalized_at timestamptz,
  finalized_command_id uuid unique
    references public.business_commands (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (status = 'DRAFT' and finalized_at is null and finalized_command_id is null)
    or (
      status = 'FINALIZED'
      and finalized_at is not null
      and finalized_command_id is not null
    )
  )
);

create unique index opname_sessions_single_draft_idx
  on public.opname_sessions ((status))
  where status = 'DRAFT';

create table public.opname_counts (
  session_id uuid not null
    references public.opname_sessions (id) on delete restrict,
  product_id uuid not null references public.products (id) on delete restrict,
  batch_id uuid not null,
  system_qty bigint not null check (system_qty >= 0),
  physical_qty bigint check (physical_qty >= 0),
  variance_qty bigint,
  saved_at timestamptz,
  primary key (session_id, batch_id),
  foreign key (batch_id, product_id)
    references public.batches (id, product_id) on delete restrict,
  check (
    (
      physical_qty is null
      and variance_qty is null
      and saved_at is null
    )
    or (
      physical_qty is not null
      and variance_qty = physical_qty - system_qty
      and saved_at is not null
    )
  )
);

create index opname_counts_product_idx
  on public.opname_counts (session_id, product_id, batch_id);

alter table public.opening_balances
add constraint opening_balances_verified_opname_session_fk
foreign key (verified_by_opname_session_id)
references public.opname_sessions (id)
on delete restrict;

create table public.anomalies (
  id uuid primary key default extensions.gen_random_uuid(),
  fingerprint text not null unique
    check (length(trim(fingerprint)) between 8 and 220),
  type public.anomaly_type not null,
  severity public.anomaly_severity not null,
  status public.anomaly_status not null default 'OPEN',
  product_id uuid references public.products (id) on delete restrict,
  batch_id uuid references public.batches (id) on delete restrict,
  order_id uuid references public.orders (id) on delete restrict,
  return_id uuid references public.returns (id) on delete restrict,
  movement_id uuid references public.stock_ledger (id) on delete restrict,
  explanation text not null
    check (length(trim(explanation)) between 8 and 500),
  evidence jsonb not null default '{}'::jsonb,
  detected_at timestamptz not null,
  last_detected_at timestamptz not null,
  resolved_at timestamptz,
  updated_at timestamptz not null default now(),
  check (
    (status = 'OPEN' and resolved_at is null)
    or (status = 'RESOLVED' and resolved_at is not null)
  )
);

create index anomalies_worklist_idx
  on public.anomalies (status, severity, last_detected_at desc, id);

create trigger returns_set_updated_at
before update on public.returns
for each row execute function public.set_updated_at();

create trigger return_items_set_updated_at
before update on public.return_items
for each row execute function public.set_updated_at();

create trigger opname_sessions_set_updated_at
before update on public.opname_sessions
for each row execute function public.set_updated_at();

create trigger anomalies_set_updated_at
before update on public.anomalies
for each row execute function public.set_updated_at();

create or replace function public.get_return_receipt(
  p_return_id uuid,
  p_outcome text default null
)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    public.get_movement_receipt(
      return_row.created_command_id,
      coalesce(p_outcome, 'APPLIED')
    )
    || jsonb_build_object(
      'return', jsonb_build_object(
        'id', return_row.id,
        'external_return_id', return_row.external_return_id,
        'order_id', return_row.order_id,
        'external_order_id', orders.external_order_id,
        'channel', return_row.channel,
        'claim_deadline', return_row.claim_deadline,
        'claim_status', return_row.claim_status,
        'created_at', return_row.created_at,
        'items', (
          select coalesce(
            jsonb_agg(
              jsonb_build_object(
                'id', item.id,
                'order_item_id', item.order_item_id,
                'external_line_id', order_item.external_line_id,
                'product_id', item.product_id,
                'product_sku', product.sku,
                'product_name', product.name,
                'qty', item.qty,
                'inspection_status', item.inspection_status,
                'condition', item.condition,
                'return_batch_id', item.return_batch_id,
                'inspected_at', item.inspected_at
              )
              order by item.created_at, item.id
            ),
            '[]'::jsonb
          )
          from public.return_items as item
          join public.order_items as order_item
            on order_item.id = item.order_item_id
          join public.products as product on product.id = item.product_id
          where item.return_id = return_row.id
        )
      )
    )
  from public.returns as return_row
  join public.orders as orders on orders.id = return_row.order_id
  where return_row.id = p_return_id
    and public.is_admin();
$$;

create or replace function public.create_return(
  p_idempotency_key text,
  p_channel public.stock_channel,
  p_external_order_id text,
  p_external_return_id text,
  p_items jsonb,
  p_created_at timestamptz default now()
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
  v_request_hash text;
  v_order_id uuid;
  v_return_id uuid;
  v_existing_return_id uuid;
  v_item jsonb;
  v_order_item_id uuid;
  v_product_id uuid;
  v_qty bigint;
  v_shipped_qty bigint;
  v_existing_returned_qty bigint;
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
      'created_at', p_created_at,
      'external_order_id', trim(p_external_order_id),
      'external_return_id', trim(p_external_return_id),
      'items', p_items
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
    'CREATE_RETURN',
    trim(p_idempotency_key),
    v_request_hash,
    'PROCESSING',
    v_actor_id,
    'RETURN',
    trim(p_external_return_id)
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
        'command_type', 'CREATE_RETURN',
        'movements', '[]'::jsonb,
        'error', jsonb_build_object(
          'code', 'IDEMPOTENCY_KEY_REUSED',
          'message', 'Idempotency key sudah dipakai oleh payload berbeda.'
        )
      );
    end if;

    select return_row.id
    into v_existing_return_id
    from public.returns as return_row
    where return_row.created_command_id = v_command_id;

    if v_existing_return_id is not null then
      return public.get_return_receipt(
        v_existing_return_id,
        case
          when v_existing_status = 'APPLIED' then 'DUPLICATE'
          else 'REJECTED'
        end
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
    if p_channel not in ('SHOPEE', 'TIKTOK') then
      raise exception using
        errcode = '22023',
        message = 'INVALID_MARKETPLACE_CHANNEL';
    end if;

    if p_external_order_id is null
       or length(trim(p_external_order_id)) not between 1 and 160 then
      raise exception using
        errcode = '22023',
        message = 'INVALID_EXTERNAL_ORDER_ID';
    end if;

    if p_external_return_id is null
       or length(trim(p_external_return_id)) not between 1 and 160 then
      raise exception using
        errcode = '22023',
        message = 'INVALID_EXTERNAL_RETURN_ID';
    end if;

    if p_items is null
       or jsonb_typeof(p_items) <> 'array'
       or jsonb_array_length(p_items) = 0 then
      raise exception using
        errcode = '22023',
        message = 'RETURN_ITEMS_REQUIRED';
    end if;

    if exists (
      select 1
      from jsonb_array_elements(p_items) as raw_item
      group by
        raw_item ->> 'order_item_id',
        raw_item ->> 'product_id'
      having count(*) > 1
    ) then
      raise exception using
        errcode = '22023',
        message = 'DUPLICATE_RETURN_ITEM';
    end if;

    select orders.id
    into v_order_id
    from public.orders
    where orders.channel = p_channel
      and upper(orders.external_order_id) = upper(trim(p_external_order_id))
    for update;

    if not found then
      raise exception using
        errcode = 'P0002',
        message = 'ORDER_NOT_FOUND';
    end if;

    if exists (
      select 1
      from public.returns
      where channel = p_channel
        and upper(external_return_id) = upper(trim(p_external_return_id))
    ) then
      raise exception using
        errcode = '23505',
        message = 'EXTERNAL_RETURN_ID_ALREADY_EXISTS';
    end if;

    for v_item in
      select value from jsonb_array_elements(p_items)
    loop
      begin
        v_order_item_id := (v_item ->> 'order_item_id')::uuid;
        v_product_id := (v_item ->> 'product_id')::uuid;
        v_qty := (v_item ->> 'qty')::bigint;
      exception
        when others then
          raise exception using
            errcode = '22023',
            message = 'INVALID_RETURN_ITEM';
      end;

      if v_qty <= 0 then
        raise exception using
          errcode = '22023',
          message = 'INVALID_RETURN_QUANTITY';
      end if;

      perform 1
      from public.order_items as order_item
      where order_item.id = v_order_item_id
        and order_item.order_id = v_order_id
      for update;

      if not found then
        raise exception using
          errcode = 'P0002',
          message = 'ORDER_ITEM_NOT_FOUND';
      end if;

      select coalesce(
        sum(greatest(component.shipped_qty - component.cancelled_qty, 0)),
        0
      )::bigint
      into v_shipped_qty
      from public.order_item_components as component
      where component.order_item_id = v_order_item_id
        and component.product_id = v_product_id;

      if v_shipped_qty <= 0 then
        raise exception using
          errcode = '22023',
          message = 'PRODUCT_NOT_SHIPPED_FOR_ORDER_ITEM';
      end if;

      select coalesce(sum(return_item.qty), 0)::bigint
      into v_existing_returned_qty
      from public.return_items as return_item
      where return_item.order_item_id = v_order_item_id
        and return_item.product_id = v_product_id;

      if v_existing_returned_qty + v_qty > v_shipped_qty then
        raise exception using
          errcode = '22023',
          message = 'RETURN_QUANTITY_EXCEEDS_SHIPPED',
          detail = format(
            'requested=%s already_returned=%s shipped=%s',
            v_qty,
            v_existing_returned_qty,
            v_shipped_qty
          );
      end if;
    end loop;

    insert into public.returns (
      external_return_id,
      order_id,
      channel,
      claim_deadline,
      created_command_id,
      created_by,
      created_at
    )
    values (
      trim(p_external_return_id),
      v_order_id,
      p_channel,
      case
        when p_channel = 'TIKTOK'
          then p_created_at + interval '40 days'
        else null
      end,
      v_command_id,
      v_actor_id,
      p_created_at
    )
    returning id into v_return_id;

    for v_item in
      select value from jsonb_array_elements(p_items)
    loop
      v_order_item_id := (v_item ->> 'order_item_id')::uuid;
      v_product_id := (v_item ->> 'product_id')::uuid;
      v_qty := (v_item ->> 'qty')::bigint;

      insert into public.return_items (
        return_id,
        order_item_id,
        product_id,
        qty
      )
      values (
        v_return_id,
        v_order_item_id,
        v_product_id,
        v_qty
      );

      update public.order_items as order_item
      set returned_qty = order_item.returned_qty + v_qty
      where order_item.id = v_order_item_id
        and order_item.listing_type = 'PHYSICAL'
        and exists (
          select 1
          from public.order_item_components as component
          where component.order_item_id = order_item.id
            and component.product_id = v_product_id
            and component.component_type = 'PRIMARY'
        );
    end loop;

    update public.business_commands
    set status = 'APPLIED', completed_at = now()
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

  return public.get_return_receipt(v_return_id, 'APPLIED');
end;
$$;

create or replace function public.get_return_inspection_receipt(
  p_command_id uuid,
  p_return_item_id uuid,
  p_outcome text default null
)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    public.get_movement_receipt(p_command_id, p_outcome)
    || jsonb_build_object(
      'return_item', jsonb_build_object(
        'id', item.id,
        'return_id', item.return_id,
        'product_id', item.product_id,
        'product_sku', product.sku,
        'product_name', product.name,
        'qty', item.qty,
        'inspection_status', item.inspection_status,
        'condition', item.condition,
        'return_batch_id', item.return_batch_id,
        'batch_code', batch.batch_code,
        'expiry_date', batch.expiry_date,
        'inspected_at', item.inspected_at
      )
    )
  from public.return_items as item
  join public.products as product on product.id = item.product_id
  left join public.batches as batch on batch.id = item.return_batch_id
  where item.id = p_return_item_id
    and public.is_admin();
$$;

create or replace function public.inspect_return_item(
  p_idempotency_key text,
  p_return_item_id uuid,
  p_condition public.return_condition,
  p_batch_code text default null,
  p_expiry_date date default null,
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
  v_request_hash text;
  v_item public.return_items;
  v_return public.returns;
  v_group_id uuid;
  v_batch_id uuid;
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
      'condition', p_condition,
      'expiry_date', p_expiry_date,
      'occurred_at', p_occurred_at,
      'return_item_id', p_return_item_id
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
    'INSPECT_RETURN_ITEM',
    trim(p_idempotency_key),
    v_request_hash,
    'PROCESSING',
    v_actor_id,
    'RETURN_ITEM',
    p_return_item_id::text
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
        'command_type', 'INSPECT_RETURN_ITEM',
        'movements', '[]'::jsonb,
        'error', jsonb_build_object(
          'code', 'IDEMPOTENCY_KEY_REUSED',
          'message', 'Idempotency key sudah dipakai oleh payload berbeda.'
        )
      );
    end if;

    return public.get_return_inspection_receipt(
      v_command_id,
      p_return_item_id,
      case
        when v_existing_status = 'APPLIED' then 'DUPLICATE'
        else 'REJECTED'
      end
    );
  end if;

  begin
    select item.*
    into v_item
    from public.return_items as item
    where item.id = p_return_item_id
    for update;

    if not found then
      raise exception using
        errcode = 'P0002',
        message = 'RETURN_ITEM_NOT_FOUND';
    end if;

    select return_row.*
    into v_return
    from public.returns as return_row
    where return_row.id = v_item.return_id
    for update;

    if v_item.inspection_status <> 'PENDING' then
      raise exception using
        errcode = '55000',
        message = 'RETURN_ITEM_ALREADY_INSPECTED';
    end if;

    if p_condition = 'SELLABLE' then
      if p_batch_code is null
         or upper(trim(p_batch_code)) not like 'RETURN-%' then
        raise exception using
          errcode = '22023',
          message = 'RETURN_BATCH_CODE_REQUIRED';
      end if;

      if p_expiry_date is null or p_expiry_date < p_occurred_at::date then
        raise exception using
          errcode = '22023',
          message = 'VALID_RETURN_EXPIRY_REQUIRED';
      end if;

      insert into public.batches (
        product_id,
        batch_code,
        expiry_date,
        source_type
      )
      values (
        v_item.product_id,
        upper(trim(p_batch_code)),
        p_expiry_date,
        'RETURN'
      )
      returning id into v_batch_id;

      insert into public.movement_groups (
        business_command_id,
        group_type,
        source_type,
        source_id
      )
      values (
        v_command_id,
        'SELLABLE_RETURN',
        'RETURN_ITEM',
        v_item.id::text
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
        v_item.product_id,
        v_batch_id,
        v_item.qty,
        'SELLABLE_RETURN',
        v_return.channel,
        'RETURN_INSPECTION',
        v_item.id::text,
        v_return.external_return_id,
        v_actor_id,
        'return-item:' || v_item.id::text,
        p_occurred_at
      );
    elsif p_condition not in ('DAMAGED', 'LOST') then
      raise exception using
        errcode = '22023',
        message = 'INVALID_RETURN_CONDITION';
    end if;

    update public.return_items
    set
      inspection_status = 'INSPECTED',
      condition = p_condition,
      return_batch_id = v_batch_id,
      inspected_command_id = v_command_id,
      inspected_by = v_actor_id,
      inspected_at = p_occurred_at
    where id = v_item.id;

    if not exists (
      select 1
      from public.return_items
      where return_id = v_return.id
        and inspection_status = 'PENDING'
    ) then
      update public.returns
      set claim_status = 'RESOLVED'
      where id = v_return.id;
    end if;

    update public.business_commands
    set status = 'APPLIED', completed_at = now()
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

      return public.get_return_inspection_receipt(
        v_command_id,
        p_return_item_id,
        'REJECTED'
      );
  end;

  return public.get_return_inspection_receipt(
    v_command_id,
    p_return_item_id,
    'APPLIED'
  );
end;
$$;

create or replace function public.start_opname_session(
  p_idempotency_key text,
  p_started_at timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_session_id uuid;
  v_count bigint;
begin
  perform public.assert_admin();

  if p_idempotency_key is null
     or length(trim(p_idempotency_key)) not between 8 and 160 then
    raise exception using
      errcode = '22023',
      message = 'INVALID_IDEMPOTENCY_KEY';
  end if;

  select session.id
  into v_session_id
  from public.opname_sessions as session
  where session.idempotency_key = trim(p_idempotency_key);

  if found then
    return jsonb_build_object(
      'outcome', 'DUPLICATE',
      'session_id', v_session_id
    );
  end if;

  if exists (
    select 1
    from public.opname_sessions
    where status = 'DRAFT'
  ) then
    raise exception using
      errcode = '55000',
      message = 'OPNAME_SESSION_ALREADY_ACTIVE';
  end if;

  insert into public.opname_sessions (
    idempotency_key,
    actor_id,
    started_at
  )
  values (
    trim(p_idempotency_key),
    auth.uid(),
    p_started_at
  )
  returning id into v_session_id;

  insert into public.opname_counts (
    session_id,
    product_id,
    batch_id,
    system_qty
  )
  select
    v_session_id,
    batch.product_id,
    batch.id,
    coalesce(balance.on_hand_qty, 0)
  from public.batches as batch
  join public.products as product
    on product.id = batch.product_id
   and product.is_active
  left join public.stock_balances as balance
    on balance.product_id = batch.product_id
   and balance.batch_id = batch.id
  order by product.sku, batch.expiry_date, batch.batch_code, batch.id;

  get diagnostics v_count = row_count;

  return jsonb_build_object(
    'outcome', 'APPLIED',
    'session_id', v_session_id,
    'count_rows', v_count
  );
end;
$$;

create or replace function public.save_opname_count(
  p_session_id uuid,
  p_batch_id uuid,
  p_physical_qty bigint
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_count public.opname_counts;
begin
  perform public.assert_admin();

  if p_physical_qty is null or p_physical_qty < 0 then
    raise exception using
      errcode = '22023',
      message = 'INVALID_PHYSICAL_QUANTITY';
  end if;

  perform 1
  from public.opname_sessions
  where id = p_session_id
    and status = 'DRAFT'
  for update;

  if not found then
    raise exception using
      errcode = '55000',
      message = 'DRAFT_OPNAME_SESSION_NOT_FOUND';
  end if;

  update public.opname_counts
  set
    physical_qty = p_physical_qty,
    variance_qty = p_physical_qty - system_qty,
    saved_at = now()
  where session_id = p_session_id
    and batch_id = p_batch_id
  returning * into v_count;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'OPNAME_COUNT_NOT_FOUND';
  end if;

  return to_jsonb(v_count);
end;
$$;

create or replace function public.get_opname_finalize_receipt(
  p_command_id uuid,
  p_session_id uuid,
  p_outcome text default null
)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    public.get_movement_receipt(p_command_id, p_outcome)
    || jsonb_build_object(
      'session', jsonb_build_object(
        'id', session.id,
        'status', session.status,
        'started_at', session.started_at,
        'finalized_at', session.finalized_at,
        'count_rows', (
          select count(*)
          from public.opname_counts
          where session_id = session.id
        ),
        'variance_rows', (
          select count(*)
          from public.opname_counts
          where session_id = session.id
            and variance_qty <> 0
        )
      )
    )
  from public.opname_sessions as session
  where session.id = p_session_id
    and public.is_admin();
$$;

create or replace function public.finalize_opname_session(
  p_idempotency_key text,
  p_session_id uuid,
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
  v_request_hash text;
  v_session public.opname_sessions;
  v_group_id uuid;
  v_count public.opname_counts;
  v_current_qty bigint;
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
      'occurred_at', p_occurred_at,
      'session_id', p_session_id
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
    'FINALIZE_OPNAME',
    trim(p_idempotency_key),
    v_request_hash,
    'PROCESSING',
    v_actor_id,
    'OPNAME_SESSION',
    p_session_id::text
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
        'command_type', 'FINALIZE_OPNAME',
        'movements', '[]'::jsonb,
        'error', jsonb_build_object(
          'code', 'IDEMPOTENCY_KEY_REUSED',
          'message', 'Idempotency key sudah dipakai oleh payload berbeda.'
        )
      );
    end if;

    return public.get_opname_finalize_receipt(
      v_command_id,
      p_session_id,
      case
        when v_existing_status = 'APPLIED' then 'DUPLICATE'
        else 'REJECTED'
      end
    );
  end if;

  begin
    select session.*
    into v_session
    from public.opname_sessions as session
    where session.id = p_session_id
    for update;

    if not found then
      raise exception using
        errcode = 'P0002',
        message = 'OPNAME_SESSION_NOT_FOUND';
    end if;

    if v_session.status <> 'DRAFT' then
      raise exception using
        errcode = '55000',
        message = 'OPNAME_SESSION_ALREADY_FINALIZED';
    end if;

    if exists (
      select 1
      from public.opname_counts
      where session_id = p_session_id
        and physical_qty is null
    ) then
      raise exception using
        errcode = '22023',
        message = 'OPNAME_COUNTS_INCOMPLETE';
    end if;

    perform 1
    from public.stock_balances as balance
    join public.opname_counts as count_row
      on count_row.product_id = balance.product_id
     and count_row.batch_id = balance.batch_id
    where count_row.session_id = p_session_id
    order by balance.product_id, balance.batch_id
    for update of balance;

    for v_count in
      select *
      from public.opname_counts
      where session_id = p_session_id
      order by product_id, batch_id
    loop
      select coalesce(balance.on_hand_qty, 0)
      into v_current_qty
      from public.batches as batch
      left join public.stock_balances as balance
        on balance.product_id = batch.product_id
       and balance.batch_id = batch.id
      where batch.id = v_count.batch_id
        and batch.product_id = v_count.product_id;

      if v_current_qty <> v_count.system_qty then
        raise exception using
          errcode = '40001',
          message = 'OPNAME_SNAPSHOT_STALE',
          detail = format(
            'batch_id=%s snapshot=%s current=%s',
            v_count.batch_id,
            v_count.system_qty,
            v_current_qty
          );
      end if;
    end loop;

    if exists (
      select 1
      from public.opname_counts
      where session_id = p_session_id
        and variance_qty <> 0
    ) then
      insert into public.movement_groups (
        business_command_id,
        group_type,
        source_type,
        source_id
      )
      values (
        v_command_id,
        'OPNAME_ADJUSTMENT',
        'OPNAME_SESSION',
        p_session_id::text
      )
      returning id into v_group_id;

      for v_count in
        select *
        from public.opname_counts
        where session_id = p_session_id
          and variance_qty <> 0
        order by product_id, batch_id
      loop
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
          v_count.product_id,
          v_count.batch_id,
          v_count.variance_qty,
          'OPNAME_ADJUSTMENT',
          'INTERNAL',
          'OPNAME_SESSION',
          p_session_id::text,
          'Finalisasi opname',
          v_actor_id,
          'opname:' || v_count.batch_id::text,
          p_occurred_at
        );
      end loop;
    end if;

    update public.opening_balances as opening
    set
      verification_status = 'VERIFIED',
      verified_by_opname_session_id = p_session_id,
      verified_at = p_occurred_at
    where opening.verification_status = 'UNVERIFIED'
      and exists (
        select 1
        from public.opname_counts as count_row
        where count_row.session_id = p_session_id
          and count_row.batch_id = opening.batch_id
      );

    update public.opname_sessions
    set
      status = 'FINALIZED',
      finalized_at = p_occurred_at,
      finalized_command_id = v_command_id
    where id = p_session_id;

    update public.business_commands
    set status = 'APPLIED', completed_at = now()
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

      return public.get_opname_finalize_receipt(
        v_command_id,
        p_session_id,
        'REJECTED'
      );
  end;

  return public.get_opname_finalize_receipt(
    v_command_id,
    p_session_id,
    'APPLIED'
  );
end;
$$;

create or replace function public.run_daily_reconciliation(
  p_as_of timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_detected_count bigint;
  v_open_count bigint;
begin
  perform public.assert_admin();

  update public.anomalies
  set status = 'RESOLVED', resolved_at = p_as_of
  where status = 'OPEN'
    and type in (
      'PROJECTION_DRIFT',
      'NEGATIVE_STOCK',
      'ORDER_LEDGER_MISMATCH',
      'DUPLICATE_PROCESSING',
      'ORPHAN_MOVEMENT',
      'OVER_RETURN',
      'OVERDUE_RETURN'
    );

  insert into public.anomalies (
    fingerprint,
    type,
    severity,
    product_id,
    batch_id,
    explanation,
    evidence,
    detected_at,
    last_detected_at
  )
  select
    'PROJECTION_DRIFT:' || coalesce(ledger.batch_id, balance.batch_id)::text,
    'PROJECTION_DRIFT',
    'CRITICAL',
    coalesce(ledger.product_id, balance.product_id),
    coalesce(ledger.batch_id, balance.batch_id),
    'Saldo projection berbeda dari penjumlahan ledger.',
    jsonb_build_object(
      'ledger_qty', coalesce(ledger.ledger_qty, 0),
      'projection_qty', coalesce(balance.on_hand_qty, 0)
    ),
    p_as_of,
    p_as_of
  from (
    select product_id, batch_id, sum(qty_delta)::bigint as ledger_qty
    from public.stock_ledger
    group by product_id, batch_id
  ) as ledger
  full outer join public.stock_balances as balance
    on balance.product_id = ledger.product_id
   and balance.batch_id = ledger.batch_id
  where coalesce(ledger.ledger_qty, 0) <> coalesce(balance.on_hand_qty, 0)
  on conflict (fingerprint) do update
  set
    status = 'OPEN',
    severity = excluded.severity,
    explanation = excluded.explanation,
    evidence = excluded.evidence,
    last_detected_at = p_as_of,
    resolved_at = null;

  insert into public.anomalies (
    fingerprint,
    type,
    severity,
    product_id,
    batch_id,
    explanation,
    evidence,
    detected_at,
    last_detected_at
  )
  select
    'NEGATIVE_STOCK:' || balance.batch_id::text,
    'NEGATIVE_STOCK',
    'CRITICAL',
    balance.product_id,
    balance.batch_id,
    'Saldo batch berada di bawah nol.',
    jsonb_build_object('on_hand_qty', balance.on_hand_qty),
    p_as_of,
    p_as_of
  from public.stock_balances as balance
  where balance.on_hand_qty < 0
  on conflict (fingerprint) do update
  set
    status = 'OPEN',
    severity = excluded.severity,
    explanation = excluded.explanation,
    evidence = excluded.evidence,
    last_detected_at = p_as_of,
    resolved_at = null;

  insert into public.anomalies (
    fingerprint,
    type,
    severity,
    product_id,
    order_id,
    explanation,
    evidence,
    detected_at,
    last_detected_at
  )
  select
    'ORDER_LEDGER_MISMATCH:' || component.id::text,
    'ORDER_LEDGER_MISMATCH',
    'CRITICAL',
    component.product_id,
    order_item.order_id,
    'Kuantitas shipment order tidak cocok dengan movement ledger.',
    jsonb_build_object(
      'component_id', component.id,
      'shipped_qty', component.shipped_qty,
      'ledger_outbound_qty', coalesce(ledger.outbound_qty, 0)
    ),
    p_as_of,
    p_as_of
  from public.order_item_components as component
  join public.order_items as order_item on order_item.id = component.order_item_id
  left join lateral (
    select coalesce(sum(-movement.qty_delta), 0)::bigint as outbound_qty
    from public.stock_ledger as movement
    where movement.source_type = 'MARKETPLACE_ORDER_ITEM_COMPONENT'
      and movement.source_id = component.id::text
      and movement.qty_delta < 0
  ) as ledger on true
  where component.shipped_qty > 0
    and component.shipped_qty <> coalesce(ledger.outbound_qty, 0)
  on conflict (fingerprint) do update
  set
    status = 'OPEN',
    severity = excluded.severity,
    explanation = excluded.explanation,
    evidence = excluded.evidence,
    last_detected_at = p_as_of,
    resolved_at = null;

  insert into public.anomalies (
    fingerprint,
    type,
    severity,
    explanation,
    evidence,
    detected_at,
    last_detected_at
  )
  select
    'DUPLICATE_PROCESSING:' || attempt.marketplace_event_id::text,
    'DUPLICATE_PROCESSING',
    'WARNING',
    'Satu marketplace event mempunyai lebih dari satu attempt APPLIED.',
    jsonb_build_object(
      'marketplace_event_id', attempt.marketplace_event_id,
      'applied_attempts', count(*)
    ),
    p_as_of,
    p_as_of
  from public.marketplace_event_attempts as attempt
  where attempt.processing_status = 'APPLIED'
  group by attempt.marketplace_event_id
  having count(*) > 1
  on conflict (fingerprint) do update
  set
    status = 'OPEN',
    severity = excluded.severity,
    explanation = excluded.explanation,
    evidence = excluded.evidence,
    last_detected_at = p_as_of,
    resolved_at = null;

  insert into public.anomalies (
    fingerprint,
    type,
    severity,
    product_id,
    movement_id,
    explanation,
    evidence,
    detected_at,
    last_detected_at
  )
  select
    'ORPHAN_MOVEMENT:' || movement.id::text,
    'ORPHAN_MOVEMENT',
    'CRITICAL',
    movement.product_id,
    movement.id,
    'Movement marketplace tidak mempunyai komponen order sumber yang valid.',
    jsonb_build_object(
      'source_type', movement.source_type,
      'source_id', movement.source_id
    ),
    p_as_of,
    p_as_of
  from public.stock_ledger as movement
  left join public.order_item_components as component
    on movement.source_id = component.id::text
  where movement.source_type = 'MARKETPLACE_ORDER_ITEM_COMPONENT'
    and component.id is null
  on conflict (fingerprint) do update
  set
    status = 'OPEN',
    severity = excluded.severity,
    explanation = excluded.explanation,
    evidence = excluded.evidence,
    last_detected_at = p_as_of,
    resolved_at = null;

  insert into public.anomalies (
    fingerprint,
    type,
    severity,
    product_id,
    order_id,
    explanation,
    evidence,
    detected_at,
    last_detected_at
  )
  select
    'OVER_RETURN:' || shipped.order_item_id::text || ':' || shipped.product_id::text,
    'OVER_RETURN',
    'CRITICAL',
    shipped.product_id,
    order_item.order_id,
    'Kuantitas return melebihi kuantitas fisik yang dikirim.',
    jsonb_build_object(
      'shipped_qty', shipped.shipped_qty,
      'returned_qty', returned.returned_qty
    ),
    p_as_of,
    p_as_of
  from (
    select
      component.order_item_id,
      component.product_id,
      sum(greatest(component.shipped_qty - component.cancelled_qty, 0))::bigint
        as shipped_qty
    from public.order_item_components as component
    group by component.order_item_id, component.product_id
  ) as shipped
  join public.order_items as order_item on order_item.id = shipped.order_item_id
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
  where returned.returned_qty > shipped.shipped_qty
  on conflict (fingerprint) do update
  set
    status = 'OPEN',
    severity = excluded.severity,
    explanation = excluded.explanation,
    evidence = excluded.evidence,
    last_detected_at = p_as_of,
    resolved_at = null;

  insert into public.anomalies (
    fingerprint,
    type,
    severity,
    order_id,
    return_id,
    explanation,
    evidence,
    detected_at,
    last_detected_at
  )
  select
    'OVERDUE_RETURN:' || return_row.id::text,
    'OVERDUE_RETURN',
    'WARNING',
    return_row.order_id,
    return_row.id,
    'Batas klaim return TikTok sudah terlewati dan inspeksi belum selesai.',
    jsonb_build_object(
      'claim_deadline', return_row.claim_deadline,
      'external_return_id', return_row.external_return_id
    ),
    p_as_of,
    p_as_of
  from public.returns as return_row
  where return_row.channel = 'TIKTOK'
    and return_row.claim_status = 'OPEN'
    and return_row.claim_deadline < p_as_of
  on conflict (fingerprint) do update
  set
    status = 'OPEN',
    severity = excluded.severity,
    explanation = excluded.explanation,
    evidence = excluded.evidence,
    last_detected_at = p_as_of,
    resolved_at = null;

  select count(*) into v_detected_count
  from public.anomalies
  where last_detected_at = p_as_of
    and status = 'OPEN';

  select count(*) into v_open_count
  from public.anomalies
  where status = 'OPEN';

  return jsonb_build_object(
    'as_of', p_as_of,
    'detected_count', v_detected_count,
    'open_count', v_open_count
  );
end;
$$;

create or replace view public.notification_feed
with (security_invoker = true)
as
select
  'EXPIRY:' || batch.id::text as id,
  'EXPIRY'::text as type,
  case
    when batch.expiry_date <= current_date + 30 then 'CRITICAL'
    else 'WARNING'
  end::text as severity,
  'Batch mendekati kedaluwarsa'::text as title,
  product.sku || ' · ' || batch.batch_code || ' · '
    || balance.on_hand_qty::text || ' unit' as message,
  batch.expiry_date::timestamptz as due_at,
  product.id as product_id,
  batch.id as batch_id,
  null::uuid as return_id,
  batch.created_at
from public.stock_balances as balance
join public.batches as batch
  on batch.id = balance.batch_id
 and batch.product_id = balance.product_id
join public.products as product on product.id = batch.product_id
where balance.on_hand_qty > 0
  and batch.expiry_date <= current_date + 90

union all

select
  'TIKTOK_CLAIM:' || return_row.id::text as id,
  'TIKTOK_CLAIM'::text as type,
  case
    when return_row.claim_deadline < now() then 'CRITICAL'
    else 'WARNING'
  end::text as severity,
  'Batas klaim return TikTok'::text as title,
  return_row.external_return_id || ' · '
    || greatest(
      ceil(extract(epoch from (return_row.claim_deadline - now())) / 86400),
      0
    )::bigint::text || ' hari tersisa' as message,
  return_row.claim_deadline as due_at,
  null::uuid as product_id,
  null::uuid as batch_id,
  return_row.id as return_id,
  return_row.recorded_at as created_at
from public.returns as return_row
where return_row.channel = 'TIKTOK'
  and return_row.claim_status = 'OPEN'
  and return_row.claim_deadline <= now() + interval '10 days';

alter table public.returns enable row level security;
alter table public.return_items enable row level security;
alter table public.opname_sessions enable row level security;
alter table public.opname_counts enable row level security;
alter table public.anomalies enable row level security;

create policy returns_admin_select
on public.returns for select
to authenticated
using (public.is_admin());

create policy return_items_admin_select
on public.return_items for select
to authenticated
using (public.is_admin());

create policy opname_sessions_admin_select
on public.opname_sessions for select
to authenticated
using (public.is_admin());

create policy opname_counts_admin_select
on public.opname_counts for select
to authenticated
using (public.is_admin());

create policy anomalies_admin_select
on public.anomalies for select
to authenticated
using (public.is_admin());

revoke all on table public.returns from anon, authenticated;
revoke all on table public.return_items from anon, authenticated;
revoke all on table public.opname_sessions from anon, authenticated;
revoke all on table public.opname_counts from anon, authenticated;
revoke all on table public.anomalies from anon, authenticated;
revoke all on table public.notification_feed from anon, authenticated;

grant select on table public.returns to authenticated;
grant select on table public.return_items to authenticated;
grant select on table public.opname_sessions to authenticated;
grant select on table public.opname_counts to authenticated;
grant select on table public.anomalies to authenticated;
grant select on table public.notification_feed to authenticated;

grant select on table public.returns to service_role;
grant select on table public.return_items to service_role;
grant select on table public.opname_sessions to service_role;
grant select on table public.opname_counts to service_role;
grant select on table public.anomalies to service_role;
grant select on table public.notification_feed to service_role;

revoke execute on function public.get_return_receipt(uuid, text) from public;
revoke execute on function public.create_return(
  text,
  public.stock_channel,
  text,
  text,
  jsonb,
  timestamptz
) from public;
revoke execute on function public.get_return_inspection_receipt(
  uuid,
  uuid,
  text
) from public;
revoke execute on function public.inspect_return_item(
  text,
  uuid,
  public.return_condition,
  text,
  date,
  timestamptz
) from public;
revoke execute on function public.start_opname_session(text, timestamptz)
  from public;
revoke execute on function public.save_opname_count(uuid, uuid, bigint)
  from public;
revoke execute on function public.get_opname_finalize_receipt(
  uuid,
  uuid,
  text
) from public;
revoke execute on function public.finalize_opname_session(
  text,
  uuid,
  timestamptz
) from public;
revoke execute on function public.run_daily_reconciliation(timestamptz)
  from public;

grant execute on function public.get_return_receipt(uuid, text)
  to authenticated;
grant execute on function public.create_return(
  text,
  public.stock_channel,
  text,
  text,
  jsonb,
  timestamptz
) to authenticated;
grant execute on function public.get_return_inspection_receipt(
  uuid,
  uuid,
  text
) to authenticated;
grant execute on function public.inspect_return_item(
  text,
  uuid,
  public.return_condition,
  text,
  date,
  timestamptz
) to authenticated;
grant execute on function public.start_opname_session(text, timestamptz)
  to authenticated;
grant execute on function public.save_opname_count(uuid, uuid, bigint)
  to authenticated;
grant execute on function public.get_opname_finalize_receipt(
  uuid,
  uuid,
  text
) to authenticated;
grant execute on function public.finalize_opname_session(
  text,
  uuid,
  timestamptz
) to authenticated;
grant execute on function public.run_daily_reconciliation(timestamptz)
  to authenticated;

update public.system_settings
set schema_version = 5;

commit;

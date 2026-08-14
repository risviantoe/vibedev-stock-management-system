begin;

create type public.marketplace_event_source as enum (
  'SIMULATOR',
  'CSV_IMPORT',
  'SHOPEE',
  'TIKTOK'
);

create type public.marketplace_event_type as enum (
  'ORDER_CREATED',
  'ORDER_SHIPPED',
  'ORDER_CANCELLED'
);

create type public.marketplace_processing_status as enum (
  'RECEIVED',
  'APPLIED',
  'DUPLICATE',
  'REJECTED'
);

create type public.marketplace_order_status as enum (
  'RESERVED',
  'SHIPPED',
  'IN_TRANSIT',
  'PARTIALLY_CANCELLED',
  'CANCELLED'
);

create type public.marketplace_listing_type as enum (
  'PHYSICAL',
  'BUNDLE'
);

create type public.order_component_type as enum (
  'PRIMARY',
  'BUNDLE_COMPONENT',
  'PROMO'
);

create table public.bundles (
  id uuid primary key default extensions.gen_random_uuid(),
  sku text not null check (length(trim(sku)) between 1 and 80),
  name text not null check (length(trim(name)) between 1 and 180),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index bundles_sku_unique
  on public.bundles (upper(sku));

create table public.bundle_recipe_versions (
  id uuid primary key default extensions.gen_random_uuid(),
  bundle_id uuid not null references public.bundles (id) on delete restrict,
  version integer not null check (version > 0),
  effective_from timestamptz not null,
  created_at timestamptz not null default now(),
  unique (bundle_id, version)
);

create index bundle_recipe_versions_effective_idx
  on public.bundle_recipe_versions (bundle_id, effective_from desc, version desc);

create table public.bundle_recipe_components (
  id uuid primary key default extensions.gen_random_uuid(),
  recipe_version_id uuid not null
    references public.bundle_recipe_versions (id) on delete restrict,
  product_id uuid not null references public.products (id) on delete restrict,
  qty bigint not null check (qty > 0),
  created_at timestamptz not null default now(),
  unique (recipe_version_id, product_id)
);

create table public.promo_rules (
  id uuid primary key default extensions.gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 180),
  start_at timestamptz not null,
  end_at timestamptz not null,
  channel public.stock_channel not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (channel in ('SHOPEE', 'TIKTOK')),
  check (end_at > start_at)
);

create index promo_rules_active_window_idx
  on public.promo_rules (channel, start_at, end_at)
  where is_active;

create table public.promo_rule_items (
  id uuid primary key default extensions.gen_random_uuid(),
  promo_rule_id uuid not null
    references public.promo_rules (id) on delete restrict,
  trigger_product_id uuid not null
    references public.products (id) on delete restrict,
  trigger_qty bigint not null check (trigger_qty > 0),
  free_product_id uuid not null
    references public.products (id) on delete restrict,
  free_qty bigint not null check (free_qty > 0),
  created_at timestamptz not null default now(),
  unique (promo_rule_id, trigger_product_id, free_product_id)
);

create table public.marketplace_listings (
  id uuid primary key default extensions.gen_random_uuid(),
  channel public.stock_channel not null,
  listing_sku text not null
    check (length(trim(listing_sku)) between 1 and 100),
  listing_type public.marketplace_listing_type not null,
  product_id uuid references public.products (id) on delete restrict,
  bundle_id uuid references public.bundles (id) on delete restrict,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (channel in ('SHOPEE', 'TIKTOK')),
  check (
    (
      listing_type = 'PHYSICAL'
      and product_id is not null
      and bundle_id is null
    )
    or (
      listing_type = 'BUNDLE'
      and product_id is null
      and bundle_id is not null
    )
  )
);

create unique index marketplace_listings_channel_sku_unique
  on public.marketplace_listings (channel, upper(listing_sku));

create table public.marketplace_events (
  id uuid primary key default extensions.gen_random_uuid(),
  source public.marketplace_event_source not null,
  external_event_id text not null
    check (length(trim(external_event_id)) between 1 and 160),
  channel public.stock_channel not null,
  event_type public.marketplace_event_type not null,
  external_order_id text not null
    check (length(trim(external_order_id)) between 1 and 160),
  raw_payload jsonb not null default '{}'::jsonb,
  canonical_payload jsonb not null,
  payload_hash text not null check (payload_hash ~ '^[a-f0-9]{64}$'),
  occurred_at timestamptz not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  processing_status public.marketplace_processing_status
    not null default 'RECEIVED',
  business_command_id uuid
    references public.business_commands (id) on delete restrict,
  error_code text,
  error_message text,
  unique (source, external_event_id),
  check (channel in ('SHOPEE', 'TIKTOK')),
  check (
    (processing_status = 'RECEIVED' and processed_at is null)
    or (processing_status <> 'RECEIVED' and processed_at is not null)
  ),
  check (
    (processing_status = 'REJECTED' and error_code is not null)
    or processing_status <> 'REJECTED'
  )
);

create index marketplace_events_inbox_idx
  on public.marketplace_events (received_at desc, id);

create index marketplace_events_order_idx
  on public.marketplace_events (channel, external_order_id, occurred_at, id);

create table public.marketplace_event_attempts (
  id uuid primary key default extensions.gen_random_uuid(),
  marketplace_event_id uuid not null
    references public.marketplace_events (id) on delete restrict,
  attempt_no integer not null check (attempt_no > 0),
  processing_status public.marketplace_processing_status not null,
  payload_hash text not null check (payload_hash ~ '^[a-f0-9]{64}$'),
  error_code text,
  error_message text,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  unique (marketplace_event_id, attempt_no),
  check (
    (processing_status = 'RECEIVED' and processed_at is null)
    or (processing_status <> 'RECEIVED' and processed_at is not null)
  )
);

create index marketplace_event_attempts_inbox_idx
  on public.marketplace_event_attempts (received_at desc, id);

create table public.orders (
  id uuid primary key default extensions.gen_random_uuid(),
  external_order_id text not null
    check (length(trim(external_order_id)) between 1 and 160),
  channel public.stock_channel not null,
  status public.marketplace_order_status not null default 'RESERVED',
  created_event_id uuid not null
    references public.marketplace_events (id) on delete restrict,
  last_event_id uuid not null
    references public.marketplace_events (id) on delete restrict,
  ordered_at timestamptz not null,
  shipped_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (channel, external_order_id),
  check (channel in ('SHOPEE', 'TIKTOK'))
);

create index orders_status_updated_idx
  on public.orders (status, updated_at desc, id);

create table public.order_items (
  id uuid primary key default extensions.gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete restrict,
  external_line_id text not null
    check (length(trim(external_line_id)) between 1 and 160),
  listing_sku text not null
    check (length(trim(listing_sku)) between 1 and 100),
  listing_type public.marketplace_listing_type not null,
  ordered_qty bigint not null check (ordered_qty > 0),
  reserved_qty bigint not null default 0 check (reserved_qty >= 0),
  shipped_qty bigint not null default 0 check (shipped_qty >= 0),
  cancelled_qty bigint not null default 0 check (cancelled_qty >= 0),
  returned_qty bigint not null default 0 check (returned_qty >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (order_id, external_line_id),
  check (reserved_qty + shipped_qty <= ordered_qty),
  check (cancelled_qty <= ordered_qty),
  check (returned_qty <= shipped_qty)
);

create index order_items_order_idx
  on public.order_items (order_id, created_at, id);

create table public.order_item_components (
  id uuid primary key default extensions.gen_random_uuid(),
  order_item_id uuid not null
    references public.order_items (id) on delete restrict,
  product_id uuid not null references public.products (id) on delete restrict,
  component_type public.order_component_type not null,
  qty_per_item numeric(18, 6) not null check (qty_per_item > 0),
  ordered_component_qty bigint not null check (ordered_component_qty > 0),
  reserved_qty bigint not null default 0 check (reserved_qty >= 0),
  shipped_qty bigint not null default 0 check (shipped_qty >= 0),
  cancelled_qty bigint not null default 0 check (cancelled_qty >= 0),
  recipe_version_id uuid
    references public.bundle_recipe_versions (id) on delete restrict,
  promo_rule_id uuid references public.promo_rules (id) on delete restrict,
  snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (reserved_qty + shipped_qty <= ordered_component_qty),
  check (cancelled_qty <= ordered_component_qty),
  check (
    (component_type = 'BUNDLE_COMPONENT' and recipe_version_id is not null)
    or component_type <> 'BUNDLE_COMPONENT'
  ),
  check (
    (component_type = 'PROMO' and promo_rule_id is not null)
    or component_type <> 'PROMO'
  )
);

create index order_item_components_item_idx
  on public.order_item_components (order_item_id, product_id, id);

create index order_item_components_product_idx
  on public.order_item_components (product_id, reserved_qty)
  where reserved_qty > 0;

create table public.product_reservations (
  product_id uuid primary key
    references public.products (id) on delete restrict,
  reserved_qty bigint not null default 0 check (reserved_qty >= 0),
  updated_at timestamptz not null default now()
);

create table public.marketplace_cancellation_allocations (
  id uuid primary key default extensions.gen_random_uuid(),
  marketplace_event_id uuid not null
    references public.marketplace_events (id) on delete restrict,
  order_item_component_id uuid not null
    references public.order_item_components (id) on delete restrict,
  original_movement_id uuid not null unique
    references public.stock_ledger (id) on delete restrict,
  reversal_movement_id uuid not null unique
    references public.stock_ledger (id) on delete restrict,
  residual_movement_id uuid unique
    references public.stock_ledger (id) on delete restrict,
  qty bigint not null check (qty > 0),
  created_at timestamptz not null default now()
);

create trigger bundles_set_updated_at
before update on public.bundles
for each row execute function public.set_updated_at();

create trigger promo_rules_set_updated_at
before update on public.promo_rules
for each row execute function public.set_updated_at();

create trigger marketplace_listings_set_updated_at
before update on public.marketplace_listings
for each row execute function public.set_updated_at();

create trigger orders_set_updated_at
before update on public.orders
for each row execute function public.set_updated_at();

create trigger order_items_set_updated_at
before update on public.order_items
for each row execute function public.set_updated_at();

create trigger order_item_components_set_updated_at
before update on public.order_item_components
for each row execute function public.set_updated_at();

create trigger product_reservations_set_updated_at
before update on public.product_reservations
for each row execute function public.set_updated_at();

create or replace function public.ensure_product_reservation_covered()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_on_hand bigint;
  v_reserved bigint;
begin
  select coalesce(sum(balance.on_hand_qty), 0)::bigint
  into v_on_hand
  from public.stock_balances as balance
  where balance.product_id = new.product_id;

  select coalesce(reservation.reserved_qty, 0)
  into v_reserved
  from public.product_reservations as reservation
  where reservation.product_id = new.product_id;

  v_reserved := coalesce(v_reserved, 0);

  if v_on_hand < v_reserved then
    raise exception using
      errcode = 'P0001',
      message = 'RESERVED_STOCK_PROTECTED',
      detail = format(
        'product_id=%s on_hand=%s reserved=%s',
        new.product_id,
        v_on_hand,
        v_reserved
      );
  end if;

  return new;
end;
$$;

create trigger stock_ledger_validate_reservations
after insert on public.stock_ledger
for each row execute function public.ensure_product_reservation_covered();

create or replace function public.get_marketplace_event_receipt(
  p_event_id uuid,
  p_outcome text default null
)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with event_row as (
    select event.*
    from public.marketplace_events as event
    where event.id = p_event_id
  ),
  order_row as (
    select orders.*
    from public.orders
    join event_row
      on orders.channel = event_row.channel
     and orders.external_order_id = event_row.external_order_id
    limit 1
  ),
  item_rows as (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', item.id,
          'external_line_id', item.external_line_id,
          'listing_sku', item.listing_sku,
          'listing_type', item.listing_type,
          'ordered_qty', item.ordered_qty,
          'reserved_qty', item.reserved_qty,
          'shipped_qty', item.shipped_qty,
          'cancelled_qty', item.cancelled_qty,
          'components', (
            select coalesce(
              jsonb_agg(
                jsonb_build_object(
                  'id', component.id,
                  'product_id', component.product_id,
                  'product_sku', product.sku,
                  'product_name', product.name,
                  'component_type', component.component_type,
                  'ordered_qty', component.ordered_component_qty,
                  'reserved_qty', component.reserved_qty,
                  'shipped_qty', component.shipped_qty,
                  'cancelled_qty', component.cancelled_qty,
                  'snapshot', component.snapshot
                )
                order by component.component_type, product.sku, component.id
              ),
              '[]'::jsonb
            )
            from public.order_item_components as component
            join public.products as product on product.id = component.product_id
            where component.order_item_id = item.id
          )
        )
        order by item.created_at, item.id
      ),
      '[]'::jsonb
    ) as items
    from public.order_items as item
    join order_row on order_row.id = item.order_id
  )
  select
    coalesce(
      case
        when event_row.business_command_id is not null then
          public.get_movement_receipt(
            event_row.business_command_id,
            coalesce(p_outcome, event_row.processing_status::text)
          )
        else
          jsonb_build_object(
            'outcome', coalesce(p_outcome, event_row.processing_status::text),
            'command_id', null,
            'movement_group_id', null,
            'idempotency_key', null,
            'command_type', 'INGEST_MARKETPLACE_EVENT',
            'movements', '[]'::jsonb,
            'error', case
              when event_row.error_code is null then null
              else jsonb_build_object(
                'code', event_row.error_code,
                'message', event_row.error_message
              )
            end
          )
      end,
      '{}'::jsonb
    )
    || jsonb_build_object(
      'event', jsonb_build_object(
        'id', event_row.id,
        'source', event_row.source,
        'external_event_id', event_row.external_event_id,
        'channel', event_row.channel,
        'event_type', event_row.event_type,
        'external_order_id', event_row.external_order_id,
        'processing_status', event_row.processing_status,
        'occurred_at', event_row.occurred_at,
        'received_at', event_row.received_at,
        'processed_at', event_row.processed_at
      ),
      'order', case
        when order_row.id is null then null
        else jsonb_build_object(
          'id', order_row.id,
          'external_order_id', order_row.external_order_id,
          'channel', order_row.channel,
          'status', order_row.status,
          'ordered_at', order_row.ordered_at,
          'shipped_at', order_row.shipped_at,
          'cancelled_at', order_row.cancelled_at,
          'items', item_rows.items
        )
      end
    )
  from event_row
  left join order_row on true
  left join item_rows on true;
$$;

create or replace function public.save_bundle_recipe(
  p_sku text,
  p_name text,
  p_components jsonb,
  p_effective_from timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_bundle_id uuid;
  v_recipe_id uuid;
  v_version integer;
  v_component jsonb;
  v_product_id uuid;
  v_qty bigint;
begin
  perform public.assert_admin();

  if p_sku is null or length(trim(p_sku)) not between 1 and 80 then
    raise exception using errcode = '22023', message = 'INVALID_BUNDLE_SKU';
  end if;

  if p_name is null or length(trim(p_name)) not between 1 and 180 then
    raise exception using errcode = '22023', message = 'INVALID_BUNDLE_NAME';
  end if;

  if jsonb_typeof(p_components) <> 'array'
     or jsonb_array_length(p_components) = 0 then
    raise exception using
      errcode = '22023',
      message = 'BUNDLE_COMPONENTS_REQUIRED';
  end if;

  insert into public.bundles (sku, name, is_active)
  values (upper(trim(p_sku)), trim(p_name), true)
  on conflict ((upper(sku))) do update
  set
    name = excluded.name,
    is_active = true
  returning id into v_bundle_id;

  perform 1
  from public.bundles
  where id = v_bundle_id
  for update;

  select coalesce(max(version), 0) + 1
  into v_version
  from public.bundle_recipe_versions
  where bundle_id = v_bundle_id;

  insert into public.bundle_recipe_versions (
    bundle_id,
    version,
    effective_from
  )
  values (
    v_bundle_id,
    v_version,
    coalesce(p_effective_from, now())
  )
  returning id into v_recipe_id;

  for v_component in
    select value
    from jsonb_array_elements(p_components)
  loop
    v_product_id := (v_component ->> 'product_id')::uuid;
    v_qty := (v_component ->> 'qty')::bigint;

    if v_qty <= 0 then
      raise exception using
        errcode = '22023',
        message = 'BUNDLE_COMPONENT_QTY_MUST_BE_POSITIVE';
    end if;

    perform 1
    from public.products
    where id = v_product_id
      and is_active;

    if not found then
      raise exception using
        errcode = 'P0002',
        message = 'ACTIVE_COMPONENT_PRODUCT_NOT_FOUND';
    end if;

    insert into public.bundle_recipe_components (
      recipe_version_id,
      product_id,
      qty
    )
    values (v_recipe_id, v_product_id, v_qty);
  end loop;

  return jsonb_build_object(
    'bundle_id', v_bundle_id,
    'recipe_version_id', v_recipe_id,
    'version', v_version
  );
end;
$$;

create or replace function public.save_promo_rule(
  p_name text,
  p_channel public.stock_channel,
  p_start_at timestamptz,
  p_end_at timestamptz,
  p_trigger_product_id uuid,
  p_trigger_qty bigint,
  p_free_product_id uuid,
  p_free_qty bigint
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_rule_id uuid;
begin
  perform public.assert_admin();

  if p_name is null or length(trim(p_name)) not between 1 and 180 then
    raise exception using errcode = '22023', message = 'INVALID_PROMO_NAME';
  end if;

  if p_channel not in ('SHOPEE', 'TIKTOK') then
    raise exception using errcode = '22023', message = 'INVALID_PROMO_CHANNEL';
  end if;

  if p_start_at is null or p_end_at is null or p_end_at <= p_start_at then
    raise exception using errcode = '22023', message = 'INVALID_PROMO_WINDOW';
  end if;

  if p_trigger_qty is null or p_trigger_qty <= 0
     or p_free_qty is null or p_free_qty <= 0 then
    raise exception using errcode = '22023', message = 'INVALID_PROMO_QTY';
  end if;

  perform 1
  where (
    select count(distinct product.id)
    from public.products as product
    where product.id in (p_trigger_product_id, p_free_product_id)
      and product.is_active
  ) = case
    when p_trigger_product_id = p_free_product_id then 1
    else 2
  end;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'ACTIVE_PROMO_PRODUCT_NOT_FOUND';
  end if;

  insert into public.promo_rules (
    name,
    start_at,
    end_at,
    channel,
    is_active
  )
  values (
    trim(p_name),
    p_start_at,
    p_end_at,
    p_channel,
    true
  )
  returning id into v_rule_id;

  insert into public.promo_rule_items (
    promo_rule_id,
    trigger_product_id,
    trigger_qty,
    free_product_id,
    free_qty
  )
  values (
    v_rule_id,
    p_trigger_product_id,
    p_trigger_qty,
    p_free_product_id,
    p_free_qty
  );

  return jsonb_build_object('promo_rule_id', v_rule_id);
end;
$$;

create or replace function public.ingest_marketplace_event(
  p_source public.marketplace_event_source,
  p_external_event_id text,
  p_channel public.stock_channel,
  p_event_type public.marketplace_event_type,
  p_external_order_id text,
  p_items jsonb default '[]'::jsonb,
  p_occurred_at timestamptz default now(),
  p_raw_payload jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor_id uuid := auth.uid();
  v_event_id uuid;
  v_attempt_id uuid;
  v_attempt_no integer;
  v_command_id uuid;
  v_group_id uuid;
  v_original_group_id uuid;
  v_payload_hash text;
  v_existing_hash text;
  v_canonical_payload jsonb;
  v_order public.orders;
  v_order_id uuid;
  v_item public.order_items;
  v_item_id uuid;
  v_item_value jsonb;
  v_listing public.marketplace_listings;
  v_recipe_id uuid;
  v_recipe_version integer;
  v_qty bigint;
  v_cancel_qty bigint;
  v_new_item_cancelled bigint;
  v_total_component_qty bigint;
  v_target_component_cancelled bigint;
  v_component_cancel_qty bigint;
  v_reserved_cancel_qty bigint;
  v_physical_cancel_qty bigint;
  v_available_qty bigint;
  v_current_reserved bigint;
  v_remaining_qty bigint;
  v_allocated_qty bigint;
  v_reversal_id uuid;
  v_residual_id uuid;
  v_error_message text;
  v_component record;
  v_product_total record;
  v_batch record;
  v_movement record;
  v_recipe_component record;
  v_promo record;
begin
  perform public.assert_admin();

  if p_external_event_id is null
     or length(trim(p_external_event_id)) not between 1 and 160 then
    raise exception using
      errcode = '22023',
      message = 'INVALID_EXTERNAL_EVENT_ID';
  end if;

  if p_external_order_id is null
     or length(trim(p_external_order_id)) not between 1 and 160 then
    raise exception using
      errcode = '22023',
      message = 'INVALID_EXTERNAL_ORDER_ID';
  end if;

  if p_channel not in ('SHOPEE', 'TIKTOK') then
    raise exception using
      errcode = '22023',
      message = 'INVALID_MARKETPLACE_CHANNEL';
  end if;

  if p_source = 'SHOPEE' and p_channel <> 'SHOPEE'
     or p_source = 'TIKTOK' and p_channel <> 'TIKTOK' then
    raise exception using
      errcode = '22023',
      message = 'SOURCE_CHANNEL_MISMATCH';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    raise exception using
      errcode = '22023',
      message = 'EVENT_ITEMS_MUST_BE_ARRAY';
  end if;

  v_canonical_payload := jsonb_build_object(
    'source', p_source,
    'external_event_id', trim(p_external_event_id),
    'channel', p_channel,
    'event_type', p_event_type,
    'external_order_id', trim(p_external_order_id),
    'occurred_at', p_occurred_at,
    'items', p_items
  );
  v_payload_hash := public.request_hash(v_canonical_payload);

  insert into public.marketplace_events (
    source,
    external_event_id,
    channel,
    event_type,
    external_order_id,
    raw_payload,
    canonical_payload,
    payload_hash,
    occurred_at
  )
  values (
    p_source,
    trim(p_external_event_id),
    p_channel,
    p_event_type,
    trim(p_external_order_id),
    coalesce(p_raw_payload, '{}'::jsonb),
    v_canonical_payload,
    v_payload_hash,
    coalesce(p_occurred_at, now())
  )
  on conflict (source, external_event_id) do nothing
  returning id into v_event_id;

  if v_event_id is null then
    select event.id, event.payload_hash
    into v_event_id, v_existing_hash
    from public.marketplace_events as event
    where event.source = p_source
      and event.external_event_id = trim(p_external_event_id)
    for update;

    select coalesce(max(attempt_no), 0) + 1
    into v_attempt_no
    from public.marketplace_event_attempts
    where marketplace_event_id = v_event_id;

    if v_existing_hash <> v_payload_hash then
      insert into public.marketplace_event_attempts (
        marketplace_event_id,
        attempt_no,
        processing_status,
        payload_hash,
        error_code,
        error_message,
        processed_at
      )
      values (
        v_event_id,
        v_attempt_no,
        'REJECTED',
        v_payload_hash,
        'EVENT_ID_REUSED',
        'External event ID sudah dipakai oleh payload berbeda.',
        now()
      );

      return public.get_marketplace_event_receipt(v_event_id, 'REJECTED')
        || jsonb_build_object(
          'error',
          jsonb_build_object(
            'code', 'EVENT_ID_REUSED',
            'message', 'External event ID sudah dipakai oleh payload berbeda.'
          )
        );
    end if;

    insert into public.marketplace_event_attempts (
      marketplace_event_id,
      attempt_no,
      processing_status,
      payload_hash,
      processed_at
    )
    values (
      v_event_id,
      v_attempt_no,
      'DUPLICATE',
      v_payload_hash,
      now()
    );

    return public.get_marketplace_event_receipt(v_event_id, 'DUPLICATE');
  end if;

  insert into public.marketplace_event_attempts (
    marketplace_event_id,
    attempt_no,
    processing_status,
    payload_hash
  )
  values (
    v_event_id,
    1,
    'RECEIVED',
    v_payload_hash
  )
  returning id into v_attempt_id;

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
    'INGEST_MARKETPLACE_EVENT',
    'marketplace:' || encode(
      extensions.digest(
        lower(p_source::text) || ':' || trim(p_external_event_id),
        'sha256'
      ),
      'hex'
    ),
    v_payload_hash,
    'PROCESSING',
    v_actor_id,
    'MARKETPLACE_EVENT',
    v_event_id::text
  )
  returning id into v_command_id;

  update public.marketplace_events
  set business_command_id = v_command_id
  where id = v_event_id;

  begin
    if p_event_type = 'ORDER_CREATED' then
      if jsonb_array_length(p_items) = 0 then
        raise exception using
          errcode = '22023',
          message = 'ORDER_ITEMS_REQUIRED';
      end if;

      insert into public.orders (
        external_order_id,
        channel,
        status,
        created_event_id,
        last_event_id,
        ordered_at
      )
      values (
        trim(p_external_order_id),
        p_channel,
        'RESERVED',
        v_event_id,
        v_event_id,
        coalesce(p_occurred_at, now())
      )
      returning id into v_order_id;

      for v_item_value in
        select value
        from jsonb_array_elements(p_items)
      loop
        if coalesce(v_item_value ->> 'external_line_id', '') = ''
           or coalesce(v_item_value ->> 'listing_sku', '') = ''
           or jsonb_typeof(v_item_value -> 'quantity') <> 'number' then
          raise exception using
            errcode = '22023',
            message = 'INVALID_ORDER_ITEM';
        end if;

        v_qty := (v_item_value ->> 'quantity')::bigint;

        if v_qty <= 0 then
          raise exception using
            errcode = '22023',
            message = 'ORDER_ITEM_QTY_MUST_BE_POSITIVE';
        end if;

        select listing.*
        into v_listing
        from public.marketplace_listings as listing
        where listing.channel = p_channel
          and upper(listing.listing_sku) =
            upper(trim(v_item_value ->> 'listing_sku'))
          and listing.is_active
        for share;

        if v_listing.id is null then
          raise exception using
            errcode = 'P0002',
            message = 'ACTIVE_MARKETPLACE_LISTING_NOT_FOUND',
            detail = trim(v_item_value ->> 'listing_sku');
        end if;

        insert into public.order_items (
          order_id,
          external_line_id,
          listing_sku,
          listing_type,
          ordered_qty,
          reserved_qty
        )
        values (
          v_order_id,
          trim(v_item_value ->> 'external_line_id'),
          upper(trim(v_item_value ->> 'listing_sku')),
          v_listing.listing_type,
          v_qty,
          v_qty
        )
        returning id into v_item_id;

        if v_listing.listing_type = 'PHYSICAL' then
          insert into public.order_item_components (
            order_item_id,
            product_id,
            component_type,
            qty_per_item,
            ordered_component_qty,
            reserved_qty,
            snapshot
          )
          select
            v_item_id,
            product.id,
            'PRIMARY',
            1,
            v_qty,
            v_qty,
            jsonb_build_object(
              'listing_id', v_listing.id,
              'listing_sku', v_listing.listing_sku,
              'product_sku', product.sku,
              'product_name', product.name
            )
          from public.products as product
          where product.id = v_listing.product_id
            and product.is_active;

          if not found then
            raise exception using
              errcode = 'P0002',
              message = 'ACTIVE_LISTING_PRODUCT_NOT_FOUND';
          end if;

          for v_promo in
            select
              rule.id as rule_id,
              rule.name as rule_name,
              item.trigger_qty,
              item.free_product_id,
              item.free_qty,
              product.sku as free_product_sku,
              product.name as free_product_name
            from public.promo_rules as rule
            join public.promo_rule_items as item
              on item.promo_rule_id = rule.id
            join public.products as product
              on product.id = item.free_product_id
             and product.is_active
            where rule.channel = p_channel
              and rule.is_active
              and coalesce(p_occurred_at, now()) >= rule.start_at
              and coalesce(p_occurred_at, now()) < rule.end_at
              and item.trigger_product_id = v_listing.product_id
              and v_qty >= item.trigger_qty
            order by rule.created_at, rule.id
          loop
            v_total_component_qty :=
              (v_qty / v_promo.trigger_qty) * v_promo.free_qty;

            if v_total_component_qty > 0 then
              insert into public.order_item_components (
                order_item_id,
                product_id,
                component_type,
                qty_per_item,
                ordered_component_qty,
                reserved_qty,
                promo_rule_id,
                snapshot
              )
              values (
                v_item_id,
                v_promo.free_product_id,
                'PROMO',
                v_total_component_qty::numeric / v_qty::numeric,
                v_total_component_qty,
                v_total_component_qty,
                v_promo.rule_id,
                jsonb_build_object(
                  'promo_rule_id', v_promo.rule_id,
                  'promo_name', v_promo.rule_name,
                  'trigger_qty', v_promo.trigger_qty,
                  'free_qty', v_promo.free_qty,
                  'free_product_sku', v_promo.free_product_sku,
                  'free_product_name', v_promo.free_product_name
                )
              );
            end if;
          end loop;
        else
          select recipe.id, recipe.version
          into v_recipe_id, v_recipe_version
          from public.bundle_recipe_versions as recipe
          where recipe.bundle_id = v_listing.bundle_id
            and recipe.effective_from <= coalesce(p_occurred_at, now())
          order by recipe.effective_from desc, recipe.version desc
          limit 1
          for share;

          if v_recipe_id is null then
            raise exception using
              errcode = 'P0002',
              message = 'ACTIVE_BUNDLE_RECIPE_NOT_FOUND';
          end if;

          for v_recipe_component in
            select
              component.product_id,
              component.qty,
              product.sku,
              product.name
            from public.bundle_recipe_components as component
            join public.products as product
              on product.id = component.product_id
             and product.is_active
            where component.recipe_version_id = v_recipe_id
            order by product.sku, component.id
          loop
            v_total_component_qty := v_recipe_component.qty * v_qty;

            insert into public.order_item_components (
              order_item_id,
              product_id,
              component_type,
              qty_per_item,
              ordered_component_qty,
              reserved_qty,
              recipe_version_id,
              snapshot
            )
            values (
              v_item_id,
              v_recipe_component.product_id,
              'BUNDLE_COMPONENT',
              v_recipe_component.qty,
              v_total_component_qty,
              v_total_component_qty,
              v_recipe_id,
              jsonb_build_object(
                'recipe_version_id', v_recipe_id,
                'recipe_version', v_recipe_version,
                'bundle_id', v_listing.bundle_id,
                'bundle_sku', v_listing.listing_sku,
                'product_sku', v_recipe_component.sku,
                'product_name', v_recipe_component.name
              )
            );
          end loop;

          if not found then
            raise exception using
              errcode = 'P0002',
              message = 'BUNDLE_RECIPE_COMPONENTS_NOT_FOUND';
          end if;
        end if;
      end loop;

      for v_product_total in
        select
          component.product_id,
          sum(component.reserved_qty)::bigint as qty
        from public.order_item_components as component
        join public.order_items as item on item.id = component.order_item_id
        where item.order_id = v_order_id
        group by component.product_id
        order by component.product_id
      loop
        insert into public.product_reservations (product_id, reserved_qty)
        values (v_product_total.product_id, 0)
        on conflict (product_id) do nothing;

        select reservation.reserved_qty
        into v_current_reserved
        from public.product_reservations as reservation
        where reservation.product_id = v_product_total.product_id
        for update;

        perform 1
        from public.stock_balances as balance
        where balance.product_id = v_product_total.product_id
        order by balance.batch_id
        for update;

        select coalesce(sum(balance.on_hand_qty), 0)::bigint
        into v_available_qty
        from public.stock_balances as balance
        where balance.product_id = v_product_total.product_id;

        if v_available_qty - v_current_reserved < v_product_total.qty then
          raise exception using
            errcode = 'P0001',
            message = 'INSUFFICIENT_AVAILABLE_STOCK',
            detail = format(
              'product_id=%s requested=%s available=%s',
              v_product_total.product_id,
              v_product_total.qty,
              v_available_qty - v_current_reserved
            );
        end if;

        update public.product_reservations
        set reserved_qty = reserved_qty + v_product_total.qty
        where product_id = v_product_total.product_id;
      end loop;
    elsif p_event_type = 'ORDER_SHIPPED' then
      select orders.*
      into v_order
      from public.orders
      where orders.channel = p_channel
        and orders.external_order_id = trim(p_external_order_id)
      for update;

      if v_order.id is null then
        raise exception using errcode = 'P0002', message = 'ORDER_NOT_FOUND';
      end if;

      if v_order.status not in ('RESERVED', 'PARTIALLY_CANCELLED') then
        raise exception using
          errcode = '22023',
          message = 'OUT_OF_ORDER_SHIPMENT_EVENT';
      end if;

      if not exists (
        select 1
        from public.order_items
        where order_id = v_order.id
          and reserved_qty > 0
      ) then
        raise exception using
          errcode = '22023',
          message = 'ORDER_HAS_NO_RESERVED_ITEMS';
      end if;

      for v_product_total in
        select
          component.product_id,
          sum(component.reserved_qty)::bigint as qty
        from public.order_item_components as component
        join public.order_items as item on item.id = component.order_item_id
        where item.order_id = v_order.id
          and component.reserved_qty > 0
        group by component.product_id
        order by component.product_id
      loop
        select reservation.reserved_qty
        into v_current_reserved
        from public.product_reservations as reservation
        where reservation.product_id = v_product_total.product_id
        for update;

        if v_current_reserved < v_product_total.qty then
          raise exception using
            errcode = '55000',
            message = 'RESERVATION_PROJECTION_DRIFT';
        end if;

        perform 1
        from public.stock_balances as balance
        where balance.product_id = v_product_total.product_id
        order by balance.batch_id
        for update;

        select coalesce(sum(balance.on_hand_qty), 0)::bigint
        into v_available_qty
        from public.stock_balances as balance
        where balance.product_id = v_product_total.product_id;

        if v_available_qty < v_product_total.qty then
          raise exception using
            errcode = 'P0001',
            message = 'INSUFFICIENT_STOCK';
        end if;

        update public.product_reservations
        set reserved_qty = reserved_qty - v_product_total.qty
        where product_id = v_product_total.product_id;
      end loop;

      insert into public.movement_groups (
        business_command_id,
        group_type,
        source_type,
        source_id
      )
      values (
        v_command_id,
        'MARKETPLACE_SHIPMENT',
        'MARKETPLACE_EVENT',
        v_event_id::text
      )
      returning id into v_group_id;

      for v_component in
        select component.*
        from public.order_item_components as component
        join public.order_items as item on item.id = component.order_item_id
        where item.order_id = v_order.id
          and component.reserved_qty > 0
        order by component.product_id, component.id
        for update of component
      loop
        v_remaining_qty := v_component.reserved_qty;

        for v_batch in
          select
            batch.id as batch_id,
            balance.on_hand_qty
          from public.stock_balances as balance
          join public.batches as batch
            on batch.id = balance.batch_id
           and batch.product_id = balance.product_id
          where balance.product_id = v_component.product_id
            and balance.on_hand_qty > 0
          order by batch.expiry_date, batch.created_at, batch.id
          for update of balance
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
            v_component.product_id,
            v_batch.batch_id,
            -v_allocated_qty,
            'ONLINE_SALE',
            p_channel,
            'MARKETPLACE_ORDER_ITEM_COMPONENT',
            v_component.id::text,
            trim(p_external_order_id),
            v_actor_id,
            'ship:' || v_component.id::text || ':' || v_batch.batch_id::text,
            coalesce(p_occurred_at, now())
          );

          v_remaining_qty := v_remaining_qty - v_allocated_qty;
        end loop;

        if v_remaining_qty <> 0 then
          raise exception using
            errcode = '55000',
            message = 'FEFO_ALLOCATION_INCOMPLETE';
        end if;

        update public.order_item_components
        set
          shipped_qty = shipped_qty + reserved_qty,
          reserved_qty = 0
        where id = v_component.id;
      end loop;

      update public.order_items
      set
        shipped_qty = shipped_qty + reserved_qty,
        reserved_qty = 0
      where order_id = v_order.id;

      update public.orders
      set
        status = case
          when p_channel = 'SHOPEE' then 'SHIPPED'::public.marketplace_order_status
          else 'IN_TRANSIT'::public.marketplace_order_status
        end,
        shipped_at = coalesce(p_occurred_at, now()),
        last_event_id = v_event_id
      where id = v_order.id;
    elsif p_event_type = 'ORDER_CANCELLED' then
      if jsonb_array_length(p_items) = 0 then
        raise exception using
          errcode = '22023',
          message = 'CANCELLATION_ITEMS_REQUIRED';
      end if;

      select orders.*
      into v_order
      from public.orders
      where orders.channel = p_channel
        and orders.external_order_id = trim(p_external_order_id)
      for update;

      if v_order.id is null then
        raise exception using errcode = 'P0002', message = 'ORDER_NOT_FOUND';
      end if;

      if v_order.status = 'CANCELLED' then
        raise exception using
          errcode = '22023',
          message = 'ORDER_ALREADY_CANCELLED';
      end if;

      for v_item_value in
        select value
        from jsonb_array_elements(p_items)
      loop
        if coalesce(v_item_value ->> 'external_line_id', '') = ''
           or jsonb_typeof(v_item_value -> 'quantity') <> 'number' then
          raise exception using
            errcode = '22023',
            message = 'INVALID_CANCELLATION_ITEM';
        end if;

        v_cancel_qty := (v_item_value ->> 'quantity')::bigint;

        if v_cancel_qty <= 0 then
          raise exception using
            errcode = '22023',
            message = 'CANCELLATION_QTY_MUST_BE_POSITIVE';
        end if;

        select item.*
        into v_item
        from public.order_items as item
        where item.order_id = v_order.id
          and item.external_line_id =
            trim(v_item_value ->> 'external_line_id')
        for update;

        if v_item.id is null then
          raise exception using
            errcode = 'P0002',
            message = 'ORDER_ITEM_NOT_FOUND';
        end if;

        if v_cancel_qty > v_item.ordered_qty - v_item.cancelled_qty then
          raise exception using
            errcode = '22023',
            message = 'CANCELLATION_EXCEEDS_ORDERED_QTY';
        end if;

        v_new_item_cancelled := v_item.cancelled_qty + v_cancel_qty;

        for v_component in
          select component.*
          from public.order_item_components as component
          where component.order_item_id = v_item.id
          order by component.product_id, component.id
          for update
        loop
          if v_new_item_cancelled = v_item.ordered_qty then
            v_target_component_cancelled :=
              v_component.ordered_component_qty;
          else
            v_target_component_cancelled := floor(
              v_component.ordered_component_qty::numeric
              * v_new_item_cancelled::numeric
              / v_item.ordered_qty::numeric
            )::bigint;
          end if;

          v_component_cancel_qty :=
            v_target_component_cancelled - v_component.cancelled_qty;

          if v_component_cancel_qty < 0 then
            raise exception using
              errcode = '55000',
              message = 'COMPONENT_CANCELLATION_DRIFT';
          end if;

          v_reserved_cancel_qty :=
            least(v_component.reserved_qty, v_component_cancel_qty);
          v_physical_cancel_qty :=
            v_component_cancel_qty - v_reserved_cancel_qty;

          if v_reserved_cancel_qty > 0 then
            select reservation.reserved_qty
            into v_current_reserved
            from public.product_reservations as reservation
            where reservation.product_id = v_component.product_id
            for update;

            if v_current_reserved < v_reserved_cancel_qty then
              raise exception using
                errcode = '55000',
                message = 'RESERVATION_PROJECTION_DRIFT';
            end if;

            update public.product_reservations
            set reserved_qty = reserved_qty - v_reserved_cancel_qty
            where product_id = v_component.product_id;
          end if;

          if v_physical_cancel_qty > 0 then
            if v_group_id is null then
              select ledger.movement_group_id
              into v_original_group_id
              from public.stock_ledger as ledger
              join public.order_item_components as source_component
                on source_component.id::text = ledger.source_id
              join public.order_items as source_item
                on source_item.id = source_component.order_item_id
              where source_item.order_id = v_order.id
                and ledger.source_type = 'MARKETPLACE_ORDER_ITEM_COMPONENT'
                and ledger.qty_delta < 0
              order by ledger.sequence_no
              limit 1;

              if v_original_group_id is null then
                raise exception using
                  errcode = '55000',
                  message = 'SHIPMENT_MOVEMENTS_NOT_FOUND';
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
                'MARKETPLACE_CANCELLATION',
                'MARKETPLACE_EVENT',
                v_event_id::text,
                v_original_group_id
              )
              returning id into v_group_id;
            end if;

            v_remaining_qty := v_physical_cancel_qty;

            for v_movement in
              select ledger.*
              from public.stock_ledger as ledger
              where ledger.source_type = 'MARKETPLACE_ORDER_ITEM_COMPONENT'
                and ledger.source_id = v_component.id::text
                and ledger.qty_delta < 0
                and not exists (
                  select 1
                  from public.stock_ledger as reversal
                  where reversal.reverses_movement_id = ledger.id
                )
              order by abs(ledger.qty_delta), ledger.sequence_no
              for update
            loop
              exit when v_remaining_qty = 0;
              v_allocated_qty :=
                least(abs(v_movement.qty_delta), v_remaining_qty);

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
                v_movement.product_id,
                v_movement.batch_id,
                abs(v_movement.qty_delta),
                'CANCELLATION_REVERSAL',
                p_channel,
                'MARKETPLACE_CANCELLATION',
                v_event_id::text,
                trim(p_external_order_id),
                v_movement.id,
                v_actor_id,
                'cancel:' || v_movement.id::text,
                coalesce(p_occurred_at, now())
              )
              returning id into v_reversal_id;

              v_residual_id := null;

              if v_allocated_qty < abs(v_movement.qty_delta) then
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
                  v_movement.product_id,
                  v_movement.batch_id,
                  -(abs(v_movement.qty_delta) - v_allocated_qty),
                  'ONLINE_SALE',
                  p_channel,
                  'MARKETPLACE_ORDER_ITEM_COMPONENT',
                  v_component.id::text,
                  trim(p_external_order_id),
                  v_actor_id,
                  'cancel-residual:' || v_movement.id::text,
                  coalesce(p_occurred_at, now())
                )
                returning id into v_residual_id;
              end if;

              insert into public.marketplace_cancellation_allocations (
                marketplace_event_id,
                order_item_component_id,
                original_movement_id,
                reversal_movement_id,
                residual_movement_id,
                qty
              )
              values (
                v_event_id,
                v_component.id,
                v_movement.id,
                v_reversal_id,
                v_residual_id,
                v_allocated_qty
              );

              v_remaining_qty := v_remaining_qty - v_allocated_qty;
            end loop;

            if v_remaining_qty <> 0 then
              raise exception using
                errcode = '55000',
                message = 'CANCELLATION_MOVEMENT_ALLOCATION_INCOMPLETE';
            end if;
          end if;

          update public.order_item_components
          set
            reserved_qty = reserved_qty - v_reserved_cancel_qty,
            cancelled_qty = cancelled_qty + v_component_cancel_qty
          where id = v_component.id;
        end loop;

        update public.order_items
        set
          reserved_qty = greatest(reserved_qty - v_cancel_qty, 0),
          cancelled_qty = cancelled_qty + v_cancel_qty
        where id = v_item.id;
      end loop;

      update public.orders
      set
        status = case
          when (
            select sum(item.cancelled_qty) = sum(item.ordered_qty)
            from public.order_items as item
            where item.order_id = v_order.id
          ) then 'CANCELLED'::public.marketplace_order_status
          else 'PARTIALLY_CANCELLED'::public.marketplace_order_status
        end,
        cancelled_at = coalesce(p_occurred_at, now()),
        last_event_id = v_event_id
      where id = v_order.id;
    end if;

    update public.business_commands
    set
      status = 'APPLIED',
      completed_at = now()
    where id = v_command_id;

    update public.marketplace_events
    set
      processing_status = 'APPLIED',
      processed_at = now(),
      error_code = null,
      error_message = null
    where id = v_event_id;

    update public.marketplace_event_attempts
    set
      processing_status = 'APPLIED',
      processed_at = now()
    where id = v_attempt_id;
  exception
    when others then
      get stacked diagnostics v_error_message = message_text;

      update public.business_commands
      set
        status = 'REJECTED',
        error_code = v_error_message,
        error_message = v_error_message,
        completed_at = now()
      where id = v_command_id;

      update public.marketplace_events
      set
        processing_status = 'REJECTED',
        processed_at = now(),
        error_code = v_error_message,
        error_message = v_error_message
      where id = v_event_id;

      update public.marketplace_event_attempts
      set
        processing_status = 'REJECTED',
        error_code = v_error_message,
        error_message = v_error_message,
        processed_at = now()
      where id = v_attempt_id;
  end;

  return public.get_marketplace_event_receipt(v_event_id);
end;
$$;

create or replace function public.ingest_marketplace_event_batch(
  p_events jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_event jsonb;
  v_result jsonb := '[]'::jsonb;
  v_row_result jsonb;
begin
  perform public.assert_admin();

  if jsonb_typeof(p_events) <> 'array'
     or jsonb_array_length(p_events) = 0 then
    raise exception using
      errcode = '22023',
      message = 'EVENT_BATCH_REQUIRED';
  end if;

  if jsonb_array_length(p_events) > 250 then
    raise exception using
      errcode = '22023',
      message = 'EVENT_BATCH_TOO_LARGE';
  end if;

  for v_event in
    select value
    from jsonb_array_elements(p_events)
  loop
    begin
      v_row_result := public.ingest_marketplace_event(
        (v_event ->> 'source')::public.marketplace_event_source,
        v_event ->> 'external_event_id',
        (v_event ->> 'channel')::public.stock_channel,
        (v_event ->> 'event_type')::public.marketplace_event_type,
        v_event ->> 'external_order_id',
        coalesce(v_event -> 'items', '[]'::jsonb),
        coalesce((v_event ->> 'occurred_at')::timestamptz, now()),
        coalesce(v_event -> 'raw_payload', v_event)
      );
    exception
      when others then
        v_row_result := jsonb_build_object(
          'outcome', 'REJECTED',
          'event', jsonb_build_object(
            'external_event_id', v_event ->> 'external_event_id',
            'external_order_id', v_event ->> 'external_order_id'
          ),
          'error', jsonb_build_object(
            'code', sqlstate,
            'message', sqlerrm
          )
        );
    end;

    v_result := v_result || jsonb_build_array(v_row_result);
  end loop;

  return v_result;
end;
$$;

create or replace function public.ship_order(
  p_external_event_id text,
  p_channel public.stock_channel,
  p_external_order_id text,
  p_occurred_at timestamptz default now()
)
returns jsonb
language sql
security definer
set search_path = public, pg_temp
as $$
  select public.ingest_marketplace_event(
    'SIMULATOR',
    p_external_event_id,
    p_channel,
    'ORDER_SHIPPED',
    p_external_order_id,
    '[]'::jsonb,
    p_occurred_at,
    jsonb_build_object('adapter', 'SHIP_ORDER')
  );
$$;

create or replace function public.cancel_order_items(
  p_external_event_id text,
  p_channel public.stock_channel,
  p_external_order_id text,
  p_items jsonb,
  p_occurred_at timestamptz default now()
)
returns jsonb
language sql
security definer
set search_path = public, pg_temp
as $$
  select public.ingest_marketplace_event(
    'SIMULATOR',
    p_external_event_id,
    p_channel,
    'ORDER_CANCELLED',
    p_external_order_id,
    p_items,
    p_occurred_at,
    jsonb_build_object('adapter', 'CANCEL_ORDER_ITEMS')
  );
$$;

alter table public.bundles enable row level security;
alter table public.bundle_recipe_versions enable row level security;
alter table public.bundle_recipe_components enable row level security;
alter table public.promo_rules enable row level security;
alter table public.promo_rule_items enable row level security;
alter table public.marketplace_listings enable row level security;
alter table public.marketplace_events enable row level security;
alter table public.marketplace_event_attempts enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.order_item_components enable row level security;
alter table public.product_reservations enable row level security;
alter table public.marketplace_cancellation_allocations enable row level security;

create policy bundles_admin_select
on public.bundles for select
to authenticated
using (public.is_admin());

create policy bundle_recipe_versions_admin_select
on public.bundle_recipe_versions for select
to authenticated
using (public.is_admin());

create policy bundle_recipe_components_admin_select
on public.bundle_recipe_components for select
to authenticated
using (public.is_admin());

create policy promo_rules_admin_select
on public.promo_rules for select
to authenticated
using (public.is_admin());

create policy promo_rule_items_admin_select
on public.promo_rule_items for select
to authenticated
using (public.is_admin());

create policy marketplace_listings_admin_select
on public.marketplace_listings for select
to authenticated
using (public.is_admin());

create policy marketplace_events_admin_select
on public.marketplace_events for select
to authenticated
using (public.is_admin());

create policy marketplace_event_attempts_admin_select
on public.marketplace_event_attempts for select
to authenticated
using (public.is_admin());

create policy orders_admin_select
on public.orders for select
to authenticated
using (public.is_admin());

create policy order_items_admin_select
on public.order_items for select
to authenticated
using (public.is_admin());

create policy order_item_components_admin_select
on public.order_item_components for select
to authenticated
using (public.is_admin());

create policy product_reservations_admin_select
on public.product_reservations for select
to authenticated
using (public.is_admin());

create policy marketplace_cancellation_allocations_admin_select
on public.marketplace_cancellation_allocations for select
to authenticated
using (public.is_admin());

revoke all on table public.bundles from anon, authenticated;
revoke all on table public.bundle_recipe_versions from anon, authenticated;
revoke all on table public.bundle_recipe_components from anon, authenticated;
revoke all on table public.promo_rules from anon, authenticated;
revoke all on table public.promo_rule_items from anon, authenticated;
revoke all on table public.marketplace_listings from anon, authenticated;
revoke all on table public.marketplace_events from anon, authenticated;
revoke all on table public.marketplace_event_attempts from anon, authenticated;
revoke all on table public.orders from anon, authenticated;
revoke all on table public.order_items from anon, authenticated;
revoke all on table public.order_item_components from anon, authenticated;
revoke all on table public.product_reservations from anon, authenticated;
revoke all on table public.marketplace_cancellation_allocations
  from anon, authenticated;

grant select on table public.bundles to authenticated;
grant select on table public.bundle_recipe_versions to authenticated;
grant select on table public.bundle_recipe_components to authenticated;
grant select on table public.promo_rules to authenticated;
grant select on table public.promo_rule_items to authenticated;
grant select on table public.marketplace_listings to authenticated;
grant select on table public.marketplace_events to authenticated;
grant select on table public.marketplace_event_attempts to authenticated;
grant select on table public.orders to authenticated;
grant select on table public.order_items to authenticated;
grant select on table public.order_item_components to authenticated;
grant select on table public.product_reservations to authenticated;
grant select on table public.marketplace_cancellation_allocations
  to authenticated;

grant select on table public.bundles to service_role;
grant select on table public.bundle_recipe_versions to service_role;
grant select on table public.bundle_recipe_components to service_role;
grant select on table public.promo_rules to service_role;
grant select on table public.promo_rule_items to service_role;
grant select on table public.marketplace_listings to service_role;
grant select on table public.marketplace_events to service_role;
grant select on table public.marketplace_event_attempts to service_role;
grant select on table public.orders to service_role;
grant select on table public.order_items to service_role;
grant select on table public.order_item_components to service_role;
grant select on table public.product_reservations to service_role;
grant select on table public.marketplace_cancellation_allocations
  to service_role;

revoke execute on function public.ensure_product_reservation_covered()
  from public;
revoke execute on function public.get_marketplace_event_receipt(uuid, text)
  from public;
revoke execute on function public.save_bundle_recipe(
  text,
  text,
  jsonb,
  timestamptz
) from public;
revoke execute on function public.save_promo_rule(
  text,
  public.stock_channel,
  timestamptz,
  timestamptz,
  uuid,
  bigint,
  uuid,
  bigint
) from public;
revoke execute on function public.ingest_marketplace_event(
  public.marketplace_event_source,
  text,
  public.stock_channel,
  public.marketplace_event_type,
  text,
  jsonb,
  timestamptz,
  jsonb
) from public;
revoke execute on function public.ingest_marketplace_event_batch(jsonb)
  from public;
revoke execute on function public.ship_order(
  text,
  public.stock_channel,
  text,
  timestamptz
) from public;
revoke execute on function public.cancel_order_items(
  text,
  public.stock_channel,
  text,
  jsonb,
  timestamptz
) from public;

grant execute on function public.get_marketplace_event_receipt(uuid, text)
  to authenticated;
grant execute on function public.save_bundle_recipe(
  text,
  text,
  jsonb,
  timestamptz
) to authenticated;
grant execute on function public.save_promo_rule(
  text,
  public.stock_channel,
  timestamptz,
  timestamptz,
  uuid,
  bigint,
  uuid,
  bigint
) to authenticated;
grant execute on function public.ingest_marketplace_event(
  public.marketplace_event_source,
  text,
  public.stock_channel,
  public.marketplace_event_type,
  text,
  jsonb,
  timestamptz,
  jsonb
) to authenticated;
grant execute on function public.ingest_marketplace_event_batch(jsonb)
  to authenticated;
grant execute on function public.ship_order(
  text,
  public.stock_channel,
  text,
  timestamptz
) to authenticated;
grant execute on function public.cancel_order_items(
  text,
  public.stock_channel,
  text,
  jsonb,
  timestamptz
) to authenticated;

update public.system_settings
set schema_version = 3;

commit;

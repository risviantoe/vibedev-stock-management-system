create index if not exists products_active_sku_retrieval_idx
  on public.products (is_active, sku, id);

create index if not exists products_updated_retrieval_idx
  on public.products (updated_at desc, id);

create index if not exists batches_expiry_product_retrieval_idx
  on public.batches (expiry_date, product_id, id);

create index if not exists stock_ledger_occurred_retrieval_idx
  on public.stock_ledger (occurred_at desc, sequence_no desc, id);

create index if not exists stock_ledger_reason_channel_retrieval_idx
  on public.stock_ledger (reason, channel, occurred_at desc, id);

create index if not exists orders_channel_status_updated_retrieval_idx
  on public.orders (channel, status, updated_at desc, id);

create index if not exists marketplace_events_channel_status_retrieval_idx
  on public.marketplace_events (
    channel,
    processing_status,
    received_at desc,
    id
  );

create or replace function public.search_inventory_products(
  p_search text default null,
  p_status text default 'ACTIVE',
  p_expiry text default 'ALL',
  p_sort text default 'SKU_ASC',
  p_page integer default 1,
  p_page_size integer default 25
)
returns table (
  product_id uuid,
  total_count bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  with product_metrics as (
    select
      product.id,
      product.sku,
      product.name,
      product.is_active,
      product.updated_at,
      coalesce(sum(balance.on_hand_qty), 0)::bigint as on_hand_qty,
      coalesce(reservation.reserved_qty, 0)::bigint as reserved_qty,
      (
        coalesce(sum(balance.on_hand_qty), 0)
        - coalesce(reservation.reserved_qty, 0)
      )::bigint as available_qty,
      min(batch.expiry_date) filter (
        where coalesce(balance.on_hand_qty, 0) > 0
      ) as nearest_expiry_date
    from public.products as product
    left join public.batches as batch
      on batch.product_id = product.id
    left join public.stock_balances as balance
      on balance.product_id = product.id
      and balance.batch_id = batch.id
    left join public.product_reservations as reservation
      on reservation.product_id = product.id
    group by
      product.id,
      product.sku,
      product.name,
      product.is_active,
      product.updated_at,
      reservation.reserved_qty
  ),
  filtered as (
    select metric.*
    from product_metrics as metric
    where
      (
        nullif(trim(p_search), '') is null
        or position(lower(trim(p_search)) in lower(metric.sku)) > 0
        or position(lower(trim(p_search)) in lower(metric.name)) > 0
      )
      and (
        p_status = 'ALL'
        or (p_status = 'ACTIVE' and metric.is_active)
        or (p_status = 'INACTIVE' and not metric.is_active)
      )
      and (
        p_expiry = 'ALL'
        or (
          p_expiry = 'EXPIRED'
          and metric.nearest_expiry_date < current_date
        )
        or (
          p_expiry = 'DAYS_30'
          and metric.nearest_expiry_date between current_date and current_date + 30
        )
        or (
          p_expiry = 'DAYS_90'
          and metric.nearest_expiry_date between current_date and current_date + 90
        )
      )
  )
  select
    filtered.id as product_id,
    count(*) over () as total_count
  from filtered
  order by
    case when p_sort = 'SKU_ASC' then lower(filtered.sku) end asc,
    case when p_sort = 'EXPIRY_ASC' then filtered.nearest_expiry_date end asc nulls last,
    case when p_sort = 'AVAILABLE_ASC' then filtered.available_qty end asc,
    case when p_sort = 'UPDATED_DESC' then filtered.updated_at end desc,
    filtered.id
  offset (greatest(p_page, 1) - 1) * least(greatest(p_page_size, 1), 100)
  limit least(greatest(p_page_size, 1), 100);
$$;

create or replace function public.search_stock_movements(
  p_search text default null,
  p_from date default null,
  p_to date default null,
  p_reason text default 'ALL',
  p_channel text default 'ALL',
  p_status text default 'ALL',
  p_sort text default 'OCCURRED_DESC',
  p_page integer default 1,
  p_page_size integer default 25
)
returns table (
  movement_id uuid,
  total_count bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  with movements as (
    select
      ledger.id,
      ledger.sequence_no,
      ledger.occurred_at,
      ledger.reason::text as reason,
      ledger.channel::text as channel,
      ledger.reference,
      ledger.source_id,
      product.sku as product_sku,
      batch.batch_code,
      command.source_id as command_source_id,
      command.idempotency_key,
      case
        when reversal.id is not null then 'REVERSED'
        when ledger.reverses_movement_id is not null then 'CORRECTION'
        else 'FINAL'
      end as correction_status
    from public.stock_ledger as ledger
    join public.products as product
      on product.id = ledger.product_id
    join public.batches as batch
      on batch.id = ledger.batch_id
    join public.movement_groups as movement_group
      on movement_group.id = ledger.movement_group_id
    join public.business_commands as command
      on command.id = movement_group.business_command_id
    left join public.stock_ledger as reversal
      on reversal.reverses_movement_id = ledger.id
  ),
  filtered as (
    select movement.*
    from movements as movement
    where
      (
        nullif(trim(p_search), '') is null
        or position(lower(trim(p_search)) in lower(movement.sequence_no::text)) > 0
        or position(lower(trim(p_search)) in lower(movement.product_sku)) > 0
        or position(lower(trim(p_search)) in lower(movement.batch_code)) > 0
        or position(lower(trim(p_search)) in lower(coalesce(movement.reference, ''))) > 0
        or position(lower(trim(p_search)) in lower(movement.source_id)) > 0
        or position(lower(trim(p_search)) in lower(coalesce(movement.command_source_id, ''))) > 0
        or position(lower(trim(p_search)) in lower(movement.idempotency_key)) > 0
      )
      and (p_from is null or movement.occurred_at >= p_from::timestamptz)
      and (p_to is null or movement.occurred_at < (p_to + 1)::timestamptz)
      and (p_reason = 'ALL' or movement.reason = p_reason)
      and (p_channel = 'ALL' or movement.channel = p_channel)
      and (p_status = 'ALL' or movement.correction_status = p_status)
  )
  select
    filtered.id as movement_id,
    count(*) over () as total_count
  from filtered
  order by
    case when p_sort = 'OCCURRED_ASC' then filtered.occurred_at end asc,
    case when p_sort <> 'OCCURRED_ASC' then filtered.occurred_at end desc,
    case when p_sort = 'OCCURRED_ASC' then filtered.sequence_no end asc,
    case when p_sort <> 'OCCURRED_ASC' then filtered.sequence_no end desc,
    filtered.id
  offset (greatest(p_page, 1) - 1) * least(greatest(p_page_size, 1), 100)
  limit least(greatest(p_page_size, 1), 100);
$$;

create or replace function public.search_marketplace_orders(
  p_search text default null,
  p_channel text default 'ALL',
  p_status text default 'ALL',
  p_sort text default 'UPDATED_DESC',
  p_page integer default 1,
  p_page_size integer default 25
)
returns table (
  order_id uuid,
  total_count bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  with filtered as (
    select marketplace_order.*
    from public.orders as marketplace_order
    where
      (
        nullif(trim(p_search), '') is null
        or position(
          lower(trim(p_search))
          in lower(marketplace_order.external_order_id)
        ) > 0
        or exists (
          select 1
          from public.order_items as order_item
          where order_item.order_id = marketplace_order.id
            and position(
              lower(trim(p_search))
              in lower(order_item.listing_sku)
            ) > 0
        )
      )
      and (p_channel = 'ALL' or marketplace_order.channel::text = p_channel)
      and (p_status = 'ALL' or marketplace_order.status::text = p_status)
  )
  select
    filtered.id as order_id,
    count(*) over () as total_count
  from filtered
  order by
    case when p_sort = 'ORDERED_DESC' then filtered.ordered_at end desc,
    case when p_sort <> 'ORDERED_DESC' then filtered.updated_at end desc,
    filtered.id
  offset (greatest(p_page, 1) - 1) * least(greatest(p_page_size, 1), 100)
  limit least(greatest(p_page_size, 1), 100);
$$;

create or replace function public.search_marketplace_event_attempts(
  p_search text default null,
  p_channel text default 'ALL',
  p_status text default 'ALL',
  p_sort text default 'RECEIVED_DESC',
  p_page integer default 1,
  p_page_size integer default 25
)
returns table (
  attempt_id uuid,
  total_count bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  with filtered as (
    select
      attempt.id,
      attempt.received_at
    from public.marketplace_event_attempts as attempt
    join public.marketplace_events as event
      on event.id = attempt.marketplace_event_id
    where
      (
        nullif(trim(p_search), '') is null
        or position(lower(trim(p_search)) in lower(event.external_event_id)) > 0
        or position(lower(trim(p_search)) in lower(event.external_order_id)) > 0
      )
      and (p_channel = 'ALL' or event.channel::text = p_channel)
      and (p_status = 'ALL' or attempt.processing_status::text = p_status)
  )
  select
    filtered.id as attempt_id,
    count(*) over () as total_count
  from filtered
  order by
    case when p_sort = 'RECEIVED_ASC' then filtered.received_at end asc,
    case when p_sort <> 'RECEIVED_ASC' then filtered.received_at end desc,
    filtered.id
  offset (greatest(p_page, 1) - 1) * least(greatest(p_page_size, 1), 100)
  limit least(greatest(p_page_size, 1), 100);
$$;

revoke all on function public.search_inventory_products(
  text,
  text,
  text,
  text,
  integer,
  integer
) from public, anon;
revoke all on function public.search_stock_movements(
  text,
  date,
  date,
  text,
  text,
  text,
  text,
  integer,
  integer
) from public, anon;
revoke all on function public.search_marketplace_orders(
  text,
  text,
  text,
  text,
  integer,
  integer
) from public, anon;
revoke all on function public.search_marketplace_event_attempts(
  text,
  text,
  text,
  text,
  integer,
  integer
) from public, anon;

grant execute on function public.search_inventory_products(
  text,
  text,
  text,
  text,
  integer,
  integer
) to authenticated;
grant execute on function public.search_stock_movements(
  text,
  date,
  date,
  text,
  text,
  text,
  text,
  integer,
  integer
) to authenticated;
grant execute on function public.search_marketplace_orders(
  text,
  text,
  text,
  text,
  integer,
  integer
) to authenticated;
grant execute on function public.search_marketplace_event_attempts(
  text,
  text,
  text,
  text,
  integer,
  integer
) to authenticated;

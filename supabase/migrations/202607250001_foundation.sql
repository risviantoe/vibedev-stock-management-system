begin;

create extension if not exists pgcrypto with schema extensions;

create type public.app_role as enum ('ADMIN');
create type public.stock_channel as enum (
  'SHOPEE',
  'TIKTOK',
  'OFFLINE',
  'INTERNAL'
);
create type public.stock_reason as enum (
  'OPENING_BALANCE',
  'PRODUCTION_RECEIPT',
  'ONLINE_SALE',
  'OFFLINE_SALE',
  'BONUS',
  'PROMO',
  'SAMPLE',
  'DAMAGED',
  'EXPIRED',
  'SELLABLE_RETURN',
  'CANCELLATION_REVERSAL',
  'ENTRY_CORRECTION',
  'OPNAME_ADJUSTMENT'
);
create type public.batch_source_type as enum ('PRODUCTION', 'RETURN');
create type public.command_status as enum (
  'PROCESSING',
  'APPLIED',
  'REJECTED'
);
create type public.opening_verification_status as enum (
  'UNVERIFIED',
  'VERIFIED'
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete restrict,
  email text not null,
  display_name text,
  role public.app_role not null default 'ADMIN',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index profiles_email_unique
  on public.profiles (lower(email));

create table public.system_settings (
  id boolean primary key default true check (id),
  expiry_warning_days integer not null default 90
    check (expiry_warning_days between 1 and 730),
  demo_mode boolean not null default true,
  schema_version integer not null default 1 check (schema_version > 0),
  updated_at timestamptz not null default now()
);

create table public.products (
  id uuid primary key default extensions.gen_random_uuid(),
  sku text not null check (length(trim(sku)) between 1 and 80),
  name text not null check (length(trim(name)) between 1 and 180),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index products_sku_unique
  on public.products (upper(sku));

create table public.batches (
  id uuid primary key default extensions.gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete restrict,
  batch_code text not null
    check (length(trim(batch_code)) between 1 and 100),
  expiry_date date not null,
  source_type public.batch_source_type not null default 'PRODUCTION',
  created_at timestamptz not null default now(),
  unique (product_id, batch_code),
  unique (id, product_id)
);

create index batches_fefo_idx
  on public.batches (product_id, expiry_date, created_at, id);

create table public.business_commands (
  id uuid primary key default extensions.gen_random_uuid(),
  command_type text not null
    check (length(trim(command_type)) between 1 and 80),
  idempotency_key text not null unique
    check (length(trim(idempotency_key)) between 8 and 160),
  request_hash text not null check (request_hash ~ '^[a-f0-9]{64}$'),
  status public.command_status not null default 'PROCESSING',
  actor_id uuid not null references public.profiles (id) on delete restrict,
  source_type text,
  source_id text,
  error_code text,
  error_message text,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  check (
    (status = 'PROCESSING' and completed_at is null)
    or (status in ('APPLIED', 'REJECTED') and completed_at is not null)
  ),
  check (
    (status = 'REJECTED' and error_code is not null)
    or (status <> 'REJECTED')
  )
);

create index business_commands_actor_created_idx
  on public.business_commands (actor_id, created_at desc);

create table public.movement_groups (
  id uuid primary key default extensions.gen_random_uuid(),
  business_command_id uuid not null unique
    references public.business_commands (id) on delete restrict,
  group_type text not null
    check (length(trim(group_type)) between 1 and 80),
  source_type text,
  source_id text,
  reversal_group_id uuid
    references public.movement_groups (id) on delete restrict,
  created_at timestamptz not null default now(),
  check (reversal_group_id is null or reversal_group_id <> id)
);

create table public.stock_balances (
  product_id uuid not null references public.products (id) on delete restrict,
  batch_id uuid not null,
  on_hand_qty bigint not null default 0 check (on_hand_qty >= 0),
  updated_at timestamptz not null default now(),
  primary key (product_id, batch_id),
  foreign key (batch_id, product_id)
    references public.batches (id, product_id)
    on delete restrict
);

create index stock_balances_product_positive_idx
  on public.stock_balances (product_id, on_hand_qty)
  where on_hand_qty > 0;

create table public.stock_ledger (
  id uuid primary key default extensions.gen_random_uuid(),
  movement_group_id uuid not null
    references public.movement_groups (id) on delete restrict,
  product_id uuid not null references public.products (id) on delete restrict,
  batch_id uuid not null,
  qty_delta bigint not null check (qty_delta <> 0),
  reason public.stock_reason not null,
  channel public.stock_channel not null,
  source_type text not null
    check (length(trim(source_type)) between 1 and 80),
  source_id text not null
    check (length(trim(source_id)) between 1 and 180),
  reference text,
  reverses_movement_id uuid
    references public.stock_ledger (id) on delete restrict,
  actor_id uuid not null references public.profiles (id) on delete restrict,
  movement_key text not null
    check (length(trim(movement_key)) between 1 and 180),
  occurred_at timestamptz not null,
  created_at timestamptz not null default now(),
  foreign key (batch_id, product_id)
    references public.batches (id, product_id)
    on delete restrict,
  unique (movement_group_id, movement_key),
  check (reverses_movement_id is null or reverses_movement_id <> id)
);

create unique index stock_ledger_single_reversal_idx
  on public.stock_ledger (reverses_movement_id)
  where reverses_movement_id is not null;

create index stock_ledger_product_created_idx
  on public.stock_ledger (product_id, created_at desc, id);

create index stock_ledger_batch_created_idx
  on public.stock_ledger (batch_id, created_at, id);

create index stock_ledger_source_idx
  on public.stock_ledger (source_type, source_id);

create table public.opening_balances (
  id uuid primary key default extensions.gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete restrict,
  batch_id uuid not null unique,
  qty bigint not null check (qty > 0),
  verification_status public.opening_verification_status
    not null default 'UNVERIFIED',
  verified_by_opname_session_id uuid,
  created_at timestamptz not null default now(),
  verified_at timestamptz,
  foreign key (batch_id, product_id)
    references public.batches (id, product_id)
    on delete restrict,
  check (
    (
      verification_status = 'UNVERIFIED'
      and verified_by_opname_session_id is null
      and verified_at is null
    )
    or (
      verification_status = 'VERIFIED'
      and verified_by_opname_session_id is not null
      and verified_at is not null
    )
  )
);

comment on table public.stock_ledger is
  'Append-only source of truth for physical stock.';
comment on table public.stock_balances is
  'O(1) projection. Rebuildable from stock_ledger.';
comment on column public.business_commands.request_hash is
  'SHA-256 of canonical request payload bound to the idempotency key.';

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger products_set_updated_at
before update on public.products
for each row execute function public.set_updated_at();

create trigger settings_set_updated_at
before update on public.system_settings
for each row execute function public.set_updated_at();

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.profiles (id, email, display_name, role)
  values (
    new.id,
    coalesce(new.email, new.id::text || '@invalid.local'),
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)),
    'ADMIN'
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

create trigger auth_user_created_create_profile
after insert on auth.users
for each row execute function public.handle_new_auth_user();

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'ADMIN'
  );
$$;

create or replace function public.assert_admin()
returns void
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception using
      errcode = '42501',
      message = 'ADMIN_AUTH_REQUIRED';
  end if;
end;
$$;

create or replace function public.block_stock_ledger_mutation()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  raise exception using
    errcode = '55000',
    message = 'STOCK_LEDGER_IS_APPEND_ONLY';
end;
$$;

create trigger stock_ledger_block_update_delete
before update or delete on public.stock_ledger
for each row execute function public.block_stock_ledger_mutation();

create or replace function public.project_stock_ledger_insert()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_projected_qty bigint;
begin
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
  where public.stock_balances.on_hand_qty + excluded.on_hand_qty >= 0
  returning on_hand_qty into v_projected_qty;

  if v_projected_qty is null then
    raise exception using
      errcode = 'P0001',
      message = 'INSUFFICIENT_STOCK';
  end if;

  return new;
exception
  when check_violation then
    raise exception using
      errcode = 'P0001',
      message = 'INSUFFICIENT_STOCK';
end;
$$;

create trigger stock_ledger_update_projection
after insert on public.stock_ledger
for each row execute function public.project_stock_ledger_insert();

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
    'created_at', command.created_at,
    'completed_at', command.completed_at,
    'movements',
      coalesce(
        (
          select jsonb_agg(
            jsonb_build_object(
              'movement_id', ledger.id,
              'movement_key', ledger.movement_key,
              'product_id', ledger.product_id,
              'batch_id', ledger.batch_id,
              'qty_delta', ledger.qty_delta,
              'reason', ledger.reason,
              'channel', ledger.channel,
              'balance_after', balance.on_hand_qty,
              'reference', ledger.reference
            )
            order by ledger.created_at, ledger.id
          )
          from public.stock_ledger as ledger
          join public.stock_balances as balance
            on balance.product_id = ledger.product_id
           and balance.batch_id = ledger.batch_id
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
    and command.actor_id = auth.uid();
$$;

create or replace function public.record_opening_balance(
  p_idempotency_key text,
  p_product_id uuid,
  p_batch_id uuid,
  p_qty bigint,
  p_reference text default null,
  p_occurred_at timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_actor_id uuid := auth.uid();
  v_command_id uuid;
  v_existing_status public.command_status;
  v_existing_hash text;
  v_group_id uuid;
  v_opening_id uuid;
  v_request jsonb;
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

  v_request := jsonb_build_object(
    'batch_id', p_batch_id,
    'occurred_at', p_occurred_at,
    'product_id', p_product_id,
    'qty', p_qty,
    'reference', p_reference
  );
  v_request_hash := encode(
    extensions.digest(convert_to(v_request::text, 'UTF8'), 'sha256'),
    'hex'
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
    'RECORD_OPENING_BALANCE',
    trim(p_idempotency_key),
    v_request_hash,
    'PROCESSING',
    v_actor_id,
    'OPENING_BALANCE',
    p_batch_id::text
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
        'command_type', 'RECORD_OPENING_BALANCE',
        'movements', '[]'::jsonb,
        'error', jsonb_build_object(
          'code', 'IDEMPOTENCY_KEY_REUSED',
          'message', 'Idempotency key sudah dipakai oleh payload berbeda.'
        )
      );
    end if;

    if v_existing_status = 'APPLIED' then
      return public.get_movement_receipt(v_command_id, 'DUPLICATE');
    end if;

    return public.get_movement_receipt(v_command_id, 'REJECTED');
  end if;

  begin
    if p_qty is null or p_qty <= 0 then
      raise exception using
        errcode = '22023',
        message = 'OPENING_QTY_MUST_BE_POSITIVE';
    end if;

    perform 1
    from public.batches
    where id = p_batch_id
      and product_id = p_product_id
    for update;

    if not found then
      raise exception using
        errcode = '23503',
        message = 'BATCH_PRODUCT_MISMATCH';
    end if;

    insert into public.movement_groups (
      business_command_id,
      group_type,
      source_type,
      source_id
    )
    values (
      v_command_id,
      'OPENING_BALANCE',
      'BATCH',
      p_batch_id::text
    )
    returning id into v_group_id;

    insert into public.opening_balances (
      product_id,
      batch_id,
      qty,
      verification_status
    )
    values (
      p_product_id,
      p_batch_id,
      p_qty,
      'UNVERIFIED'
    )
    returning id into v_opening_id;

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
      p_batch_id,
      p_qty,
      'OPENING_BALANCE',
      'INTERNAL',
      'OPENING_BALANCE',
      v_opening_id::text,
      nullif(trim(p_reference), ''),
      v_actor_id,
      'opening:' || v_opening_id::text,
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

create or replace function public.verify_stock_projection()
returns table (
  product_id uuid,
  batch_id uuid,
  ledger_qty bigint,
  projected_qty bigint,
  difference_qty bigint
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.assert_admin();

  return query
  with ledger_totals as (
    select
      ledger.product_id,
      ledger.batch_id,
      sum(ledger.qty_delta)::bigint as qty
    from public.stock_ledger as ledger
    group by ledger.product_id, ledger.batch_id
  ),
  all_keys as (
    select totals.product_id, totals.batch_id from ledger_totals as totals
    union
    select balance.product_id, balance.batch_id from public.stock_balances as balance
  )
  select
    keys.product_id,
    keys.batch_id,
    coalesce(totals.qty, 0)::bigint as ledger_qty,
    coalesce(balance.on_hand_qty, 0)::bigint as projected_qty,
    (
      coalesce(totals.qty, 0) - coalesce(balance.on_hand_qty, 0)
    )::bigint as difference_qty
  from all_keys as keys
  left join ledger_totals as totals
    on totals.product_id = keys.product_id
   and totals.batch_id = keys.batch_id
  left join public.stock_balances as balance
    on balance.product_id = keys.product_id
   and balance.batch_id = keys.batch_id
  where coalesce(totals.qty, 0) <> coalesce(balance.on_hand_qty, 0)
  order by keys.product_id, keys.batch_id;
end;
$$;

create or replace function public.rebuild_stock_balances(
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_actor_id uuid := auth.uid();
  v_command_id uuid;
  v_existing_status public.command_status;
  v_existing_hash text;
  v_request_hash text;
  v_row_count bigint;
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

  v_request_hash := encode(
    extensions.digest(
      convert_to(
        jsonb_build_object('command', 'REBUILD_STOCK_BALANCES')::text,
        'UTF8'
      ),
      'sha256'
    ),
    'hex'
  );

  insert into public.business_commands (
    command_type,
    idempotency_key,
    request_hash,
    status,
    actor_id,
    source_type
  )
  values (
    'REBUILD_STOCK_BALANCES',
    trim(p_idempotency_key),
    v_request_hash,
    'PROCESSING',
    v_actor_id,
    'INTEGRITY'
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
        'command_type', 'REBUILD_STOCK_BALANCES',
        'movements', '[]'::jsonb,
        'error', jsonb_build_object(
          'code', 'IDEMPOTENCY_KEY_REUSED',
          'message', 'Idempotency key sudah dipakai oleh payload berbeda.'
        )
      );
    end if;

    return public.get_movement_receipt(
      v_command_id,
      case when v_existing_status = 'APPLIED' then 'DUPLICATE' else 'REJECTED' end
    );
  end if;

  begin
    lock table public.stock_ledger in share mode;
    lock table public.stock_balances in access exclusive mode;

    delete from public.stock_balances;

    insert into public.stock_balances (
      product_id,
      batch_id,
      on_hand_qty,
      updated_at
    )
    select
      ledger.product_id,
      ledger.batch_id,
      sum(ledger.qty_delta)::bigint,
      now()
    from public.stock_ledger as ledger
    group by ledger.product_id, ledger.batch_id
    having sum(ledger.qty_delta) >= 0;

    get diagnostics v_row_count = row_count;

    if exists (
      select 1
      from public.stock_ledger as ledger
      group by ledger.product_id, ledger.batch_id
      having sum(ledger.qty_delta) < 0
    ) then
      raise exception using
        errcode = '55000',
        message = 'NEGATIVE_LEDGER_TOTAL_DETECTED';
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

  return public.get_movement_receipt(v_command_id, 'APPLIED')
    || jsonb_build_object('rebuilt_balance_rows', v_row_count);
end;
$$;

insert into public.system_settings (
  id,
  expiry_warning_days,
  demo_mode,
  schema_version
)
values (true, 90, true, 1)
on conflict (id) do nothing;

alter table public.profiles enable row level security;
alter table public.system_settings enable row level security;
alter table public.products enable row level security;
alter table public.batches enable row level security;
alter table public.business_commands enable row level security;
alter table public.movement_groups enable row level security;
alter table public.stock_balances enable row level security;
alter table public.stock_ledger enable row level security;
alter table public.opening_balances enable row level security;

create policy profiles_admin_select
on public.profiles for select
to authenticated
using (public.is_admin());

create policy settings_admin_select
on public.system_settings for select
to authenticated
using (public.is_admin());

create policy products_admin_select
on public.products for select
to authenticated
using (public.is_admin());

create policy batches_admin_select
on public.batches for select
to authenticated
using (public.is_admin());

create policy commands_admin_select
on public.business_commands for select
to authenticated
using (public.is_admin());

create policy movement_groups_admin_select
on public.movement_groups for select
to authenticated
using (public.is_admin());

create policy balances_admin_select
on public.stock_balances for select
to authenticated
using (public.is_admin());

create policy ledger_admin_select
on public.stock_ledger for select
to authenticated
using (public.is_admin());

create policy opening_balances_admin_select
on public.opening_balances for select
to authenticated
using (public.is_admin());

revoke all on table public.profiles from anon, authenticated;
revoke all on table public.system_settings from anon, authenticated;
revoke all on table public.products from anon, authenticated;
revoke all on table public.batches from anon, authenticated;
revoke all on table public.business_commands from anon, authenticated;
revoke all on table public.movement_groups from anon, authenticated;
revoke all on table public.stock_balances from anon, authenticated;
revoke all on table public.stock_ledger from anon, authenticated;
revoke all on table public.opening_balances from anon, authenticated;

grant select on table public.profiles to authenticated;
grant select on table public.system_settings to authenticated;
grant select on table public.products to authenticated;
grant select on table public.batches to authenticated;
grant select on table public.business_commands to authenticated;
grant select on table public.movement_groups to authenticated;
grant select on table public.stock_balances to authenticated;
grant select on table public.stock_ledger to authenticated;
grant select on table public.opening_balances to authenticated;

revoke execute on function public.set_updated_at() from public;
revoke execute on function public.handle_new_auth_user() from public;
revoke execute on function public.is_admin() from public;
revoke execute on function public.assert_admin() from public;
revoke execute on function public.block_stock_ledger_mutation() from public;
revoke execute on function public.project_stock_ledger_insert() from public;
revoke execute on function public.get_movement_receipt(uuid, text) from public;
revoke execute on function public.record_opening_balance(
  text,
  uuid,
  uuid,
  bigint,
  text,
  timestamptz
) from public;
revoke execute on function public.verify_stock_projection() from public;
revoke execute on function public.rebuild_stock_balances(text) from public;

grant execute on function public.is_admin() to authenticated;
grant execute on function public.get_movement_receipt(uuid, text)
  to authenticated;
grant execute on function public.record_opening_balance(
  text,
  uuid,
  uuid,
  bigint,
  text,
  timestamptz
) to authenticated;
grant execute on function public.verify_stock_projection() to authenticated;
grant execute on function public.rebuild_stock_balances(text)
  to authenticated;

commit;

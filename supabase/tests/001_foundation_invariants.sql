-- Run after local migrations with:
--   supabase test db
--
-- These tests use a transaction and intentionally roll back all fixtures.

begin;

do $$
begin
  if not exists (
    select 1
    from pg_trigger
    where tgname = 'stock_ledger_block_update_delete'
      and not tgisinternal
  ) then
    raise exception 'Missing append-only ledger trigger';
  end if;

  if not exists (
    select 1
    from pg_trigger
    where tgname = 'stock_ledger_update_projection'
      and not tgisinternal
  ) then
    raise exception 'Missing ledger projection trigger';
  end if;

  if not exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and indexname = 'stock_ledger_single_reversal_idx'
  ) then
    raise exception 'Missing single-reversal invariant';
  end if;

  if exists (
    select 1
    from information_schema.role_table_grants
    where table_schema = 'public'
      and table_name = 'stock_ledger'
      and grantee in ('anon', 'authenticated')
      and privilege_type in ('INSERT', 'UPDATE', 'DELETE')
  ) then
    raise exception 'Application roles can mutate ledger directly';
  end if;

  if (
    select count(*)
    from unnest(enum_range(null::public.stock_reason))
  ) <> 13 then
    raise exception 'Unexpected stock_reason enum count';
  end if;
end;
$$;

rollback;

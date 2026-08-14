begin;

-- plpgsql_check cannot infer temporary tables created inside a function.
-- Private, write-blocked templates give the linter a shape to validate while
-- pg_temp tables with the same names continue to shadow them at runtime.
create schema if not exists integrity_templates;

revoke all on schema integrity_templates from public, anon, authenticated;

create table integrity_templates.integrity_challenge_events (
  external_event_id text primary key,
  applied_count integer not null default 1
);

create table integrity_templates.integrity_challenge_stock (
  scenario text not null,
  sku text not null,
  qty bigint not null check (qty >= 0),
  primary key (scenario, sku)
);

create table integrity_templates.integrity_challenge_movements (
  id integer primary key,
  scenario text not null,
  qty_delta bigint not null,
  reverses_id integer
);

create table integrity_templates.integrity_challenge_returns (
  id text primary key,
  shipped_qty bigint not null,
  returned_qty bigint not null
);

create table integrity_templates.integrity_challenge_ledger (
  scenario text not null,
  qty_delta bigint not null
);

create table integrity_templates.integrity_challenge_projection (
  scenario text primary key,
  qty bigint not null
);

create or replace function integrity_templates.block_template_dml()
returns trigger
language plpgsql
set search_path = pg_catalog, pg_temp
as $$
begin
  raise exception using
    errcode = '55000',
    message = 'INTEGRITY_TEMPLATE_IS_NOT_RUNTIME_STORAGE';
end;
$$;

create trigger integrity_challenge_events_block_dml
before insert or update or delete
on integrity_templates.integrity_challenge_events
for each row execute function integrity_templates.block_template_dml();

create trigger integrity_challenge_stock_block_dml
before insert or update or delete
on integrity_templates.integrity_challenge_stock
for each row execute function integrity_templates.block_template_dml();

create trigger integrity_challenge_movements_block_dml
before insert or update or delete
on integrity_templates.integrity_challenge_movements
for each row execute function integrity_templates.block_template_dml();

create trigger integrity_challenge_returns_block_dml
before insert or update or delete
on integrity_templates.integrity_challenge_returns
for each row execute function integrity_templates.block_template_dml();

create trigger integrity_challenge_ledger_block_dml
before insert or update or delete
on integrity_templates.integrity_challenge_ledger
for each row execute function integrity_templates.block_template_dml();

create trigger integrity_challenge_projection_block_dml
before insert or update or delete
on integrity_templates.integrity_challenge_projection
for each row execute function integrity_templates.block_template_dml();

alter function public.run_integrity_challenge()
  set search_path = pg_temp, public, integrity_templates;

commit;

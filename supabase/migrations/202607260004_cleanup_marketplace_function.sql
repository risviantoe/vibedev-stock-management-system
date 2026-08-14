begin;

-- The linked project received an earlier draft of this function containing
-- two unused declarations. Rebuild the installed definition without changing
-- its business logic. Fresh databases receive the already-clean definition
-- from 202607260001, so both replacements are harmless no-ops there.
do $cleanup$
declare
  v_definition text;
  v_function regprocedure :=
    'public.ingest_marketplace_event(public.marketplace_event_source,text,public.stock_channel,public.marketplace_event_type,text,jsonb,timestamptz,jsonb)'::regprocedure;
begin
  select pg_get_functiondef(v_function::oid)
  into v_definition;

  v_definition := regexp_replace(
    v_definition,
    E'get stacked diagnostics[[:space:]]+v_error_code = returned_sqlstate,[[:space:]]+v_error_message = message_text;',
    'get stacked diagnostics v_error_message = message_text;',
    'g'
  );
  v_definition := regexp_replace(
    v_definition,
    E'\n[[:space:]]*v_product_id uuid;[[:space:]]*\n',
    E'\n',
    'g'
  );
  v_definition := regexp_replace(
    v_definition,
    E'\n[[:space:]]*v_error_code text;[[:space:]]*\n',
    E'\n',
    'g'
  );

  execute v_definition;
end;
$cleanup$;

commit;

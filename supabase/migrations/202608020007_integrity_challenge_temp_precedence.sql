begin;

-- The private templates satisfy static analysis. At runtime the challenge's
-- own pg_temp fixtures must take precedence over those write-blocked shapes.
-- Main operational relations in the function are explicitly public-qualified.
alter function public.run_integrity_challenge()
  set search_path = pg_temp, public, integrity_templates;

commit;

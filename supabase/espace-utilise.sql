-- Accueil 2.17 : espace utilise sur Supabase (reserve au concepteur). A coller une fois dans SQL Editor > Run.
-- Sans ce script, le bloc « Espace utilisé » reste simplement cache.
create or replace function public.espace_utilise() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare stock bigint := 0; calc bigint := 0;
begin
  if not public.is_concepteur() then raise exception 'Reserve au concepteur'; end if;
  begin
    select coalesce(sum((metadata ->> 'size')::bigint), 0) into stock from storage.objects;
  exception when others then stock := 0;
  end;
  begin
    execute 'select coalesce(sum(pg_column_size(donnees)), 0) from public.calculs' into calc;
  exception when others then calc := 0;
  end;
  return jsonb_build_object('base', pg_database_size(current_database()), 'stockage', stock, 'calculs', calc);
end $$;
revoke all on function public.espace_utilise() from public;
grant execute on function public.espace_utilise() to authenticated;

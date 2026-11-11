-- Accueil 2.26 : sauvegarde complete des donnees (reservee au concepteur). A coller une fois dans SQL Editor > Run.
-- Renvoie toutes les tables du schema public + la liste des comptes (sans mots de passe) en un seul fichier JSON.
create or replace function public.export_complet() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare t record; lignes jsonb; res jsonb := '{}'::jsonb; comptes jsonb;
begin
  if not public.is_concepteur() then raise exception 'Reserve au concepteur'; end if;
  for t in select table_name from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE' order by table_name loop
    execute format('select coalesce(jsonb_agg(to_jsonb(x)), ''[]''::jsonb) from public.%I x', t.table_name) into lignes;
    res := res || jsonb_build_object(t.table_name, lignes);
  end loop;
  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'email', email, 'created_at', created_at, 'meta', raw_user_meta_data)), '[]'::jsonb) into comptes from auth.users;
  return jsonb_build_object('date', now(), 'tables', res, 'comptes', comptes);
end $$;
revoke all on function public.export_complet() from public;
grant execute on function public.export_complet() to authenticated;
